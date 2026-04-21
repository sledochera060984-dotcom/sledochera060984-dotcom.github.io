const CACHE_NAME = 'arabrus-cache-v7';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './base.js',
  './verbs.js',
  './tts-enhancer.js',
  './icon.png',
  './icons/192x192.png',
  './icons/512x512.png',
  './icons/512x512-monochrome.png'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function injectTtsEnhancer(response) {
  if (!response) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const originalText = await response.text();
  if (originalText.includes('tts-enhancer.js')) {
    return new Response(originalText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  const injectedText = originalText.includes('</body>')
    ? originalText.replace('</body>', '<script src="/tts-enhancer.js"></script></body>')
    : originalText + '<script src="/tts-enhancer.js"></script>';

  return new Response(injectedText, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || networkPromise || caches.match('./offline.html');
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put('./index.html', response.clone()).catch(() => {});
    }
    return injectTtsEnhancer(response);
  } catch (_) {
    const cachedIndex = await cache.match('./index.html');
    if (cachedIndex) return injectTtsEnhancer(cachedIndex);
    const offlinePage = await cache.match('./offline.html');
    return injectTtsEnhancer(offlinePage);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (APP_SHELL.some((asset) => url.pathname.endsWith(asset.replace('./', '/')) || url.pathname === asset.replace('./', '/'))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response && response.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    }).catch(() => caches.match('./offline.html')))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});