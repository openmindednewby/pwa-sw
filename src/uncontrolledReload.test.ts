import { generateRegistration } from './generateRegistration';
import { loadPage, settle } from './swHarness.testutil';

const source = generateRegistration({
  apiCacheName: 'game-api-v1',
  staticCacheName: 'game-static-v1',
  publicApiPathMatchers: [],
  staticOnly: true,
  buildVersion: 'build-2',
  selfHeal: false,
});

describe('controllerchange on a page loaded without a controller', () => {
  it('with a worker already active at load (hard reload), reloads onto the new build', async () => {
    const page = loadPage(source, { hasController: false, activeWorker: true });
    page.start();
    await settle();

    page.controllerChange();

    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it('with no worker active at load (first visit), does not reload for the first install', async () => {
    const page = loadPage(source, { hasController: false, activeWorker: false });
    page.start();
    await settle();

    page.controllerChange();

    expect(page.reload).not.toHaveBeenCalled();
  });
});
