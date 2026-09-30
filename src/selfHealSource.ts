import type { ResolvedServiceWorkerConfig } from './config';
import { BUILD_VERSION_META_NAME, HEAL_GUARD_KEY_PREFIX, VERSION_REQUEST_TYPE } from './freshness';

const VERSION_REPLY_TIMEOUT_MS = 3000;

/**
 * Registration-snippet source for the zombie self-heal, or '' when disabled.
 * Emits `verifyActiveVersion()`, called once the registration resolves.
 */
export function selfHealSource(resolved: ResolvedServiceWorkerConfig): string {
  if (!resolved.selfHeal) {
    return '';
  }
  const json = (value: unknown): string => JSON.stringify(value);
  return `
  // Zombie self-heal: a worker that keeps serving another build after the grace
  // period (a legacy hand-written SW, or one whose script URL moved) is removed.
  const BUILD_VERSION = ${json(resolved.buildVersion)};
  const VERSION_REQUEST_TYPE = ${json(VERSION_REQUEST_TYPE)};
  const HEAL_GRACE_MS = ${resolved.selfHealGraceMs};
  const VERSION_REPLY_TIMEOUT_MS = ${VERSION_REPLY_TIMEOUT_MS};

  const readPageVersion = function () {
    const meta = document.querySelector('meta[name=${json(BUILD_VERSION_META_NAME)}]');
    const content = meta ? meta.getAttribute('content') : null;
    return content ? content : BUILD_VERSION;
  };
  const PAGE_VERSION = readPageVersion();
  const HEAL_GUARD_KEY = ${json(HEAL_GUARD_KEY_PREFIX)} + PAGE_VERSION;

  // Resolves the controller's build version, or null when it does not answer.
  const askWorkerVersion = function (worker) {
    return new Promise(function (resolve) {
      const channel = new MessageChannel();
      const timer = setTimeout(function () { resolve(null); }, VERSION_REPLY_TIMEOUT_MS);
      channel.port1.onmessage = function (e) {
        clearTimeout(timer);
        resolve(e.data && e.data.version ? e.data.version : null);
      };
      try {
        worker.postMessage({ type: VERSION_REQUEST_TYPE }, [channel.port2]);
      } catch (_e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  };

  const controllerIsCurrent = function () {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return Promise.resolve(true);
    return askWorkerVersion(controller).then(function (version) { return version === PAGE_VERSION; });
  };

  const heal = function () {
    try {
      if (sessionStorage.getItem(HEAL_GUARD_KEY)) return Promise.resolve(false);
      sessionStorage.setItem(HEAL_GUARD_KEY, '1');
    } catch (_e) {
      return Promise.resolve(false); // no storage = no loop guard = never heal
    }
    const pageUrl = window.location.href;
    return navigator.serviceWorker.getRegistrations()
      .then(function (regs) {
        return Promise.all(regs
          .filter(function (r) { return pageUrl.indexOf(r.scope) === 0; })
          .map(function (r) { return r.unregister(); }));
      })
      .then(function () { return caches.keys(); })
      .then(function (names) { return Promise.all(names.map(function (n) { return caches.delete(n); })); })
      .then(function () { (window.__gsWhenIdle || run)(reload); return true; });
  };

  const verifyActiveVersion = function () {
    return controllerIsCurrent().then(function (current) {
      if (current) return false;
      return new Promise(function (resolve) { setTimeout(resolve, HEAL_GRACE_MS); })
        .then(controllerIsCurrent)
        .then(function (stillCurrent) { return stillCurrent ? false : heal(); });
    });
  };
`;
}
