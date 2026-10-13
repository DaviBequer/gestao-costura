// Gráficos simples em SVG, sem bibliotecas externas.

import { html } from '../vendor/preact-htm.js';
import { brl0 } from './util.js';

const compact = (cents) => {
  const r = cents / 100;
  if (r >= 1000) return `${(r / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return Math.round(r).toString();
};

/**
 * Barras verticais.
 * data: [{ label, a, b? }]  (a = série principal, b = série secundária opcional)
 * format: função para mostrar o valor acima da barra
 */
export const BarChart = ({ data, height = 180, labelA, labelB, goal, format = compact, highlight = -1, unit = 'money' }) => {
  const W = 340;
  const H = height;
  const top = 18, bottom = 22, left = 4, right = 4;
  const hasB = data.some((d) => d.b !== undefined);
  const max = Math.max(1, goal || 0, ...data.map((d) => Math.max(d.a || 0, d.b || 0))) * 1.1;
  const slot = (W - left - right) / data.length;
  const barW = Math.min(28, slot * (hasB ? 0.36 : 0.6));
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const fmt = unit === 'money' ? format : (v) => String(Math.round(v));

  return html`
    <figure class="chart">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${labelA || 'Gráfico'}>
        ${[0.25, 0.5, 0.75, 1].map((f) => html`<line class="grid" x1=${left} x2=${W - right} y1=${y(max * f / 1.1)} y2=${y(max * f / 1.1)} />`)}
        ${goal ? html`<line class="goal" x1=${left} x2=${W - right} y1=${y(goal)} y2=${y(goal)} />` : null}
        ${data.map((d, i) => {
          const cx = left + slot * i + slot / 2;
          const xa = hasB ? cx - barW - 1 : cx - barW / 2;
          const ha = H - bottom - y(d.a || 0);
          const hb = hasB ? H - bottom - y(d.b || 0) : 0;
          return html`<g key=${i} class=${i === highlight ? 'hl' : ''}>
            ${d.a > 0 && html`<rect class="bar a" x=${xa} y=${y(d.a)} width=${barW} height=${ha} rx="4" />`}
            ${hasB && d.b > 0 && html`<rect class="bar b" x=${cx + 1} y=${y(d.b)} width=${barW} height=${hb} rx="4" />`}
            ${!hasB && d.a > 0 && html`<text class="val" x=${cx} y=${y(d.a) - 5} text-anchor="middle">${fmt(d.a)}</text>`}
            <text class="lbl" x=${cx} y=${H - 6} text-anchor="middle">${d.label}</text>
          </g>`;
        })}
      </svg>
      ${(labelA || labelB) &&
      html`<figcaption class="legend">
        ${labelA && html`<span><i class="dot a"></i>${labelA}</span>`}
        ${labelB && html`<span><i class="dot b"></i>${labelB}</span>`}
        ${goal ? html`<span><i class="dash"></i>Meta ${brl0(goal)}</span>` : null}
      </figcaption>`}
    </figure>`;
};

/** Barras horizontais (ex.: dias de cada lote, ranking de referências) */
export const HBarList = ({ items, format = (v) => v, max }) => {
  const m = max || Math.max(1, ...items.map((i) => i.value));
  return html`<ul class="hbars">
    ${items.map(
      (it, i) => html`<li key=${i}>
        <span class="hb-label">${it.label}</span>
        <span class="hb-track"><span class=${'hb-fill ' + (it.tone || '')} style=${`width:${Math.max(3, (it.value / m) * 100)}%`}></span></span>
        <span class="hb-val">${format(it.value)}</span>
      </li>`,
    )}
  </ul>`;
};
