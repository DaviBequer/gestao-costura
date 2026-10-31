// Tela inicial: resumo do mês (meta + semanas), alertas, filtros e lista de lotes.

import { html, useState, useMemo, useRef, useEffect } from '../../vendor/preact-htm.js';
import { Icon, Sheet, MoneyInput, Empty, confirmDialog, run, tipoIcon } from '../ui.js';
import { brl, brl0, dm, fmtRef, MESES, daysInMonth, daysBetween, today, num } from '../util.js';
import {
  FILTERS, applyFilter, filterMonth, finishedInMonth, openLotes, loteValue, lotePieces, weeksOfMonth, currentWeekIndex,
  prazoInfo, totalAReceber, isFinal, TIPO_LABEL,
} from '../calc.js';
import { useStore, updateSettings, deleteLote, setPago } from '../store.js';

const SHORT_FILTER = { em_andamento: 'Andamento', este_mes: 'Este mês', mes_passado: 'Mês passado', todos: 'Todos' };

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

// ---------- Pesponto animado: agulha costurando a borda do cartão ----------

/** Retângulo arredondado recuado `inset` px, como caminho SVG */
const roundedPath = (w, h, inset = 8, r = 14) => {
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  return `M${x0 + r} ${y0} H${x1 - r} Q${x1} ${y0} ${x1} ${y0 + r} V${y1 - r} Q${x1} ${y1} ${x1 - r} ${y1} H${x0 + r} Q${x0} ${y1} ${x0} ${y1 - r} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} Z`;
};

