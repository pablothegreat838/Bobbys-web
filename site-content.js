(() => {
  let content = {};
  const defaultTitle = document.title;

  window.applySiteContentSettings = (settings) => {
    document.documentElement.dataset.theme = settings.theme || 'default';
    document.title = settings.siteTitle?.trim() || defaultTitle;
    const themeColors = { default: '#ffffff', halloween: '#0D1117', christmas: '#F4F8F4' };
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[settings.theme] || themeColors.default);
    let favicon = document.querySelector('[data-site-favicon]');
    if (settings.favicon) {
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.dataset.siteFavicon = '';
        document.head.append(favicon);
      }
      favicon.href = `/api/site-icon?v=${encodeURIComponent(settings.favicon)}`;
    } else {
      favicon?.remove();
    }
  };

  window.siteContentReady = fetch('/api/site-content', { cache: 'no-store' })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Site text could not be loaded.');
      content = result.content || {};
      window.applySiteContentSettings(content);
      document.querySelectorAll('[data-site-text]').forEach((element) => {
        const value = content[element.dataset.siteText];
        if (typeof value === 'string') element.textContent = value;
      });
      return content;
    })
    .catch(() => content);

  window.siteText = (key, fallback) => content[key] ?? fallback;
})();