# Deployment

Omigjen is a static Cloudflare Pages project, served at https://omigjen.johannesgorset.com.
The subdomain is a CNAME to `omigjen.pages.dev` in the existing Route 53 zone.

```sh
npm run build
npx wrangler pages deploy dist --project-name omigjen --branch main
```

Only `dist/` is uploaded. There are no Pages Functions, databases, or server-side audio storage.
YouTube downloads remain available when running the app locally.

Saved sessions belong to each browser and origin. Sessions from localhost do not appear on the public site.
