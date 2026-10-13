// App principal: abas, janelas, botão voltar do celular, tema e inicialização.

import { html, render, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { Icon, ToastHost, DialogHost, confirmDialog, toast } from './ui.js';
import { useStore, init, setPago, getState } from './store.js';
import { isFinal } from './calc.js';
import { Home, SearchSheet } from './views/home.js';
import { LoteForm } from './views/loteForm.js';
import { Finance } from './views/finance.js';
import { Stats } from './views/stats.js';
import { Settings } from './views/settings.js';
import { Report } from './views/report.js';
import { Annual } from './views/annual.js';

const TABS = [
  { id: 'inicio', label: 'Início', icon: 'home' },
  { id: 'financas', label: 'Finanças', icon: 'wallet' },
  { id: 'numeros', label: 'Números', icon: 'chart' },
  { id: 'ajustes', label: 'Ajustes', icon: 'gear' },
];

const FILTER_KEY = 'costura_filtro';

const App = () => {
  const st = useStore();
  const [tab, setTab] = useState('inicio');
  const [filter, setFilterState] = useState(() => {
    try {
      return localStorage.getItem(FILTER_KEY) || 'este_mes';
    } catch (e) {
      return 'este_mes';
    }
  });
  const [modal, setModal] = useState(null);
  const [exitAsk, setExitAsk] = useState(false);
  const [splash, setSplash] = useState(true);
  const [focus, setFocus] = useState(null);
  const [update, setUpdate] = useState(null);

  const setFilter = (f) => {
    setFilterState(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch (e) {
      /* ignora */
    }
  };

  // ---------- Inicialização ----------
  useEffect(() => {
    const t0 = Date.now();
    init().then(() => setTimeout(() => setSplash(false), Math.max(0, 700 - (Date.now() - t0))));
  }, []);

  // Dados vieram do app antigo neste mesmo navegador: pergunta sobre pagamentos
  useEffect(() => {
    if (!st.ready || splash || !st.legacyImported) return;
    st.legacyImported = false;
    const semInfo = getState().lotes.filter((l) => isFinal(l) && l.pago === undefined);
    toast('Seus dados do app antigo foram trazidos!');
    if (semInfo.length)
      confirmDialog({
        title: 'Lotes antigos já foram pagos?',
        text: `${semInfo.length} lote(s) finalizado(s) vieram do app antigo. Marcar todos como pagos?`,
        ok: 'Sim, já recebi',
        cancel: 'Deixar a receber',
        icon: 'money',
      }).then((yes) => setPago(semInfo.map((l) => l.id), yes));
  }, [st.ready, splash]);

  // ---------- Tema, título e ícone ----------
  useEffect(() => {
    const t = st.settings.tema;
    const root = document.documentElement;
    if (t === 'claro') root.setAttribute('data-theme', 'light');
    else if (t === 'escuro') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    document.title = st.settings.appName || 'Gestão Costura';
    const icon = st.settings.logo || 'icons/icon-192.png';
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((l) => (l.href = icon));
  }, [st.settings.tema, st.settings.appName, st.settings.logo]);

  // Trava a rolagem do fundo quando há janela aberta
  useEffect(() => {
    document.body.classList.toggle('locked', !!modal || exitAsk);
  }, [modal, exitAsk]);

  // ---------- Botão voltar do celular ----------
  const stateRef = useRef({});
  stateRef.current = { modal, tab, exitAsk };
  const exiting = useRef(false);

  useEffect(() => {
    history.replaceState({ root: true }, '');
    history.pushState({ app: true }, '');
    const onPop = () => {
      if (exiting.current) return;
      const s = stateRef.current;
      if (document.querySelector('.overlay.center')) {
        // Um diálogo de confirmação está aberto: deixa o próprio diálogo tratar (clicar fora fecha)
        document.querySelector('.overlay.center')?.click();
      } else if (s.modal) setModal(null);
      else if (s.exitAsk) setExitAsk(false);
      else if (s.tab !== 'inicio') setTab('inicio');
      else setExitAsk(true);
      history.pushState({ app: true }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const exitApp = () => {
    exiting.current = true;
    setExitAsk(false);
    history.go(-2);
  };

  // ---------- Atualização do app (service worker) ----------
  useEffect(() => {
    const onUpdate = (e) => setUpdate(() => e.detail);
    window.addEventListener('sw-update', onUpdate);
    return () => window.removeEventListener('sw-update', onUpdate);
  }, []);

  // ---------- Ações ----------
  const openLote = (lote) => setModal({ type: 'lote', lote, key: Date.now() });
  const finishLote = (lote) => setModal({ type: 'lote', lote, finish: true, key: Date.now() });
  const newLote = () => setModal({ type: 'lote', lote: null, key: Date.now() });
  const duplicate = (lote) => setModal({ type: 'lote', lote: null, template: lote, key: Date.now() });

  const go = (where) => {
    if (where === 'receber') {
      setTab('financas');
      setTimeout(() => document.getElementById('receber')?.scrollIntoView({ behavior: 'smooth' }), 80);
    } else if (where === 'atrasados') {
      setFilter('em_andamento');
      setTimeout(() => document.querySelector('.lote-list')?.scrollIntoView({ behavior: 'smooth' }), 80);
    } else if (where === 'backup') {
      setTab('ajustes');
      setFocus('backup');
      setTimeout(() => setFocus(null), 500);
    }
  };

  if (splash || !st.ready) {
    return html`<div class="splash">
      <img src=${st.settings.logo || 'icons/icon-192.png'} alt="" />
      <div class="splash-bar"><span></span></div>
    </div>`;
  }

  if (st.error) {
    return html`<div class="fatal">
      <h2>Ops!</h2><p>${st.error}</p>
      <p class="muted">Se estiver em uma janela anônima, abra o app em uma janela normal.</p>
      <button class="btn primary" onClick=${() => location.reload()}>Tentar de novo</button>
    </div>`;
  }

  return html`
    <div class="shell">
      <main class="content">
        ${tab === 'inicio' && html`<${Home} filter=${filter} setFilter=${setFilter} onNew=${newLote} onOpen=${openLote} onFinish=${finishLote}
            onAnnual=${() => setModal({ type: 'annual' })} onSearch=${() => setModal({ type: 'search' })}
            onReport=${() => setModal({ type: 'report', initial: filter === 'mes_passado' ? (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return { y: d.getFullYear(), m: d.getMonth() }; })() : filter === 'todos' ? 'todos' : null })}
            onGo=${go} />`}
        ${tab === 'financas' && html`<${Finance} onOpenLote=${openLote} onReport=${(ym) => setModal({ type: 'report', initial: ym })} onAnnual=${() => setModal({ type: 'annual' })} />`}
        ${tab === 'numeros' && html`<${Stats} />`}
        ${tab === 'ajustes' && html`<${Settings} onOpenLote=${openLote} focus=${focus} />`}
      </main>

      <nav class="tabbar" aria-label="Navegação">
        ${TABS.map((t, i) => html`
          ${i === 2 && html`<button class="tab-new" onClick=${newLote} aria-label="Novo lote"><span><${Icon} name="plus" size=${26} stroke=${2.6} /></span><small>Novo lote</small></button>`}
          <button class=${'tab' + (tab === t.id ? ' on' : '')} aria-current=${tab === t.id ? 'page' : null}
            onClick=${() => { setTab(t.id); window.scrollTo(0, 0); }}>
            <${Icon} name=${t.icon} size=${22} /><span>${t.label}</span>
          </button>`)}
      </nav>

      ${modal?.type === 'lote' && html`<${LoteForm} key=${modal.key} lote=${modal.lote} template=${modal.template} finish=${modal.finish}
          onClose=${() => setModal(null)} onDuplicate=${duplicate} />`}
      ${modal?.type === 'search' && html`<${SearchSheet} onClose=${() => setModal(null)} onOpen=${openLote} />`}
      ${modal?.type === 'report' && html`<${Report} initial=${modal.initial} onClose=${() => setModal(null)} />`}
      ${modal?.type === 'annual' && html`<${Annual} onClose=${() => setModal(null)} />`}

      ${exitAsk && html`
        <div class="overlay center" onClick=${() => setExitAsk(false)}>
          <div class="dialog pop" onClick=${(e) => e.stopPropagation()}>
            <h3>Sair do app?</h3>
            <div class="row gap">
              <button class="btn ghost grow" onClick=${() => setExitAsk(false)}>Cancelar</button>
              <button class="btn primary grow" onClick=${exitApp}>Sair</button>
            </div>
          </div>
        </div>`}

      ${update && html`<button class="update-bar" onClick=${() => update()}>Nova versão disponível — toque para atualizar</button>`}

      <${DialogHost} />
      <${ToastHost} />
    </div>`;
};

render(html`<${App} />`, document.getElementById('app'));

// ---------- Service worker (funcionar offline) ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        const announce = (worker) =>
          window.dispatchEvent(new CustomEvent('sw-update', { detail: () => worker.postMessage('skipWaiting') }));
        if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) announce(w);
          });
        });
      })
      .catch((e) => console.warn('Service worker não registrado', e));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}
