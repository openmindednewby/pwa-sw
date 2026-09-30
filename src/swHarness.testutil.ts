/* Test-only: executes GENERATED worker / registration source against in-memory fakes. */

export interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

type RequestLike = FakeRequest | string;
type Listener = (event: unknown) => void;

function keyOf(request: RequestLike): string {
  if (typeof request !== 'string') {
    return request.url;
  }
  return request.startsWith('/') ? 'https://game.test' + request : request;
}

export class FakeCache {
  readonly store = new Map<string, Response>();

  match(request: RequestLike): Promise<Response | undefined> {
    return Promise.resolve(this.store.get(keyOf(request))?.clone());
  }

  put(request: RequestLike, response: Response): Promise<void> {
    this.store.set(keyOf(request), response);
    return Promise.resolve();
  }

  delete(request: RequestLike): Promise<boolean> {
    return Promise.resolve(this.store.delete(keyOf(request)));
  }

  keys(): Promise<Array<{ url: string }>> {
    return Promise.resolve([...this.store.keys()].map((url) => ({ url })));
  }
}

export class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  open(name: string): Promise<FakeCache> {
    const existing = this.caches.get(name);
    if (existing) {
      return Promise.resolve(existing);
    }
    const created = new FakeCache();
    this.caches.set(name, created);
    return Promise.resolve(created);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.caches.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }
}

export type FetchImpl = (request: FakeRequest, init?: { cache?: string }) => Promise<Response>;

export interface FakeWindowClient {
  url: string;
  navigate: jest.Mock<Promise<unknown>, [string]>;
}

export interface WorkerSelf {
  skipWaiting: jest.Mock;
  registration: { unregister: jest.Mock<Promise<boolean>, []> };
  clients: { claim: jest.Mock; matchAll: jest.Mock<Promise<FakeWindowClient[]>, [unknown?]> };
}

export interface WorkerEnv {
  listeners: Map<string, Listener[]>;
  caches: FakeCacheStorage;
  fetch: jest.Mock<Promise<Response>, [FakeRequest, { cache?: string }?]>;
  self: WorkerSelf;
}

export function fakeWindowClient(url: string): FakeWindowClient {
  return { url, navigate: jest.fn((_url: string) => Promise.resolve(undefined)) };
}

export function loadWorker(source: string, fetchImpl: FetchImpl, windowClients: FakeWindowClient[] = []): WorkerEnv {
  const listeners = new Map<string, Listener[]>();
  const cacheStorage = new FakeCacheStorage();
  const fetchMock = jest.fn(fetchImpl);
  const workerSelf: WorkerSelf = {
    skipWaiting: jest.fn(() => Promise.resolve()),
    registration: { unregister: jest.fn(() => Promise.resolve(true)) },
    clients: {
      claim: jest.fn(() => Promise.resolve()),
      matchAll: jest.fn((_options?: unknown) => Promise.resolve(windowClients)),
    },
  };
  const self = {
    ...workerSelf,
    addEventListener: (type: string, fn: Listener): void => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
  };
  new Function('self', 'caches', 'fetch', source)(self, cacheStorage, fetchMock);
  return { listeners, caches: cacheStorage, fetch: fetchMock, self: workerSelf };
}

function emit(env: WorkerEnv, type: string, event: unknown): void {
  for (const listener of env.listeners.get(type) ?? []) {
    listener(event);
  }
}

export async function dispatchFetch(
  env: WorkerEnv,
  url: string,
  mode = 'no-cors',
  accept = '*/*',
): Promise<Response | undefined> {
  let responded: Promise<Response> | undefined;
  const headers = { get: (name: string): string | null => (name === 'accept' ? accept : null) };
  const event = {
    request: { url, method: 'GET', mode, headers },
    respondWith: (p: Promise<Response>): void => {
      responded = p;
    },
  };
  emit(env, 'fetch', event);
  return responded === undefined ? undefined : responded;
}

export async function dispatchMessage(env: WorkerEnv, data: unknown): Promise<unknown> {
  const replies: unknown[] = [];
  const pending: Array<Promise<unknown>> = [];
  const event = {
    data,
    ports: [{ postMessage: (m: unknown): number => replies.push(m) }],
    source: null,
    waitUntil: (p: Promise<unknown>): number => pending.push(p),
  };
  emit(env, 'message', event);
  await Promise.all(pending);
  return replies[0];
}

