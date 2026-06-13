import { buildManifest } from './buildManifest';

const icons = [{ src: '/icons/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }];

describe('buildManifest', () => {
  it('parameterizes theme color (no hardcoded #008d5c)', () => {
    const manifest = buildManifest({
      name: 'Erevna',
      shortName: 'Erevna',
      description: 'Surveys',
      themeColor: '#123456',
      icons,
    });
    expect(manifest.theme_color).toBe('#123456');
  });

  it('applies sensible defaults', () => {
    const manifest = buildManifest({
      name: 'Erevna',
      shortName: 'Erevna',
      description: 'Surveys',
      themeColor: '#123456',
      icons,
    });
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.screenshots).toEqual([]);
    expect(manifest.categories).toEqual(['productivity', 'utilities']);
    expect(manifest.lang).toBe('en-US');
    expect(manifest.dir).toBe('ltr');
    expect(manifest.id).toBe('/');
    expect(manifest.orientation).toBe('portrait');
  });

  it('honours overrides', () => {
    const manifest = buildManifest({
      name: 'Erevna',
      shortName: 'Erevna',
      description: 'Surveys',
      themeColor: '#123456',
      backgroundColor: '#000000',
      startUrl: '/home',
      scope: '/app',
      display: 'fullscreen',
      orientation: 'landscape',
      categories: ['games'],
      screenshots: [{ src: '/s.png', sizes: '1x1', type: 'image/png', form_factor: 'wide' }],
      lang: 'el-GR',
      dir: 'rtl',
      id: '/app',
      icons,
    });
    expect(manifest.background_color).toBe('#000000');
    expect(manifest.start_url).toBe('/home');
    expect(manifest.scope).toBe('/app');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.categories).toEqual(['games']);
    expect(manifest.screenshots).toHaveLength(1);
    expect(manifest.lang).toBe('el-GR');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.id).toBe('/app');
  });

  it('treats blank startUrl/scope as unset', () => {
    const manifest = buildManifest({
      name: 'Erevna',
      shortName: 'Erevna',
      description: 'Surveys',
      themeColor: '#123456',
      startUrl: '',
      scope: '',
      icons,
    });
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(manifest.scope).toBe('/');
  });

  it.each([
    ['name', { name: '', shortName: 's', description: 'd', themeColor: '#1', icons }],
    ['themeColor', { name: 'n', shortName: 's', description: 'd', themeColor: '', icons }],
    ['icons', { name: 'n', shortName: 's', description: 'd', themeColor: '#1', icons: [] }],
  ])('throws when %s is missing', (_label, bad) => {
    expect(() => buildManifest(bad)).toThrow();
  });
});
