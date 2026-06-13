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

## Registering the worker (app side)

Registration stays in the app (it's framework-specific). Register `/service-worker.js`
at `load`, scoped to `/`. To evict the public cache mid-session (e.g. after a save),
post the purge message to the controller:

```ts
navigator.serviceWorker.controller?.postMessage({ type: 'PURGE_PUBLIC_CACHE', externalId });
```

## API

- `generateServiceWorker(config: ServiceWorkerConfig): string`
- `buildManifest(config: ManifestConfig): BuiltManifest`
- `resolveConfig`, `cachePrefix`, `DEFAULT_STATIC_EXTENSIONS`, `DEFAULT_PURGE_MESSAGE_TYPE`

## License

MIT
