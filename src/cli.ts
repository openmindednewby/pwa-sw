#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { buildManifest, type ManifestConfig } from './buildManifest';
import { generateServiceWorker } from './generateServiceWorker';
import { generateRegistration } from './generateRegistration';
import type { ServiceWorkerConfig } from './config';

/**
 * The shape a `pwa-sw.config.(js|cjs)` module must export. `serviceWorker` is
 * required; `manifest` is optional (when present a manifest.json is also emitted).
 */
interface PwaConfigModule {
  serviceWorker: ServiceWorkerConfig;
  manifest?: ManifestConfig;
}

/* eslint-disable no-console */

/**
 * Resolve the per-build version: an explicit config value wins (a caller can pin it), then a
 * CI-provided `PWA_BUILD_VERSION` (e.g. the git sha), else a wall-clock token so it changes every run.
 */
function resolveBuildVersion(configValue: string | undefined): string {
  if (configValue !== undefined && configValue.trim() !== '') {
    return configValue.trim();
  }
  const env = process.env.PWA_BUILD_VERSION;
  if (env !== undefined && env.trim() !== '') {
    return env.trim();
  }
  return Date.now().toString(36);
}

/**
 * `pwa-sw-gen <config> <outDir>`
 * - config: path to a CommonJS module exporting { serviceWorker, manifest? }.
 * - outDir: directory to write `service-worker.js` (+ `manifest.json` if config has one).
 *           Defaults to `public/`.
 */
export function run(argv: string[]): number {
  const [configArg, outArg] = argv;
  if (configArg === undefined || configArg === '') {
    console.error('Usage: pwa-sw-gen <config-file> [out-dir]');
    return 1;
  }
  const configPath = isAbsolute(configArg) ? configArg : resolve(process.cwd(), configArg);
  if (!existsSync(configPath)) {
    console.error(`pwa-sw-gen: config file not found: ${configPath}`);
    return 1;
  }
  const outDir = outArg !== undefined && outArg !== '' ? resolve(process.cwd(), outArg) : resolve(process.cwd(), 'public');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(configPath) as PwaConfigModule;
  if (!mod || !mod.serviceWorker) {
    console.error('pwa-sw-gen: config module must export a `serviceWorker` object');
    return 1;
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Stamp a UNIQUE per-build version so every deploy ships a byte-different SW (the trigger the
  // browser needs to install the update). Prefer an explicit config value, then a CI-provided
  // PWA_BUILD_VERSION (e.g. the git sha), else a wall-clock token.
  const swConfig: ServiceWorkerConfig = {
    ...mod.serviceWorker,
    buildVersion: resolveBuildVersion(mod.serviceWorker.buildVersion),
  };

  const swSource = generateServiceWorker(swConfig);
  const swPath = join(outDir, 'service-worker.js');
  writeFileSync(swPath, swSource, 'utf8');
  console.log(`pwa-sw-gen: wrote ${swPath} (build ${swConfig.buildVersion})`);

  // The auto-updating registration snippet, from the SAME config (scope / swUrl / interval).
  const regSource = generateRegistration(swConfig);
  const regPath = join(outDir, 'sw-register.js');
  writeFileSync(regPath, regSource, 'utf8');
  console.log(`pwa-sw-gen: wrote ${regPath}`);

  if (mod.manifest) {
    const manifest = buildManifest(mod.manifest);
    const manifestPath = join(outDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`pwa-sw-gen: wrote ${manifestPath}`);
  }

  return 0;
}

/* istanbul ignore next -- entrypoint wiring, exercised via the built CLI not unit tests */
if (require.main === module) {
  const code = run(process.argv.slice(2));
  if (code !== 0) {
    process.exit(code);
  }
}
