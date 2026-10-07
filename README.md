# Bobbys-web

Static Cloudflare Pages status board. The public page is `home.html`; `index.html` forwards the root URL to it. Staff tools are served at `/staff` and use Cloudflare Pages Functions plus KV for server-protected edits and shared entry storage.

## Cloudflare Pages setup

1. Deploy this project with Cloudflare Pages Git integration or `wrangler pages deploy`. Pages Functions in `functions/` are required; a static drag-and-drop upload does not deploy them.
2. Set the build output directory to the project root (`.`) and leave the build command empty.
3. In Cloudflare, open **Workers & Pages → your Pages project → Settings → Functions → KV namespace bindings**. Add a binding named exactly `ENTRIES`, create/select a KV namespace for it, and save.
4. In that project's **Settings → Variables and Secrets**, add `STAFF_PASSWORD` as a secret. Set it to `8989` as requested, though a longer password is much safer.
5. Add `SESSION_SECRET` there as a secret with a unique random value of at least 32 bytes. For example, generate one with `openssl rand -hex 32` and enter the result in Cloudflare.
6. Add the binding and secrets to the **Production** environment. If testing a Preview deployment, configure them there too.
7. Redeploy the project after saving the binding and secrets. Open `/staff` to sign in.

The staff password and entry mutations are checked by Pages Functions; the password is not included in browser JavaScript. Sessions are signed, secure, HttpOnly cookies and expire after two hours. Login attempts are limited to five per IP per ten minutes using the configured KV namespace.