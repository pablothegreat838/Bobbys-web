import { json, requireSameOrigin } from '../_lib/data.js';
import { defaultSiteContent } from '../_lib/site-content.js';

const CONTENT_KEY = 'site-content';
const ICON_PREFIX = 'site-icons/';
const MAX_ICON_SIZE = 256 * 1024;
const ICON_TYPES = new Set([
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/jpeg',
  'image/gif',
  'image/webp'
]);
const VERSION_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function hasValidSignature(type, bytes) {
  if (type === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === 'image/x-icon' || type === 'image/vnd.microsoft.icon') return bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0;
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/gif') return bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)).startsWith('GIF8');
  if (type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  return false;
}

export async function onRequestPost({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (!env.MOVIES || !env.ENTRIES) return json({ error: 'The MOVIES or ENTRIES binding is not configured.' }, 503);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Upload a favicon using a multipart form.' }, 400);
  }
  const file = form.get('favicon');
  const siteTitle = String(form.get('siteTitle') || '').trim();
  if (siteTitle.length > 120) return json({ error: 'The browser tab title must be no longer than 120 characters.' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function' || !ICON_TYPES.has(file.type) || file.size < 1 || file.size > MAX_ICON_SIZE) {
    return json({ error: 'Choose a PNG, ICO, JPEG, GIF, or WebP favicon up to 256 KB.' }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(file.type, bytes)) return json({ error: 'The selected file does not match its image type.' }, 400);

  const previous = await env.ENTRIES.get(CONTENT_KEY);
  let content;
  try {
    const saved = previous ? JSON.parse(previous) : {};
    content = { ...defaultSiteContent(), ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}) };
  } catch {
    return json({ error: 'Saved site settings could not be read.' }, 503);
  }

  const previousVersion = content.favicon;
  const version = crypto.randomUUID();
  const key = `${ICON_PREFIX}${version}`;
  try {
    await env.MOVIES.put(key, bytes, { httpMetadata: { contentType: file.type } });
    content.siteTitle = siteTitle;
    content.favicon = version;
    await env.ENTRIES.put(CONTENT_KEY, JSON.stringify(content));
    if (VERSION_PATTERN.test(previousVersion) && previousVersion !== version) {
      await env.MOVIES.delete(`${ICON_PREFIX}${previousVersion}`).catch(() => {});
    }
    return json({ content });
  } catch (error) {
    await env.MOVIES.delete(key).catch(() => {});
    return json({ error: error.message || 'Favicon could not be saved.' }, 503);
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);
  const version = new URL(request.url).searchParams.get('v');
  if (!VERSION_PATTERN.test(version || '')) return json({ error: 'Invalid favicon version.' }, 400);

  try {
    const object = await env.MOVIES.get(`${ICON_PREFIX}${version}`);
    if (!object) return json({ error: 'Favicon not found.' }, 404);
    const headers = new Headers({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    object.writeHttpMetadata(headers);
    return new Response(object.body, { headers });
  } catch (error) {
    return json({ error: error.message || 'Favicon could not be loaded.' }, 503);
  }
}