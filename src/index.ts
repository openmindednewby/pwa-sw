export {
  resolveConfig,
  cachePrefix,
  joinScope,
  DEFAULT_STATIC_EXTENSIONS,
  DEFAULT_PURGE_MESSAGE_TYPE,
  DEFAULT_BUILD_VERSION,
  DEFAULT_SCOPE,
  DEFAULT_UPDATE_CHECK_INTERVAL_MS,
} from './config';
export type { ServiceWorkerConfig, ResolvedServiceWorkerConfig } from './config';
export { generateServiceWorker } from './generateServiceWorker';
export { generateRegistration } from './generateRegistration';
export { buildManifest } from './buildManifest';
export {
  DEFAULT_HASHED_ASSET_PATTERN,
  DEFAULT_SELF_HEAL_GRACE_MS,
  VERSION_REQUEST_TYPE,
  VERSION_REPLY_TYPE,
  BUILD_VERSION_META_NAME,
} from './freshness';
export type { FreshnessOptions } from './freshness';
export { unityWebGLPreset, UNITY_WEBGL_EXTENSIONS } from './presets';
export type { UnityWebGLPresetOptions } from './presets';
export type {
  ManifestConfig,
  ManifestIcon,
  ManifestScreenshot,
  BuiltManifest,
} from './buildManifest';
