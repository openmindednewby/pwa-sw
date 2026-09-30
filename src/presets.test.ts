import { resolveConfig } from './config';
import { DEFAULT_HASHED_ASSET_PATTERN } from './freshness';
import { unityWebGLPreset } from './presets';

describe('unityWebGLPreset', () => {
  it('builds a static-only config that treats Build/ and TemplateData/ as unhashed', () => {
    const resolved = resolveConfig(unityWebGLPreset({ name: 'ghosty', buildVersion: 'b1' }));
    expect(resolved.staticOnly).toBe(true);
    expect(resolved.unhashedPathMatchers).toEqual(['/Build/', '/TemplateData/']);
    expect(resolved.staticExtensions).toEqual(expect.arrayContaining(['.wasm', '.data', '.br', '.gz', '.unityweb']));
    expect(resolved.staticCacheName).toBe('ghosty-static-v1');
    expect(resolved.freshUnhashedAssets).toBe(true);
  });

  it('lets the game override any field', () => {
    const resolved = resolveConfig(unityWebGLPreset({ name: 'ghosty', scope: '/play/' }));
    expect(resolved.swUrl).toBe('/play/service-worker.js');
    expect(resolved.registrationUrl).toBe('/play/sw-register.js');
  });

  it('rejects an empty name', () => {
    expect(() => unityWebGLPreset({ name: ' ' })).toThrow('name');
  });
});

describe('DEFAULT_HASHED_ASSET_PATTERN', () => {
  const hashed = new RegExp(DEFAULT_HASHED_ASSET_PATTERN);

  it.each(['entry-5f3c9a1b2e7d.js', 'index-BzX3a_1q.js', 'icon.a1b2c3d4e5f6.png', 'chunk.0a1b2c3d.wasm.br'])(
    'treats %s as content-hashed',
    (name) => expect(hashed.test(name)).toBe(true),
  );

  it.each(['hero.png', 'WebGL.framework.js', 'WebGL.loader.js', 'logo-192x192.png', 'apple-touch-icon.png', 'MyGame2024.data'])(
    'treats %s as unhashed',
    (name) => expect(hashed.test(name)).toBe(false),
  );
});

describe('freshness config validation', () => {
  const base = { apiCacheName: 'a-v1', staticCacheName: 'b-v1', publicApiPathMatchers: ['/public/'] };

  it('rejects an invalid hashedAssetPattern at build time', () => {
    expect(() => resolveConfig({ ...base, hashedAssetPattern: '([' })).toThrow('hashedAssetPattern');
  });

  it('allows no public-API matchers only for a staticOnly worker', () => {
    expect(() => resolveConfig({ ...base, publicApiPathMatchers: [] })).toThrow();
    expect(resolveConfig({ ...base, publicApiPathMatchers: [], staticOnly: true }).publicApiPathMatchers).toEqual([]);
  });

  it('defaults self-heal on with a 10s grace, and off when the reload is disabled', () => {
    expect(resolveConfig(base).selfHeal).toBe(true);
    expect(resolveConfig(base).selfHealGraceMs).toBe(10000);
    expect(resolveConfig({ ...base, reloadOnControllerChange: false }).selfHeal).toBe(false);
    expect(resolveConfig({ ...base, reloadOnControllerChange: false, selfHeal: true }).selfHeal).toBe(true);
  });
});
