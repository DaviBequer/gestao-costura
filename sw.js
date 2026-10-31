// Service worker: guarda o app no aparelho para funcionar sem internet.
// Com internet, sempre busca a versão mais nova (o app abre já atualizado, sem botão).
// Ao mudar qualquer arquivo do app, aumente a VERSAO para os celulares trocarem a cópia guardada.
const VERSAO = 'costura-v2.0.24';
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
  'icons/bird.png',
];

self.addEventListener('install', (e) => {
  // Baixa sem passar pelo cache do navegador e entra no lugar da versão antiga na hora
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
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

  // Arquivos do app: primeiro a rede (versão nova), guardando a cópia; sem rede ou rede lenta, usa a guardada
  e.respondWith(
    (async () => {
      const guardado = () =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      const rede = fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      });
      // Rede muito lenta: depois de 4 s mostra a cópia guardada (a nova fica salva para a próxima)
      const espera = new Promise((ok) => setTimeout(ok, 4000)).then(guardado);
      try {
        const res = await Promise.race([rede, espera.then((hit) => hit || rede)]);
        return res || Response.error();
      } catch (err) {
        return (await guardado()) || Response.error();
      }
    })(),
  );
});
