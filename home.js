(() => {
  const app = document.querySelector('#app');
  let entries = [];
  let activeFilter = 'all';
  let searchTerm = '';
  let apiError = '';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function render() {
    const focusedSearch = document.activeElement?.id === 'search';
    const selectionStart = focusedSearch ? document.activeElement.selectionStart : null;
    const selectionEnd = focusedSearch ? document.activeElement.selectionEnd : null;
    const query = searchTerm.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const matchesQuery = !query || entry.text.toLowerCase().includes(query);
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

    app.innerHTML = `
      ${apiError ? `<div class="board-warning" role="status"><strong>List temporarily unavailable</strong>${escapeHtml(apiError)} The status board is still available; entries will appear after the Pages data binding is configured.</div>` : ''}
      <p class="eyebrow">The community status board</p>
      <h1>Check an entry.</h1>
      <p class="intro">Search the list to see whether an entry is currently blocked or available.</p>
      <div class="search-wrap">
        <svg class="search-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <input class="search-input" id="search" type="search" placeholder="Search games or websites..." value="${escapeHtml(searchTerm)}" autocomplete="off" aria-label="Search entries">
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

    if (focusedSearch) {
      const input = app.querySelector('#search');
      input.focus();
      if (selectionStart !== null) input.setSelectionRange(selectionStart, selectionEnd);
    }
    app.querySelector('#search').addEventListener('input', (event) => {
      searchTerm = event.target.value;
      render();
    });
    app.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      render();
    }));
  }

  async function loadEntries() {
    const response = await fetch('/api/entries', { cache: 'no-store' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'The status board could not be loaded.');
    }
    entries = await response.json();
    apiError = '';
    render();
  }

  loadEntries().catch((error) => {
    apiError = error.message;
    render();
  });
  window.setInterval(() => {
    loadEntries().catch((error) => {
      if (apiError !== error.message) {
        apiError = error.message;
        render();
      }
    });
  }, 15000);
})();