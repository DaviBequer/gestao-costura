// Componentes visuais reutilizáveis: ícones, modais, avisos, campos de dinheiro e números.

import { html, useEffect, useRef, useState } from '../vendor/preact-htm.js';
import { brl, onlyDigits } from './util.js';

// ---------- Ícones (SVG em linha) ----------

const P = {
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  download: 'M12 3v12M7 10l5 5 5-5M4 19h16',
  upload: 'M12 15V3M7 8l5-5 5 5M4 19h16',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  whats: 'M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.5-2.5-2-3-3l1-1-1-2z',
};

const Shirt = 'M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c0 1.7-1.3 3-3 3s-3-1.3-3-3z';
const Pants = 'M6 3h12l1 18h-5l-2-11-2 11H5z';
const Layers = 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5';

export const Icon = ({ name, size = 20, class: cls = '', stroke = 2 }) => {
  const d = name === 'shirt' ? Shirt : name === 'pants' ? Pants : name === 'layers' ? Layers : P[name];
  return html`<svg class=${'icon ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d} /></svg>`;
};

export const tipoIcon = (tipo) => (tipo === 'superior' ? 'shirt' : tipo === 'inferior' ? 'pants' : 'layers');

// ---------- Avisos rápidos (toast) ----------

let toastSetter = null;
export const toast = (msg, kind = 'ok') => toastSetter && toastSetter({ msg, kind, key: Date.now() });

export const ToastHost = () => {
  const [t, setT] = useState(null);
  toastSetter = setT;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return html`<div class=${'toast toast-' + t.kind} key=${t.key} role="status">${t.msg}</div>`;
};

// ---------- Diálogo de confirmação (substitui o confirm() do navegador) ----------

let dialogSetter = null;
/** confirmDialog({ title, text, ok, cancel, danger }) -> Promise<boolean> */
export const confirmDialog = (opts) =>
  new Promise((resolve) => {
    if (!dialogSetter) return resolve(window.confirm(opts.text || opts.title));
    dialogSetter({ ...opts, resolve });
  });

export const DialogHost = () => {
  const [d, setD] = useState(null);
  dialogSetter = setD;
  if (!d) return null;
  const done = (v) => {
    setD(null);
    d.resolve(v);
  };
  return html`
    <div class="overlay center" onClick=${() => done(false)}>
      <div class="dialog pop" onClick=${(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        ${d.icon && html`<div class=${'dialog-icon ' + (d.danger ? 'danger' : '')}><${Icon} name=${d.icon} size=${28} /></div>`}
        <h3>${d.title}</h3>
        ${d.text && html`<p>${d.text}</p>`}
        <div class="row gap">
          ${d.cancel !== false && html`<button class="btn ghost grow" onClick=${() => done(false)}>${d.cancel || 'Cancelar'}</button>`}
          <button class=${'btn grow ' + (d.danger ? 'danger' : 'primary')} onClick=${() => done(true)}>${d.ok || 'Confirmar'}</button>
        </div>
      </div>
    </div>`;
};

// ---------- Tela cheia / folha de baixo ----------

export const Sheet = ({ title, onClose, children, footer, wide, left, float }) => html`
  <div class=${'overlay' + (float ? ' float' : '')} onClick=${onClose}>
    <section class=${'sheet slide-up' + (wide ? ' wide' : '') + (float ? ' float' : '')} onClick=${(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label=${title}>
      <header class="sheet-head">
        ${left || html`<span class="w40"></span>`}
        <h2>${title}</h2>
        <button class="icon-btn" onClick=${onClose} aria-label="Fechar"><${Icon} name="x" /></button>
      </header>
      <div class="sheet-body">${children}</div>
      ${footer && html`<footer class="sheet-foot">${footer}</footer>`}
    </section>
  </div>`;

// ---------- Campos ----------

/** Campo de dinheiro: digita só números e ele formata (1234 -> R$ 12,34). value/onChange em centavos. */
export const MoneyInput = ({ value, onChange, maxDigits = 6, placeholder = 'R$ 0,00', class: cls = '', autoFocus, ...rest }) => {
  const shown = value ? brl(value) : '';
  return html`<input class=${'input money ' + cls} type="text" inputmode="numeric" placeholder=${placeholder} value=${shown}
    autoFocus=${autoFocus}
    onInput=${(e) => {
      const digits = onlyDigits(e.target.value, maxDigits);
      const cents = digits ? parseInt(digits, 10) : 0;
      onChange(cents);
      e.target.value = cents ? brl(cents) : '';
    }} ...${rest} />`;
};

/** Campo de número inteiro (quantidades). value/onChange em número ou null. */
export const NumInput = ({ value, onChange, maxDigits = 4, placeholder = '0', class: cls = '', ...rest }) => html`
  <input class=${'input num ' + cls} type="text" inputmode="numeric" pattern="[0-9]*" placeholder=${placeholder}
    value=${value ? String(value) : ''}
    onInput=${(e) => {
      const digits = onlyDigits(e.target.value, maxDigits);
      e.target.value = digits;
      onChange(digits ? parseInt(digits, 10) : null);
    }}
    onFocus=${(e) => e.target.select()} ...${rest} />`;

export const Toggle = ({ on, onChange, label, hint }) => html`
  <button type="button" class=${'toggle-row' + (on ? ' on' : '')} onClick=${() => onChange(!on)} role="switch" aria-checked=${on}>
    <span class="toggle-text"><b>${label}</b>${hint && html`<small>${hint}</small>`}</span>
    <span class="switch"><span class="knob"></span></span>
  </button>`;

export const Field = ({ label, children, hint }) => html`
  <label class="field">
    <span class="field-label">${label}</span>
    ${children}
    ${hint && html`<small class="field-hint">${hint}</small>`}
  </label>`;

export const Empty = ({ icon = 'layers', title, text, children }) => html`
  <div class="empty">
    <div class="empty-icon"><${Icon} name=${icon} size=${32} /></div>
    <b>${title}</b>
    ${text && html`<p>${text}</p>`}
    ${children}
  </div>`;

/** Executa uma ação assíncrona mostrando erro amigável */
export const run = async (fn, okMsg) => {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    console.error(e);
    toast(e?.message || 'Algo deu errado', 'error');
    return undefined;
  }
};

/** Hook para rolar até o topo quando algo muda */
export const useScrollTop = (dep) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [dep]);
  return ref;
};
