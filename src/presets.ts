import { DEFAULT_STATIC_EXTENSIONS, type ServiceWorkerConfig } from './config';

export interface UnityWebGLPresetOptions extends Partial<ServiceWorkerConfig> {
  /** Short game id used for the cache names, e.g. `ghosty`. */
  name: string;
}

/** Extensions a Unity WebGL build serves, including its compressed variants. */
export const UNITY_WEBGL_EXTENSIONS: readonly string[] = ['.wasm', '.data', '.json', '.unityweb', '.br', '.gz'];

/**
 * Config for a Unity WebGL game: `Build/*.wasm`, `*.data`, `*.framework.js`,
 * `*.loader.js` and `TemplateData/*` keep the same URL across builds, so they are
 * always revalidated (network-first); the cache is only the offline fallback.
 * Any field can be overridden by passing it alongside `name`.
 */
export function unityWebGLPreset(options: UnityWebGLPresetOptions): ServiceWorkerConfig {
  const { name, ...overrides } = options;
  if (name.trim() === '') {
    throw new Error('pwa-sw: unityWebGLPreset requires a non-empty name');
  }
  return {
    apiCacheName: `${name}-api-v1`,
    staticCacheName: `${name}-static-v1`,
    publicApiPathMatchers: [],
    staticOnly: true,
    staticExtensions: [...DEFAULT_STATIC_EXTENSIONS, ...UNITY_WEBGL_EXTENSIONS],
    unhashedPathMatchers: ['/Build/', '/TemplateData/'],
    freshUnhashedAssets: true,
    ...overrides,
  };
}