export async function dispatchInstall(env: WorkerEnv): Promise<void> {
  const pending: Array<Promise<unknown>> = [];
  emit(env, 'install', { waitUntil: (p: Promise<unknown>): number => pending.push(p) });
  await Promise.all(pending);
}

export async function dispatchActivate(env: WorkerEnv): Promise<void> {
  const pending: Array<Promise<unknown>> = [];
  emit(env, 'activate', { waitUntil: (p: Promise<unknown>): number => pending.push(p) });
  await Promise.all(pending);
}

export interface PageOptions {
  /** Versions the controlling worker answers with, one per ask (last repeats). `null` = never answers. */
  controllerVersions?: Array<string | null>;
  hasController?: boolean;
  metaVersion?: string;
  storage?: Record<string, string>;
}

export interface PageEnv {
  start: () => void;
  reload: jest.Mock;
  caches: FakeCacheStorage;
  unregister: jest.Mock;
  foreignUnregister: jest.Mock;
  storage: Map<string, string>;
  asks: () => number;
}

const COMPRESSED_TIMER_MS = 1;

interface Port {
  postMessage: (d: unknown) => void;
}

export function loadPage(source: string, options: PageOptions = {}): PageEnv {
  const reload = jest.fn();
  const unregister = jest.fn(() => Promise.resolve(true));
  const foreignUnregister = jest.fn(() => Promise.resolve(true));
  const storage = new Map<string, string>(Object.entries(options.storage ?? {}));
  const cacheStorage = new FakeCacheStorage();
  void cacheStorage.open('legacy-game-cache-v3');
  const versions = options.controllerVersions ?? [];
  let askCount = 0;
  let loadHandler: (() => void) | undefined;

  const controller = {
    postMessage: (_msg: unknown, ports: Port[]): void => {
      const version = versions[Math.min(askCount, versions.length - 1)];
      askCount += 1;
      if (version !== null && version !== undefined) {
        ports[0]?.postMessage({ type: 'PWA_SW_VERSION', version });
      }
    },
  };
  const registration = { scope: 'https://game.test/', unregister, update: jest.fn() };
  const foreign = { scope: 'https://game.test/other-app/', unregister: foreignUnregister, update: jest.fn() };
  const navigatorFake = {
    serviceWorker: {
      controller: options.hasController === false ? null : controller,
      addEventListener: jest.fn(),
      register: jest.fn(() => Promise.resolve(registration)),
      getRegistrations: jest.fn(() => Promise.resolve([registration, foreign])),
    },
  };
  const windowFake = {
    addEventListener: (type: string, fn: () => void): void => {
      if (type === 'load') {
        loadHandler = fn;
      }
    },
    location: { reload, href: 'https://game.test/index.html' },
  };
  const documentFake = {
    querySelector: (): { getAttribute: () => string } | null =>
      options.metaVersion === undefined ? null : { getAttribute: (): string => options.metaVersion ?? '' },
    addEventListener: jest.fn(),
    visibilityState: 'visible',
  };
  const sessionStorageFake = {
    getItem: (k: string): string | null => storage.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      storage.set(k, v);
    },
  };
  class FakeChannel {
    port1: { onmessage: ((e: { data: unknown }) => void) | null } = { onmessage: null };
    port2: Port = { postMessage: (d: unknown): void => this.port1.onmessage?.({ data: d }) };
  }
  const compressedTimeout = (fn: () => void): ReturnType<typeof setTimeout> => setTimeout(fn, COMPRESSED_TIMER_MS);

  new Function(
    'window', 'navigator', 'document', 'sessionStorage', 'caches', 'MessageChannel',
    'setTimeout', 'clearTimeout', 'setInterval', 'requestIdleCallback', 'console',
    source,
  )(
    windowFake, navigatorFake, documentFake, sessionStorageFake, cacheStorage, FakeChannel,
    compressedTimeout, clearTimeout, jest.fn(), undefined, { warn: jest.fn() },
  );

  return {
    start: (): void => loadHandler?.(),
    reload,
    caches: cacheStorage,
    unregister,
    foreignUnregister,
    storage,
    asks: (): number => askCount,
  };
}

export function settle(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
