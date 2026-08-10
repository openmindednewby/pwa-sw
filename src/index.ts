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
export type {
  ManifestConfig,
  ManifestIcon,
  ManifestScreenshot,
  BuiltManifest,
} from './buildManifest';
