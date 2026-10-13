// Service worker: guarda o app no aparelho para funcionar sem internet.
// Ao mudar qualquer arquivo do app, aumente a VERSAO para os celulares baixarem a nova versão.
const VERSAO = 'costura-v2.0.9';
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/util.js',
  'js/calc.js',
  'js/db.js',
  'js/store.js',
  'js/migrate.js',
  'js/ui.js',
  'js/charts.js',
  'js/views/home.js',
  'js/views/loteForm.js',
  'js/views/finance.js',
  'js/views/stats.js',
  'js/views/annual.js',
  'js/views/report.js',
  'js/views/settings.js',
  'vendor/preact-htm.js',
  'vendor/html2pdf.bundle.min.js',
  'icons/icon-64.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSAO && k !== 'costura-fontes').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: guarda depois do primeiro uso
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('costura-fontes').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          c.put(req, res.clone());
          return res;
        } catch (err) {
          return new Response('', { status: 504 });
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // No computador (localhost) busca sempre a versão nova; sem rede, usa a guardada
  if (DEV) {
    e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  // Arquivos do app: primeiro o que está guardado, senão a rede
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())),
    ),
  );
});
