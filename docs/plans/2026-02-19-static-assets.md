# Static Asset Hosting Plan (2026-02-19)

## Current Situation
- Gateway views reference `/styles/tailwind.css`, but no worker actually serves that path.
- HTMX scripts load from a CDN (`https://unpkg.com/htmx.org@2.0.4`).
- No JS/CSS bundling pipeline exists; `@mauntic/ui-kit` exports raw Tailwind source.

## Target Architecture
1. **Build artifacts**
   - Use `pnpm --filter @mauntic/ui-kit build:css` (new script) to compile Tailwind into a single `assets/styles.css`.
   - Bundle any future HTMX helpers into `assets/app.js` via Vite/ESBuild when needed.
2. **Storage**
   - Create an R2 bucket (`mauntic-static-assets`) with:
     - `styles/latest.css`
     - `scripts/latest.js`
     - Versioned files (`styles/<git-sha>.css`) for cache-busting.
   - Alternatively, use Cloudflare Pages for simpler deploys (upload `dist/static/*` as part of CI).
3. **Access from Workers**
   - Gateway (and any worker rendering HTML) fetches assets via:
     - `https://assets.zeluto.com/styles/latest.css` (served from Pages or directly from R2 with a public domain).
     - Provide cache headers (`Cache-Control: public, max-age=31536000, immutable` for versioned assets).
   - Keep a fallback `/styles/tailwind.css` fetch that proxies to the same R2/PAGES location until all references migrate.
4. **CI/CD flow**
   - Add a Turbo pipeline target `static:build` that produces `dist/static`.
   - Extend Cloudflare Workers Deployments workflow to:
     1. Run `pnpm run static:build`.
     2. Upload `dist/static/*` to R2 (via `wrangler r2 object put` or `wrangler pages deploy dist/static`).
     3. Publish workers referencing the new asset URLs (use env var `STATIC_BASE_URL`).

## Next Steps
- ✅ Scaffold the Tailwind build command + `dist/static` output (`pnpm run static:build`).
- ✅ Create R2 bucket + `STATIC_ASSETS` binding for gateway (dev bucket: `mauntic-static-assets-dev`, prod bucket: `mauntic-static-assets`).
- ✅ Update gateway layout/components to respect `STATIC_BASE_URL` so HTML emits the correct `<link>` tag.
- ✅ Document and automate the build/upload workflow:
  - `pnpm run static:upload` now builds CSS and pushes both `styles/latest.css` and `styles/<git-sha>.css` via `scripts/upload-static-assets.mjs`.
  - `.github/workflows/cloudflare-workers.yml` runs the upload once per deploy (dev bucket on PRs, prod bucket on `main`).
- 🔄 Future: bundle HTMX helpers / JS once we add custom scripts (placeholder until requirements land).
