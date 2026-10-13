// Faturamento anual: produção (lotes entregues) x declaração (valores digitados por mês).

import { html, useState, useMemo, useEffect } from '../../vendor/preact-htm.js';
import { Sheet, MoneyInput, run } from '../ui.js';
import { brl, MESES_CURTOS, MESES } from '../util.js';
import { finishedInMonth, loteValue } from '../calc.js';
import { BarChart } from '../charts.js';
import { useStore, updateSettings } from '../store.js';

const MIN_DECL = 99999; // R$ 999,99 — mesmo limite mínimo do app antigo

export const Annual = ({ onClose }) => {
  const { lotes, despesas, settings } = useStore();
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const s = new Set([thisYear]);
    lotes.forEach((l) => l.dataFim && s.add(Number(l.dataFim.slice(0, 4))));
    Object.keys(settings.declaracoes || {}).forEach((y) => s.add(Number(y)));
    return [...s].sort((a, b) => b - a);
  }, [lotes]);
  const [year, setYear] = useState(thisYear);
  const [decl, setDecl] = useState({});

  useEffect(() => setDecl({ ...(settings.declaracoes?.[year] || {}) }), [year]);

  const prod = MESES_CURTOS.map((_, m) => finishedInMonth(lotes, { y: year, m }).reduce((a, l) => a + loteValue(l), 0));
  const gastos = MESES_CURTOS.map((_, m) => despesas.filter((d) => d.data?.startsWith(`${year}-${String(m + 1).padStart(2, '0')}`)).reduce((a, d) => a + d.valor, 0));
  const totalProd = prod.reduce((a, b) => a + b, 0);
  const totalDecl = Object.values(decl).reduce((a, b) => a + (b || 0), 0);
  const totalGastos = gastos.reduce((a, b) => a + b, 0);
  const mesesAtivos = prod.filter((v, i) => v > 0 || (decl[i] || 0) > 0).length;
  const invalid = (m) => (decl[m] || 0) > 0 && decl[m] < MIN_DECL;

  const setMonth = (m, v) => setDecl((d) => {
    const n = { ...d };
    if (v) n[m] = v;
    else delete n[m];
    return n;
  });

  const save = () => {
    // Salva só os meses válidos; os inválidos ficam destacados
    const clean = {};
    Object.entries(decl).forEach(([m, v]) => {
      if (v >= MIN_DECL) clean[m] = v;
    });
    run(() => updateSettings({ declaracoes: { ...settings.declaracoes, [year]: clean } }));
  };

  return html`<${Sheet} title="Faturamento anual" onClose=${() => { save(); onClose(); }} wide>
    <div class="year-tabs">
      ${years.map((y) => html`<button class=${'chip' + (y === year ? ' on' : '')} onClick=${() => { save(); setYear(y); }}>${y}</button>`)}
    </div>

    <section class="annual-summary">
      <div><small>Produção</small><b>${brl(totalProd)}</b><span>${mesesAtivos} ${mesesAtivos === 1 ? 'mês' : 'meses'}</span></div>
      <div class="light"><small>Declaração</small><b>${brl(totalDecl)}</b><span>Lucro: ${brl(totalProd - totalGastos)}</span></div>
    </section>

    <section class="block">
      <div class="block-head"><h2>Comparativo mensal</h2></div>
      <${BarChart} data=${MESES_CURTOS.map((label, m) => ({ label: label[0], a: prod[m], b: decl[m] || 0 }))} labelA="Produção" labelB="Declaração" highlight=${year === thisYear ? new Date().getMonth() : -1} />
    </section>

    <section class="block">
      <div class="block-head"><h2>Valores declarados</h2><small class="muted">mínimo R$ 999,99</small></div>
      <div class="decl-grid">
        ${MESES.map((nome, m) => html`
          <label class=${'decl' + (invalid(m) ? ' bad' : '')} key=${m}>
            <span>${nome}</span>
            <${MoneyInput} value=${decl[m] || 0} onChange=${(v) => setMonth(m, v)} maxDigits=${8} onBlur=${save} />
            <small>Produção: ${brl(prod[m])}</small>
            ${invalid(m) && html`<em>Mínimo R$ 999,99</em>`}
          </label>`)}
      </div>
    </section>
  </${Sheet}>`;
};
