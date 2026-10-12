(() => {
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const categories = ['websites', 'eagler', 'movies'];
  let entries = [];
  let toastTimeout;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function render() {
    const rows = entries.map((entry, index) => `
      <article class="manage-entry">
        <div class="manage-top">
          <div class="manage-entry-copy">
            <strong>${index + 1}. ${escapeHtml(entry.name)}</strong>
            <div class="manage-entry-links">${(entry.links || []).map((url) => `<span>${escapeHtml(url)}</span>`).join(' <span aria-hidden="true">&middot;</span> ') || '<span>No links added</span>'}</div>
            <span class="entry-category">${escapeHtml(entry.category || 'websites')}</span>
          </div>
          <div class="manage-actions">
            <button class="small-button remove" type="button" data-delete="${escapeHtml(entry.id)}" aria-label="Delete entry">Delete</button>
          </div>
        </div>
      </article>`).join('');

    app.innerHTML = `
      <div class="staff-heading">
        <div><p class="eyebrow">Staff tools</p><h1>Bob.</h1><p class="intro">Create named link entries and organize them by category.</p></div>
        <div class="staff-nav"><a class="back-link" href="/home.html">Public page</a></div>
      </div>
      <div class="staff-grid">
        <section aria-labelledby="add-title">
          <h2 class="section-title" id="add-title">Add entries</h2>
          <form class="add-form" id="add-form">
            <div class="field"><label for="new-name">Entry name</label><input id="new-name" name="name" type="text" maxlength="200" placeholder="Daily link" required></div>
            <div class="field"><label for="new-links">Links</label><textarea id="new-links" name="links" placeholder="Paste links here, one per line" required></textarea><small>All links stay together under this entry name.</small></div>
            <div class="field"><label for="new-category">Category</label><select id="new-category" name="category">${categories.map((category) => `<option value="${category}">${category[0].toUpperCase() + category.slice(1)}</option>`).join('')}</select></div>
            <button class="primary-button" type="submit">Add entry</button>
          </form>
        </section>
        <section aria-labelledby="list-title">
          <div class="list-heading"><h2 class="section-title" id="list-title">Current entries <span class="result-count">(${entries.length})</span></h2><button class="small-button remove" id="delete-all" type="button" ${entries.length ? '' : 'disabled'}>Delete all</button></div>
          <div class="manage-list">${rows || '<div class="manage-empty">No entries yet. Add one to get started.</div>'}</div>
        </section>
      </div>`;

    app.querySelector('#add-form').addEventListener('submit', addEntries);
    app.querySelector('#delete-all').addEventListener('click', deleteAll);
    app.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => mutate('DELETE', { id: button.dataset.delete }, 'Entry deleted.')));
  }

  async function request(method = 'GET', data) {
    const response = await fetch('/api/entries', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The change could not be saved.');
    return result;
  }

  async function loadEntries() {
    entries = await request('GET');
    render();
  }

  async function mutate(method, data, message) {
    try {
      await request(method, data);
      await loadEntries();
      notify(message);
    } catch (error) {
      notify(error.message);
    }
  }

  async function addEntries(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const links = String(formData.get('links')).split(/[\r\n\s]+/).map((url) => url.trim().replace(/[,;]+$/, '')).filter(Boolean);
    const entry = {
      name: String(formData.get('name')).trim(),
      links,
      category: String(formData.get('category'))
    };
    try {
      const result = await request('POST', entry);
      await loadEntries();
      notify(`${result.added} ${result.added === 1 ? 'entry added' : 'entries added'}.`);
      form.reset();
    } catch (error) {
      notify(error.message);
    }
  }

  async function deleteAll() {
    if (!entries.length || !window.confirm(`Delete all ${entries.length} entries? This cannot be undone.`)) return;
    await mutate('DELETE', { all: true }, 'All entries deleted.');
  }

  loadEntries().catch((error) => {
    app.innerHTML = `<div class="empty"><strong>Staff tools unavailable</strong>${escapeHtml(error.message)}</div>`;
  });
  window.setInterval(() => { loadEntries().catch(() => {}); }, 15000);
})();