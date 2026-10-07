# Bobbys-web

Static Cloudflare Pages status board. The public page is `home.html`; `index.html` forwards the root URL to it. Staff tools are served at `/staff` and use Cloudflare Pages Functions plus KV for shared entry storage. Staff editing is password-free and publicly accessible; anyone can add, change, or delete entries.

## Cloudflare Pages setup

1. Deploy this project with Cloudflare Pages Git integration or `wrangler pages deploy`. Pages Functions in `functions/` are required; a static drag-and-drop upload does not deploy them.
2. Set the build output directory to the project root (`.`) and leave the build command empty.
3. In Cloudflare, open **Workers & Pages → your Pages project → Settings → Functions → KV namespace bindings**. Add a binding named exactly `ENTRIES`, create/select a KV namespace for it, and save.
4. Add the binding to the **Production** environment. If testing a Preview deployment, configure it there too.
5. Redeploy the project after saving the binding. Open `/staff` to manage entries.

No password or session secrets are required. The staff editor and its write API are public, so anyone who can reach the site can change or delete board entries.