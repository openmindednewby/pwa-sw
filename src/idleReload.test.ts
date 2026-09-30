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
const holdCallback = (): jest.Mock => jest.fn();

describe('reloads go through window.__gsWhenIdle', () => {
  it('controllerchange reloads immediately when no idle gate is installed', () => {
    const page = loadPage(source, { controllerVersions: ['build-2'] });
    page.controllerChange();
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it('controllerchange hands the reload to the idle gate instead of reloading', () => {
    const whenIdle = holdCallback();
    const page = loadPage(source, { controllerVersions: ['build-2'], whenIdle });
    page.controllerChange();
    expect(page.reload).not.toHaveBeenCalled();
    expect(whenIdle).toHaveBeenCalledTimes(1);
    const deferred = whenIdle.mock.calls[0][0] as () => void;
    deferred();
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it('asks the idle gate only once across repeated controller changes', () => {
    const whenIdle = holdCallback();
    const page = loadPage(source, { controllerVersions: ['build-2'], whenIdle });
    page.controllerChange();
    page.controllerChange();
    page.controllerChange();
    expect(whenIdle).toHaveBeenCalledTimes(1);
  });

  it('self-heal defers its reload to the idle gate', async () => {
    const whenIdle = holdCallback();
    const page = loadPage(source, { controllerVersions: ['build-1'], whenIdle });
    page.start();
    await settle();
    expect(page.unregister).toHaveBeenCalledTimes(1);
    expect(page.reload).not.toHaveBeenCalled();
    expect(whenIdle).toHaveBeenCalledTimes(1);
    (whenIdle.mock.calls[0][0] as () => void)();
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it('emits no reload helper when both reload paths are disabled', () => {
    expect(generateRegistration({ ...base, reloadOnControllerChange: false })).not.toContain('__gsWhenIdle');
  });
});
