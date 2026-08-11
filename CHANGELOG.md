# Changelog

## 1.2.0
- Config: added `reloadOnControllerChange` (default `true`). Set `false` for an app that ALSO registers a SECOND service worker at the same scope (e.g. a separate push-notifications worker) — the two workers hand control back and forth and reload-on-`controllerchange` would turn that silent hand-off into a RELOAD LOOP. With it off, `generateRegistration` omits the reload listener entirely; a new build's SW still installs, activates, and evicts stale caches (the stale-cache fix is unaffected) — only the auto-reload of an already-open tab is skipped, so the tab converges on the next navigation.

## 1.1.0
- Auto-update: `generateServiceWorker` now stamps a per-build `BUILD_VERSION` into the worker (and the effective cache names), so every deploy ships a byte-different SW — the trigger the browser needs to install the update; the activate handler evicts every other build's caches.
- New `generateRegistration` + `sw-register.js` emitted by the CLI: registers with `updateViaCache:'none'`, polls for a new worker on load / interval / refocus, and reloads once on `controllerchange` (guarded against first-install + loops) so an already-open tab picks up a redeploy automatically.
- Config: added `buildVersion`, `scope`, `swUrl`, `updateCheckIntervalMs`. CLI injects `PWA_BUILD_VERSION` (or a timestamp) when unset and writes `sw-register.js` alongside `service-worker.js`.


## 1.0.2

- Fix: the generated service worker now bails out of the `fetch` handler for any
  non-http(s) scheme (`chrome-extension:`, `safari-extension:`, `data:`, …) before
  routing to `cacheFirst`/`networkFirst`. The Cache API rejects `cache.put` for those
  schemes, which surfaced as an uncaught `TypeError: Request scheme 'chrome-extension'
  is unsupported` whenever a browser extension issued an extension-scheme GET that
  matched a static-asset extension. Adds an `isHttpRequest(url)` guard + test.

## 1.0.0 (unreleased)

- Initial extraction (task #186). Converges the diverged app service workers onto
  a single, config-driven generator shipping the FIXED network-first (v2) strategy.
- `generateServiceWorker(config)` — emits a parameterized `service-worker.js`:
  network-first for the public API matcher(s), cache-first for static assets,
  network-only for admin/auth, versioned caches with prefix cleanup on activate,
  `skipWaiting` + `clients.claim`, and a configurable purge-on-publish message
  handler. Deliberately does NOT ship the old stale-while-revalidate (the bug).
- `buildManifest(config)` — builds a `manifest.json` with theme color / branding
  as config (previously hardcoded `#008d5c`).
- `pwa-sw-gen` CLI — writes `service-worker.js` (+ optional `manifest.json`) from
  a `pwa-sw.config.js` into an app's `public/` directory as a build output.
