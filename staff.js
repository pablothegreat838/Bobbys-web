(() => {
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const categories = ['websites', 'eagler', 'movies'];
  let entries = [];
  let movies = [];
  let announcement = null;
  let siteText = null;
  let activePanel = 'entries';
  let pendingEntries = [];
  let hasRendered = false;
  let movieUploadInProgress = false;
  let refreshPending = false;
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
    hasRendered = true;
    const siteTextGroups = siteText?.fields.reduce((groups, field) => {
      groups[field.page] ||= [];
      const id = `site-text-${field.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      groups[field.page].push(`<div class="field"><label for="${id}">${escapeHtml(field.label)}</label><textarea id="${id}" name="${escapeHtml(field.key)}" maxlength="2000" rows="2">${escapeHtml(siteText.content[field.key] ?? '')}</textarea></div>`);
      return groups;
    }, {}) || {};
    const siteTextForm = siteText ? Object.entries(siteTextGroups).map(([page, fields]) => `<section class="site-text-group"><h2 class="section-title">${escapeHtml(page)}</h2>${fields.join('')}</section>`).join('') : '<div class="manage-empty">Loading site text...</div>';
    const rows = entries.map((entry, index) => `
      <article class="manage-entry" data-entry-drop="${escapeHtml(entry.id)}">
        <div class="manage-top">
          <div class="manage-entry-copy">
            <strong>${index + 1}. ${escapeHtml(entry.name)}</strong>
            <div class="manage-entry-links">${(entry.links || []).map((url) => `<span>${escapeHtml(url)}</span>`).join(' <span aria-hidden="true">&middot;</span> ') || '<span>No links added</span>'}</div>
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
      </article>`).join('');
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

    app.innerHTML = `
      <div class="staff-heading">
        <div><p class="eyebrow">Staff workspace</p><h1>Manage.</h1></div>
        <div class="staff-nav"><a class="back-link" href="/home.html">Public page</a><a class="back-link" href="/movies.html">Movies</a></div>
      </div>
      <div class="staff-tabs" role="tablist" aria-label="Staff tools">
        <button class="staff-tab" id="staff-tab-entries" type="button" role="tab" aria-selected="${activePanel === 'entries'}" aria-controls="staff-panel-entries" data-panel="entries">Links <span>${entries.length}</span></button>
        <button class="staff-tab" id="staff-tab-movies" type="button" role="tab" aria-selected="${activePanel === 'movies'}" aria-controls="staff-panel-movies" data-panel="movies">Movies <span>${movies.length}</span></button>
        <button class="staff-tab" id="staff-tab-announcement" type="button" role="tab" aria-selected="${activePanel === 'announcement'}" aria-controls="staff-panel-announcement" data-panel="announcement">Announcement</button>
        <button class="staff-tab" id="staff-tab-site-text" type="button" role="tab" aria-selected="${activePanel === 'site-text'}" aria-controls="staff-panel-site-text" data-panel="site-text">Site text</button>
      </div>
      <section class="staff-panel${activePanel === 'entries' ? '' : ' staff-panel-hidden'}" id="staff-panel-entries" role="tabpanel" aria-labelledby="staff-tab-entries" ${activePanel === 'entries' ? '' : 'hidden'}>
        <div class="staff-workspace">
          <section aria-labelledby="add-title">
            <h2 class="section-title" id="add-title">Add links</h2>
          <form class="add-form" id="add-form">
            <div class="field"><label for="new-name">Entry name</label><input id="new-name" name="name" type="text" maxlength="200" placeholder="Daily link" required></div>
            <div class="field"><label for="new-links">Links</label><textarea id="new-links" name="links" placeholder="Paste links here, one per line" required></textarea><small>All links stay together under this entry name.</small></div>
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
      <section class="staff-panel${activePanel === 'site-text' ? '' : ' staff-panel-hidden'}" id="staff-panel-site-text" role="tabpanel" aria-labelledby="staff-tab-site-text" ${activePanel === 'site-text' ? '' : 'hidden'}>
        <div class="site-text-editor">
          <form id="site-text-form" class="site-text-form">
            <p class="intro">Edit public page copy. Changes are shared with every visitor.</p>
            ${siteTextForm}
            ${siteText ? '<button class="primary-button" type="submit">Save site text</button>' : ''}
          </form>
        </div>
      </section>`);

    app.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => {
      activePanel = button.dataset.panel;
      render();
    }));
    app.querySelector('#add-form').addEventListener('submit', addEntries);
    app.querySelector('#movie-form').addEventListener('submit', addMovie);
    app.querySelector('#announcement-form').addEventListener('submit', saveAnnouncement);
    app.querySelector('#site-text-form')?.addEventListener('submit', saveSiteText);
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

  async function deleteAll() {
    if (!entries.length || !window.confirm(`Delete all ${entries.length} entries? This cannot be undone.`)) return;
    await mutate('DELETE', { all: true }, 'All entries deleted.');
  }

  loadEntries().catch((error) => {
    app.innerHTML = `<div class="empty"><strong>Staff tools unavailable</strong>${escapeHtml(error.message)}</div>`;
  });
  loadMovies().catch(() => {});
  loadAnnouncement().catch(() => {});
  loadSiteText().catch((error) => notify(error.message));
  window.setInterval(() => { loadEntries().catch(() => {}); }, 15000);
  window.setInterval(() => { loadMovies().catch(() => {}); }, 15000);
  window.setInterval(() => { loadAnnouncement().catch(() => {}); }, 15000);
})();