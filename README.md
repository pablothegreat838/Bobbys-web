# Bobbys-web

Static Cloudflare Pages link collection. The public page is `home.html`; `index.html` forwards the root URL to it. Bob's editor is served at `/staff` and uses Cloudflare Pages Functions plus KV for shared entry storage. Staff editing is password-free and publicly accessible; anyone can add or delete entries.

## Cloudflare Pages setup

1. Deploy this project with Cloudflare Pages Git integration or `wrangler pages deploy`. Pages Functions in `functions/` are required; a static drag-and-drop upload does not deploy them.
2. Set the build output directory to the project root (`.`) and leave the build command empty.
3. In Cloudflare, open **Workers & Pages → your Pages project → Settings → Functions → KV namespace bindings**. Add a binding named exactly `ENTRIES`, create/select a KV namespace for it, and save.
4. In **Settings → Functions → R2 bucket bindings**, add a binding named exactly `MOVIES` and select a bucket for uploaded posters and video files.
5. Add both bindings to the **Production** environment. If testing a Preview deployment, configure them there too.
6. Redeploy the project after saving the bindings. Open `/staff` to add named entries, paste multiple links into each entry, and choose a category; use its Movies section to publish a title with a poster and video file.

## Data persistence

Entries and movie details are saved to the `ENTRIES` KV namespace as they are changed; uploaded posters and videos are saved to the `MOVIES` R2 bucket. Updating or redeploying the website does not erase this data. Keep the same KV namespace and R2 bucket connected to the Production environment for every deployment. Preview deployments and local Wrangler storage can use separate data, so changes made there do not automatically appear on Production. Deleting or replacing the bound namespace or bucket will make its data unavailable.

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

The staff editor and its write APIs remain public, so anyone who can reach the site can change or delete entries and publish or remove movies. The `API_SECRET` protects only link creation and deletion. Video and poster objects are uploaded to R2 in chunks and streamed from `/api/movie-media` with byte-range support. There is no per-entry link-count limit, though Cloudflare KV still imposes its per-value storage limit on the complete entries board.