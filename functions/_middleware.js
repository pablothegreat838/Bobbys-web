import { json } from './_lib/data.js';
import { requireStaff } from './_lib/staff-auth.js';
import { readControlState } from './_lib/staff-control.js';

const PAGE_ROUTES = new Map([
  ['/', 'links'], ['/index', 'links'], ['/index.html', 'links'], ['/home', 'links'], ['/home.html', 'links'], ['/links', 'links'], ['/links.html', 'links'],
  ['/movies', 'movies'], ['/movies.html', 'movies'], ['/terms', 'terms'], ['/terms.html', 'terms']
]);
const CONTENT_SECURITY_POLICY = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https: blob:; frame-src https://drive.google.com; connect-src 'self'";

async function secureResponse(responsePromise) {
  const response = await responsePromise;
  if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('text/html')) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function maintenancePage(message, status = 503) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Temporarily unavailable | Bobby's Web</title><link rel="stylesheet" href="/styles.css"></head><body><header class="topbar"><a class="brand" href="/home.html">bobbys<span>-</span>web</a></header><main class="shutdown-main"><p class="eyebrow">Service notice</p><h1>Temporarily unavailable.</h1><p class="intro">${escapeHtml(message)}</p></main></body></html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': CONTENT_SECURITY_POLICY
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    if (path !== '/api/staff/login' && path !== '/api/staff/session' && path !== '/api/links') {
      if (request.headers.get('Origin') !== url.origin) return json({ error: 'Request origin rejected.' }, 403);
      const denied = await requireStaff(request, env);
      if (denied) return denied;
    }
  }

  if (!['GET', 'HEAD'].includes(request.method) || path.startsWith('/staff') || /\.(?:css|js|png|jpe?g|gif|webp|ico|svg|woff2?)$/i.test(path)) {
    return secureResponse(context.next());
  }

  let state;
  try {
    state = await readControlState(env);
  } catch {
    return secureResponse(context.next());
  }
  if (path.startsWith('/api/staff/')) return context.next();
  if (state.full.enabled) return maintenancePage(state.full.message);
  if (path.startsWith('/api/')) return context.next();

  if (path === '/sl' || path === '/sl/' || path === '/sl.html') {
    if (!state.pages.links.enabled && state.pages.links.redirect) return maintenancePage(state.pages.links.message);
    return new Response(null, { status: 302, headers: { Location: new URL('/home.html', request.url).href, 'Cache-Control': 'no-store' } });
  }

  const page = PAGE_ROUTES.get(path);
  if (!page || state.pages[page].enabled) return secureResponse(context.next());
  if (page === 'links' && state.pages.links.redirect) {
    return new Response(null, { status: 302, headers: { Location: new URL('/sl', request.url).href, 'Cache-Control': 'no-store' } });
  }
  return maintenancePage(state.pages[page].message);
}