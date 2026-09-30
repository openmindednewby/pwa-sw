import { generateServiceWorker } from './generateServiceWorker';
import { unityWebGLPreset } from './presets';
import { dispatchActivate, dispatchFetch, dispatchMessage, loadWorker, type FetchImpl } from './swHarness.testutil';

const ORIGIN = 'https://game.test';
const base = {
  apiCacheName: 'public-api-v1',
  staticCacheName: 'static-assets-v1',
  publicApiPathMatchers: ['/public/'],
  buildVersion: 'build-2',
};

/** A server whose body for every URL is the current deploy tag. */
function server(): { impl: FetchImpl; deploy: (tag: string) => void; offline: () => void } {
  let tag = 'v1';
  let online = true;
  return {
    impl: () => (online ? Promise.resolve(new Response(tag)) : Promise.reject(new Error('offline'))),
    deploy: (next: string): void => {
      tag = next;
    },
    offline: (): void => {
      online = false;
    },
  };
}

async function bodyOf(response: Response | undefined): Promise<string | undefined> {
  return response === undefined ? undefined : response.text();
}

describe('generated worker: unhashed assets are never served stale', () => {
  it('fetches an unhashed asset network-first (revalidating) even when it is cached', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker(base), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`));
    s.deploy('v2');
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`))).toBe('v2');
    expect(env.fetch.mock.calls[1]?.[1]).toEqual({ cache: 'no-cache' });
  });

  it('falls back to the cached unhashed asset when offline', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker(base), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`));
    s.offline();
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`))).toBe('v1');
  });

  it('keeps content-hashed assets cache-first (their URL changes when the bytes do)', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker(base), s.impl);
    const url = `${ORIGIN}/_expo/static/js/web/entry-5f3c9a1b2e7d.js`;
    await bodyOf(await dispatchFetch(env, url));
    s.deploy('v2');
    expect(await bodyOf(await dispatchFetch(env, url))).toBe('v1');
    expect(env.fetch).toHaveBeenCalledTimes(1);
  });

  it('restores legacy cache-first for unhashed assets only when freshUnhashedAssets is false', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker({ ...base, freshUnhashedAssets: false }), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`));
    s.deploy('v2');
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`))).toBe('v1');
  });

  it('serves HTML navigations network-first with an offline fallback', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker(base), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/`, 'navigate'));
    s.deploy('v2');
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/`, 'navigate'))).toBe('v2');
    s.offline();
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/`, 'navigate'))).toBe('v2');
  });

  it('never intercepts its own script or the registration snippet', async () => {
    const env = loadWorker(generateServiceWorker({ ...base, scope: '/app/' }), server().impl);
    expect(await dispatchFetch(env, `${ORIGIN}/app/service-worker.js`)).toBeUndefined();
    expect(await dispatchFetch(env, `${ORIGIN}/app/sw-register.js`)).toBeUndefined();
  });

  it('answers a version request with its build version', async () => {
    const env = loadWorker(generateServiceWorker(base), server().impl);
    expect(await dispatchMessage(env, { type: 'PWA_SW_GET_VERSION' })).toEqual({
      type: 'PWA_SW_VERSION',
      version: 'build-2',
    });
  });

  it('purges every other build caches on activate, keeping its own', async () => {
    const env = loadWorker(generateServiceWorker(base), server().impl);
    await env.caches.open('static-assets-v1-build-1');
    await env.caches.open('public-api-v1-build-1');
    await env.caches.open('unrelated-cache');
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/images/hero.png`));
    await dispatchActivate(env);
    expect([...env.caches.caches.keys()].sort()).toEqual(['static-assets-v1-build-2', 'unrelated-cache']);
  });
});

describe('generated worker: Unity WebGL preset', () => {
  const unityFiles = [
    '/Build/WebGL.wasm',
    '/Build/WebGL.data',
    '/Build/WebGL.framework.js',
    '/Build/WebGL.loader.js',
    '/Build/a1b2c3d4e5f60718.wasm.br',
    '/TemplateData/style.css',
    '/TemplateData/unity-logo-dark.png',
  ];

  it.each(unityFiles)('serves %s fresh after a deploy', async (path) => {
    const s = server();
    const env = loadWorker(generateServiceWorker(unityWebGLPreset({ name: 'ghosty', buildVersion: 'b1' })), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}${path}`));
    s.deploy('v2');
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}${path}`))).toBe('v2');
  });
});

describe('generated worker: HTML detection and offline shell', () => {
  it('treats a request that accepts text/html as a page load', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker(base), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/`, 'cors', 'text/html,application/xhtml+xml'));
    s.deploy('v2');
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/`, 'cors', 'text/html'))).toBe('v2');
  });

  it('serves the cached app shell for an uncached page when offline', async () => {
    const s = server();
    const env = loadWorker(generateServiceWorker(base), s.impl);
    await bodyOf(await dispatchFetch(env, `${ORIGIN}/`, 'navigate'));
    s.offline();
    expect(await bodyOf(await dispatchFetch(env, `${ORIGIN}/level/3`, 'navigate'))).toBe('v1');
  });
});
