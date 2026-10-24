# Bobbys-web

Static Cloudflare Pages link collection. The public page is `home.html`; `index.html` forwards the root URL to it. The staff editor is served at `/staff` and uses Cloudflare Pages Functions plus KV for shared content. All staff management writes require a server-verified staff session.

## Cloudflare Pages setup

1. Deploy this project with Cloudflare Pages Git integration or `wrangler pages deploy`. Pages Functions in `functions/` are required; a static drag-and-drop upload does not deploy them.
2. Set the build output directory to the project root (`.`) and leave the build command empty.
3. In Cloudflare, open **Workers & Pages → your Pages project → Settings → Functions → KV namespace bindings**. Add a binding named exactly `ENTRIES`, create/select a KV namespace for it, and save.
4. In **Settings → Functions → R2 bucket bindings**, add a binding named exactly `MOVIES` and select a bucket for uploaded posters and video files.
5. Add both bindings to the **Production** environment. If testing a Preview deployment, configure them there too.
6. In **Settings → Variables and Secrets**, add a secret named `STAFF_PASSWORD` with the required staff password and a secret named `STAFF_SESSION_SECRET` with at least 32 random characters (for example, generate one with `openssl rand -base64 32`). Configure both in every environment where staff access is needed. Do not commit either secret.
7. Redeploy the project after saving the bindings and secret. Open `/staff` to sign in with the staff password, manage the site, and use the Control tab for maintenance settings.

## Data persistence

Entries, their display order, movie details, movie order, the current announcement, editable page text, selected site theme, custom browser tab title, active favicon version, staff control settings, and saved safe command codes are stored in the `ENTRIES` KV namespace. Use **Site text** in `/staff` to change copy on the Links, Movies, and Terms pages and the shared footer. Use **Theme** to apply the Default, Halloween, or Christmas palette, set the browser tab title, and upload a PNG, ICO, JPEG, GIF, or WebP favicon for every visitor. The **Control** tab can temporarily disable the full site or an individual page, customize the visitor message, and restore availability. Code `#565` redirects the links page to the unlisted `/sl` notice page. Custom codes select only from the predefined safe actions; they do not execute JavaScript or shell commands. Announcements appear on the links page until their scheduled expiry and are then hidden automatically. Uploaded posters and videos are also saved to the `MOVIES` R2 bucket. Movie links can use a Google Drive file share URL or a direct HTTPS video URL; Google Drive files must be shared with viewers. Updating or redeploying the website does not erase this data. Keep the same KV namespace and R2 bucket connected to the Production environment for every deployment. Preview deployments and local Wrangler storage can use separate data, so changes made there do not automatically appear on Production. KV propagation is eventually consistent, so maintenance changes may take a short time to reach every edge location. Deleting or replacing the bound namespace or bucket will make its data unavailable.

The `/staff` editor and its write APIs require a server-verified staff session. Set `STAFF_PASSWORD` to the required password in Cloudflare Secrets; do not put its value in the repository. The password is intentionally simple as requested, so do not reuse it for any other account. Login sessions are signed with `STAFF_SESSION_SECRET`, stored in an HttpOnly, SameSite cookie, and expire after 12 hours. Login attempts are rate-limited per Cloudflare client IP. Public API reads remain available.

## Links API

The Pages Function at `/api/links` stores standalone links in the same `ENTRIES` KV namespace under a separate `links` key for bot integrations. `GET` returns the public link list. `POST` adds a link from `{ "url": "https://example.com", "title": "Example", "category": "websites" }`, `PATCH` updates a category from `{ "id": "...", "category": "movies" }`, and `DELETE` removes a link from `{ "id": "..." }`. Categories are `websites`, `eagler`, and `movies`; omitted categories default to `websites`. Write methods require a bearer token. The home page combines these standalone links with named entries from `/api/entries`.

### Configure the API secret

In **Workers & Pages → your Pages project → Settings → Variables and Secrets**, add a secret named `API_SECRET` with a long, randomly generated value. Configure it for Production and for Preview too if the API should work on preview deployments, then redeploy. Keep this value in the Discord bot's server-side environment; never include it in website JavaScript or other frontend files.

### Discord bot requests

Use your deployed site's origin in place of `https://your-site.pages.dev`. Keep `API_SECRET` in the bot's environment, not in code committed to the website repository.

```js
const site = 'https://your-site.pages.dev';
const token = process.env.API_SECRET;

const listResponse = await fetch(`${site}/api/links`);
const links = await listResponse.json();

const addResponse = await fetch(`${site}/api/links`, {
	method: 'POST',
	headers: {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	},
	body: JSON.stringify({ url: 'https://example.com', title: 'Example', category: 'websites' })
});
const addedLink = await addResponse.json();

const deleteResponse = await fetch(`${site}/api/links`, {
	method: 'DELETE',
	headers: {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	},
	body: JSON.stringify({ id: addedLink.id })
});
const deleted = await deleteResponse.json();
```

The `API_SECRET` protects standalone link creation and deletion for bot integrations; browser staff writes use the staff session. Video and poster objects are uploaded to R2 in chunks and streamed from `/api/movie-media` with byte-range support. There is no per-entry link-count limit, though Cloudflare KV still imposes its per-value storage limit on the complete entries board.