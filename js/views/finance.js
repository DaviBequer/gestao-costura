// Finanças: lucro do mês (faturado x despesas), lotes a receber e despesas.

import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { Icon, Sheet, MoneyInput, Empty, confirmDialog, run, toast } from '../ui.js';
import { brl, brl0, dm, fmtRef, monthLabel, shiftMonth, currentMonth, sameMonth, today, daysBetween, MESES } from '../util.js';
import { monthSummary, aReceber, loteValue, lotePieces, TIPO_LABEL } from '../calc.js';
import { useStore, saveDespesa, deleteDespesa, setPago } from '../store.js';

export const CATEGORIAS = [
  { id: 'linha', label: 'Linha / aviamentos', short: 'Linha', emoji: '🧵' },
  { id: 'agulha', label: 'Agulhas / peças', short: 'Agulhas', emoji: '🧷' },
  { id: 'energia', label: 'Energia', short: 'Energia', emoji: '💡' },
  { id: 'ajudante', label: 'Ajudante', short: 'Ajudante', emoji: '🤝' },
  { id: 'manutencao', label: 'Manutenção da máquina', short: 'Máquina', emoji: '🔧' },
  { id: 'transporte', label: 'Transporte / entrega', short: 'Transporte', emoji: '🛵' },
  { id: 'outros', label: 'Outros', short: 'Outros', emoji: '📦' },
];
const catOf = (id) => CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];

/** Navegação de mês (também usada na aba Números) */
export const MonthNav = ({ ym, setYm }) => {
  const isCurrent = ym.y === currentMonth().y && ym.m === currentMonth().m;
  return html`<div class="month-nav">
    <button class="icon-btn" onClick=${() => setYm(shiftMonth(ym, -1))} aria-label="Mês anterior"><${Icon} name="back" /></button>
    <b>${monthLabel(ym)}</b>
    <button class="icon-btn" disabled=${isCurrent} onClick=${() => setYm(shiftMonth(ym, 1))} aria-label="Próximo mês"><${Icon} name="next" /></button>
  </div>`;
};

// ---------- Despesa (formulário) ----------

const DespesaForm = ({ item, ym, onClose }) => {
  const isCur = ym.y === currentMonth().y && ym.m === currentMonth().m;
  const defaultDate = isCur ? today() : `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`;
  const [d, setD] = useState(item || { data: defaultDate, categoria: 'linha', descricao: '', valor: 0 });
  const up = (p) => setD((s) => ({ ...s, ...p }));
  const save = async () => {
    if (!d.valor) return toast('Informe o valor', 'error');
    await run(() => saveDespesa({ ...d, descricao: d.descricao.trim() }), item ? 'Despesa atualizada' : 'Despesa lançada');
    onClose();
  };
  const remove = async () => {
    if (await confirmDialog({ title: 'Excluir despesa?', ok: 'Excluir', danger: true, icon: 'trash' })) {
      await run(() => deleteDespesa(item.id), 'Despesa excluída');
      onClose();
    }
  };
  const footer = html`<div class="lf-foot">
    ${item && html`<button class="icon-btn danger" onClick=${remove} aria-label="Excluir despesa"><${Icon} name="trash" /></button>`}
    <button class="btn big primary grow" onClick=${save}><${Icon} name="check" /> Salvar</button>
  </div>`;
  return html`<${Sheet} title=${item ? 'Editar despesa' : 'Nova despesa'} onClose=${onClose} footer=${footer}>
    <div class="form lf">
      <${MoneyInput} class="big-input dz-value" value=${d.valor} onChange=${(v) => up({ valor: v })} maxDigits=${8} autoFocus=${!item} />
      <div class="dz-cats">
        ${CATEGORIAS.map((c) => html`<button type="button" class=${'dz-cat' + (d.categoria === c.id ? ' on' : '')} onClick=${() => up({ categoria: c.id })}>
          <span>${c.emoji}</span><small>${c.short}</small>
        </button>`)}
      </div>
      <div class="lf-card lf-dates">
        <label class="lf-field">
          <span class="lf-label">Descrição</span>
          <input class="input" maxlength="80" placeholder="Opcional" value=${d.descricao} onInput=${(e) => up({ descricao: e.target.value })} />
        </label>
        <label class="lf-field">
          <span class="lf-label">Data</span>
          <input class="input" type="date" value=${d.data} onInput=${(e) => up({ data: e.target.value || today() })} />
        </label>
      </div>
    </div>
  </${Sheet}>`;
};

