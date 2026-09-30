/**
 * Options that keep a deploy reaching every open tab and installed PWA: unhashed
 * assets are revalidated instead of served cache-first, and a page whose active
 * worker belongs to another build heals itself.
 */
export interface FreshnessOptions {
  /**
   * `true` (default): a static asset whose filename carries NO content hash is
   * fetched network-first with `cache: 'no-cache'` (a cheap 304 when unchanged);
   * the cache is only an offline fallback. A cache-first unhashed file is how an
   * old `game.wasm` gets paired with a new loader after a deploy. `false` restores
   * the old cache-first behaviour for every static asset.
   */
  freshUnhashedAssets?: boolean;
  /**
   * RegExp SOURCE tested against the asset FILENAME; a match means "content-hashed,
   * safe to serve cache-first". Defaults to {@link DEFAULT_HASHED_ASSET_PATTERN}.
   */
  hashedAssetPattern?: string;
  /**
   * Path substrings that are ALWAYS treated as unhashed, whatever the filename
   * looks like (e.g. Unity's `/Build/`, whose names never change between builds).
   */
  unhashedPathMatchers?: string[];
  /** A worker with no public API (a game). Allows `publicApiPathMatchers: []`. */
  staticOnly?: boolean;
  /**
   * URL of the registration snippet, e.g. `/app/sw-register.js`. The worker never
   * intercepts it or its own script. Defaults to `<scope>sw-register.js`.
   */
  registrationUrl?: string;
  /**
   * Zombie self-heal in the registration snippet: if the worker controlling the
   * page still reports a different build than the page after the grace period,
   * unregister it, clear caches and reload ONCE (guarded per page build).
   * Defaults to the value of `reloadOnControllerChange` — an app with a second
   * worker at the same scope must not have it unregistered.
   */
  selfHeal?: boolean;
  /**
   * How long (ms) a version mismatch may persist before healing. A mismatch right
   * after a deploy is the normal hand-off (the new worker installs and
   * `controllerchange` reloads); only one that outlives this is a zombie.
   * Defaults to 10000.
   */
  selfHealGraceMs?: number;
}

export interface ResolvedFreshness {
  freshUnhashedAssets: boolean;
  hashedAssetPattern: string;
  unhashedPathMatchers: string[];
  staticOnly: boolean;
  registrationUrl: string;
  selfHeal: boolean;
  selfHealGraceMs: number;
}

/**
 * A `-` or `.` separator, then a token of 8+ url-safe characters containing at
 * least one digit, then the extension(s): `entry-5f3c9a1b.js`, `index-BzX3a_1q.js`,
 * `icon.a1b2c3d4.png`, `chunk.0a1b2c3d.wasm.br`. Requiring a digit keeps words
 * like `framework` or `Settings` out; a real hash without a digit is merely
 * revalidated (the safe direction).
 */
export const DEFAULT_HASHED_ASSET_PATTERN = '[.-](?=[A-Za-z0-9_-]*[0-9])[A-Za-z0-9_-]{8,}(?:\\.[A-Za-z0-9]+)+$';

export const DEFAULT_SELF_HEAL_GRACE_MS = 10000;

export const VERSION_REQUEST_TYPE = 'PWA_SW_GET_VERSION';

export const VERSION_REPLY_TYPE = 'PWA_SW_VERSION';

/** `<meta name="pwa-build-version" content="…">` overrides the version stamped into the snippet. */
export const BUILD_VERSION_META_NAME = 'pwa-build-version';

export const HEAL_GUARD_KEY_PREFIX = 'pwa-sw-heal:';

function assertValidPattern(pattern: string): void {
  try {
    new RegExp(pattern);
  } catch (error) {
    throw new Error(`pwa-sw: hashedAssetPattern is not a valid RegExp: ${String(error)}`);
  }
}

export function resolveFreshness(
  options: FreshnessOptions,
  defaultRegistrationUrl: string,
  reloadOnControllerChange: boolean,
): ResolvedFreshness {
  const hashedAssetPattern = options.hashedAssetPattern?.trim() || DEFAULT_HASHED_ASSET_PATTERN;
  assertValidPattern(hashedAssetPattern);
  const selfHealGraceMs =
    typeof options.selfHealGraceMs === 'number' && options.selfHealGraceMs >= 0
      ? options.selfHealGraceMs
      : DEFAULT_SELF_HEAL_GRACE_MS;
  return {
    freshUnhashedAssets: options.freshUnhashedAssets ?? true,
    hashedAssetPattern,
    unhashedPathMatchers: options.unhashedPathMatchers ?? [],
    staticOnly: options.staticOnly ?? false,
    registrationUrl: options.registrationUrl?.trim() || defaultRegistrationUrl,
    selfHeal: options.selfHeal ?? reloadOnControllerChange,
    selfHealGraceMs,
  };
}
