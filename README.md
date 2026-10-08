# Bobbys-web

Static Cloudflare Pages status board. The public page is `home.html`; `index.html` forwards the root URL to it. Staff tools are served at `/staff` and use Cloudflare Pages Functions plus KV for shared entry storage. Staff editing is password-free and publicly accessible; anyone can add, change, or delete entries.

## Cloudflare Pages setup

1. Deploy this project with Cloudflare Pages Git integration or `wrangler pages deploy`. Pages Functions in `functions/` are required; a static drag-and-drop upload does not deploy them.
2. Set the build output directory to the project root (`.`) and leave the build command empty.
3. In Cloudflare, open **Workers & Pages → your Pages project → Settings → Functions → KV namespace bindings**. Add a binding named exactly `ENTRIES`, create/select a KV namespace for it, and save.
4. Add the binding to the **Production** environment. If testing a Preview deployment, configure it there too.
5. Redeploy the project after saving the binding. Open `/staff` to manage entries.

## Links API

The Pages Function at `/api/links` stores links in the same `ENTRIES` KV namespace under a separate `links` key. `GET` returns the public link list. `POST` adds a link from `{ "url": "https://example.com", "title": "Example" }`, and `DELETE` removes a link from `{ "id": "..." }`. Both write methods require a bearer token.

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
	body: JSON.stringify({ url: 'https://example.com', title: 'Example' })
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

The staff editor and its existing entries write API remain public, so anyone who can reach the site can change or delete board entries. The `API_SECRET` protects only link creation and deletion.