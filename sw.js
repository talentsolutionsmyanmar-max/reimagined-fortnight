// ═══════════════════════════════════════════════════════════════
// QuentrexKillzone OS — Service Worker v7.2
// Handles: caching, offline fallback, push notifications (KZ alerts)
// ═══════════════════════════════════════════════════════════════
const CACHE_NAME  = 'quentrex-v7.2';
const STATIC_URLS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// ── INSTALL: cache shell immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first for API calls, cache-first for shell
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Always network for live data endpoints
  if (
    url.includes('api.binance.com') ||
    url.includes('fapi.binance.com') ||
    url.includes('api.bybit.com') ||
    url.includes('stream.binance.com') ||
    url.includes('stream.bybit.com') ||
    url.includes('tradingview.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for app shell (HTML, icons, manifest)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Killzone alerts
// ═══════════════════════════════════════════════════════════════
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || '🔥 QuentrexOS Alert';
  const options = {
    body:    data.body  || 'Killzone is now active — Hunt mode!',
    icon:    './icon-192.png',
    badge:   './icon-192.png',
    tag:     data.tag   || 'kz-alert',
    renotify: true,
    vibrate: [200, 100, 200, 100, 400],
    data:    { url: data.url || './', timestamp: Date.now() },
    actions: [
      { action: 'open',   title: '⚡ Open App' },
      { action: 'dismiss',title: '✕ Dismiss'  }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        clientList[0].focus();
        clientList[0].navigate(e.notification.data?.url || './');
      } else {
        clients.openWindow(e.notification.data?.url || './');
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════
// BACKGROUND SYNC — Killzone timer check every minute via message
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', e => {
  if (e.data?.type === 'KZ_CHECK') {
    const { activeKZ, kzName } = e.data;
    if (activeKZ) {
      self.registration.showNotification(`🔥 ${kzName} KILLZONE ACTIVE`, {
        body:    'Hunt mode ON — Check your setups now!',
        icon:    './icon-192.png',
        badge:   './icon-192.png',
        tag:     'kz-active',
        renotify: false,
        vibrate: [300, 100, 300],
        silent:  false
      });
    }
  }
  if (e.data?.type === 'KZ_OPENING') {
    self.registration.showNotification(`⏰ ${e.data.kzName} opens in 5 minutes`, {
      body:    'Prepare your charts and watchlist now!',
      icon:    './icon-192.png',
      badge:   './icon-192.png',
      tag:     'kz-upcoming',
      renotify: true,
      vibrate: [100, 50, 100]
    });
  }
  if (e.data?.type === 'SIGNAL_ALERT') {
    self.registration.showNotification(`⚡ ${e.data.pair} ${e.data.grade} Signal`, {
      body:    `${e.data.dir} @ ${e.data.entry} | RR ${e.data.rr} | ${e.data.session}`,
      icon:    './icon-192.png',
      badge:   './icon-192.png',
      tag:     'signal',
      renotify: true,
      vibrate: [200, 100, 200, 100, 200, 100, 400]
    });
  }
});
