import {
  cachePrefix,
  DEFAULT_PURGE_MESSAGE_TYPE,
  DEFAULT_STATIC_EXTENSIONS,
  resolveConfig,
} from './config';

describe('resolveConfig', () => {
  const valid = {
    apiCacheName: 'public-menu-api-v2',
    staticCacheName: 'static-assets-v1',
    publicApiPathMatchers: ['/public/menus/'],
  };

  it('fills defaults for optional fields', () => {
    const resolved = resolveConfig(valid);
    expect(resolved.purgeMessageType).toBe(DEFAULT_PURGE_MESSAGE_TYPE);
    expect(resolved.staticExtensions).toEqual([...DEFAULT_STATIC_EXTENSIONS]);
  });

  it('keeps provided optional fields', () => {
    const resolved = resolveConfig({
      ...valid,
      purgeMessageType: 'PURGE_PUBLIC_MENU',
      staticExtensions: ['.js'],
    });
    expect(resolved.purgeMessageType).toBe('PURGE_PUBLIC_MENU');
    expect(resolved.staticExtensions).toEqual(['.js']);
  });

  it('treats blank optional strings as unset', () => {
    const resolved = resolveConfig({ ...valid, purgeMessageType: '   ' });
    expect(resolved.purgeMessageType).toBe(DEFAULT_PURGE_MESSAGE_TYPE);
  });

  it('treats empty staticExtensions array as unset', () => {
    const resolved = resolveConfig({ ...valid, staticExtensions: [] });
    expect(resolved.staticExtensions).toEqual([...DEFAULT_STATIC_EXTENSIONS]);
  });

  it.each([
    ['apiCacheName', { ...valid, apiCacheName: '' }],
    ['apiCacheName blank', { ...valid, apiCacheName: '   ' }],
    ['staticCacheName', { ...valid, staticCacheName: '' }],
    ['staticCacheName blank', { ...valid, staticCacheName: '  ' }],
  ])('throws when %s is missing', (_label, bad) => {
    expect(() => resolveConfig(bad)).toThrow();
  });

  it('throws when there are no public API matchers', () => {
    expect(() => resolveConfig({ ...valid, publicApiPathMatchers: [] })).toThrow();
  });
});

describe('cachePrefix', () => {
  it('strips the version suffix', () => {
    expect(cachePrefix('public-menu-api-v2')).toBe('public-menu-api-');
    expect(cachePrefix('static-assets-v1')).toBe('static-assets-');
  });

  it('handles names without a dash', () => {
    expect(cachePrefix('cache')).toBe('cache-');
  });
});
