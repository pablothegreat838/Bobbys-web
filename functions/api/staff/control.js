import { json } from '../../_lib/data.js';
import { normalizeControlState, readControlState, writeControlState } from '../../_lib/staff-control.js';
import { requireStaff } from '../../_lib/staff-auth.js';

export async function onRequestGet({ request, env }) {
  const denied = await requireStaff(request, env);
  if (denied) return denied;
  try {
    return json(normalizeControlState(await readControlState(env)));
  } catch {
    return json({ error: 'Could not load staff controls.' }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  const denied = await requireStaff(request, env);
  if (denied) return denied;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid staff controls.' }, 400);
  if (typeof body.full?.enabled !== 'boolean') return json({ error: 'Choose whether the full website is enabled.' }, 400);
  const state = normalizeControlState(body);
  if (typeof body.full?.message !== 'string' || body.full.message.trim().length > 500 || !body.full.message.trim()) {
    return json({ error: 'The full-site message must contain 1 to 500 characters.' }, 400);
  }
  for (const page of ['links', 'movies', 'terms']) {
    if (typeof body.pages?.[page]?.enabled !== 'boolean' || typeof body.pages[page].message !== 'string' ||
      !body.pages[page].message.trim() || body.pages[page].message.trim().length > 500) {
      return json({ error: 'Each page needs an enabled state and a message of 1 to 500 characters.' }, 400);
    }
    if (page === 'links' && typeof body.pages.links.redirect !== 'boolean') {
      return json({ error: 'Choose whether the links page redirects while disabled.' }, 400);
    }
  }
  if (!Array.isArray(body.customCodes) || body.customCodes.length > 30 || body.customCodes.some((item) =>
    !item || typeof item.code !== 'string' || !/^#[0-9]{3,8}$/.test(item.code) ||
    ['#0998', '#7878', '#565'].includes(item.code) || typeof item.action !== 'string' ||
    !['full-on', 'full-off', 'links-off', 'links-off-redirect', 'links-on', 'movies-off', 'movies-on', 'terms-off', 'terms-on'].includes(item.action))) {
    return json({ error: 'Custom codes must use a unique numeric code and a supported safe action.' }, 400);
  }
  if (new Set(body.customCodes.map((item) => item.code)).size !== body.customCodes.length) {
    return json({ error: 'Custom codes must be unique.' }, 400);
  }
  try {
    await writeControlState(env, state);
    return json(state);
  } catch {
    return json({ error: 'Could not save staff controls.' }, 503);
  }
}