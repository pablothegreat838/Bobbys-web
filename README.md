# Bobbys-web

Static Cloudflare Pages status board. The public page is `home.html`; `index.html` forwards the root URL to it. Staff tools are served at `/staff` and use Cloudflare Pages Functions plus KV for server-protected edits and shared entry storage.

## Cloudflare Pages setup

1. Deploy this project with Cloudflare Pages Git integration or `wrangler pages deploy`. Pages Functions in `functions/` are required; a static drag-and-drop upload does not deploy them.
2. Set the build output directory to the project root (`.`) and leave the build command empty.
3. Create a KV namespace, then add a Pages Functions KV binding named `ENTRIES` that points to it.
4. In the Pages project's environment variables, add `STAFF_PASSWORD` as a secret. Set it to `8989` as requested, though a longer password is much safer.
5. Add `SESSION_SECRET` as a secret with a unique random value of at least 32 bytes. For example, generate one with `openssl rand -hex 32` and enter the result in Cloudflare.
6. Deploy again after setting the binding and secrets. Open `/staff` to sign in.

The staff password and entry mutations are checked by Pages Functions; the password is not included in browser JavaScript. Sessions are signed, secure, HttpOnly cookies and expire after two hours. Login attempts are limited to five per IP per ten minutes using the configured KV namespace.