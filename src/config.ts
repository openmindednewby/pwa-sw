/**
 * Configuration contract for the generated service worker.
 *
 * The package owns the caching *strategies* (network-first for the public API,
 * cache-first for static assets, network-only for admin/auth) and the
 * purge-on-publish behaviour. The consuming app owns this *config* — its cache
 * names/versions, which API paths are public (cacheable), the purge message
 * type, and the static-asset extensions.
 */
export interface ServiceWorkerConfig {
  /**
   * Cache name for cached public-API (network-first) responses, e.g.
   * `public-menu-api-v2`. BUMP the version suffix on a deploy that should evict
   * the old (potentially stale) entries — the activate handler deletes any cache
   * that shares the prefix but is not the current name.
   */
  apiCacheName: string;
  /** Cache name for static assets (cache-first), e.g. `static-assets-v1`. */
  staticCacheName: string;
  /**
   * Path substrings that mark a request as a cacheable *public* API read
   * (network-first). A request matches if its pathname includes ANY entry.
   * e.g. `['/public/menus/']` (katalogos) or `['/public/surveys/', '/public/questioner/']` (erevna).
   */
  publicApiPathMatchers: string[];
  /**
   * Message `type` the app posts to trigger a purge of the public-API cache.
   * Defaults to `PURGE_PUBLIC_CACHE`.
   */
  purgeMessageType?: string;
  /**
   * Static-asset extensions eligible for cache-first. Defaults to a sensible
   * web set (js/css/images/fonts).
   */
  staticExtensions?: string[];
  /**
   * A UNIQUE per-BUILD token stamped into the generated SW (and appended to the
   * effective cache names) so that EVERY deploy produces a byte-different
   * `service-worker.js`. This is what makes auto-update work: the browser only
   * installs a new SW when the SW file's bytes change, so without a per-build
   * token a redeploy leaves an already-open tab running the OLD code. The CLI
   * injects `process.env.PWA_BUILD_VERSION` or a timestamp when this is absent;
   * tests pass an explicit value for determinism. Defaults to `'dev'`.
   */
  buildVersion?: string;
  /**
   * The scope the registration snippet registers the SW under (the app's base
   * path), e.g. `/app/`. Defaults to `/`. Used only by `generateRegistration`.
   */
  scope?: string;
  /**
   * The URL the SW is served from, e.g. `/app/service-worker.js`. Defaults to
   * `<scope>service-worker.js`. Used only by `generateRegistration`.
   */
  swUrl?: string;
  /**
   * How often (ms) the registration polls for a new SW version (in addition to
   * on-load + on-tab-refocus). `0` disables the interval. Defaults to 60000.
   * Used only by `generateRegistration`.
   */
  updateCheckIntervalMs?: number;
}

/** Default static-asset extensions (cache-first). */
export const DEFAULT_STATIC_EXTENSIONS: readonly string[] = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.woff',
  '.woff2',
  '.ico',
];

/** Default purge message type. */
export const DEFAULT_PURGE_MESSAGE_TYPE = 'PURGE_PUBLIC_CACHE';

/** Default per-build version when neither config nor CLI supplies one. */
export const DEFAULT_BUILD_VERSION = 'dev';

/** Default SW scope (app base path). */
export const DEFAULT_SCOPE = '/';

/** Default interval (ms) for the registration's update poll. */
export const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 60000;

/** Join a scope + a file into a URL, tolerating a scope with or without a trailing slash. */
export function joinScope(scope: string, file: string): string {
  return scope.endsWith('/') ? scope + file : scope + '/' + file;
}

/**
 * A resolved config with all optionals filled in. Used internally by the
 * generator so the emitted SW never depends on undefined values.
 */
export interface ResolvedServiceWorkerConfig {
  apiCacheName: string;
  staticCacheName: string;
  publicApiPathMatchers: string[];
  purgeMessageType: string;
  staticExtensions: string[];
  buildVersion: string;
  scope: string;
  swUrl: string;
  updateCheckIntervalMs: number;
}

/**
 * Validate + fill defaults. Throws on a config that would produce a broken SW
 * (empty cache names or no public-API matcher), so misconfiguration fails at
 * build time instead of silently shipping a no-op SW.
 */
export function resolveConfig(config: ServiceWorkerConfig): ResolvedServiceWorkerConfig {
  if (!config.apiCacheName || config.apiCacheName.trim() === '') {
    throw new Error('pwa-sw: apiCacheName is required');
  }
  if (!config.staticCacheName || config.staticCacheName.trim() === '') {
    throw new Error('pwa-sw: staticCacheName is required');
  }
  if (!Array.isArray(config.publicApiPathMatchers) || config.publicApiPathMatchers.length === 0) {
    throw new Error('pwa-sw: publicApiPathMatchers must contain at least one path substring');
  }
  const purgeMessageType =
    config.purgeMessageType !== undefined && config.purgeMessageType.trim() !== ''
      ? config.purgeMessageType
      : DEFAULT_PURGE_MESSAGE_TYPE;
  const staticExtensions =
    config.staticExtensions !== undefined && config.staticExtensions.length > 0
      ? config.staticExtensions
      : [...DEFAULT_STATIC_EXTENSIONS];
  const buildVersion =
    config.buildVersion !== undefined && config.buildVersion.trim() !== ''
      ? config.buildVersion.trim()
      : DEFAULT_BUILD_VERSION;
  const scope =
    config.scope !== undefined && config.scope.trim() !== '' ? config.scope.trim() : DEFAULT_SCOPE;
  const swUrl =
    config.swUrl !== undefined && config.swUrl.trim() !== '' ? config.swUrl.trim() : joinScope(scope, 'service-worker.js');
  const updateCheckIntervalMs =
    typeof config.updateCheckIntervalMs === 'number' && config.updateCheckIntervalMs >= 0
      ? config.updateCheckIntervalMs
      : DEFAULT_UPDATE_CHECK_INTERVAL_MS;
  return {
    apiCacheName: config.apiCacheName,
    staticCacheName: config.staticCacheName,
    publicApiPathMatchers: config.publicApiPathMatchers,
    purgeMessageType,
    staticExtensions,
    buildVersion,
    scope,
    swUrl,
    updateCheckIntervalMs,
  };
}

/**
 * Derive the cache-name prefix (everything up to and including the last `-`
 * before the version), used by the activate handler to clean up old versions.
 * `public-menu-api-v2` -> `public-menu-api-`. If there is no version suffix the
 * whole name + `-` is used (still safe; only exact-prefix matches are deleted).
 */
export function cachePrefix(cacheName: string): string {
  const lastDash = cacheName.lastIndexOf('-');
  if (lastDash === -1) {
    return cacheName + '-';
  }
  return cacheName.slice(0, lastDash + 1);
}
