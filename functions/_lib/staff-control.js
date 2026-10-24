export const CONTROL_KEY = 'staff-control';
export const DEFAULT_LINK_MESSAGE = 'sorry but code #565 has been executed the website will be up shortly';
export const SAFE_ACTIONS = [
  'full-on', 'full-off',
  'links-off', 'links-off-redirect', 'links-on',
  'movies-off', 'movies-on', 'terms-off', 'terms-on'
];

export function defaultControlState() {
  return {
    full: { enabled: false, message: 'This website is temporarily unavailable. Please check back soon.' },
    pages: {
      links: { enabled: true, redirect: false, message: DEFAULT_LINK_MESSAGE },
      movies: { enabled: true, message: 'This page is temporarily unavailable. Please check back soon.' },
      terms: { enabled: true, message: 'This page is temporarily unavailable. Please check back soon.' }
    },
    customCodes: []
  };
}

function cleanMessage(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 500 ? value.trim() : fallback;
}

export function normalizeControlState(value) {
  const state = defaultControlState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return state;
  if (typeof value.full?.enabled === 'boolean') state.full.enabled = value.full.enabled;
  state.full.message = cleanMessage(value.full?.message, state.full.message);
  for (const page of Object.keys(state.pages)) {
    const saved = value.pages?.[page];
    if (typeof saved?.enabled === 'boolean') state.pages[page].enabled = saved.enabled;
    if (page === 'links' && typeof saved?.redirect === 'boolean') state.pages.links.redirect = saved.redirect;
    state.pages[page].message = cleanMessage(saved?.message, state.pages[page].message);
  }
  if (Array.isArray(value.customCodes)) {
    state.customCodes = value.customCodes.slice(0, 30).filter((item) => item &&
      typeof item.code === 'string' && /^#[0-9]{3,8}$/.test(item.code) &&
      typeof item.action === 'string' && SAFE_ACTIONS.includes(item.action) &&
      !['#0998', '#7878', '#565'].includes(item.code)).map(({ code, action }) => ({ code, action }));
    state.customCodes = [...new Map(state.customCodes.map((item) => [item.code, item])).values()];
  }
  return state;
}

export async function readControlState(env) {
  if (!env.ENTRIES) throw new Error('KV unavailable');
  const saved = await env.ENTRIES.get(CONTROL_KEY);
  if (!saved) return defaultControlState();
  try {
    return normalizeControlState(JSON.parse(saved));
  } catch {
    return defaultControlState();
  }
}

export async function writeControlState(env, state) {
  if (!env.ENTRIES) throw new Error('KV unavailable');
  await env.ENTRIES.put(CONTROL_KEY, JSON.stringify(normalizeControlState(state)));
}

export function applySafeAction(state, action) {
  if (action === 'full-on') state.full.enabled = true;
  if (action === 'full-off') state.full.enabled = false;
  if (action === 'links-off') Object.assign(state.pages.links, { enabled: false, redirect: false });
  if (action === 'links-off-redirect') Object.assign(state.pages.links, { enabled: false, redirect: true });
  if (action === 'links-on') Object.assign(state.pages.links, { enabled: true, redirect: false });
  if (action === 'movies-off') state.pages.movies.enabled = false;
  if (action === 'movies-on') state.pages.movies.enabled = true;
  if (action === 'terms-off') state.pages.terms.enabled = false;
  if (action === 'terms-on') state.pages.terms.enabled = true;
}