import { generateRegistration } from './generateRegistration';
import { loadPage, settle } from './swHarness.testutil';

const base = {
  apiCacheName: 'game-api-v1',
  staticCacheName: 'game-static-v1',
  publicApiPathMatchers: [],
  staticOnly: true,
  buildVersion: 'build-2',
};
const source = generateRegistration(base);

describe('zombie service-worker self-heal', () => {
  it('does nothing when the active worker runs the page build', async () => {
    const page = loadPage(source, { controllerVersions: ['build-2'] });
    page.start();
    await settle();
    expect(page.reload).not.toHaveBeenCalled();
    expect(page.unregister).not.toHaveBeenCalled();
  });

  it('unregisters, clears caches and reloads once when the worker stays on another build', async () => {
    const page = loadPage(source, { controllerVersions: ['build-1'] });
    page.start();
    await settle();
    expect(page.unregister).toHaveBeenCalledTimes(1);
    expect(page.foreignUnregister).not.toHaveBeenCalled();
    expect(page.caches.caches.size).toBe(0);
    expect(page.reload).toHaveBeenCalledTimes(1);
    expect(page.storage.get('pwa-sw-heal:build-2')).toBe('1');
  });

  it('heals a legacy worker that does not answer the version request', async () => {
    const page = loadPage(source, { controllerVersions: [null] });
    page.start();
    await settle();
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it('does not heal twice for the same page build (loop guard)', async () => {
    const page = loadPage(source, { controllerVersions: ['build-1'], storage: { 'pwa-sw-heal:build-2': '1' } });
    page.start();
    await settle();
    expect(page.reload).not.toHaveBeenCalled();
    expect(page.unregister).not.toHaveBeenCalled();
  });

  it('waits out the normal update hand-off instead of healing it', async () => {
    const page = loadPage(source, { controllerVersions: ['build-1', 'build-2'] });
    page.start();
    await settle();
    expect(page.asks()).toBe(2);
    expect(page.reload).not.toHaveBeenCalled();
  });

  it('does nothing for an uncontrolled page', async () => {
    const page = loadPage(source, { hasController: false });
    page.start();
    await settle();
    expect(page.reload).not.toHaveBeenCalled();
  });

  it('prefers the page meta pwa-build-version over the stamped version', async () => {
    const page = loadPage(source, { controllerVersions: ['build-3'], metaVersion: 'build-3' });
    page.start();
    await settle();
    expect(page.reload).not.toHaveBeenCalled();
  });

  it('is omitted when selfHeal is false', () => {
    expect(generateRegistration({ ...base, selfHeal: false })).not.toContain('PWA_SW_GET_VERSION');
  });

  it('defaults off for an app with a second worker at the same scope', () => {
    expect(generateRegistration({ ...base, reloadOnControllerChange: false })).not.toContain('PWA_SW_GET_VERSION');
  });
});
