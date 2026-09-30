# @dloizides/pwa-sw

Config-driven PWA **service worker generator** + **manifest builder**. Ships the
*fixed* network-first caching strategy (versioned cache + purge-on-publish), so
an edit/activation is reflected on the next public load instead of serving a
day-old payload.

## Why

Two app service workers drifted: one was network-first (correct), one was still
stale-while-revalidate with a 24h max-age (served stale content). This package is
the single source of truth — each app supplies *config*, the package owns the
*strategy*.

| Package owns | App owns (config) |
|---|---|
| network-first / cache-first / network-only strategies | cache names + version strings |
| versioned-cache cleanup on `activate` | which API paths are public (cacheable) |
| `skipWaiting` + `clients.claim` | purge message type |
| purge-on-publish message handler | static-asset extensions |
| manifest assembly | manifest name / colors / icons |

## Install

```jsonc
// dev (before publish): local file reference
"@dloizides/pwa-sw": "file:../NpmPackages/packages/pwa-sw"
// after publish:
"@dloizides/pwa-sw": "^1.0.0"
```

## Usage — generate at build time (recommended)

`pwa-sw.config.js` (CommonJS, lives in the app root):

```js
module.exports = {
  serviceWorker: {
    apiCacheName: 'public-survey-api-v2',     // bump the version to evict stale entries on deploy
    staticCacheName: 'static-assets-v1',
    publicApiPathMatchers: ['/public/surveys/', '/public/questioner/'],
    purgeMessageType: 'PURGE_PUBLIC_CACHE',   // optional
  },
  manifest: {
    name: 'Erevna',
    shortName: 'Erevna',
    description: 'Surveys and forms',
    themeColor: '#008d5c',
    icons: [{ src: '/icons/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }],
  },
};
```

```jsonc
// package.json
"scripts": {
  "generate:sw": "pwa-sw-gen ./pwa-sw.config.js ./public"
}
```

Run `npm run generate:sw` → writes `public/service-worker.js` (and `public/manifest.json`
if `manifest` is present). Commit the output or regenerate in a prebuild step.

## Usage — programmatic

```ts
import { generateServiceWorker, buildManifest } from '@dloizides/pwa-sw';

const swSource = generateServiceWorker({
  apiCacheName: 'public-menu-api-v2',
  staticCacheName: 'static-assets-v1',
  publicApiPathMatchers: ['/public/menus/'],
});

const manifest = buildManifest({ name: 'Katalogos', shortName: 'Katalogos', description: '…', themeColor: '#008d5c', icons: [...] });
```

## Freshness: every deploy reaches every player (1.4.0)

The generated worker never serves a previous build:

| Request | Strategy |
|---|---|
| HTML (navigation, or `Accept: text/html`) | network-first; offline: cached copy, else the cached shell at `scope` |
| Static asset WITHOUT a content hash in its filename (`hero.png`, `Build/game.wasm`) | network-first with `cache: 'no-cache'` (a 304 when unchanged); cache = offline fallback |
| Content-hashed asset (`entry-5f3c9a1b.js`) | cache-first; its URL changes when its bytes do |
| `service-worker.js`, `sw-register.js` | never intercepted |

Caches are keyed by the per-build `BUILD_VERSION`; `activate` deletes every other build's
caches, then `skipWaiting` + `clients.claim` + the snippet's `controllerchange` reload hand an
open tab to the new build. Options: `freshUnhashedAssets` (default `true`), `hashedAssetPattern`
(RegExp source, default `DEFAULT_HASHED_ASSET_PATTERN`), `unhashedPathMatchers`, `staticOnly`.

**Zombie self-heal** (`selfHeal`, default = `reloadOnControllerChange`): after registering, the
snippet asks the controlling worker for its build (`PWA_SW_GET_VERSION`). If it still differs from
the page's build after `selfHealGraceMs` (default 10 s, which covers the normal hand-off), or the
worker does not answer (a legacy hand-written SW), the snippet unregisters the workers whose scope
covers the page, deletes all caches and reloads ONCE. A `sessionStorage` key per page build
prevents a loop. The page build is the stamped version, or `<meta name="pwa-build-version">`.

**Retiring an old worker URL** (`retireWorkerUrls`, 1.5.0): moving from a hand-written worker at
`/sw.js` to `/service-worker.js` strands returning players. The old worker keeps answering
navigations from its cache with the OLD page, which never loads `sw-register.js`, and a 404 on the
browser's update check of `/sw.js` does NOT unregister it. Set
`retireWorkerUrls: ['/sw.js']` and `pwa-sw-gen` writes a kill-switch worker to that path: on the
next update check it installs, skips waiting, deletes every cache, unregisters itself and navigates
each window it controlled once, so the page reloads from the network and registers the new worker.

- **The old URL must keep being served (200, never 404)** — deploy the generated file there for as
  long as any player might still run the old worker (months, not days).
- **Serve it with `Cache-Control: no-cache`**, like `service-worker.js`.
- Each URL must be an absolute `.js` path inside `scope`, and not the live worker or
  `sw-register.js` (the generator throws otherwise).

## Adopting it in a game

1. `npm i -D @dloizides/pwa-sw`, then `pwa-sw.config.js`:
   ```js
   const { unityWebGLPreset } = require('@dloizides/pwa-sw');
   module.exports = { serviceWorker: unityWebGLPreset({ name: 'ghosty' }), manifest: { /* … */ } };
   ```
   Unity preset: `Build/*.wasm`, `*.data`, `*.framework.js`, `*.loader.js` (and `.br`/`.gz`/
   `.unityweb` variants) and `TemplateData/*` are always revalidated. A non-Unity game passes
   `staticOnly: true, publicApiPathMatchers: []` plus its own cache names.
2. Build step: `PWA_BUILD_VERSION=$(git rev-parse --short HEAD) pwa-sw-gen ./pwa-sw.config.js <out-dir>`
   (without it a timestamp is used; either way every build ships a byte-different worker).
3. In the game's HTML: `<script src="/sw-register.js" defer></script>`. Delete the old hand-written
   worker file and its registration code. If the old worker lived at a DIFFERENT URL (e.g.
   `/sw.js`), list it in `retireWorkerUrls` (see below) — self-heal alone cannot reach a player
   whose old worker serves a cached page that never loads `sw-register.js`.
4. nginx: `Cache-Control: no-cache` on `index.html`, `service-worker.js` and `sw-register.js`.
5. **Do NOT also run `@dloizides/game-shell`'s `versionPoll`.** pwa-sw already detects the new
   build and reloads the tab; two update mechanisms race each other and reload twice (or loop).

## Registering the worker (app side)

`pwa-sw-gen` also writes `sw-register.js` (registration + auto-update + self-heal); load it
with a `<script src>`. To evict the public cache mid-session (e.g. after a save),
post the purge message to the controller:

```ts
navigator.serviceWorker.controller?.postMessage({ type: 'PURGE_PUBLIC_CACHE', externalId });
```

## API

- `generateServiceWorker(config: ServiceWorkerConfig): string`
- `buildManifest(config: ManifestConfig): BuiltManifest`
- `generateRegistration(config: ServiceWorkerConfig): string`
- `unityWebGLPreset({ name, ...overrides }): ServiceWorkerConfig`
- `resolveConfig`, `cachePrefix`, `DEFAULT_STATIC_EXTENSIONS`, `DEFAULT_PURGE_MESSAGE_TYPE`, `DEFAULT_HASHED_ASSET_PATTERN`

## License

MIT
