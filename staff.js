(() => {
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  let entries = [];
  let toastTimeout;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function toLocalInput(value) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function render() {
    const rows = entries.map((entry) => `
      <article class="manage-entry">
        <div class="manage-top">
          <div class="entry-copy">${escapeHtml(entry.text)}</div>
          <div class="manage-actions">
            <span class="badge ${entry.status}">${entry.status}</span>
            <button class="small-button" type="button" data-toggle="${escapeHtml(entry.id)}">Mark ${entry.status === 'blocked' ? 'unblocked' : 'blocked'}</button>
            <button class="small-button remove" type="button" data-delete="${escapeHtml(entry.id)}" aria-label="Delete entry">Delete</button>
          </div>
        </div>
        ${entry.status === 'blocked' ? `<form class="timer-form" data-timer-id="${escapeHtml(entry.id)}">
          <label class="timer-label" for="timer-${escapeHtml(entry.id)}">Automatic release</label>
          <input id="timer-${escapeHtml(entry.id)}" type="datetime-local" value="${entry.releaseAt ? escapeHtml(toLocalInput(entry.releaseAt)) : ''}" required>
          <button class="small-button" type="submit">${entry.releaseAt ? 'Update timer' : 'Add timer'}</button>
          ${entry.releaseAt ? `<button class="small-button remove" type="button" data-remove-timer="${escapeHtml(entry.id)}">Delete timer</button><span class="no-timer">Releases ${escapeHtml(formatDate(entry.releaseAt))}</span>` : ''}
        </form>` : '<div class="no-timer">Unblocked entries do not have release timers.</div>'}
      </article>`).join('');

    app.innerHTML = `
      <div class="staff-heading">
        <div><p class="eyebrow">Staff tools</p><h1>Manage entries.</h1><p class="intro">Add games and websites, change their status, and schedule automatic releases.</p></div>
        <div class="staff-nav"><a class="back-link" href="/home.html">Public page</a></div>
      </div>
      <div class="staff-grid">
        <section aria-labelledby="add-title">
          <h2 class="section-title" id="add-title">Add entries</h2>
          <form class="add-form" id="add-form">
            <div class="field"><label for="new-entries">Games or websites</label><textarea id="new-entries" name="text" placeholder="Paste one per line, or separate with commas or semicolons" required></textarea><small>Each line, comma, or semicolon becomes a separate entry.</small></div>
            <div class="field"><label for="new-status">Starting status</label><select id="new-status" name="status"><option value="blocked">Blocked</option><option value="unblocked">Unblocked</option></select></div>
            <div class="field"><label for="new-release">Automatic release (optional)</label><input id="new-release" name="releaseAt" type="datetime-local"><small>Applied to every new entry when its status is blocked.</small></div>
            <button class="primary-button" type="submit">Add to the board</button>
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
    app.querySelectorAll('[data-toggle]').forEach((button) => {
      const entry = entries.find((item) => item.id === button.dataset.toggle);
      button.addEventListener('click', () => mutate('PATCH', { id: entry.id, status: entry.status === 'blocked' ? 'unblocked' : 'blocked', releaseAt: null }, 'Entry status updated.'));
    });
    app.querySelectorAll('[data-timer-id]').forEach((form) => form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      const releaseAt = new Date(input.value);
      if (Number.isNaN(releaseAt.getTime()) || releaseAt.getTime() <= Date.now()) {
        notify('Choose a release time in the future.');
        return;
      }
      mutate('PATCH', { id: form.dataset.timerId, releaseAt: releaseAt.toISOString() }, 'Automatic release timer saved.');
    }));
    app.querySelectorAll('[data-remove-timer]').forEach((button) => button.addEventListener('click', () => mutate('PATCH', { id: button.dataset.removeTimer, releaseAt: null }, 'Release timer deleted.')));
  }

  async function request(method, data) {
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
    const items = String(formData.get('text')).split(/[\r\n,;]+/).map((line) => line.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
    if (!items.length) return;
    const status = String(formData.get('status'));
    const rawRelease = String(formData.get('releaseAt') || '');
    const releaseDate = rawRelease ? new Date(rawRelease) : null;
    if (releaseDate && (Number.isNaN(releaseDate.getTime()) || releaseDate.getTime() <= Date.now())) {
      notify('Choose an automatic release time in the future.');
      return;
    }
    const releaseAt = releaseDate ? releaseDate.toISOString() : null;
    try {
      const result = await request('POST', { items, status, releaseAt: status === 'blocked' ? releaseAt : null });
      await loadEntries();
      notify(`${result.added} ${result.added === 1 ? 'entry added' : 'entries added'}.`);
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