const Pesponto = () => {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box) return;
    const measure = () => setSize({ w: box.offsetWidth, h: box.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const d = size ? roundedPath(size.w, size.h) : '';
  return html`<svg ref=${ref} class="pesponto" width=${size?.w || 0} height=${size?.h || 0} aria-hidden="true">
    ${size && html`
      <mask id="pespMask"><path class="pesp-revela" pathLength="100" d=${d} /></mask>
      <path class="pesp-linha" mask="url(#pespMask)" d=${d} />
      <g class="pesp-agulha" style=${`offset-path:path("${d}")`}>
        <g class="pesp-bate"><line x1="0" y1="-16" x2="0" y2="0" /><circle cx="0" cy="-16" r="2.5" /></g>
      </g>`}
  </svg>`;
};

// ---------- Fio da meta: a linha é puxada até onde o mês chegou ----------

const FIO = 'M2 18 C40 8 70 28 110 18 S180 8 220 18 S270 28 292 18';

const Fio = ({ pct, prod }) => {
  const a = Math.min(100, pct);
  const b = Math.min(100 - a, prod);
  return html`<svg class="fio" viewBox="0 0 294 34" aria-hidden="true">
    <path class="fio-bg" d=${FIO} />
    ${b > 0 && html`<path class="fio-prod" pathLength="100" d=${FIO} stroke-dasharray=${`0 ${a} ${b} 100`} />`}
    <path class="fio-feito" pathLength="100" d=${FIO} style=${`stroke-dashoffset:${100 - a}`} />
    <g class="fio-agulha" style=${`offset-path:path("${FIO}");offset-distance:${a}%`}>
      <path d="M-20 -1.5 L2 0 L-20 1.5 Z" /><ellipse cx="-16" cy="0" rx="2.6" ry="1" />
    </g>
  </svg>`;
};

// ---------- Gráfico do mês: faturamento acumulado x ritmo da meta ----------

/** Curva suave (Catmull-Rom → Bézier) passando pelos pontos */
const smoothPath = (pts) => {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    // Acumulado nunca desce: limita os pontos de controle ao intervalo do segmento
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    d += ` C${c1x.toFixed(1)},${Math.min(hi, Math.max(lo, c1y)).toFixed(1)} ${c2x.toFixed(1)},${Math.min(hi, Math.max(lo, c2y)).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
};

const MonthChart = ({ lotes, ym, meta, isPast }) => {
  const dim = daysInMonth(ym);
  const hoje = isPast ? dim : new Date().getDate();
  const weeks = weeksOfMonth(lotes, ym);
  const cur = isPast ? 5 : currentWeekIndex();

  // Faturado por dia → acumulado
  const porDia = new Array(dim + 1).fill(0);
  finishedInMonth(lotes, ym).forEach((l) => (porDia[Number(l.dataFim.slice(8, 10))] += loteValue(l)));
  const acum = [0];
  for (let d = 1; d <= dim; d++) acum[d] = acum[d - 1] + porDia[d];
  const total = acum[hoje];
  const ideal = meta ? (meta * hoje) / dim : 0;

  const W = 320, H = 112, top = 22, bottom = 6, left = 4, right = 4;
  const max = Math.max(1, meta, acum[dim]) * 1.08;
  const x = (d) => left + ((W - left - right) * d) / dim;
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const pts = [];
  // Pontos só no início, nos dias com entrega e em hoje: curva suave em vez de degraus
  for (let d = 0; d <= hoje; d++) if (d === 0 || d === hoje || porDia[d] > 0) pts.push([x(d), y(acum[d])]);
  const line = smoothPath(pts);
  const area = `${line} L${x(hoje).toFixed(1)},${H - bottom} L${x(0)},${H - bottom} Z`;
  const ahead = total >= ideal;
  const tx = x(hoje), ty = y(total);
  const label = brl0(total);
  const lw = label.length * 6.4 + 14;
  const lx = Math.min(W - lw - 2, Math.max(2, tx - lw / 2));
  const bands = [0, 7, 14, 21, 28, dim].filter((v, i, a) => i === 0 || v > a[i - 1]);

  return html`
    <div class="mchart">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`Faturado ${label} até o dia ${hoje}`}>
        <defs>
          <linearGradient id="mcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity="0.45" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${bands.slice(1, -1).map((d) => html`<line class="mc-sep" x1=${x(d)} x2=${x(d)} y1=${top - 8} y2=${H - bottom} />`)}
        ${!isPast && html`<rect class="mc-now" x=${x(bands[Math.min(cur, bands.length - 2)])} y=${top - 8} width=${x(bands[Math.min(cur + 1, bands.length - 1)]) - x(bands[Math.min(cur, bands.length - 2)])} height=${H - bottom - top + 8} rx="6" />`}
        ${meta > 0 && html`<line class="mc-ideal" x1=${x(0)} y1=${y(0)} x2=${x(dim)} y2=${y(meta)} />`}
        ${meta > 0 && html`<text class="mc-meta" x=${W - right} y=${y(meta) - 5} text-anchor="end">meta</text>`}
        <path class="mc-area" d=${area} />
        <path class="mc-line" d=${line} />
        <circle class=${'mc-dot' + (ahead ? ' ok' : '')} cx=${tx} cy=${ty} r="4.5" />
        <g class="mc-bubble">
          <rect x=${lx} y=${Math.max(1, ty - 26)} width=${lw} height="18" rx="9" />
          <text x=${lx + lw / 2} y=${Math.max(1, ty - 26) + 12.5} text-anchor="middle">${label}</text>
        </g>
      </svg>
      <div class="mc-weeks" style=${`grid-template-columns:${bands.slice(1).map((d, i) => `${d - bands[i]}fr`).join(' ')}`}>
        ${weeks.slice(0, bands.length - 1).map((w, i) => html`<div class=${'mc-week' + (i === cur ? ' current' : '') + (i > cur ? ' future' : '')} key=${i}>
          <b>${w.label}</b><small>${w.value ? brl0(w.value) : '—'}</small>
        </div>`)}
      </div>
      ${meta > 0 && !isPast && html`<p class=${'mc-pace ' + (ahead ? 'ok' : 'low')}>
        ${ahead ? `✨ ${brl0(total - ideal)} acima do ritmo da meta` : `${brl0(ideal - total)} abaixo do ritmo da meta`}
      </p>`}
    </div>`;
};

// ---------- Resumo do mês (meta + semanas) ----------

const Hero = ({ filter, onAnnual }) => {
  const { lotes, settings } = useStore();
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(settings.metaMensal);
  const isPast = filter === 'mes_passado';
  const ym = filterMonth(isPast ? 'mes_passado' : 'este_mes');
  const faturado = finishedInMonth(lotes, ym).reduce((a, l) => a + loteValue(l), 0);
  const producao = isPast ? 0 : openLotes(lotes).reduce((a, l) => a + loteValue(l), 0);
  const meta = settings.metaMensal || 0;
  const pct = meta ? (faturado / meta) * 100 : 0;
  const pctProd = meta ? (producao / meta) * 100 : 0;
  const falta = Math.max(0, meta - faturado);
  const diasRestantes = daysInMonth(ym) - new Date().getDate() + 1;
  const porDia = !isPast && falta > 0 && diasRestantes > 0 ? falta / diasRestantes : 0;

  return html`
    <section class="hero">
      <${Pesponto} />
      <div class="hero-top">
        <span>Meta de ${MESES[ym.m].toLowerCase()}${meta ? ` · ${brl0(meta)}` : ''}</span>
        <div class="row gap-s">
          <button class="hero-btn" onClick=${onAnnual} aria-label="Faturamento anual"><${Icon} name="chart" size=${15} /></button>
          <button class="hero-btn" onClick=${() => { setTemp(meta); setEditing(true); }} aria-label="Editar meta"><${Icon} name="edit" size=${15} /></button>
        </div>
      </div>

      <div class="hero-values">
        <strong>${brl0(faturado)}</strong>
        <span class="hero-pct">${Math.round(pct)}%</span>
      </div>
      <${Fio} pct=${pct} prod=${pctProd} />
      <span class="hero-note">
        ${falta > 0 ? `faltam ${brl0(falta)}` : 'meta batida! 🎉'}${producao > 0 ? ` · ${brl0(producao)} na máquina` : ''}
      </span>

      ${porDia > 0 && html`
        <div class="hero-stats">
          <span><${Icon} name="clock" size=${13} /> ~${brl0(porDia)}/dia p/ bater</span>
        </div>`}

      <${MonthChart} lotes=${lotes} ym=${ym} meta=${meta} isPast=${isPast} />

      ${editing && html`
        <div class="overlay center" onClick=${() => setEditing(false)}>
          <div class="dialog pop" onClick=${(e) => e.stopPropagation()}>
            <h3>Meta mensal</h3>
            <p>Quanto você quer faturar por mês?</p>
            <${MoneyInput} class="big-input" value=${temp} onChange=${setTemp} maxDigits=${9} autoFocus />
            <div class="row gap">
              <button class="btn ghost grow" onClick=${() => setEditing(false)}>Cancelar</button>
              <button class="btn primary grow" onClick=${async () => { await run(() => updateSettings({ metaMensal: temp }), 'Meta atualizada'); setEditing(false); }}>Salvar</button>
            </div>
          </div>
        </div>`}
    </section>`;
};

// ---------- Alertas ----------

const Alerts = ({ onGo }) => {
  const { lotes } = useStore();
  const hoje = today();
  const prazos = openLotes(lotes).map((l) => prazoInfo(l, hoje)).filter(Boolean);
  const atrasados = prazos.filter((p) => p.tipo === 'atrasado').length;
  const proximos = prazos.filter((p) => p.tipo === 'hoje' || p.tipo === 'proximo').length;

  const items = [];
  if (atrasados) items.push(html`<button class="alert danger" onClick=${() => onGo('atrasados')}><${Icon} name="alert" size=${15} /> ${atrasados} atrasado${atrasados > 1 ? 's' : ''}</button>`);
  if (proximos) items.push(html`<button class="alert warn" onClick=${() => onGo('atrasados')}><${Icon} name="clock" size=${15} /> ${proximos} vence${proximos > 1 ? 'm' : ''} logo</button>`);
  if (!items.length) return null;
  return html`<div class="alerts">${items}</div>`;
};

// ---------- Retalhos: produção, peças e a receber ----------

const Retalhos = ({ onGo }) => {
  const { lotes } = useStore();
  const abertos = openLotes(lotes);
  const pecas = abertos.reduce((a, l) => a + lotePieces(l), 0);
  return html`<div class="retalhos">
    <div class="retalho xadrez"><small>Produção</small><b>${abertos.length} lote${abertos.length === 1 ? '' : 's'}</b></div>
    <div class="retalho bolinhas"><small>Peças</small><b>${num(pecas)}</b></div>
    <button class="retalho listras" onClick=${() => onGo('receber')}><small>A receber</small><b>${brl0(totalAReceber(lotes))}</b></button>
  </div>`;
};

// ---------- Linha de lote (deslize para a esquerda para excluir) ----------

const LoteRow = ({ lote, onOpen, onFinish, swiped, setSwiped }) => {
  const start = useRef(null);
  const [drag, setDrag] = useState(0);
  const [verFoto, setVerFoto] = useState(false);
  const prazo = prazoInfo(lote);
  const fin = isFinal(lote);
  const offset = drag || (swiped ? -88 : 0);

  // Tempo na máquina e quanto do prazo já passou (verde → amarelo → vermelho)
  let prog = null;
  if (!fin && lote.dataInicio) {
    const dias = Math.max(0, daysBetween(lote.dataInicio, today()));
    const total = lote.dataPrevista ? Math.max(1, daysBetween(lote.dataInicio, lote.dataPrevista)) : 0;
    const tom = !prazo ? '' : prazo.tipo === 'atrasado' ? 'atraso' : prazo.tipo === 'ok' ? 'ok' : 'perto';
    prog = { dias, pct: total ? Math.min(100, Math.round((dias / total) * 100)) : 0, tom };
  }

  const touchStart = (e) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null };
    if (!swiped) setSwiped(null);
  };
  const touchMove = (e) => {
    if (!start.current) return;
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (start.current.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) start.current.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (start.current.locked !== 'x') return;
    setDrag(Math.max(-110, Math.min(0, (swiped ? -88 : 0) + dx)));
  };
  const touchEnd = () => {
    if (start.current?.locked === 'x') setSwiped(drag < -44 ? lote.id : null);
    start.current = null;
    setDrag(0);
  };

  const remove = async (e) => {
    e.stopPropagation();
    const yes = await confirmDialog({ title: 'Excluir lote?', text: `O lote #${lote.ref} será apagado. Isso não pode ser desfeito.`, ok: 'Excluir', danger: true, icon: 'trash' });
    setSwiped(null);
    if (yes) run(() => deleteLote(lote.id), 'Lote excluído');
  };

  const togglePago = (e) => {
    e.stopPropagation();
    run(() => setPago(lote.id, !lote.pago), lote.pago ? 'Marcado como a receber' : 'Pagamento registrado');
  };

  return html`
    <div class=${'swipe-wrap' + (offset < 0 ? ' open' : '')}>
      <button class="swipe-del" onClick=${remove} aria-label="Excluir lote"><${Icon} name="trash" /><small>Excluir</small></button>
      <article class=${'lrow' + (fin ? ' fin' : '') + (prazo?.tipo === 'atrasado' ? ' late' : '')}
        style=${`transform:translateX(${offset}px);${drag ? 'transition:none' : ''}`}
        onClick=${() => (swiped ? setSwiped(null) : onOpen(lote))}
        onTouchStart=${touchStart} onTouchMove=${touchMove} onTouchEnd=${touchEnd}>
        <div class=${'lrow-thumb' + (lote.foto ? ' has-photo' : '')} onClick=${(e) => { if (lote.foto && !swiped) { e.stopPropagation(); setVerFoto(true); } }}>
          ${lote.foto ? html`<img src=${lote.foto} alt="" loading="lazy" />` : html`<${Icon} name=${tipoIcon(lote.tipo)} size=${22} stroke=${1.7} />`}
        </div>
        <div class="lrow-info">
          <h4><span class="hash">#</span>${fmtRef(lote.ref)}</h4>
          <span class="lrow-sub">${TIPO_LABEL[lote.tipo]} · ${num(lotePieces(lote))} pçs</span>
          <span class="lrow-when">
            ${prazo
              ? html`<em class=${prazo.tipo}>${prazo.texto}</em>`
              : fin ? `Entregue ${dm(lote.dataFim)}` : lote.dataPrevista ? `Prazo ${dm(lote.dataPrevista)}` : `Início ${dm(lote.dataInicio)}`}
          </span>
        </div>
        <div class="lrow-end">
          <b>${brl(loteValue(lote))}</b>
          ${fin
            ? html`<button class=${'tag-btn ' + (lote.pago ? 'paid' : 'due')} onClick=${togglePago}>${lote.pago ? '✓ Pago' : 'A receber'}</button>`
            : html`<button class="tag-btn finish" onClick=${(e) => { e.stopPropagation(); onFinish(lote); }}><${Icon} name="check" size=${12} stroke=${3} /> Finalizar</button>`}
        </div>
        ${prog && html`
          <div class=${'lrow-prog ' + prog.tom}>
            ${lote.dataPrevista && html`<div class="lrow-bar"><i style=${`width:${prog.pct}%`}></i></div>`}
            <div class="lrow-prog-foot">
              <span>${prog.dias === 0 ? 'Começou hoje' : `Há ${prog.dias} dia${prog.dias > 1 ? 's' : ''} na máquina`}</span>
              ${lote.dataPrevista && html`<span>Entrega prevista ${dm(lote.dataPrevista)}</span>`}
            </div>
          </div>`}
      </article>
      ${verFoto && html`
        <div class="overlay center photo-view" onClick=${() => setVerFoto(false)}>
          <figure onClick=${(e) => e.stopPropagation()}>
            <img src=${lote.foto} alt=${`Foto do lote ${lote.ref}`} />
            <figcaption><b>#${fmtRef(lote.ref)}</b> · ${TIPO_LABEL[lote.tipo]}</figcaption>
          </figure>
          <button class="icon-btn photo-close" onClick=${() => setVerFoto(false)} aria-label="Fechar foto"><${Icon} name="x" /></button>
        </div>`}
    </div>`;
};

