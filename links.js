(() => {
  const linkList = document.querySelector('#link-list');
  const toast = document.querySelector('#toast');
  const categories = ['websites', 'eagler', 'movies'];
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

  function render(links) {
    const sections = categories.map((category) => {
      const grouped = links.filter((link) => (categories.includes(link.category) ? link.category : 'websites') === category);
      if (!grouped.length) return '';
      const rows = grouped.map((link) => {
        let url;
        try {
          url = new URL(link.url);
        } catch {
          return '';
        }
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        return `<article class="published-link">
          <div class="published-link-title"><a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a><span>${escapeHtml(url.href)}</span></div>
          <button class="small-button copy-link" type="button" data-copy="${escapeHtml(url.href)}" aria-label="Copy ${escapeHtml(link.title)} link">Copy link</button>
        </article>`;
      }).join('');
      return rows ? `<section class="link-category" aria-labelledby="category-${category}"><h2 id="category-${category}">${category}</h2><div class="published-links">${rows}</div></section>` : '';
    }).join('');

    linkList.innerHTML = sections || '<div class="empty"><strong>No published links yet</strong>Check back later for new links.</div>';
    linkList.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        notify('Link copied.');
      } catch {
        notify('Could not copy link. Select and copy the link address instead.');
      }
    }));
  }

  fetch('/api/links', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Links could not be loaded.');
      }
      return response.json();
    })
    .then(render)
    .catch((error) => {
      linkList.innerHTML = `<div class="board-warning" role="status"><strong>Links temporarily unavailable</strong>${escapeHtml(error.message)}</div>`;
    });
})();