# Changelog

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
