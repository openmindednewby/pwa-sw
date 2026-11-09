/** Emitted install handler: skips waiting and, given a URL, precaches it into the static cache without a failure failing the install. */
export function installListenerSource(precacheUrl: string | null): string {
  if (precacheUrl === null) {
    return `self.addEventListener('install', function() {
  self.skipWaiting();
});`;
  }
  return `const SHELL_PRECACHE_URL = ${JSON.stringify(precacheUrl)};

function precacheShell() {
  return caches.open(STATIC_CACHE).then(function(cache) {
    return fetch(SHELL_PRECACHE_URL, { cache: 'no-cache' }).then(function(response) {
      if (response && response.ok && !response.redirected) {
        return cache.put(SHELL_PRECACHE_URL, response);
      }
      return undefined;
    });
  }).catch(function() {
    return undefined;
  });
}

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(precacheShell());
});`;
}