// ---------- Busca ----------

export const SearchSheet = ({ onClose, onOpen }) => {
  const { lotes } = useStore();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase().replace('#', '').replace(/\s+/g, '');
    if (!s) return [];
    return lotes
      .filter((l) => l.ref.toLowerCase().includes(s) || (l.obs || '').toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''))
      .slice(0, 60);
  }, [q, lotes]);
  return html`<${Sheet} title="Buscar" onClose=${onClose}>
    <input class="input search" type="search" placeholder="Buscar referência" value=${q} autoFocus onInput=${(e) => setQ(e.target.value)} />
    ${q && !results.length && html`<${Empty} icon="search" title="Nada encontrado" text="Tente outra referência." />`}
    <div class="search-list">
      ${results.map(
        (l) => html`<button class="search-item" key=${l.id} onClick=${() => onOpen(l)}>
          <span><b>#${fmtRef(l.ref)}</b> <small>${TIPO_LABEL[l.tipo]}</small></span>
          <span class="right"><b>${brl(loteValue(l))}</b><small>${isFinal(l) ? 'Entregue ' + dm(l.dataFim) : 'Em andamento'}</small></span>
        </button>`,
      )}
    </div>
  </${Sheet}>`;
};

// ---------- Tela ----------

const Group = ({ title, items, ...rowProps }) => {
  if (!items.length) return null;
  const total = items.reduce((a, l) => a + loteValue(l), 0);
  return html`<section class="lgroup">
    <header class="lgroup-head"><h3>${title} <small>${items.length}</small></h3><span>${brl(total)}</span></header>
    <div class="lote-list">
      ${items.map((l) => html`<${LoteRow} key=${l.id} lote=${l} swiped=${rowProps.swiped === l.id} setSwiped=${rowProps.setSwiped} onOpen=${rowProps.onOpen} onFinish=${rowProps.onFinish} />`)}
    </div>
  </section>`;
};

