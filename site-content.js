(() => {
  let content = {};

  window.siteContentReady = fetch('/api/site-content', { cache: 'no-store' })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Site text could not be loaded.');
      content = result.content || {};
      document.querySelectorAll('[data-site-text]').forEach((element) => {
        const value = content[element.dataset.siteText];
        if (typeof value === 'string') element.textContent = value;
      });
      return content;
    })
    .catch(() => content);

  window.siteText = (key, fallback) => content[key] ?? fallback;
})();