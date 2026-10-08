(() => {
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const categories = ['websites', 'eagler', 'movies'];
  let links = [];
  let activeCategory = 'all';
  let searchTerm = '';
  let toastTimeout;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 2400);
  }

  function render() {
    const focusedSearch = document.activeElement?.id === 'search';
    const selectionStart = focusedSearch ? document.activeElement.selectionStart : null;
    const selectionEnd = focusedSearch ? document.activeElement.selectionEnd : null;
    const query = searchTerm.trim().toLowerCase();
    const filtered = links.filter((link) => {
      const category = categories.includes(link.category) ? link.category : 'websites';
      const matchesQuery = !query || `${link.title} ${link.url}`.toLowerCase().includes(query);
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      return matchesQuery && matchesCategory;
    });
    const rows = filtered.map((link, index) => {
      let url;
      try {
        url = new URL(link.url);
      } catch {
        return '';
      }
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return `<article class="published-link" style="animation-delay:${Math.min(index * 25, 150)}ms">
        <div class="published-link-title"><a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a><span>${escapeHtml(url.href)}</span></div>
        <button class="small-button copy-link" type="button" data-copy="${escapeHtml(url.href)}" aria-label="Copy ${escapeHtml(link.title)} link">Copy link</button>
      </article>`;
    }).join('');

    app.innerHTML = `
      <p class="eyebrow">The link collection</p>
      <h1>Links.</h1>
      <p class="intro">Browse by category or search for a link.</p>
      <div class="segmented category-tabs" role="group" aria-label="Filter links by category">
        ${['all', ...categories].map((category) => `<button class="filter-button" type="button" data-category="${category}" aria-pressed="${activeCategory === category}">${category === 'all' ? 'All links' : category[0].toUpperCase() + category.slice(1)}</button>`).join('')}
      </div>
      <div class="search-wrap">
        <svg class="search-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <input class="search-input" id="search" type="search" placeholder="Search titles or URLs..." value="${escapeHtml(searchTerm)}" autocomplete="off" aria-label="Search links">
      </div>
      <div class="filters">
        <span class="result-count">${filtered.length} ${filtered.length === 1 ? 'LINK' : 'LINKS'}</span>
      </div>
      <section class="published-links" aria-label="Published links">
        ${rows || `<div class="empty"><strong>${links.length ? 'No matching links' : 'No links published yet'}</strong>${links.length ? 'Try another category or search.' : 'Check back later for new links.'}</div>`}
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
    app.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        notify('Link copied.');
      } catch {
        notify('Could not copy link.');
      }
    }));
  }

  async function loadLinks() {
    const response = await fetch('/api/links', { cache: 'no-store' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Links could not be loaded.');
    }
    links = await response.json();
    render();
  }

  loadLinks().catch((error) => {
    app.innerHTML = `<div class="board-warning" role="status"><strong>Links temporarily unavailable</strong>${escapeHtml(error.message)}</div>`;
  });
  window.setInterval(() => { loadLinks().catch(() => {}); }, 15000);
})();