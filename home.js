(() => {
  const app = document.querySelector('#app');
  const categories = ['websites', 'eagler', 'movies'];
  let entries = [];
  let announcement = null;
  let announcementTimeout;
  let activeCategory = 'all';
  let searchTerm = '';
  const expandedEntries = new Set();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function scheduleAnnouncementExpiry() {
    clearTimeout(announcementTimeout);
    if (!announcement) return;
    const remaining = Date.parse(announcement.expiresAt) - Date.now();
    if (remaining <= 0) {
      announcement = null;
      return;
    }
    announcementTimeout = setTimeout(() => {
      scheduleAnnouncementExpiry();
      render();
    }, Math.min(remaining, 2147483647));
  }

  function render() {
    const text = window.siteText;
    const focusedSearch = document.activeElement?.id === 'search';
    const selectionStart = focusedSearch ? document.activeElement.selectionStart : null;
    const selectionEnd = focusedSearch ? document.activeElement.selectionEnd : null;
    const query = searchTerm.trim().toLowerCase();
    const publicEntries = entries.filter((entry) => entry.category !== 'movies');
    const totalLinkCount = entries.reduce((total, entry) => total + entry.links.length, 0);
    const filtered = publicEntries.filter((entry) => {
      const category = categories.includes(entry.category) ? entry.category : 'websites';
      const searchable = `${entry.number} #${entry.number} ${entry.name} ${entry.links.join(' ')}`.toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      return matchesQuery && matchesCategory;
    });
    const rows = filtered.map((entry, index) => {
      const expandable = entry.links.length > 100;
      const expanded = expandedEntries.has(entry.id);
      const visibleLinks = expandable && !expanded ? entry.links.slice(0, 100) : entry.links;
      const urls = visibleLinks.map((value) => {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) return escapeHtml(value);
          return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url.href)}</a>`;
        } catch {
          return escapeHtml(value);
        }
      }).filter(Boolean);
      return `<article class="published-link${entry.pinned ? ' is-pinned' : ''}" style="animation-delay:${Math.min(index * 25, 150)}ms">
        <div class="published-link-title">
          <strong><span class="entry-number">#${entry.number}</span> ${escapeHtml(entry.name)}</strong>
          ${entry.pinned ? '<span class="entry-pinned">Pinned</span>' : ''}
          <span class="entry-category">${escapeHtml(entry.category)}</span>
          <span class="entry-url-list">${urls.join(' <span aria-hidden="true">&middot;</span> ')}</span>
          ${expandable ? `<button class="entry-links-toggle" type="button" data-expand-entry="${escapeHtml(entry.id)}" aria-expanded="${expanded}">${expanded ? 'Show less' : `Show ${entry.links.length - 100} more links`}</button>` : ''}
        </div>
      </article>`;
    }).join('');

    app.innerHTML = `
      ${announcement ? `<aside class="announcement-banner" aria-label="Announcement"><strong>Announcement</strong><p>${escapeHtml(announcement.message)}</p><span>Until ${escapeHtml(new Date(announcement.expiresAt).toLocaleString())}</span></aside>` : ''}
      <p class="eyebrow">${escapeHtml(text('links.eyebrow', 'The link collection'))}</p>
      <h1>${escapeHtml(text('links.title', 'Links.'))}</h1>
      <p class="intro">${escapeHtml(text('links.intro', 'Browse by category or search by entry number, name, or link.'))}</p>
      <div class="segmented category-tabs" role="group" aria-label="Filter links by category">
        ${['all', 'websites', 'eagler'].map((category) => `<button class="filter-button" type="button" data-category="${category}" aria-pressed="${activeCategory === category}">${category === 'all' ? 'All links' : category[0].toUpperCase() + category.slice(1)}</button>`).join('')}
      </div>
      <div class="search-wrap">
        <svg class="search-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <input class="search-input" id="search" type="search" placeholder="${escapeHtml(text('links.search', 'Search number, name, or URL...'))}" value="${escapeHtml(searchTerm)}" autocomplete="off" aria-label="Search entries">
      </div>
      <div class="filters">
        <span class="result-count">${filtered.length} ${filtered.length === 1 ? 'ENTRY' : 'ENTRIES'}</span>
        <span class="result-count">${totalLinkCount} TOTAL LINKS</span>
      </div>
      <section class="published-links" aria-label="Link entries">
        ${rows || `<div class="empty"><strong>${publicEntries.length ? 'No matching entries' : escapeHtml(text('links.emptyTitle', 'No links published yet'))}</strong>${publicEntries.length ? 'Try another category or search.' : escapeHtml(text('links.emptyMessage', 'Check back later for new links.'))}</div>`}
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
    app.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      render();
    }));
    app.querySelectorAll('[data-expand-entry]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.expandEntry;
      if (expandedEntries.has(id)) expandedEntries.delete(id);
      else expandedEntries.add(id);
      render();
    }));
  }

  async function loadEntries() {
    await window.siteContentReady;
    const [entriesResponse, linksResponse, announcementResponse] = await Promise.all([
      fetch('/api/entries', { cache: 'no-store' }),
      fetch('/api/links', { cache: 'no-store' }).catch(() => null),
      fetch('/api/announcements', { cache: 'no-store' }).catch(() => null)
    ]);
    if (!entriesResponse.ok) {
      const result = await entriesResponse.json().catch(() => ({}));
      throw new Error(result.error || 'Entries could not be loaded.');
    }
    const savedEntries = await entriesResponse.json();
    const entriesFromApi = savedEntries.map((entry) => ({
      id: entry.id,
      name: entry.name || entry.text || 'Unnamed entry',
      links: Array.isArray(entry.links) ? entry.links : [],
      category: categories.includes(entry.category) ? entry.category : 'websites',
      pinned: entry.pinned === true
    }));
    let legacyLinks = [];
    if (announcementResponse?.ok) {
      const result = await announcementResponse.json();
      announcement = result.announcement;
      scheduleAnnouncementExpiry();
    }
    if (linksResponse?.ok) {
      const publishedLinks = await linksResponse.json();
      legacyLinks = publishedLinks.map((link, index) => ({ id: `legacy-${index}`, name: link.title, links: [link.url], category: link.category }));
    }
    entries = [...entriesFromApi, ...legacyLinks]
      .sort((first, second) => Number(second.pinned === true) - Number(first.pinned === true));
    entries.filter((entry) => entry.category !== 'movies').forEach((entry, index) => { entry.number = index + 1; });
    render();
  }

  loadEntries().catch((error) => {
    app.innerHTML = `<div class="board-warning" role="status"><strong>Links temporarily unavailable</strong>${escapeHtml(error.message)}</div>`;
  });
  window.setInterval(() => { loadEntries().catch(() => {}); }, 15000);
})();