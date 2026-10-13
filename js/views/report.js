// Relatório A4 (visualização + PDF para compartilhar no WhatsApp ou salvar).

import { html, useState, useMemo, useEffect, useRef } from '../../vendor/preact-htm.js';
import { Icon, Sheet, Empty, toast } from '../ui.js';
import { brl, num, dm, dmy, today, MESES, currentMonth, shiftMonth, monthLabel, sameMonth, shareOrDownload } from '../util.js';
import { isFinal, loteValue, loteExtraValue, loteRegularValue, lotePieces, loteExtraPieces, partQty, partsOf, TIPO_LABEL } from '../calc.js';
import { useStore } from '../store.js';

const A4_W = 794;
const A4_H = 1123;

let html2pdfPromise = null;
const loadHtml2pdf = () => {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (!html2pdfPromise) {
    html2pdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/html2pdf.bundle.min.js';
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => {
        html2pdfPromise = null;
        reject(new Error('Não foi possível carregar o gerador de PDF'));
      };
      document.head.appendChild(s);
    });
  }
  return html2pdfPromise;
};

const Qty = ({ lote }) => {
  const parts = partsOf(lote);
  if (parts.length === 1) return html`<span>${partQty(lote, parts[0])}</span>`;
  return html`<span class="r-split"><span>Sup ${partQty(lote, 'sup')}</span><span>Inf ${partQty(lote, 'inf')}</span></span>`;
};

const Price = ({ lote }) => {
  const parts = partsOf(lote);
  if (parts.length === 1) return html`<span>${brl(lote.partes[parts[0]].preco)}</span>`;
  return html`<span class="r-split"><span>Sup ${brl(lote.partes.sup.preco)}</span><span>Inf ${brl(lote.partes.inf.preco)}</span></span>`;
};

