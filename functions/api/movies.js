import { json, requireSameOrigin } from '../_lib/data.js';

const MOVIES_KEY = 'movies';
const MAX_TITLE_LENGTH = 200;
const MOVIE_KEY = /^movies\/[0-9a-f-]{36}\/(video|poster)$/i;

async function readMovies(env) {
  if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
  const saved = await env.ENTRIES.get(MOVIES_KEY);
  if (!saved) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((movie) => movie && typeof movie.id === 'string' && typeof movie.title === 'string' && MOVIE_KEY.test(movie.videoKey) && MOVIE_KEY.test(movie.posterKey));
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
  if (!env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const videoKey = typeof body?.videoKey === 'string' ? body.videoKey : '';
  const posterKey = typeof body?.posterKey === 'string' ? body.posterKey : '';
  if (!title || title.length > MAX_TITLE_LENGTH || !MOVIE_KEY.test(videoKey) || !videoKey.endsWith('/video') || !MOVIE_KEY.test(posterKey) || !posterKey.endsWith('/poster')) {
    return json({ error: 'Provide a title, video file, and poster image.' }, 400);
  }

  try {
    const [video, poster] = await Promise.all([env.MOVIES.head(videoKey), env.MOVIES.head(posterKey)]);
    if (!video || !poster) return json({ error: 'The video or poster upload could not be found.' }, 400);
    if (!video.httpMetadata?.contentType?.startsWith('video/') || !poster.httpMetadata?.contentType?.startsWith('image/')) {
      return json({ error: 'Upload a video file and an image poster.' }, 400);
    }
    const movies = await readMovies(env);
    const movie = { id: crypto.randomUUID(), title, videoKey, posterKey, createdAt: new Date().toISOString() };
    await env.ENTRIES.put(MOVIES_KEY, JSON.stringify([...movies, movie]));
    return json(movie, 201);
  } catch (error) {
    return json({ error: error.message || 'Could not save the movie.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (!env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);

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
    await env.ENTRIES.put(MOVIES_KEY, JSON.stringify(movies.filter((item) => item.id !== body.id)));
    await Promise.all([env.MOVIES.delete(movie.videoKey), env.MOVIES.delete(movie.posterKey)]);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Could not delete the movie.' }, 503);
  }
}