import { isAuthenticated } from './_lib/auth.js';

export async function onRequest({ request, env, next }) {
  const path = new URL(request.url).pathname;
  if (['/staff', '/staff/', '/staff/index.html'].includes(path) && !await isAuthenticated(request, env)) {
    return Response.redirect(new URL('/staff-login.html', request.url), 302);
  }
  return next();
}