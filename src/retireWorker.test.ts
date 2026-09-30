import { generateRetireWorker, retireWorkerFiles } from './retireWorker';
import { dispatchActivate, dispatchInstall, fakeWindowClient, loadWorker } from './swHarness.testutil';

const base = {
  apiCacheName: 'game-api-v1',
  staticCacheName: 'game-static-v1',
  publicApiPathMatchers: [],
  staticOnly: true,
  buildVersion: 'build-2',
};

const offline = (): Promise<Response> => Promise.reject(new Error('offline'));

describe('retired worker kill-switch', () => {
  it('skips waiting on install', async () => {
    const env = loadWorker(generateRetireWorker(), offline);
    await dispatchInstall(env);
    expect(env.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('on activate deletes every cache, unregisters itself and navigates each controlled window once', async () => {
    const tab = fakeWindowClient('https://game.test/index.html');
    const env = loadWorker(generateRetireWorker(), offline, [tab]);
    await env.caches.open('legacy-game-cache-v3');
    await env.caches.open('game-static-v1-build-2');
    await dispatchActivate(env);
    expect(env.caches.caches.size).toBe(0);
    expect(env.self.registration.unregister).toHaveBeenCalledTimes(1);
    expect(env.self.clients.matchAll).toHaveBeenCalledWith({ type: 'window' });
    expect(tab.navigate).toHaveBeenCalledTimes(1);
    expect(tab.navigate).toHaveBeenCalledWith('https://game.test/index.html');
  });

  it('unregisters before navigating, so the reloaded page is not controlled by it', async () => {
    const order: string[] = [];
    const tab = fakeWindowClient('https://game.test/');
    tab.navigate.mockImplementation(() => Promise.resolve(order.push('navigate')));
    const env = loadWorker(generateRetireWorker(), offline, [tab]);
    env.self.registration.unregister.mockImplementation(() => Promise.resolve(order.push('unregister') > 0));
    await dispatchActivate(env);
    expect(order).toEqual(['unregister', 'navigate']);
  });

  it('still activates when a client refuses navigation', async () => {
    const tab = fakeWindowClient('https://game.test/');
    tab.navigate.mockImplementation(() => Promise.reject(new TypeError('not controlled')));
    const env = loadWorker(generateRetireWorker(), offline, [tab]);
    await expect(dispatchActivate(env)).resolves.toBeUndefined();
  });

  it('never intercepts fetches', () => {
    const env = loadWorker(generateRetireWorker(), offline);
    expect(env.listeners.get('fetch')).toBeUndefined();
  });
});

describe('retireWorkerFiles', () => {
  it('is empty when no retired URL is configured', () => {
    expect(retireWorkerFiles(base)).toEqual([]);
  });

  it('maps each retired URL to a file relative to the scope output directory', () => {
    const files = retireWorkerFiles({ ...base, scope: '/game/', retireWorkerUrls: ['/game/sw.js', '/game/old/worker.js'] });
    expect(files.map((f) => f.file)).toEqual(['sw.js', 'old/worker.js']);
    expect(files[0]?.source).toBe(generateRetireWorker());
  });

  it('rejects a URL outside the scope', () => {
    expect(() => retireWorkerFiles({ ...base, scope: '/game/', retireWorkerUrls: ['/sw.js'] })).toThrow(/outside scope/);
  });

  it('rejects the live worker or registration URL', () => {
    expect(() => retireWorkerFiles({ ...base, retireWorkerUrls: ['/service-worker.js'] })).toThrow(/live/);
    expect(() => retireWorkerFiles({ ...base, retireWorkerUrls: ['/sw-register.js'] })).toThrow(/live/);
  });

  it('rejects a URL that is not an absolute .js path', () => {
    expect(() => retireWorkerFiles({ ...base, retireWorkerUrls: ['sw.js'] })).toThrow(/absolute/);
    expect(() => retireWorkerFiles({ ...base, retireWorkerUrls: ['/sw'] })).toThrow(/absolute/);
    expect(() => retireWorkerFiles({ ...base, retireWorkerUrls: ['/a/../sw.js'] })).toThrow(/absolute/);
  });
});
