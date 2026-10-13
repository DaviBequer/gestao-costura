// Números: produtividade, comparação com o mês anterior, evolução mês a mês e ranking.

import { html, useState, useMemo } from '../../vendor/preact-htm.js';
import { Icon, Empty } from '../ui.js';
import { brl, brl0, num, MESES_CURTOS, shiftMonth, currentMonth, fmtRef, monthLabel } from '../util.js';
import { productivity, finishedInMonth, loteValue, lotePieces, openLotes, loteDuration, isFinal } from '../calc.js';
import { BarChart, HBarList } from '../charts.js';
import { MonthNav } from './finance.js';
import { useStore } from '../store.js';

const delta = (a, b) => {
  if (!b) return null;
  const p = ((a - b) / b) * 100;
  return { p, up: p >= 0, txt: `${p >= 0 ? '+' : ''}${Math.round(p)}%` };
};

const Stat = ({ label, value, sub, d }) => html`
  <div class="stat">
    <small>${label}</small>
    <b>${value}</b>
    ${d ? html`<span class=${'delta ' + (d.up ? 'pos' : 'neg')}>${d.txt} vs mês anterior</span>` : sub && html`<span>${sub}</span>`}
  </div>`;

export const Stats = () => {
  const { lotes, settings } = useStore();
  const [ym, setYm] = useState(currentMonth());
  const [serie, setSerie] = useState('valor');
  const p = productivity(lotes, ym);
  const prev = productivity(lotes, shiftMonth(ym, -1));

  // Últimos 12 meses até o mês escolhido
  const meses = useMemo(() => {
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const m = shiftMonth(ym, -i);
      const fin = finishedInMonth(lotes, m);
      out.push({
        label: MESES_CURTOS[m.m],
        a: serie === 'valor' ? fin.reduce((s, l) => s + loteValue(l), 0) : fin.reduce((s, l) => s + lotePieces(l), 0),
      });
    }
    return out;
  }, [lotes, ym, serie]);

  const ranking = useMemo(() => {
    const map = new Map();
    finishedInMonth(lotes, ym).forEach((l) => {
      const r = map.get(l.ref) || { label: '#' + fmtRef(l.ref), value: 0, pecas: 0 };
      r.value += loteValue(l);
      r.pecas += lotePieces(l);
      map.set(l.ref, r);
    });
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  }, [lotes, ym]);

  // Tempo de cada lote (em andamento + finalizados do mês)
  const tempos = useMemo(() => {
    const list = [...openLotes(lotes), ...finishedInMonth(lotes, ym)];
    return list
      .map((l) => ({ label: '#' + fmtRef(l.ref), value: loteDuration(l), tone: isFinal(l) ? '' : 'open' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [lotes, ym]);

  return html`
    <div class="page">
      <header class="page-head"><h1>Números</h1></header>
      <${MonthNav} ym=${ym} setYm=${setYm} />

      ${!p.lotes && !openLotes(lotes).length
        ? html`<${Empty} icon="chart" title="Sem lotes entregues em ${monthLabel(ym).toLowerCase()}" text="Os números aparecem quando você finaliza lotes." />`
        : html`
          <section class="stats-grid">
            <${Stat} label="Faturado" value=${brl0(p.valor)} d=${delta(p.valor, prev.valor)} />
            <${Stat} label="Peças entregues" value=${num(p.pecas)} d=${delta(p.pecas, prev.pecas)} />
            <${Stat} label="Peças por dia" value=${p.pecasDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} sub="média no mês" />
            <${Stat} label="Ganho por dia" value=${brl0(p.valorDia)} sub="média no mês" />
            <${Stat} label="Valor médio por peça" value=${brl(Math.round(p.valorMedioPeca))} />
            <${Stat} label="Dias por lote" value=${p.mediaDiasLote.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} sub=${`${p.lotes} lote(s) entregue(s)`} />
          </section>`}

      <section class="block">
        <div class="block-head">
          <h2>Mês a mês</h2>
          <div class="seg">
            <button class=${serie === 'valor' ? 'on' : ''} onClick=${() => setSerie('valor')}>R$</button>
            <button class=${serie === 'pecas' ? 'on' : ''} onClick=${() => setSerie('pecas')}>Peças</button>
          </div>
        </div>
        <${BarChart} data=${meses} highlight=${11} unit=${serie === 'valor' ? 'money' : 'n'} goal=${serie === 'valor' ? settings.metaMensal : 0} />
      </section>

      ${ranking.length > 0 && html`
        <section class="block">
          <div class="block-head"><h2>Referências que mais renderam</h2></div>
          <${HBarList} items=${ranking} format=${brl0} />
        </section>`}

      ${tempos.length > 0 && html`
        <section class="block">
          <div class="block-head"><h2>Tempo de cada lote</h2><small class="muted"><i class="dot open"></i> em andamento</small></div>
          <${HBarList} items=${tempos} format=${(v) => `${v} dia${v > 1 ? 's' : ''}`} />
        </section>`}
    </div>`;
};
