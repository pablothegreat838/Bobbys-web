(() => {
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const categories = ['websites', 'eagler', 'movies'];
  let entries = [];
  let movies = [];
  let announcement = null;
  let siteText = null;
  let controlState = null;
  let activePanel = 'entries';
  let sidebarOpen = true;
  const expandedEntries = new Set();
  let pendingEntries = [];
  let hasRendered = false;
  let movieUploadInProgress = false;
  let refreshPending = false;
  let toastTimeout;
  let authenticated = false;
  let refreshTimers = [];

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
    if (!authenticated) return;
    hasRendered = true;
    const siteTextGroups = siteText?.fields.reduce((groups, field) => {
      groups[field.page] ||= [];
      const id = `site-text-${field.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      groups[field.page].push(`<div class="field"><label for="${id}">${escapeHtml(field.label)}</label><textarea id="${id}" name="${escapeHtml(field.key)}" maxlength="2000" rows="2">${escapeHtml(siteText.content[field.key] ?? '')}</textarea></div>`);
      return groups;
    }, {}) || {};
    const siteTextForm = siteText ? Object.entries(siteTextGroups).map(([page, fields]) => `<section class="site-text-group"><h2 class="section-title">${escapeHtml(page)}</h2>${fields.join('')}</section>`).join('') : '<div class="manage-empty">Loading site text...</div>';
    const rows = entries.map((entry, index) => {
      const links = entry.links || [];
      const expanded = expandedEntries.has(entry.id);
      const visibleLinks = expanded ? links : links.slice(0, 100);
      return `
      <article class="manage-entry" data-entry-drop="${escapeHtml(entry.id)}">
        <div class="manage-top">
          <div class="manage-entry-copy">
            <strong>${index + 1}. ${escapeHtml(entry.name)}</strong>
            <div class="manage-entry-links">${visibleLinks.map((url) => `<span>${escapeHtml(url)}</span>`).join(' <span aria-hidden="true">&middot;</span> ') || '<span>No links added</span>'}${links.length > 100 ? `<button class="entry-links-toggle" type="button" data-expand-entry="${escapeHtml(entry.id)}" aria-expanded="${expanded}">${expanded ? 'Show less' : `Show ${links.length - 100} more links`}</button>` : ''}</div>
            <span class="entry-category">${escapeHtml(entry.category || 'websites')}</span>
          </div>
          <div class="manage-actions">
            <button class="drag-handle" type="button" draggable="true" data-entry-drag="${escapeHtml(entry.id)}" aria-label="Drag to reorder ${escapeHtml(entry.name)}" title="Drag to reorder">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1"/><circle cx="11" cy="3" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="5" cy="13" r="1"/><circle cx="11" cy="13" r="1"/></svg>
            </button>
            <button class="small-button" type="button" data-pin-entry="${escapeHtml(entry.id)}" data-pinned="${entry.pinned === true}" aria-label="${entry.pinned === true ? 'Unpin' : 'Pin'} ${escapeHtml(entry.name)}">${entry.pinned === true ? 'Unpin' : 'Pin'}</button>
            <button class="small-button remove" type="button" data-delete="${escapeHtml(entry.id)}" aria-label="Delete entry">Delete</button>
          </div>
        </div>
      </article>`;
    }).join('');
    const movieRows = movies.map((movie, index) => `
      <article class="manage-entry manage-movie">
        ${movie.posterKey ? `<img src="/api/movie-media?key=${encodeURIComponent(movie.posterKey)}" alt="" loading="lazy">` : '<span class="manage-movie-placeholder" aria-hidden="true">▶</span>'}
        <div class="manage-movie-copy"><strong>${index + 1}. ${escapeHtml(movie.title)}</strong>${movie.sourceUrl || movie.embedUrl ? '<span class="manage-movie-type">Link</span>' : ''}</div>
        <div class="manage-actions">
          <button class="small-button" type="button" data-move-movie="${escapeHtml(movie.id)}" data-direction="-1" aria-label="Move ${escapeHtml(movie.title)} up" ${index === 0 ? 'disabled' : ''}>Up</button>
          <button class="small-button" type="button" data-move-movie="${escapeHtml(movie.id)}" data-direction="1" aria-label="Move ${escapeHtml(movie.title)} down" ${index === movies.length - 1 ? 'disabled' : ''}>Down</button>
          <button class="small-button remove" type="button" data-delete-movie="${escapeHtml(movie.id)}" aria-label="Delete ${escapeHtml(movie.title)}">Delete</button>
        </div>
      </article>`).join('');

    const themes = siteText?.themes || [
      { id: 'default', label: 'Default' },
      { id: 'halloween', label: 'Halloween' },
      { id: 'christmas', label: 'Christmas' }
    ];
    app.innerHTML = `
      <div class="staff-shell">
      <div class="staff-heading">
        <div class="staff-heading-title">
          <button class="staff-menu-toggle" id="staff-menu-toggle" type="button" aria-label="${sidebarOpen ? 'Hide' : 'Show'} staff pages" aria-expanded="${sidebarOpen}" aria-controls="staff-sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <div><p class="eyebrow">Staff workspace</p><h1>Manage.</h1></div>
        </div>
        <div class="staff-nav"><a class="back-link" href="/home.html">Public page</a><a class="back-link" href="/movies.html">Movies</a><button class="small-button" id="staff-logout" type="button">Log out</button></div>
      </div>
      <div class="staff-layout">
      <nav class="staff-tabs" id="staff-sidebar" role="tablist" aria-orientation="vertical" aria-label="Staff pages" ${sidebarOpen ? '' : 'hidden'}>
        <button class="staff-tab" id="staff-tab-entries" type="button" role="tab" aria-selected="${activePanel === 'entries'}" aria-controls="staff-panel-entries" data-panel="entries">Links <span>${entries.length}</span></button>
        <button class="staff-tab" id="staff-tab-movies" type="button" role="tab" aria-selected="${activePanel === 'movies'}" aria-controls="staff-panel-movies" data-panel="movies">Movies <span>${movies.length}</span></button>
        <button class="staff-tab" id="staff-tab-announcement" type="button" role="tab" aria-selected="${activePanel === 'announcement'}" aria-controls="staff-panel-announcement" data-panel="announcement">Announcement</button>
        <button class="staff-tab" id="staff-tab-site-text" type="button" role="tab" aria-selected="${activePanel === 'site-text'}" aria-controls="staff-panel-site-text" data-panel="site-text">Site text</button>
        <button class="staff-tab" id="staff-tab-theme" type="button" role="tab" aria-selected="${activePanel === 'theme'}" aria-controls="staff-panel-theme" data-panel="theme">Theme</button>
        <button class="staff-tab" id="staff-tab-control" type="button" role="tab" aria-selected="${activePanel === 'control'}" aria-controls="staff-panel-control" data-panel="control">Control</button>
      </nav>
      <div class="staff-content">
      <section class="staff-panel${activePanel === 'entries' ? '' : ' staff-panel-hidden'}" id="staff-panel-entries" role="tabpanel" aria-labelledby="staff-tab-entries" ${activePanel === 'entries' ? '' : 'hidden'}>
        <div class="staff-workspace">
          <section aria-labelledby="add-title">
            <h2 class="section-title" id="add-title">Add links</h2>
          <form class="add-form" id="add-form">
            <div class="field"><label for="new-name">Entry name</label><input id="new-name" name="name" type="text" maxlength="200" placeholder="Daily link" required></div>
            <div class="field"><label for="new-links">Links</label><textarea id="new-links" name="links" placeholder="Paste links here, one per line" required></textarea><small>All links stay together under this entry name.</small></div>
            <div class="field"><label for="entry-files">Import text files</label><input id="entry-files" type="file" accept="text/*,.txt,.csv,.md" multiple><small>File text is added to the Links box.</small></div>
            <div class="field"><label for="new-category">Category</label><select id="new-category" name="category">${categories.map((category) => `<option value="${category}">${category[0].toUpperCase() + category.slice(1)}</option>`).join('')}</select></div>
            <button class="primary-button" type="submit">Add entry</button>
          </form>
          </section>
          <section class="staff-list-panel" aria-labelledby="list-title">
            <div class="list-heading"><h2 class="section-title" id="list-title">Links <span class="result-count">(${entries.length})</span></h2><button class="small-button remove" id="delete-all" type="button" ${entries.length ? '' : 'disabled'}>Delete all</button></div>
            <div class="manage-list">${rows || '<div class="manage-empty">No links yet. Add one to get started.</div>'}</div>
          </section>
        </div>
      </section>
      <section class="staff-panel${activePanel === 'movies' ? '' : ' staff-panel-hidden'}" id="staff-panel-movies" role="tabpanel" aria-labelledby="staff-tab-movies" ${activePanel === 'movies' ? '' : 'hidden'}>
        <div class="staff-workspace staff-movie-workspace">
          <section aria-labelledby="movies-title">
            <h2 class="section-title" id="movies-title">Publish movie</h2>
        <form class="add-form movie-add-form" id="movie-form">
          <div class="field"><label for="movie-title">Movie name</label><input id="movie-title" name="title" type="text" maxlength="200" placeholder="Movie title" required></div>
          <div class="field"><label for="movie-url">Video link</label><input id="movie-url" name="sourceUrl" type="url" placeholder="Google Drive share link or direct HTTPS video link"><small>Use a Google Drive file share link or a direct HTTPS video link, such as an MP4. Drive files must be shared so viewers can access them.</small></div>
          <div class="field"><label for="movie-poster">Poster image (optional)</label><input id="movie-poster" name="poster" type="file" accept="image/*"></div>
          <div class="field"><label for="movie-video">Or video file</label><input id="movie-video" name="video" type="file" accept="video/*"><small>Large videos upload in smaller parts; keep this page open until publishing finishes.</small></div>
          <button class="primary-button" type="submit">Publish movie</button>
        </form>
          </section>
          <section class="staff-list-panel" aria-label="Published movies">
            <h2 class="section-title">Published <span class="result-count">(${movies.length})</span></h2>
            <div class="manage-movie-list">${movieRows || '<div class="manage-empty">No movies published yet.</div>'}</div>
          </section>
        </div>
      </section>
      <section class="staff-panel${activePanel === 'announcement' ? '' : ' staff-panel-hidden'}" id="staff-panel-announcement" role="tabpanel" aria-labelledby="staff-tab-announcement" ${activePanel === 'announcement' ? '' : 'hidden'}>
        <div class="staff-workspace announcement-workspace">
          <section aria-labelledby="announcement-title">
            <h2 class="section-title" id="announcement-title">${announcement ? 'Update announcement' : 'New announcement'}</h2>
            <form class="add-form" id="announcement-form">
              <div class="field"><label for="announcement-message">Message</label><textarea id="announcement-message" name="message" maxlength="500" placeholder="Write an announcement for visitors" required>${escapeHtml(announcement?.message || '')}</textarea></div>
              <div class="field"><label for="announcement-expires">Hide announcement after</label><input id="announcement-expires" name="expiresAt" type="datetime-local" value="${announcement ? escapeHtml(new Date(new Date(announcement.expiresAt).getTime() - new Date(announcement.expiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)) : ''}" required></div>
              <button class="primary-button" type="submit">${announcement ? 'Update announcement' : 'Publish announcement'}</button>
              ${announcement ? '<button class="small-button remove announcement-remove" id="delete-announcement" type="button">Remove announcement</button>' : ''}
            </form>
          </section>
          <section class="announcement-preview" aria-label="Announcement status">
            <h2 class="section-title">On your public page</h2>
            ${announcement ? `<div class="announcement-banner"><strong>Announcement</strong><p>${escapeHtml(announcement.message)}</p><span>Automatically hides ${escapeHtml(new Date(announcement.expiresAt).toLocaleString())}</span></div>` : '<div class="manage-empty">No announcement is currently published.</div>'}
          </section>
        </div>
      </section>`;

    app.insertAdjacentHTML('beforeend', `
      <section class="staff-panel${activePanel === 'control' ? '' : ' staff-panel-hidden'}" id="staff-panel-control" role="tabpanel" aria-labelledby="staff-tab-control" ${activePanel === 'control' ? '' : 'hidden'}>
        <div class="site-text-editor staff-control-editor">
          ${controlState ? `<form id="control-state-form" class="control-state-form">
            <h2 class="section-title">Site availability</h2>
            <section class="control-setting"><label class="control-toggle"><input type="checkbox" name="fullEnabled" ${controlState.full.enabled ? 'checked' : ''}> Shut down the entire website</label><div class="field"><label for="full-message">Full-site message</label><textarea id="full-message" name="fullMessage" maxlength="500" required>${escapeHtml(controlState.full.message)}</textarea></div></section>
            ${[['links', 'Links page'], ['movies', 'Movies page'], ['terms', 'Terms page']].map(([key, label]) => `<section class="control-setting"><h3>${label}</h3><label class="control-toggle"><input type="checkbox" name="${key}Enabled" ${controlState.pages[key].enabled ? 'checked' : ''}> Page is available</label>${key === 'links' ? `<label class="control-toggle"><input type="checkbox" name="linksRedirect" ${controlState.pages.links.redirect ? 'checked' : ''}> Redirect disabled links page to /sl</label>` : ''}<div class="field"><label for="${key}-message">Shutdown message</label><textarea id="${key}-message" name="${key}Message" maxlength="500" required>${escapeHtml(controlState.pages[key].message)}</textarea></div></section>`).join('')}
            <button class="primary-button theme-save" type="submit">Save availability settings</button>
          </form>` : '<div class="manage-empty">Loading site controls...</div>'}
          <section class="control-console"><h2 class="section-title">Command console</h2><form id="command-form" class="command-form"><label class="field"><span>Staff code</span><input name="code" maxlength="12" autocomplete="off" placeholder="#7878" required></label><button class="primary-button theme-save" type="submit">Run code</button></form><p class="control-code-help">Built in: #0998 full shutdown, #7878 diagnostics, #565 redirect links to /sl.</p><pre class="command-output" id="command-output" aria-live="polite">Ready.</pre></section>
          <section class="control-custom-codes"><h2 class="section-title">Custom codes</h2><form id="custom-code-form" class="custom-code-form"><div class="field"><label for="custom-code">Numeric code</label><input id="custom-code" name="code" pattern="#[0-9]{3,8}" maxlength="9" placeholder="#1234" required></div><div class="field"><label for="custom-action">Allowed action</label><select id="custom-action" name="action"><option value="full-on">Enable full-site shutdown</option><option value="full-off">Restore full website</option><option value="links-off">Disable links page</option><option value="links-off-redirect">Disable links page and redirect</option><option value="links-on">Restore links page</option><option value="movies-off">Disable movies page</option><option value="movies-on">Restore movies page</option><option value="terms-off">Disable terms page</option><option value="terms-on">Restore terms page</option></select></div><button class="primary-button theme-save" type="submit">Save custom code</button></form><ul class="custom-code-list">${controlState ? controlState.customCodes.map((item) => `<li><code>${escapeHtml(item.code)}</code><span>${escapeHtml(item.action)}</span><button class="small-button remove" type="button" data-remove-code="${escapeHtml(item.code)}">Remove</button></li>`).join('') : ''}</ul></section>
        </div>
      </section>`);
      app.insertAdjacentHTML('beforeend', `
      <section class="staff-panel${activePanel === 'site-text' ? '' : ' staff-panel-hidden'}" id="staff-panel-site-text" role="tabpanel" aria-labelledby="staff-tab-site-text" ${activePanel === 'site-text' ? '' : 'hidden'}>
        <div class="site-text-editor">
          <form id="site-text-form" class="site-text-form">
            <p class="intro">Edit public page copy. Changes are shared with every visitor.</p>
            ${siteTextForm}
            ${siteText ? '<button class="primary-button" type="submit">Save site text</button>' : ''}
          </form>
        </div>
      </section>`);
    app.insertAdjacentHTML('beforeend', `
      <section class="staff-panel${activePanel === 'theme' ? '' : ' staff-panel-hidden'}" id="staff-panel-theme" role="tabpanel" aria-labelledby="staff-tab-theme" ${activePanel === 'theme' ? '' : 'hidden'}>
        <div class="site-text-editor">
          <form id="site-theme-form" class="site-theme-form">
            <p class="intro">Choose the color theme visitors see across the website.</p>
            <fieldset class="theme-fieldset">
              <legend class="section-title">Website theme</legend>
              <div class="theme-options">${themes.map(({ id, label }) => `<label class="theme-option"><input type="radio" name="theme" value="${escapeHtml(id)}" ${siteText?.content.theme === id || (!siteText?.content.theme && id === 'default') ? 'checked' : ''}><span class="theme-swatches" aria-hidden="true"><i data-theme-swatch="${escapeHtml(id)}"></i><i data-theme-swatch-accent="${escapeHtml(id)}"></i></span><strong>${escapeHtml(label)}</strong></label>`).join('')}</div>
            </fieldset>
            ${siteText ? '<button class="primary-button theme-save" type="submit">Apply theme for everyone</button>' : '<div class="manage-empty">Loading theme settings...</div>'}
          </form>
          <section class="site-identity-section">
            <h2 class="section-title">Site identity</h2>
            <form id="site-identity-form" class="site-identity-form">
              <p class="intro">Set the browser tab title and favicon shown to every visitor.</p>
              <div class="field"><label for="site-title">Browser tab title</label><input id="site-title" name="siteTitle" type="text" maxlength="120" value="${escapeHtml(siteText?.content.siteTitle || '')}" placeholder="Links | Bobby's Web"></div>
              <div class="field"><label for="site-favicon">Favicon image</label><input id="site-favicon" name="favicon" type="file" accept=".png,.ico,.jpg,.jpeg,.gif,.webp,image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/gif,image/webp"><small>PNG, ICO, JPEG, GIF, or WebP. Maximum size: 256 KB.</small></div>
              ${siteText?.content.favicon ? `<div class="site-icon-preview"><img src="/api/site-icon?v=${encodeURIComponent(siteText.content.favicon)}" alt="Current favicon"><span>Current favicon</span></div>` : ''}
              ${siteText ? '<button class="primary-button theme-save" type="submit">Save site identity for everyone</button>' : ''}
            </form>
          </section>
        </div>
      </section>
      </div>
      </div>
      </div>`);

    app.querySelector('#staff-menu-toggle').addEventListener('click', () => {
      sidebarOpen = !sidebarOpen;
      render();
      app.querySelector('#staff-menu-toggle')?.focus();
    });
    app.querySelector('#staff-logout').addEventListener('click', logout);
    app.querySelector('#control-state-form')?.addEventListener('submit', saveControlState);
    app.querySelector('#command-form')?.addEventListener('submit', runCommand);
    app.querySelector('#custom-code-form')?.addEventListener('submit', saveCustomCode);
    app.querySelectorAll('[data-remove-code]').forEach((button) => button.addEventListener('click', () => removeCustomCode(button.dataset.removeCode)));
    app.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => {
      activePanel = button.dataset.panel;
      if (window.matchMedia('(max-width: 650px)').matches) sidebarOpen = false;
      render();
      if (!sidebarOpen) app.querySelector('#staff-menu-toggle')?.focus();
    }));
    app.querySelectorAll('[data-expand-entry]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.expandEntry;
      if (expandedEntries.has(id)) expandedEntries.delete(id);
      else expandedEntries.add(id);
      render();
    }));
    app.querySelector('#add-form').addEventListener('submit', addEntries);
    app.querySelector('#entry-files').addEventListener('change', importEntryFiles);
    app.querySelector('#movie-form').addEventListener('submit', addMovie);
    app.querySelector('#announcement-form').addEventListener('submit', saveAnnouncement);
    app.querySelector('#site-text-form')?.addEventListener('submit', saveSiteText);
    app.querySelector('#site-theme-form')?.addEventListener('submit', saveSiteTheme);
    app.querySelector('#site-identity-form')?.addEventListener('submit', saveSiteIdentity);
    app.querySelector('#delete-announcement')?.addEventListener('click', deleteAnnouncement);
    app.querySelector('#delete-all').addEventListener('click', deleteAll);
    app.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => mutate('DELETE', { id: button.dataset.delete }, 'Entry deleted.')));
    app.querySelectorAll('[data-delete-movie]').forEach((button) => button.addEventListener('click', () => deleteMovie(button.dataset.deleteMovie)));
    app.querySelectorAll('[data-entry-drag]').forEach((handle) => {
      handle.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', handle.dataset.entryDrag);
        handle.closest('[data-entry-drop]').classList.add('is-dragging');
      });
      handle.addEventListener('dragend', () => {
        app.querySelectorAll('[data-entry-drop]').forEach((row) => row.classList.remove('is-dragging', 'is-drop-target'));
      });
      handle.addEventListener('keydown', (event) => {
        if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const index = entries.findIndex((entry) => entry.id === handle.dataset.entryDrag);
        const target = index + (event.key === 'ArrowUp' ? -1 : 1);
        if (target >= 0 && target < entries.length) reorderEntry(handle.dataset.entryDrag, entries[target].id);
      });
    });
    app.querySelectorAll('[data-entry-drop]').forEach((row) => {
      row.addEventListener('dragover', (event) => {
        if (!event.dataTransfer.types.includes('text/plain')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        app.querySelectorAll('[data-entry-drop]').forEach((item) => item.classList.toggle('is-drop-target', item === row));
      });
      row.addEventListener('dragleave', (event) => {
        if (!row.contains(event.relatedTarget)) row.classList.remove('is-drop-target');
      });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        reorderEntry(event.dataTransfer.getData('text/plain'), row.dataset.entryDrop);
      });
    });
    app.querySelectorAll('[data-pin-entry]').forEach((button) => button.addEventListener('click', () => pinEntry(button.dataset.pinEntry, button.dataset.pinned !== 'true')));
    app.querySelectorAll('[data-move-movie]').forEach((button) => button.addEventListener('click', () => reorderItems(button.dataset.moveMovie, Number(button.dataset.direction))));
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

  async function announcementRequest(method, data) {
    const response = await fetch('/api/announcements', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The announcement could not be saved.');
    return result;
  }

  async function siteTextRequest(method = 'GET', data) {
    const response = await fetch('/api/site-content', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Site text could not be saved.');
    return result;
  }

  async function controlRequest(method = 'GET', data, path = '/api/staff/control') {
    const response = await fetch(path, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Staff controls could not be saved.');
    return result;
  }

  async function saveControlState(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = {
      ...controlState,
      full: { ...controlState.full, enabled: data.has('fullEnabled'), message: String(data.get('fullMessage') || '') },
      pages: Object.fromEntries(['links', 'movies', 'terms'].map((key) => [key, {
        ...controlState.pages[key],
        enabled: data.has(`${key}Enabled`),
        ...(key === 'links' ? { redirect: data.has('linksRedirect') } : {}),
        message: String(data.get(`${key}Message`) || '')
      }]))
    };
    try {
      controlState = await controlRequest('PUT', next);
      render();
      notify('Availability settings saved.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function runCommand(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const output = app.querySelector('#command-output');
    const code = String(new FormData(form).get('code') || '').trim();
    try {
      const result = await controlRequest('POST', { code }, '/api/staff/command');
      if (result.state) controlState = result.state;
      output.textContent = result.health ? `${result.result} Website: ${result.health.website}; storage: ${result.health.storage}; pages: ${Object.entries(result.health.pages).map(([page, status]) => `${page} ${status}`).join(', ')}; checked ${result.health.time}` : result.result;
      form.reset();
      render();
      const renewedOutput = app.querySelector('#command-output');
      renewedOutput.textContent = output.textContent;
      notify(result.result);
    } catch (error) {
      output.textContent = error.message;
    }
  }

  async function saveCustomCode(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get('code') || '').trim();
    if (controlState.customCodes.some((item) => item.code === code)) {
      notify('That code is already saved.');
      return;
    }
    try {
      controlState = await controlRequest('PUT', { ...controlState, customCodes: [...controlState.customCodes, { code, action: String(data.get('action')) }] });
      render();
      notify('Custom code saved.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function removeCustomCode(code) {
    try {
      controlState = await controlRequest('PUT', { ...controlState, customCodes: controlState.customCodes.filter((item) => item.code !== code) });
      render();
      notify('Custom code removed.');
    } catch (error) {
      notify(error.message);
    }
  }

  function renderLogin(message = '') {
    authenticated = false;
    app.innerHTML = `<section class="staff-login"><p class="eyebrow">Staff workspace</p><h1>Staff login.</h1><p class="intro">Enter the staff password to continue.</p><form id="staff-login-form" class="login-form"><div class="field"><label for="staff-password">Password</label><input id="staff-password" name="password" type="password" inputmode="numeric" autocomplete="current-password" maxlength="32" required></div><p class="form-error" role="alert" ${message ? '' : 'hidden'}>${escapeHtml(message)}</p><button class="primary-button" type="submit">Log in</button></form></section>`;
    app.querySelector('#staff-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button');
      submit.disabled = true;
      const password = String(new FormData(event.currentTarget).get('password') || '');
      try {
        const response = await fetch('/api/staff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
          cache: 'no-store'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Login failed.');
        startWorkspace();
      } catch (error) {
        renderLogin(error.message);
      }
    });
  }

  async function logout() {
    try {
      await fetch('/api/staff/session', { method: 'POST', cache: 'no-store' });
    } finally {
      refreshTimers.forEach(clearInterval);
      refreshTimers = [];
      entries = [];
      movies = [];
      announcement = null;
      siteText = null;
      controlState = null;
      renderLogin();
    }
  }

  async function startWorkspace() {
    authenticated = true;
    const results = await Promise.allSettled([
      loadEntries(), loadMovies(), loadAnnouncement(), loadSiteText(), controlRequest().then((state) => { controlState = state; })
    ]);
    const failure = results.find((result) => result.status === 'rejected' && result.reason?.message?.includes('Staff login required'));
    if (failure) return renderLogin('Your staff session expired. Please log in again.');
    render();
    if (!refreshTimers.length) {
      refreshTimers = [
        window.setInterval(() => { loadEntries().catch(() => {}); }, 15000),
        window.setInterval(() => { loadMovies().catch(() => {}); }, 15000),
        window.setInterval(() => { loadAnnouncement().catch(() => {}); }, 15000)
      ];
    }
  }

  async function saveSiteText(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const content = Object.fromEntries(siteText.fields.map(({ key }) => [key, String(new FormData(form).get(key) || '')]));
    submit.disabled = true;
    try {
      const result = await siteTextRequest('PUT', { content });
      siteText = { ...siteText, content: result.content };
      render();
      notify('Site text saved.');
    } catch (error) {
      notify(error.message);
      submit.disabled = false;
    }
  }

  async function saveSiteTheme(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const theme = new FormData(form).get('theme');
    submit.disabled = true;
    try {
      const result = await siteTextRequest('PUT', { content: { theme } });
      siteText = { ...siteText, content: result.content };
      document.documentElement.dataset.theme = result.content.theme;
      const themeColors = { default: '#ffffff', halloween: '#0D1117', christmas: '#F4F8F4' };
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[result.content.theme] || themeColors.default);
      render();
      notify('Theme updated for everyone.');
    } catch (error) {
      notify(error.message);
      submit.disabled = false;
    }
  }

  async function saveSiteIdentity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    if (!submit) return;
    const data = new FormData(form);
    const favicon = data.get('favicon');
    submit.disabled = true;
    try {
      let result;
      if (favicon?.size) {
        const response = await fetch('/api/site-icon', { method: 'POST', body: data, cache: 'no-store' });
        result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Site identity could not be saved.');
      } else {
        result = await siteTextRequest('PUT', { content: { siteTitle: String(data.get('siteTitle') || '').trim() } });
      }
      siteText = { ...siteText, content: result.content };
      window.applySiteContentSettings?.(result.content);
      render();
      notify('Site identity updated for everyone.');
    } catch (error) {
      notify(error.message);
      submit.disabled = false;
    }
  }

  async function reorderItems(id, direction) {
    const index = movies.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= movies.length) return;
    const reordered = [...movies];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      const response = await fetch('/api/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((item) => item.id) }),
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Movies could not be reordered.');
      await loadMovies();
      notify('Order updated.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function reorderEntry(id, targetId) {
    const sourceIndex = entries.findIndex((entry) => entry.id === id);
    const targetIndex = entries.findIndex((entry) => entry.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const reordered = [...entries];
    const [entry] = reordered.splice(sourceIndex, 1);
    reordered.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, entry);
    try {
      await request('PATCH', { ids: reordered.map((item) => item.id) });
      await loadEntries();
      notify('Entry order updated.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function pinEntry(id, pinned) {
    try {
      await request('PATCH', { id, pinned });
      await loadEntries();
      notify(pinned ? 'Entry pinned.' : 'Entry unpinned.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function movieFileRequest(action, data) {
    const response = await fetch(`/api/movie-files?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The file upload could not be completed.');
    return result;
  }

  async function uploadMovieFile(file, kind) {
    if (!file || !file.type.startsWith(kind === 'video' ? 'video/' : 'image/')) {
      throw new Error(kind === 'video' ? 'Choose a video file.' : 'Choose an image poster.');
    }
    const upload = await movieFileRequest('init', { kind, contentType: file.type });
    const parts = [];
    const partSize = 8 * 1024 * 1024;
    try {
      for (let offset = 0, partNumber = 1; offset < file.size; offset += partSize, partNumber += 1) {
        const response = await fetch(`/api/movie-files?action=part&key=${encodeURIComponent(upload.key)}&uploadId=${encodeURIComponent(upload.uploadId)}&partNumber=${partNumber}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file.slice(offset, Math.min(offset + partSize, file.size)),
          cache: 'no-store'
        });
        const part = await response.json();
        if (!response.ok) throw new Error(part.error || 'A file part could not be uploaded.');
        parts.push(part);
        notify(`Uploading ${kind}: ${Math.min(100, Math.round((offset + partSize) / file.size * 100))}%`);
      }
      await movieFileRequest('complete', { ...upload, kind, parts });
      return upload.key;
    } catch (error) {
      await movieFileRequest('abort', { ...upload, kind }).catch(() => {});
      await movieFileRequest('delete', { key: upload.key, kind }).catch(() => {});
      throw error;
    }
  }

  async function addMovie(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const uploadedKeys = [];
    const sourceUrl = String(data.get('sourceUrl')).trim();
    const videoFile = data.get('video');
    const posterFile = data.get('poster');
    submit.disabled = true;
    movieUploadInProgress = true;
    try {
      if (Boolean(sourceUrl) === Boolean(videoFile?.size)) {
        throw new Error('Enter a video link or choose a video file, but not both.');
      }
      let posterKey;
      if (posterFile?.size) {
        posterKey = await uploadMovieFile(posterFile, 'poster');
        uploadedKeys.push({ key: posterKey, kind: 'poster' });
      }
      let videoKey;
      if (videoFile?.size) {
        videoKey = await uploadMovieFile(videoFile, 'video');
        uploadedKeys.push({ key: videoKey, kind: 'video' });
      }
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: String(data.get('title')).trim(), posterKey, videoKey, sourceUrl }),
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The movie could not be published.');
      form.reset();
      await loadMovies();
      notify('Movie published.');
    } catch (error) {
      await Promise.all(uploadedKeys.map(({ key, kind }) => movieFileRequest('delete', { key, kind }).catch(() => {})));
      notify(error.message);
    } finally {
      submit.disabled = false;
      movieUploadInProgress = false;
      if (refreshPending) {
        refreshPending = false;
        render();
      }
    }
  }

  async function loadMovies() {
    const response = await fetch('/api/movies', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Movies could not be loaded.');
    if (JSON.stringify(result) !== JSON.stringify(movies)) {
      movies = result;
      if (movieUploadInProgress) refreshPending = true;
      else render();
    }
  }

  async function deleteMovie(id) {
    if (!window.confirm('Delete this movie?')) return;
    try {
      const response = await fetch('/api/movies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The movie could not be deleted.');
      await loadMovies();
      notify('Movie deleted.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await announcementRequest('PUT', {
        message: String(data.get('message')).trim(),
        expiresAt: new Date(String(data.get('expiresAt'))).toISOString()
      });
      announcement = result.announcement;
      render();
      notify('Announcement published.');
    } catch (error) {
      notify(error.message);
      submit.disabled = false;
    }
  }

  async function deleteAnnouncement() {
    try {
      const result = await announcementRequest('DELETE');
      announcement = result.announcement;
      render();
      notify('Announcement removed.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function loadAnnouncement() {
    const response = await fetch('/api/announcements', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Announcement could not be loaded.');
    if (JSON.stringify(result.announcement) !== JSON.stringify(announcement)) {
      announcement = result.announcement;
      if (movieUploadInProgress) refreshPending = true;
      else render();
    }
  }

  async function loadSiteText() {
    const result = await siteTextRequest();
    if (JSON.stringify(result) !== JSON.stringify(siteText)) {
      siteText = result;
      render();
    }
  }

  async function loadEntries() {
    const savedEntries = await request('GET');
    const savedIds = new Set(savedEntries.map((entry) => entry.id));
    pendingEntries = pendingEntries.filter((entry) => !savedIds.has(entry.id) && entry.pendingUntil > Date.now());
    const nextEntries = [...savedEntries, ...pendingEntries.map(({ pendingUntil, ...entry }) => entry)];
    if (!hasRendered || JSON.stringify(nextEntries) !== JSON.stringify(entries)) {
      entries = nextEntries;
      if (movieUploadInProgress) refreshPending = true;
      else render();
    }
  }

  async function mutate(method, data, message) {
    try {
      await request(method, data);
      if (method === 'DELETE') {
        pendingEntries = data.all ? [] : pendingEntries.filter((entry) => entry.id !== data.id);
      }
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
      pendingEntries.push({ ...result.entry, pendingUntil: Date.now() + 120000 });
      entries = [...entries, result.entry];
      render();
      notify(`${result.added} ${result.added === 1 ? 'entry added' : 'entries added'}.`);
      form.reset();
    } catch (error) {
      notify(error.message);
    }
  }

  async function importEntryFiles(event) {
    const input = event.currentTarget;
    const textarea = app.querySelector('#new-links');
    const files = [...input.files];
    if (!files.length) return;
    try {
      const contents = await Promise.all(files.map((file) => file.text()));
      textarea.value = [textarea.value, ...contents].filter(Boolean).join('\n');
      notify(`${files.length} ${files.length === 1 ? 'file' : 'files'} added to Links.`);
    } catch {
      notify('Could not read the selected text file.');
    } finally {
      input.value = '';
    }
  }

  async function deleteAll() {
    if (!entries.length || !window.confirm(`Delete all ${entries.length} entries? This cannot be undone.`)) return;
    await mutate('DELETE', { all: true }, 'All entries deleted.');
  }

  fetch('/api/staff/session', { cache: 'no-store' })
    .then((response) => response.json().then((result) => ({ response, result })))
    .then(({ response, result }) => {
      if (response.ok && result.authenticated) startWorkspace();
      else renderLogin(result.error || '');
    })
    .catch(() => renderLogin('Could not verify the staff session.'));
})();