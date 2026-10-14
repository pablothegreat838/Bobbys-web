(() => {
  const app = document.querySelector('#app');
  let movies = [];
  let searchTerm = '';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function mediaUrl(key) {
    return `/api/movie-media?key=${encodeURIComponent(key)}`;
  }

  function render() {
    const text = window.siteText;
    const focusedSearch = document.activeElement?.id === 'movie-search';
    const selectionStart = focusedSearch ? document.activeElement.selectionStart : null;
    const selectionEnd = focusedSearch ? document.activeElement.selectionEnd : null;
    const query = searchTerm.trim().toLowerCase();
    const filtered = movies.filter((movie) => movie.title.toLowerCase().includes(query));
    const cards = filtered.map((movie) => `
      <button class="movie-card" type="button" data-movie="${escapeHtml(movie.id)}" aria-label="Play ${escapeHtml(movie.title)}">
        ${movie.posterKey ? `<img class="movie-poster" src="${escapeHtml(mediaUrl(movie.posterKey))}" alt="${escapeHtml(movie.title)} poster" loading="lazy">` : '<span class="movie-poster movie-poster-placeholder" aria-hidden="true">▶</span>'}
        <span class="movie-card-title">${escapeHtml(movie.title)}</span>
      </button>`).join('');

    app.innerHTML = `
      <p class="eyebrow">${escapeHtml(text('movies.eyebrow', 'The movie collection'))}</p>
      <h1>${escapeHtml(text('movies.title', 'Movies.'))}</h1>
      <div class="movie-search-wrap">
        <svg class="search-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <input class="search-input" id="movie-search" type="search" placeholder="${escapeHtml(text('movies.search', 'Search movies...'))}" value="${escapeHtml(searchTerm)}" autocomplete="off" aria-label="Search movies">
      </div>
      <div class="movie-results-count">${filtered.length} ${filtered.length === 1 ? 'MOVIE' : 'MOVIES'}</div>
      <section class="movie-grid" aria-label="Movies">
        ${cards || `<div class="empty"><strong>${movies.length ? 'No matching movies' : escapeHtml(text('movies.emptyTitle', 'No movies added yet'))}</strong>${movies.length ? 'Try another title.' : escapeHtml(text('movies.emptyMessage', 'New movies will appear here.'))}</div>`}
      </section>
      <dialog class="movie-dialog" id="movie-dialog" aria-label="Movie player">
        <div class="movie-dialog-heading"><strong id="movie-dialog-title"></strong><button class="small-button" id="close-movie" type="button" aria-label="Close movie">Close</button></div>
        <video id="movie-player" controls playsinline></video>
        <iframe id="movie-embed" title="Movie player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </dialog>`;

    const search = app.querySelector('#movie-search');
    search.addEventListener('input', (event) => {
      searchTerm = event.target.value;
      render();
    });
    if (focusedSearch) {
      search.focus();
      if (selectionStart !== null) search.setSelectionRange(selectionStart, selectionEnd);
    }

    const dialog = app.querySelector('#movie-dialog');
    const player = app.querySelector('#movie-player');
    const embed = app.querySelector('#movie-embed');
    app.querySelectorAll('[data-movie]').forEach((button) => button.addEventListener('click', () => {
      const movie = movies.find((item) => item.id === button.dataset.movie);
      if (!movie) return;
      app.querySelector('#movie-dialog-title').textContent = movie.title;
      player.hidden = !movie.videoKey && !movie.sourceUrl;
      embed.hidden = !movie.embedUrl;
      if (movie.embedUrl) {
        embed.src = movie.embedUrl;
      } else {
        player.poster = movie.posterKey ? mediaUrl(movie.posterKey) : '';
        player.src = movie.videoKey ? mediaUrl(movie.videoKey) : movie.sourceUrl;
      }
      dialog.showModal();
      if (!movie.embedUrl) player.play().catch(() => {});
    }));
    app.querySelector('#close-movie').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      player.pause();
      player.removeAttribute('src');
      player.removeAttribute('poster');
      player.load();
      embed.removeAttribute('src');
    });
  }

  async function loadMovies() {
    await window.siteContentReady;
    const response = await fetch('/api/movies', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Movies could not be loaded.');
    movies = result;
    render();
  }

  loadMovies().catch((error) => {
    app.innerHTML = `<div class="board-warning" role="status"><strong>Movies temporarily unavailable</strong>${escapeHtml(error.message)}</div>`;
  });
})();