import { json, requireSameOrigin } from '../_lib/data.js';

const MOVIES_KEY = 'movies';
const MAX_TITLE_LENGTH = 200;
const MOVIE_KEY = /^movies\/[0-9a-f-]{36}\/(video|poster)$/i;

function validKey(key, kind) {
  return typeof key === 'string' && MOVIE_KEY.test(key) && key.endsWith(`/${kind}`);
}

function normalizeSourceUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2048) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;

  if (['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) {
    const pathMatch = /^\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url.pathname);
    const id = pathMatch?.[1] || (url.pathname === '/open' || url.pathname === '/uc' ? url.searchParams.get('id') : null);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    return { embedUrl: `https://drive.google.com/file/d/${id}/preview` };
  }

  return { sourceUrl: url.href };
}

async function readMovies(env) {
  if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
  const saved = await env.ENTRIES.get(MOVIES_KEY);
  if (!saved) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((movie) => {
    if (!movie || typeof movie.id !== 'string' || typeof movie.title !== 'string' ||
      (movie.videoKey && !validKey(movie.videoKey, 'video')) ||
      (movie.posterKey && !validKey(movie.posterKey, 'poster'))) return [];
    const source = movie.sourceUrl ? normalizeSourceUrl(movie.sourceUrl) : null;
    const embed = movie.embedUrl ? normalizeSourceUrl(movie.embedUrl) : null;
    if (!validKey(movie.videoKey, 'video') && !source?.sourceUrl && !embed?.embedUrl) return [];
    return [{
      ...movie,
      ...(source?.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
      ...(embed?.embedUrl ? { embedUrl: embed.embedUrl } : {})
    }];
  });
}

export async function onRequestGet({ env }) {
  try {
    return json(await readMovies(env));
  } catch (error) {
    return json({ error: error.message || 'Could not load movies.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const videoKey = typeof body?.videoKey === 'string' ? body.videoKey : '';
  const posterKey = typeof body?.posterKey === 'string' ? body.posterKey : '';
  const source = body?.sourceUrl ? normalizeSourceUrl(body.sourceUrl) : null;
  if (!title || title.length > MAX_TITLE_LENGTH || Boolean(source) === validKey(videoKey, 'video') || (videoKey && !validKey(videoKey, 'video')) || (posterKey && !validKey(posterKey, 'poster')) || (body?.sourceUrl && !source)) {
    return json({ error: 'Provide a title and either a video file or a valid HTTPS video link. Google Drive links must be share links to a file.' }, 400);
  }

  try {
    const keys = [videoKey, posterKey].filter(Boolean);
    if (keys.length && !env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);
    const [video, poster] = await Promise.all([
      videoKey ? env.MOVIES.head(videoKey) : null,
      posterKey ? env.MOVIES.head(posterKey) : null
    ]);
    if ((videoKey && !video) || (posterKey && !poster)) return json({ error: 'The video or poster upload could not be found.' }, 400);
    if ((video && !video.httpMetadata?.contentType?.startsWith('video/')) || (poster && !poster.httpMetadata?.contentType?.startsWith('image/'))) {
      return json({ error: 'Upload a video file and an image poster.' }, 400);
    }
    const movies = await readMovies(env);
    const movie = { id: crypto.randomUUID(), title, ...(videoKey ? { videoKey } : source), ...(posterKey ? { posterKey } : {}), createdAt: new Date().toISOString() };
    await env.ENTRIES.put(MOVIES_KEY, JSON.stringify([...movies, movie]));
    return json(movie, 201);
  } catch (error) {
    return json({ error: error.message || 'Could not save the movie.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (typeof body?.id !== 'string' || !body.id) return json({ error: 'Provide a movie id.' }, 400);

  try {
    const movies = await readMovies(env);
    const movie = movies.find((item) => item.id === body.id);
    if (!movie) return json({ error: 'Movie not found.' }, 404);
    const keys = [movie.videoKey, movie.posterKey].filter(Boolean);
    if (keys.length && !env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);
    await env.ENTRIES.put(MOVIES_KEY, JSON.stringify(movies.filter((item) => item.id !== body.id)));
    if (keys.length) await Promise.all(keys.map((key) => env.MOVIES.delete(key)));
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Could not delete the movie.' }, 503);
  }
}