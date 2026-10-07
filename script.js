    (() => {
      const STORAGE_KEY = 'bobbys-web-entries-v1';
      const app = document.querySelector('#app');
      const toast = document.querySelector('#toast');
      let entries = loadEntries();
      let activeFilter = 'all';
      let searchTerm = '';
      let toastTimeout;

      function loadEntries() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          return Array.isArray(saved) ? saved.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.text === 'string') : [];
        } catch {
          return [];
        }
      }

      function saveEntries() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      }

      function formatDate(value) {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
      }

      function checkReleases() {
        const now = Date.now();
        let released = 0;
        entries = entries.map((entry) => {
          if (entry.status === 'blocked' && entry.releaseAt && Date.parse(entry.releaseAt) <= now) {
            released += 1;
            return { ...entry, status: 'unblocked', releaseAt: null };
          }
          return entry;
        });
        if (released) {
          saveEntries();
          showToast(`${released} ${released === 1 ? 'entry was' : 'entries were'} automatically unblocked.`);
        }
      }

      function showToast(message) {
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.hidden = true; }, 3200);
      }

      function currentPage() {
        return location.hash === '#/staff' ? 'staff' : 'home';
      }

      function renderHome() {
        const query = searchTerm.trim().toLowerCase();
        const filtered = entries.filter((entry) => {
          const matchesQuery = !query || entry.text.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query);
          const matchesStatus = activeFilter === 'all' || entry.status === activeFilter;
          return matchesQuery && matchesStatus;
        });
        const rows = filtered.map((entry, index) => `
          <article class="entry" style="animation-delay:${Math.min(index * 25, 150)}ms">
            <div class="entry-copy">${escapeHtml(entry.text)}</div>
            <div class="entry-meta">
              <span class="badge ${entry.status}">${entry.status}</span>
              ${entry.status === 'blocked' && entry.releaseAt ? `<span class="release-note">Releases ${escapeHtml(formatDate(entry.releaseAt))}</span>` : ''}
            </div>
          </article>`).join('');

        app.className = '';
        app.innerHTML = `
          <p class="eyebrow">The community status board</p>
          <h1>Check an entry.</h1>
          <p class="intro">Search the list to see whether an entry is currently blocked or available.</p>
          <div class="search-wrap">
            <svg class="search-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            <input class="search-input" id="search" type="search" placeholder="Search entries or IDs..." value="${escapeHtml(searchTerm)}" autocomplete="off" aria-label="Search entries or IDs">
          </div>
          <div class="filters">
            <div class="segmented" role="group" aria-label="Filter by status">
              ${['all', 'blocked', 'unblocked'].map((filter) => `<button class="filter-button" type="button" data-filter="${filter}" aria-pressed="${activeFilter === filter}">${filter === 'all' ? 'All entries' : filter[0].toUpperCase() + filter.slice(1)}</button>`).join('')}
            </div>
            <span class="result-count">${filtered.length} ${filtered.length === 1 ? 'RESULT' : 'RESULTS'}</span>
          </div>
          <section class="list" aria-label="Entry results">
            ${rows || `<div class="empty"><strong>${entries.length ? 'No matching entries' : 'Nothing on the board yet'}</strong>${entries.length ? 'Try another search or status filter.' : 'There are no entries to show right now.'}</div>`}
          </section>`;

        app.querySelector('#search').addEventListener('input', (event) => {
          searchTerm = event.target.value;
          const cursor = event.target.selectionStart;
          renderHome();
          const nextInput = app.querySelector('#search');
          nextInput.focus();
          nextInput.setSelectionRange(cursor, cursor);
        });
        app.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
          activeFilter = button.dataset.filter;
          renderHome();
        }));
      }

      function renderStaff() {
        const rows = entries.map((entry) => `
          <article class="manage-entry" data-entry-id="${escapeHtml(entry.id)}">
            <div class="manage-top">
              <div class="entry-copy">${escapeHtml(entry.text)}</div>
              <div class="manage-actions">
                <span class="badge ${entry.status}">${entry.status}</span>
                <button class="small-button" type="button" data-toggle="${escapeHtml(entry.id)}">Mark ${entry.status === 'blocked' ? 'unblocked' : 'blocked'}</button>
                <button class="small-button remove" type="button" data-delete="${escapeHtml(entry.id)}" aria-label="Delete entry">Delete</button>
              </div>
            </div>
            ${entry.status === 'blocked' ? `<form class="timer-form" data-timer-form="${escapeHtml(entry.id)}">
              <input type="datetime-local" aria-label="Automatic release date and time" value="${entry.releaseAt ? escapeHtml(toLocalInput(entry.releaseAt)) : ''}" required>
              <button class="small-button" type="submit">${entry.releaseAt ? 'Update timer' : 'Add timer'}</button>
              ${entry.releaseAt ? `<button class="small-button remove" type="button" data-remove-timer="${escapeHtml(entry.id)}">Delete timer</button>` : ''}
              ${entry.releaseAt ? `<span class="no-timer">Releases ${escapeHtml(formatDate(entry.releaseAt))}</span>` : ''}
            </form>` : '<div class="no-timer">Unblocked entries do not have release timers.</div>'}
          </article>`).join('');

        app.className = 'staff-main';
        app.innerHTML = `
          <div class="staff-heading">
            <div><p class="eyebrow">Private staff tools</p><h1>Manage entries.</h1><p class="intro">Add individual entries, change their status, and schedule automatic releases.</p></div>
            <a class="back-link" href="#home"><span aria-hidden="true">←</span> Public page</a>
          </div>
          <div class="staff-grid">
            <section aria-labelledby="add-title">
              <h2 class="section-title" id="add-title">Add entries</h2>
              <form class="add-form" id="add-form">
                <div class="field"><label for="new-entries">Entry text</label><textarea id="new-entries" name="text" placeholder="Paste or type one entry per line" required></textarea><small>Each non-empty line becomes its own entry.</small></div>
                <div class="field"><label for="new-status">Status</label><select id="new-status" name="status"><option value="blocked">Blocked</option><option value="unblocked">Unblocked</option></select></div>
                <button class="primary-button" type="submit">Add to the board</button>
              </form>
            </section>
            <section aria-labelledby="list-title">
              <h2 class="section-title" id="list-title">Current entries <span class="result-count">(${entries.length})</span></h2>
              <div class="manage-list">${rows || '<div class="manage-empty">No entries yet. Add one to get started.</div>'}</div>
            </section>
          </div>`;

        app.querySelector('#add-form').addEventListener('submit', (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const lines = String(formData.get('text')).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          if (!lines.length) return;
          const status = formData.get('status');
          const added = lines.map((text) => ({ id: crypto.randomUUID(), text, status, releaseAt: null, createdAt: new Date().toISOString() }));
          entries = [...entries, ...added];
          saveEntries();
          renderStaff();
          showToast(`${added.length} ${added.length === 1 ? 'entry added' : 'entries added'}.`);
        });

        app.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => {
          entries = entries.filter((entry) => entry.id !== button.dataset.delete);
          saveEntries();
          renderStaff();
          showToast('Entry deleted.');
        }));

        app.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
          entries = entries.map((entry) => entry.id === button.dataset.toggle
            ? { ...entry, status: entry.status === 'blocked' ? 'unblocked' : 'blocked', releaseAt: null }
            : entry);
          saveEntries();
          renderStaff();
          showToast('Entry status updated.');
        }));

        app.querySelectorAll('[data-timer-form]').forEach((form) => form.addEventListener('submit', (event) => {
          event.preventDefault();
          const releaseAt = new Date(form.querySelector('input').value);
          if (Number.isNaN(releaseAt.getTime()) || releaseAt.getTime() <= Date.now()) {
            showToast('Choose a release time in the future.');
            return;
          }
          entries = entries.map((entry) => entry.id === form.dataset.timerForm ? { ...entry, releaseAt: releaseAt.toISOString() } : entry);
          saveEntries();
          renderStaff();
          showToast('Automatic release timer saved.');
        }));

        app.querySelectorAll('[data-remove-timer]').forEach((button) => button.addEventListener('click', () => {
          entries = entries.map((entry) => entry.id === button.dataset.removeTimer ? { ...entry, releaseAt: null } : entry);
          saveEntries();
          renderStaff();
          showToast('Release timer deleted.');
        }));
      }

      function toLocalInput(value) {
        const date = new Date(value);
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return localDate.toISOString().slice(0, 16);
      }

      function render() {
        checkReleases();
        if (currentPage() === 'staff') renderStaff();
        else renderHome();
      }

      window.addEventListener('hashchange', render);
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
          entries = loadEntries();
          render();
        }
      });
      render();
      window.setInterval(() => {
        const previousCount = entries.filter((entry) => entry.status === 'blocked' && entry.releaseAt && Date.parse(entry.releaseAt) <= Date.now()).length;
        if (previousCount) {
          checkReleases();
          render();
        }
      }, 15000);
    })();
