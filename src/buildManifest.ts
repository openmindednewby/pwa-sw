/** A single PWA manifest icon entry. */
export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

/** A single PWA manifest screenshot entry. */
export interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
  form_factor?: string;
}

/** Config for {@link buildManifest}. Branding/colors are config, not hardcoded. */
export interface ManifestConfig {
  name: string;
  shortName: string;
  description: string;
  /** Theme color (status bar / toolbar). Previously hardcoded `#008d5c`. */
  themeColor: string;
  /** Background color shown on the splash screen. Defaults to `#ffffff`. */
  backgroundColor?: string;
  icons: ManifestIcon[];
  startUrl?: string;
  scope?: string;
  display?: string;
  orientation?: string;
  categories?: string[];
  screenshots?: ManifestScreenshot[];
  lang?: string;
  dir?: string;
  id?: string;
}

/** The shape of a built `manifest.json`. */
export interface BuiltManifest {
  name: string;
  short_name: string;
  description: string;
  categories: string[];
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
  screenshots: ManifestScreenshot[];
  lang: string;
  dir: string;
  id: string;
}

/**
 * Build a PWA `manifest.json` object from config. Theme color, branding, icons
 * and start URL all become per-app config instead of being hardcoded.
 */
export function buildManifest(config: ManifestConfig): BuiltManifest {
  if (!config.name || config.name.trim() === '') {
    throw new Error('pwa-sw: manifest name is required');
  }
  if (!config.themeColor || config.themeColor.trim() === '') {
    throw new Error('pwa-sw: manifest themeColor is required');
  }
  if (!Array.isArray(config.icons) || config.icons.length === 0) {
    throw new Error('pwa-sw: manifest icons must contain at least one icon');
  }
  const startUrl = config.startUrl !== undefined && config.startUrl !== '' ? config.startUrl : '/?source=pwa';
  const scope = config.scope !== undefined && config.scope !== '' ? config.scope : '/';
  return {
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    categories: config.categories ?? ['productivity', 'utilities'],
    start_url: startUrl,
    scope,
    display: config.display ?? 'standalone',
    orientation: config.orientation ?? 'portrait',
    background_color: config.backgroundColor ?? '#ffffff',
    theme_color: config.themeColor,
    icons: config.icons,
    screenshots: config.screenshots ?? [],
    lang: config.lang ?? 'en-US',
    dir: config.dir ?? 'ltr',
    id: config.id ?? '/',
  };
}