export const Report = ({ initial, onClose }) => {
  const { lotes, settings } = useStore();
  const [periodo, setPeriodo] = useState(initial || currentMonth()); // {y,m} ou 'todos'
  const [busy, setBusy] = useState(false);
  const [vw, setVw] = useState(window.innerWidth);
  const paperRef = useRef(null);
  const [paperH, setPaperH] = useState(A4_H);

  useEffect(() => {
    const fn = () => setVw(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const rows = useMemo(
    () =>
      lotes
        .filter((l) => isFinal(l))
        .filter((l) => periodo === 'todos' || sameMonth(l.dataFim, periodo.y, periodo.m))
        .sort((a, b) => (a.dataFim || '').localeCompare(b.dataFim || '')),
    [lotes, periodo],
  );

  const total = rows.reduce((a, l) => a + loteValue(l), 0);
  const extra = rows.reduce((a, l) => a + loteExtraValue(l), 0);
  const pecas = rows.reduce((a, l) => a + lotePieces(l), 0);
  const pecasExtra = rows.reduce((a, l) => a + loteExtraPieces(l), 0);
  const anyExtra = rows.some((l) => l.cobraAdicional && loteExtraPieces(l) > 0);
  const pendente = rows.filter((l) => !l.pago).reduce((a, l) => a + loteValue(l), 0);
  const periodLabel = periodo === 'todos' ? 'Todo o período' : monthLabel(periodo);
  const scale = Math.min(1, (vw - 32) / A4_W);

  const gerar = async () => {
    if (!rows.length) return;
    setBusy(true);
    try {
      const h2p = await loadHtml2pdf();
      const el = paperRef.current;
      const name = `Relatorio_${periodLabel.replace(/\s+/g, '_')}.pdf`;
      const worker = h2p()
        .set({
          margin: 0,
          filename: name,
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: A4_W, scrollY: 0, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'px', format: [A4_W, A4_H], orientation: 'portrait', hotfixes: ['px_scaling'] },
          pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
        })
        .from(el);
      const blob = await worker.output('blob');
      const r = await shareOrDownload(blob, name, 'Relatório de produção', `Relatório de ${periodLabel}`);
      if (r === 'downloaded') toast('PDF salvo nos downloads');
    } catch (e) {
      console.error(e);
      toast(e.message || 'Erro ao gerar PDF', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Ajusta a altura da área de visualização ao tamanho real do papel (muitas linhas = mais páginas)
  useEffect(() => {
    if (paperRef.current) setPaperH(Math.max(A4_H, paperRef.current.offsetHeight));
  });

  const isMonth = periodo !== 'todos';
  const footer = html`<button class="btn big primary" disabled=${busy || !rows.length} onClick=${gerar}>
    <${Icon} name="share" /> ${busy ? 'Gerando PDF…' : 'Gerar e compartilhar PDF'}
  </button>`;

  return html`<${Sheet} title="Relatório" onClose=${onClose} footer=${footer} wide>
    <div class="report-controls">
      <div class="month-nav compact">
        <button class="icon-btn" disabled=${!isMonth} onClick=${() => setPeriodo(shiftMonth(periodo, -1))} aria-label="Mês anterior"><${Icon} name="back" /></button>
        <b>${periodLabel}</b>
        <button class="icon-btn" disabled=${!isMonth} onClick=${() => setPeriodo(shiftMonth(periodo, 1))} aria-label="Próximo mês"><${Icon} name="next" /></button>
      </div>
      <div class="row gap-s wrap">
        <button class=${'chip' + (!isMonth ? ' on' : '')} onClick=${() => setPeriodo(isMonth ? 'todos' : currentMonth())}>Todo o período</button>
      </div>
    </div>

    ${!rows.length
      ? html`<${Empty} icon="doc" title="Nenhum lote entregue neste período" text="O relatório mostra só lotes finalizados." />`
      : html`
      <div class="paper-stage" style=${`height:${Math.ceil(paperH * scale)}px`}>
        <div class="paper-scale" style=${`transform:scale(${scale});width:${A4_W}px`}>
          <div class="report" ref=${paperRef} style=${`width:${A4_W}px;min-height:${A4_H}px`}>
            <header class="r-head">
              <div>
                <h1>${settings.appName || 'Produção'}</h1>
                <p><span class="r-tag">Relatório de produção</span> ${periodLabel}</p>
              </div>
              <div class="r-meta"><small>Emitido em</small><b>${dmy(today())}</b></div>
            </header>

            <section class="r-kpis">
              <div class="r-kpi dark">
                <small>Faturamento total</small>
                <strong>${brl(total)}</strong>
                <div class="r-break">
                  <span>Geral <b>${brl(total - extra)}</b></span>
                  ${anyExtra && html`<span>Tam. 6/8 <b>${brl(extra)}</b></span>`}
                </div>
              </div>
              <div class="r-kpi">
                <small>Produção total</small>
                <strong>${num(pecas)} <em>peças</em></strong>
                <div class="r-break">
                  <span>Lotes <b>${rows.length}</b></span>
                  ${anyExtra && html`<span>Tam. 6/8 <b>${num(pecasExtra)}</b></span>`}
                </div>
              </div>
            </section>

            <table class="r-table">
              <thead>
                <tr>
                  <th>Referência</th><th>Entrega</th><th>Grade</th><th>Valor un.</th><th>Qtd.</th><th class="num">Geral</th>
                  ${anyExtra && html`<th class="num">Tam. 6/8</th>`}
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((l) => html`<tr key=${l.id}>
                  <td><b>${l.ref}</b><small>${TIPO_LABEL[l.tipo]}</small></td>
                  <td>${dm(l.dataFim)}</td>
                  <td><span class="r-sizes">${l.tamanhos.map((s) => html`<i>${s}</i>`)}</span></td>
                  <td><${Price} lote=${l} /></td>
                  <td><${Qty} lote=${l} /></td>
                  <td class="num">${brl(loteRegularValue(l))}</td>
                  ${anyExtra && html`<td class="num">${loteExtraValue(l) ? brl(loteExtraValue(l)) : '—'}</td>`}
                  <td class="num"><b>${brl(loteValue(l))}</b></td>
                </tr>`)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan=${anyExtra ? 5 : 5}><b>Total</b></td>
                  <td class="num">${brl(total - extra)}</td>
                  ${anyExtra && html`<td class="num">${brl(extra)}</td>`}
                  <td class="num"><b>${brl(total)}</b></td>
                </tr>
              </tfoot>
            </table>

            ${pendente > 0 && pendente < total && html`<p class="r-note">Valor ainda não recebido neste período: <b>${brl(pendente)}</b></p>`}

            ${settings.versiculo !== false && html`
              <footer class="r-foot">
                <p>“Ao Rei eterno, o Deus único, imortal e invisível, sejam honra e glória para todo o sempre. Amém.”</p>
                <cite>1 Timóteo 1:17</cite>
              </footer>`}
          </div>
        </div>
      </div>`}
  </${Sheet}>`;
};
