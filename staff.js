(() => {
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const categories = ['websites', 'eagler', 'movies'];
  let entries = [];
  let movies = [];
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
    const rows = entries.map((entry, index) => `
      <article class="manage-entry">
        <div class="manage-top">
          <div class="manage-entry-copy">
            <strong>${index + 1}. ${escapeHtml(entry.name)}</strong>
            <div class="manage-entry-links">${(entry.links || []).map((url) => `<span>${escapeHtml(url)}</span>`).join(' <span aria-hidden="true">&middot;</span> ') || '<span>No links added</span>'}</div>
            <span class="entry-category">${escapeHtml(entry.category || 'websites')}</span>
          </div>
          <div class="manage-actions">
            <button class="small-button remove" type="button" data-delete="${escapeHtml(entry.id)}" aria-label="Delete entry">Delete</button>
          </div>
        </div>
      </article>`).join('');
    const movieRows = movies.map((movie) => `
      <article class="manage-entry manage-movie">
        <img src="/api/movie-media?key=${encodeURIComponent(movie.posterKey)}" alt="" loading="lazy">
        <strong>${escapeHtml(movie.title)}</strong>
        <button class="small-button remove" type="button" data-delete-movie="${escapeHtml(movie.id)}" aria-label="Delete ${escapeHtml(movie.title)}">Delete</button>
      </article>`).join('');

    app.innerHTML = `
      <div class="staff-heading">
        <div><p class="eyebrow">Bob</p><h1>Bob.</h1><p class="intro">Create named link entries and publish movies.</p></div>
        <div class="staff-nav"><a class="back-link" href="/home.html">Public page</a><a class="back-link" href="/movies.html">Movies</a></div>
      </div>
      <div class="staff-grid">
        <section aria-labelledby="add-title">
          <h2 class="section-title" id="add-title">Add entries</h2>
          <form class="add-form" id="add-form">
            <div class="field"><label for="new-name">Entry name</label><input id="new-name" name="name" type="text" maxlength="200" placeholder="Daily link" required></div>
            <div class="field"><label for="new-links">Links</label><textarea id="new-links" name="links" placeholder="Paste links here, one per line" required></textarea><small>All links stay together under this entry name.</small></div>
            <div class="field"><label for="new-category">Category</label><select id="new-category" name="category">${categories.map((category) => `<option value="${category}">${category[0].toUpperCase() + category.slice(1)}</option>`).join('')}</select></div>
            <button class="primary-button" type="submit">Add entry</button>
          </form>
        </section>
        <section aria-labelledby="list-title">
          <div class="list-heading"><h2 class="section-title" id="list-title">Current entries <span class="result-count">(${entries.length})</span></h2><button class="small-button remove" id="delete-all" type="button" ${entries.length ? '' : 'disabled'}>Delete all</button></div>
          <div class="manage-list">${rows || '<div class="manage-empty">No entries yet. Add one to get started.</div>'}</div>
        </section>
      </div>`;

    app.insertAdjacentHTML('beforeend', `
      <section class="staff-movies" aria-labelledby="movies-title">
        <h2 class="section-title" id="movies-title">Movies <span class="result-count">(${movies.length})</span></h2>
        <form class="add-form movie-add-form" id="movie-form">
          <div class="field"><label for="movie-title">Movie name</label><input id="movie-title" name="title" type="text" maxlength="200" placeholder="Movie title" required></div>
          <div class="field"><label for="movie-poster">Poster image</label><input id="movie-poster" name="poster" type="file" accept="image/*" required></div>
          <div class="field"><label for="movie-video">Video file</label><input id="movie-video" name="video" type="file" accept="video/*" required><small>Large videos upload in smaller parts; keep this page open until publishing finishes.</small></div>
          <button class="primary-button" type="submit">Publish movie</button>
        </form>
        <div class="manage-movie-list">${movieRows || '<div class="manage-empty">No movies published yet.</div>'}</div>
      </section>`);

    app.querySelector('#add-form').addEventListener('submit', addEntries);
    app.querySelector('#movie-form').addEventListener('submit', addMovie);
    app.querySelector('#delete-all').addEventListener('click', deleteAll);
    app.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => mutate('DELETE', { id: button.dataset.delete }, 'Entry deleted.')));
    app.querySelectorAll('[data-delete-movie]').forEach((button) => button.addEventListener('click', () => deleteMovie(button.dataset.deleteMovie)));
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
    submit.disabled = true;
    movieUploadInProgress = true;
    try {
      const posterKey = await uploadMovieFile(data.get('poster'), 'poster');
      uploadedKeys.push({ key: posterKey, kind: 'poster' });
      const videoKey = await uploadMovieFile(data.get('video'), 'video');
      uploadedKeys.push({ key: videoKey, kind: 'video' });
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: String(data.get('title')).trim(), posterKey, videoKey }),
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
    if (!window.confirm('Delete this movie and its uploaded files?')) return;
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
  window.setInterval(() => { loadEntries().catch(() => {}); }, 15000);
  window.setInterval(() => { loadMovies().catch(() => {}); }, 15000);
})();