# Changelog

## 1.3.0
- Emitted code is now `const`/`let`, never `var`. The generated `service-worker.js` and
  `sw-register.js` are linted by every consuming app (they live in `public/`), and `no-var`
  failed 27 times in `kefi-web` alone. Each declaration was decided by measuring whether it is
  actually reassigned -- `hadController` and `refreshing` are `let`, everything else `const` --
  because a service worker that throws `TypeError: Assignment to constant variable` never
  installs, and a worker that never installs silently stops delivering updates to every user
  of every portal.
- `BUILD_VERSION` is now genuinely referenced by the worker: `API_CACHE` / `STATIC_CACHE` are
  derived from it in-worker rather than being pre-interpolated by the generator. Same emitted
  cache names, but the constant is no longer dead code that lint flags as unused.
  The bare-prefix constants are deliberately kept for the activate handler -- `cachePrefix()`
  strips the `-vN` schema segment, so `PREFIX + BUILD_VERSION` is NOT the cache name.
- `catch (e) {}` -> `catch (_e) {}` and the stale `no-console` disable directive removed
  (`reportUnusedDisableDirectives`).
- Dev deps: `npm audit` taken from 5 vulnerabilities (4 high) to 1 low, via
  `eslint-plugin-sonarjs` ^2 -> ^4.2.0. The package ships zero runtime dependencies
  (`dependencies` and `peerDependencies` are both `{}`), so none of these ever reached a
  consumer -- but the audit gate was red and now is not.
- Registered 5 Tilt resources (`npm-pwa-sw-{lint,typecheck,unit-tests,build,security-audit}`).
  The package previously had NO Tilt resource at all, so nothing scheduled ever ran its tests
  -- and its OUTPUT is what delivers updates to users of all 7 portals.

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