// ---------- Tela ----------

export const Finance = ({ onOpenLote, onReport, onAnnual }) => {
  const { lotes, despesas, settings } = useStore();
  const [ym, setYm] = useState(currentMonth());
  const [editing, setEditing] = useState(null); // null | 'new' | despesa
  const s = monthSummary(lotes, despesas, ym);
  const prev = monthSummary(lotes, despesas, shiftMonth(ym, -1));
  const receber = useMemo(() => aReceber(lotes).sort((a, b) => (a.dataFim || '').localeCompare(b.dataFim || '')), [lotes]);
  const totalReceber = receber.reduce((a, l) => a + loteValue(l), 0);
  const gastosMes = despesas.filter((d) => sameMonth(d.data, ym.y, ym.m)).sort((a, b) => b.data.localeCompare(a.data));
  const porCategoria = CATEGORIAS.map((c) => ({ ...c, total: gastosMes.filter((d) => d.categoria === c.id).reduce((a, d) => a + d.valor, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const [aba, setAba] = useState(receber.length ? 'receber' : 'despesas');

  const margem = s.faturado ? Math.round((s.lucro / s.faturado) * 100) : 0;
  const pctGasto = s.faturado ? Math.min(100, (s.gastos / s.faturado) * 100) : s.gastos ? 100 : 0;
  const deltaLucro = prev.lucro ? Math.round(((s.lucro - prev.lucro) / Math.abs(prev.lucro)) * 100) : null;

  const pagarTodos = async () => {
    const yes = await confirmDialog({ title: 'Marcar todos como pagos?', text: `${receber.length} lote(s) — total ${brl(totalReceber)}.`, ok: 'Marcar pago', icon: 'money' });
    if (yes) run(() => setPago(receber.map((l) => l.id), true), 'Pagamento registrado');
  };

  const shareResumo = () => {
    const text = [
      `*${settings.appName} — ${monthLabel(ym)}*`,
      `Lotes entregues: ${s.lotes.length}`,
      `Peças: ${s.pecas}`,
      `Faturado: ${brl(s.faturado)}`,
      s.gastos ? `Despesas: ${brl(s.gastos)}` : null,
      s.gastos ? `Lucro: ${brl(s.lucro)}` : null,
      totalReceber ? `A receber: ${brl(totalReceber)}` : null,
    ].filter(Boolean).join('\n');
    const phone = (settings.whatsapp || '').replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/${phone.length <= 11 ? '55' + phone : phone}?text=${encodeURIComponent(text)}`, '_blank');
    else if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast('Resumo copiado'));
  };

  return html`
    <div class="page fin-page">
      <header class="fin-head">
        <h1>Finanças</h1>
        <div class="fin-month">
          <button class="icon-btn sm" onClick=${() => setYm(shiftMonth(ym, -1))} aria-label="Mês anterior"><${Icon} name="back" size=${16} /></button>
          <b>${MESES[ym.m].slice(0, 3)} ${ym.y}</b>
          <button class="icon-btn sm" disabled=${ym.y === currentMonth().y && ym.m === currentMonth().m} onClick=${() => setYm(shiftMonth(ym, 1))} aria-label="Próximo mês"><${Icon} name="next" size=${16} /></button>
        </div>
      </header>

      <!-- Resumo do mês -->
      <section class="hero fin-hero">
        <div class="hero-top">
          <span>Lucro de ${MESES[ym.m].toLowerCase()}</span>
          ${deltaLucro !== null && html`<span class=${'fin-delta ' + (deltaLucro >= 0 ? 'up' : 'down')}>${deltaLucro >= 0 ? '▲' : '▼'} ${Math.abs(deltaLucro)}%</span>`}
        </div>
        <strong class=${'fin-lucro' + (s.lucro < 0 ? ' neg' : '')}>${brl(s.lucro)}</strong>
        <div class="fin-bar" aria-hidden="true"><span style=${`width:${pctGasto}%`}></span></div>
        <div class="fin-stats">
          <div><small>Faturado</small><b>${brl0(s.faturado)}</b><span>${s.lotes.length} lotes · ${s.pecas} pçs</span></div>
          <div><small>Despesas</small><b class="red">${brl0(s.gastos)}</b><span>${gastosMes.length} lançamento${gastosMes.length === 1 ? '' : 's'}</span></div>
          <div><small>Margem</small><b>${s.faturado ? margem + '%' : '—'}</b><span>do faturado</span></div>
        </div>
      </section>

      <div class="fin-actions">
        <button onClick=${() => onReport(ym)}><span><${Icon} name="doc" size=${20} /></span>Relatório</button>
        <button onClick=${onAnnual}><span><${Icon} name="chart" size=${20} /></span>Anual</button>
        <button onClick=${shareResumo}><span><${Icon} name="whats" size=${20} /></span>Resumo</button>
        <button onClick=${() => setEditing('new')}><span class="add"><${Icon} name="plus" size=${20} stroke=${2.6} /></span>Despesa</button>
      </div>

      <!-- A receber / Despesas -->
      <div class="seg filter-seg" id="receber" role="tablist">
        <button role="tab" class=${aba === 'receber' ? 'on' : ''} onClick=${() => setAba('receber')}>A receber${receber.length ? ` · ${receber.length}` : ''}</button>
        <button role="tab" class=${aba === 'despesas' ? 'on' : ''} onClick=${() => setAba('despesas')}>Despesas${gastosMes.length ? ` · ${gastosMes.length}` : ''}</button>
      </div>

      ${aba === 'receber' && html`
        <section class="lgroup">
          ${receber.length
            ? html`
              <header class="lgroup-head">
                <h3>Total pendente</h3>
                <span class="fin-pend">${brl(totalReceber)}</span>
              </header>
              <div class="lote-list">
                ${receber.map((l) => {
                  const dias = daysBetween(l.dataFim, today());
                  return html`<div class="lrow fin" key=${l.id} onClick=${() => onOpenLote(l)}>
                    <div class="lrow-info">
                      <h4><span class="hash">#</span>${fmtRef(l.ref)}</h4>
                      <span class="lrow-sub">${TIPO_LABEL[l.tipo]} · ${lotePieces(l)} pçs</span>
                      <span class="lrow-when">${dias > 0 ? html`Entregue ${dm(l.dataFim)} · <em class=${dias > 30 ? 'atrasado' : dias > 14 ? 'proximo' : ''}>há ${dias} dia${dias > 1 ? 's' : ''}</em>` : 'Entregue hoje'}</span>
                    </div>
                    <div class="lrow-end">
                      <b>${brl(loteValue(l))}</b>
                      <button class="tag-btn paid" onClick=${(e) => { e.stopPropagation(); run(() => setPago(l.id, true), 'Pagamento registrado'); }}>
                        <${Icon} name="check" size=${12} stroke=${3} /> Recebi
                      </button>
                    </div>
                  </div>`;
                })}
              </div>
              ${receber.length > 1 && html`<button class="btn ghost fin-all" onClick=${pagarTodos}><${Icon} name="check" /> Marcar todos como pagos</button>`}`
            : html`<${Empty} icon="money" title="Tudo recebido 🎉" text="Lotes entregues e ainda não pagos aparecem aqui." />`}
        </section>`}

      ${aba === 'despesas' && html`
        <section class="lgroup">
          ${porCategoria.length > 0 && html`
            <div class="fin-cats">
              ${porCategoria.map((c) => html`<div class="fin-cat" key=${c.id}>
                <span class="fin-cat-emoji">${c.emoji}</span>
                <span class="fin-cat-name">${c.short}</span>
                <span class="fin-cat-track"><i style=${`width:${Math.max(4, (c.total / s.gastos) * 100)}%`}></i></span>
                <b>${brl0(c.total)}</b>
              </div>`)}
            </div>`}
          ${gastosMes.length
            ? html`<div class="lote-list">
                ${gastosMes.map((d) => html`
                  <div class="lrow desp" key=${d.id} onClick=${() => setEditing(d)}>
                    <div class="lrow-thumb emoji">${catOf(d.categoria).emoji}</div>
                    <div class="lrow-info">
                      <h4 class="desp-title">${d.descricao || catOf(d.categoria).label}</h4>
                      <span class="lrow-when">${catOf(d.categoria).short} · ${dm(d.data)}</span>
                    </div>
                    <div class="lrow-end"><b class="red">− ${brl(d.valor)}</b></div>
                  </div>`)}
              </div>`
            : html`<${Empty} icon="wallet" title="Nenhuma despesa em ${MESES[ym.m].toLowerCase()}" text="Lance linha, agulha, energia… para ver seu lucro de verdade.">
                <button class="btn primary" onClick=${() => setEditing('new')}><${Icon} name="plus" /> Lançar despesa</button>
              </${Empty}>`}
        </section>`}

      ${editing && html`<${DespesaForm} item=${editing === 'new' ? null : editing} ym=${ym} onClose=${() => setEditing(null)} />`}
    </div>`;
};

// ---------- Janela "A receber" (aberta pelo aviso da tela inicial) ----------

export const ReceberSheet = ({ onClose, onOpenLote }) => {
  const { lotes } = useStore();
  const receber = useMemo(() => aReceber(lotes).sort((a, b) => (a.dataFim || '').localeCompare(b.dataFim || '')), [lotes]);
  const total = receber.reduce((a, l) => a + loteValue(l), 0);

  const pagarTodos = async () => {
    const yes = await confirmDialog({ title: 'Marcar todos como pagos?', text: `${receber.length} lote(s) — total ${brl(total)}.`, ok: 'Marcar pago', icon: 'money' });
    if (yes) run(() => setPago(receber.map((l) => l.id), true), 'Pagamento registrado');
  };

  const footer = receber.length > 1
    ? html`<button class="btn big primary" onClick=${pagarTodos}><${Icon} name="check" /> Marcar todos como pagos</button>`
    : null;

  return html`<${Sheet} title="A receber" onClose=${onClose} footer=${footer}>
    ${receber.length
      ? html`<div class="lgroup">
          <header class="lgroup-head"><h3>Total pendente <small>${receber.length}</small></h3><span class="fin-pend">${brl(total)}</span></header>
          <div class="lote-list">
            ${receber.map((l) => {
              const dias = daysBetween(l.dataFim, today());
              return html`<div class="lrow fin" key=${l.id} onClick=${() => onOpenLote(l)}>
                <div class="lrow-info">
                  <h4><span class="hash">#</span>${fmtRef(l.ref)}</h4>
                  <span class="lrow-sub">${TIPO_LABEL[l.tipo]} · ${lotePieces(l)} pçs</span>
                  <span class="lrow-when">${dias > 0 ? html`Entregue ${dm(l.dataFim)} · <em class=${dias > 30 ? 'atrasado' : dias > 14 ? 'proximo' : ''}>há ${dias} dia${dias > 1 ? 's' : ''}</em>` : 'Entregue hoje'}</span>
                </div>
                <div class="lrow-end">
                  <b>${brl(loteValue(l))}</b>
                  <button class="tag-btn paid" onClick=${(e) => { e.stopPropagation(); run(() => setPago(l.id, true), 'Pagamento registrado'); }}>
                    <${Icon} name="check" size=${12} stroke=${3} /> Recebi
                  </button>
                </div>
              </div>`;
            })}
          </div>
        </div>`
      : html`<${Empty} icon="money" title="Tudo recebido 🎉" text="Lotes entregues e ainda não pagos aparecem aqui." />`}
  </${Sheet}>`;
};
