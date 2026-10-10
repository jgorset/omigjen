# Hosting

Cloudflare Pages serves the app. A Pages Function uses Apify's `marielise.dev/youtube-video-downloader` to fetch public YouTube audio, then streams the MP3 to the browser. The API token stays in Cloudflare's secret store. Local development continues to use yt-dlp and FFmpeg.

For a separate deployment, sign in with `npx wrangler login`, change the project and D1 database identifiers in `wrangler.jsonc`, then:

```sh
wrangler d1 create omigjen-imports
wrangler d1 migrations apply IMPORTS --remote
wrangler pages secret put APIFY_TOKEN --project-name omigjen
npm run build
wrangler pages deploy dist --project-name omigjen
```

Use `npx wrangler` if Wrangler is not on your PATH. Generate environment types with `npx wrangler types --include-runtime=false`. Test Pages locally with `npx wrangler pages dev dist`, applying the D1 migrations locally first and putting the API token in an ignored `.dev.vars` file.

Apify's free account has $5 monthly credit and five concurrent runs. The downloader's published MP3 rate is $0.01 per started minute, plus small storage/transfer charges. Imports stop when the free credit runs out; previously saved browser sessions remain available. Paid residential fallback is disabled, and each run has a $0.50 cap and a five-minute timeout. Audio too large for the 200 MB limit or this budget fails with a retryable message.

D1 shares recent results for six days, within Apify's seven-day free-plan retention. New jobs are limited atomically to three per minute and twenty per UTC day across the app, and six per hour per connection. IP addresses are salted and hashed before the short-lived limit record is stored. Closing the import dialog cancels the browser request; an already-started shared job may finish and remain available to another visitor.

The downloader build is pinned to the tested `0.0.65`. Re-test a newer build before changing it in `server/hosted-youtube.ts`.
