import { json } from '../_lib/data.js';

const OBJECT_KEY = /^movies\/[0-9a-f-]{36}\/(video|poster)$/i;

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  if (!match || (!match[1] && !match[2])) return null;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[2] && match[1] ? Number(match[2]) : size - 1;
  if (!match[1]) end = size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, end };
}

export async function onRequestGet({ request, env }) {
  if (!env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);
  const key = new URL(request.url).searchParams.get('key');
  if (!OBJECT_KEY.test(key || '')) return json({ error: 'Invalid media key.' }, 400);

  try {
    const head = await env.MOVIES.head(key);
    if (!head) return json({ error: 'Media not found.' }, 404);
    const headers = new Headers({ 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    head.writeHttpMetadata(headers);
    headers.set('ETag', head.httpEtag);
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      const range = parseRange(rangeHeader, head.size);
      if (!range) {
        headers.set('Content-Range', `bytes */${head.size}`);
        return new Response(null, { status: 416, headers });
      }
      const object = await env.MOVIES.get(key, { range: { offset: range.offset, length: range.length } });
      headers.set('Content-Range', `bytes ${range.offset}-${range.end}/${head.size}`);
      headers.set('Content-Length', String(range.length));
      return new Response(object.body, { status: 206, headers });
    }

    const object = await env.MOVIES.get(key);
    headers.set('Content-Length', String(head.size));
    return new Response(object.body, { headers });
  } catch (error) {
    return json({ error: 'Could not load media.' }, 503);
  }
}