export const Home = ({ filter, setFilter, onNew, onOpen, onFinish, onAnnual, onSearch, onReport, onGo, onSettings }) => {
  const { lotes, settings } = useStore();
  const [swiped, setSwiped] = useState(null);
  const list = useMemo(() => applyFilter(lotes, filter), [lotes, filter]);
  const abertos = list.filter((l) => !isFinal(l));
  const entregues = list.filter(isFinal);
  const rowProps = { swiped, setSwiped, onOpen, onFinish };

  return html`
    <div class="page home">
      <svg class="home-linha" viewBox="0 0 390 140" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 120 C80 40 160 140 250 70 S360 20 400 40" /></svg>
      <header class="home-head">
        <button class="home-logo-btn" onClick=${onSettings} aria-label="Abrir ajustes">
          <img class="home-logo" src=${settings.logo || 'icons/icon-192.png'} alt="" />
        </button>
        <div class="home-title">
          <small>${saudacao()} 👋</small>
          <b>${settings.appName}</b>
        </div>
        <button class="icon-btn" onClick=${onSearch} aria-label="Buscar"><${Icon} name="search" /></button>
        <button class="icon-btn" onClick=${onReport} aria-label="Relatório"><${Icon} name="doc" /></button>
      </header>

      <${Hero} filter=${filter} onAnnual=${onAnnual} />
      <${Retalhos} onGo=${onGo} />
      <${Alerts} onGo=${onGo} />

      <div class="seg filter-seg" role="tablist">
        ${FILTERS.map((f) => html`<button role="tab" aria-selected=${filter === f.id} class=${filter === f.id ? 'on' : ''} onClick=${() => setFilter(f.id)}>${SHORT_FILTER[f.id]}</button>`)}
      </div>

      <${Group} title="Em produção" items=${abertos} ...${rowProps} />
      <${Group} title="Entregues" items=${entregues} ...${rowProps} />
      ${!list.length && html`<${Empty} title="Nenhum lote aqui" text=${lotes.length ? 'Troque o filtro ou crie um lote novo.' : 'Toque em “Novo lote” para começar.'} />`}

    </div>`;
};
