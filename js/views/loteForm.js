// Formulário de lote: criar, editar, conferir (finalizar), reabrir, duplicar e excluir.

import { html, useMemo, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { Icon, Sheet, MoneyInput, NumInput, Toggle, confirmDialog, toast, run, tipoIcon } from '../ui.js';
import { brl, today, onlyDigits, resizeImage, dmy, fmtRef } from '../util.js';
import {
  partsForTipo, PART_LABEL, TIPO_LABEL, EXTRA_SIZES, loteValue, lotePieces, loteExtraValue, plannedPieces, plannedValue,
  partValue, partQty, lastPriceForRef,
} from '../calc.js';
import { saveLote, deleteLote, getState } from '../store.js';

const DRAFT_KEY = 'costura_rascunho_lote';

const emptyPart = () => ({ preco: 0, total: null, t6: null, t8: null, real: {} });

/** Estado do formulário a partir de um lote existente (ou modelo para duplicar) */
const fromLote = (l, settings) => {
  const m = /^0?(\d{0,3})([A-Za-z]?)/.exec(l.ref || '') || [];
  const partes = { sup: emptyPart(), inf: emptyPart() };
  partsForTipo(l.tipo).forEach((k) => {
    const p = l.partes[k];
    if (!p) return;
    partes[k] = {
      preco: p.preco || 0,
      total: p.plan?.total || null,
      t6: p.plan?.t6 || null,
      t8: p.plan?.t8 || null,
      real: { ...(p.real || {}) },
    };
  });
  return {
    step: 'form',
    tipo: l.tipo,
    refNum: m[1] || '',
    refChar: (m[2] || '').toUpperCase(),
    cliente: l.cliente || '',
    tamanhos: [...(l.tamanhos || [])],
    cobra: l.cobraAdicional !== false,
    adicional: l.adicional ?? settings.adicionalPadrao,
    partes,
    dataInicio: l.dataInicio || today(),
    dataPrevista: l.dataPrevista || '',
    dataFim: l.dataFim || '',
    obs: l.obs || '',
    foto: l.foto || null,
    pago: !!l.pago,
  };
};

const blank = (settings) => ({
  step: 'tipo',
  tipo: null,
  refNum: '',
  refChar: '',
  cliente: '',
  tamanhos: [],
  cobra: true,
  adicional: settings.adicionalPadrao,
  partes: { sup: emptyPart(), inf: emptyPart() },
  dataInicio: today(),
  dataPrevista: '',
  dataFim: '',
  obs: '',
  foto: null,
  pago: false,
});

/** Monta o objeto lote a partir do formulário */
const buildLote = (f, base, finalizado) => {
  const partes = {};
  partsForTipo(f.tipo).forEach((k) => {
    const p = f.partes[k];
    const has6 = f.tamanhos.includes(6) && f.cobra;
    const has8 = f.tamanhos.includes(8) && f.cobra;
    const real = {};
    f.tamanhos.forEach((s) => {
      if (p.real[s]) real[s] = p.real[s];
    });
    partes[k] = {
      preco: p.preco || 0,
      plan: { total: p.total || 0, t6: has6 ? p.t6 || 0 : 0, t8: has8 ? p.t8 || 0 : 0 },
      real: Object.keys(real).length ? real : null,
    };
  });
  return {
    ...(base || {}),
    ref: '0' + f.refNum + f.refChar,
    tipo: f.tipo,
    tamanhos: [...f.tamanhos].sort((a, b) => a - b),
    partes,
    cobraAdicional: f.cobra,
    adicional: f.adicional,
    status: finalizado ? 'finalizado' : 'em_andamento',
    dataInicio: f.dataInicio || today(),
    dataPrevista: f.dataPrevista || null,
    dataFim: finalizado ? f.dataFim || today() : null,
    obs: f.obs.trim(),
    foto: f.foto,
    pago: finalizado ? f.pago : false,
    dataPagamento: finalizado && f.pago ? base?.dataPagamento || today() : null,
  };
};

/**
 * props:
 *  lote      — lote existente (editar) ou null (novo)
 *  template  — lote para duplicar (opcional)
 *  finish    — abre direto na conferência
 *  onClose, onDuplicate(lote)
 */
export const LoteForm = ({ lote, template, finish, onClose, onDuplicate }) => {
  const { settings, lotes } = getState();
  const isNew = !lote;
  const wasFinal = lote?.status === 'finalizado';

  const [f, setF] = useState(() => {
    if (lote) {
      const s = fromLote(lote, settings);
      if (finish && !wasFinal) s.dataFim = today();
      return s;
    }
    if (template) {
      const s = fromLote(template, settings);
      Object.assign(s, { dataInicio: today(), dataPrevista: '', dataFim: '', pago: false, obs: '' });
      Object.values(s.partes).forEach((p) => (p.real = {}));
      return s;
    }
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.tipo) return { ...blank(settings), ...d, step: 'form' };
    } catch (e) {
      /* rascunho inválido */
    }
    return blank(settings);
  });
  const [conferencia, setConferencia] = useState(wasFinal || !!finish);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [hadDraft, setHadDraft] = useState(() => isNew && !template && !!localStorage.getItem(DRAFT_KEY));
  const [showObs, setShowObs] = useState(!!lote?.obs);
  const charRef = useRef(null);
  const fileRef = useRef(null);

  const up = (patch) => setF((s) => ({ ...s, ...patch }));
  const upPart = (k, patch) => setF((s) => ({ ...s, partes: { ...s.partes, [k]: { ...s.partes[k], ...patch } } }));
  const setReal = (k, size, v) =>
    setF((s) => ({ ...s, partes: { ...s.partes, [k]: { ...s.partes[k], real: { ...s.partes[k].real, [size]: v || 0 } } } }));

  // Rascunho automático (só para lote novo)
  useEffect(() => {
    if (!isNew || template || f.step !== 'form') return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    } catch (e) {
      /* sem espaço: ignora */
    }
  }, [f]);

  const parts = f.tipo ? partsForTipo(f.tipo) : [];
  const ref = '0' + f.refNum + f.refChar;
  const preview = useMemo(() => (f.tipo ? buildLote(f, lote, conferencia) : null), [f, conferencia]);
  const total = preview ? loteValue(preview) : 0;
  const extra = preview ? loteExtraValue(preview) : 0;
  const hasExtraSizes = f.tamanhos.some((s) => EXTRA_SIZES.includes(s));
  const sugestao = useMemo(
    () => (f.refNum.length === 3 && !conferencia ? lastPriceForRef(lotes, ref, lote?.id) : null),
    [f.refNum, f.refChar, conferencia],
  );

  // ---------- Validação ----------
  const errors = [];
  if (f.refNum.length !== 3) errors.push('Informe os 3 números da referência');
  if (!f.tamanhos.length) errors.push('Escolha pelo menos um tamanho');
  parts.forEach((k) => {
    const p = f.partes[k];
    const nome = parts.length > 1 ? ` (${PART_LABEL[k].toLowerCase()})` : '';
    if (!p.preco) errors.push(`Informe o valor por peça${nome}`);
    if (!conferencia) {
      if (!p.total) errors.push(`Informe a quantidade${nome}`);
      if ((p.t6 || 0) + (p.t8 || 0) > (p.total || 0) && f.cobra) errors.push(`Tam. 6 + 8 maior que o total${nome}`);
    }
  });
  if (conferencia && preview && lotePieces(preview) === 0) errors.push('Digite as quantidades entregues');
  if (f.dataPrevista && f.dataPrevista < f.dataInicio) errors.push('O prazo é antes do início');
  if (conferencia && f.dataFim && f.dataFim < f.dataInicio) errors.push('A data de fim é antes do início');

  // ---------- Ações ----------
  const save = async () => {
    if (errors.length) {
      setTried(true);
      return toast(errors[0], 'error');
    }
    setSaving(true);
    const l = buildLote(f, lote, conferencia);
    const ok = await run(() => saveLote(l), conferencia ? (wasFinal ? 'Lote atualizado' : 'Lote finalizado!') : isNew ? 'Lote criado' : 'Lote salvo');
    setSaving(false);
    if (ok) {
      if (isNew) localStorage.removeItem(DRAFT_KEY);
      onClose();
    }
  };

  const remove = async () => {
    const yes = await confirmDialog({ title: 'Excluir lote?', text: `O lote #${lote.ref} será apagado. Isso não pode ser desfeito.`, ok: 'Excluir', danger: true, icon: 'trash' });
    if (!yes) return;
    await run(() => deleteLote(lote.id), 'Lote excluído');
    onClose();
  };

  const reopen = async () => {
    const yes = await confirmDialog({ title: 'Reabrir lote?', text: 'Ele volta para "em andamento". As quantidades conferidas ficam guardadas.', ok: 'Reabrir', icon: 'undo' });
    if (!yes) return;
    const l = { ...buildLote(f, lote, false) };
    await run(() => saveLote(l), 'Lote reaberto');
    onClose();
  };

  const discardDraft = async () => {
    localStorage.removeItem(DRAFT_KEY);
    setF(blank(settings));
    setConferencia(false);
    setHadDraft(false);
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const data = await run(() => resizeImage(file, 900));
    if (data) up({ foto: data });
  };

  const toggleSize = (s) => {
    if (conferencia) return;
    up({ tamanhos: f.tamanhos.includes(s) ? f.tamanhos.filter((x) => x !== s) : [...f.tamanhos, s].sort((a, b) => a - b) });
  };

  const applySugestao = () => {
    const p = { ...f.partes };
    if (sugestao.sup != null && p.sup) p.sup = { ...p.sup, preco: sugestao.sup };
    if (sugestao.inf != null && p.inf) p.inf = { ...p.inf, preco: sugestao.inf };
    // Lote avulso: usa o preço que existir
    if (f.tipo !== 'conjunto') {
      const k = parts[0];
      p[k] = { ...p[k], preco: sugestao[k] ?? sugestao.sup ?? sugestao.inf ?? 0 };
    }
    up({ partes: p });
    toast('Preço aplicado');
  };

  // ---------- Telas ----------

  const title = f.step === 'tipo' ? 'Novo lote' : conferencia ? (wasFinal ? `Lote #${fmtRef(lote.ref)}` : 'Conferência') : isNew ? `Novo · ${TIPO_LABEL[f.tipo]}` : 'Editar lote';

  if (f.step === 'tipo') {
    return html`<${Sheet} title=${title} onClose=${onClose} float>
      <p class="muted center mb">Qual é o tipo do lote?</p>
      <div class="tipo-grid">
        ${['superior', 'inferior', 'conjunto'].map(
          (t) => html`<button class=${'tipo-card ' + t} onClick=${() => up({ tipo: t, step: 'form' })}>
            <span class="tipo-ico"><${Icon} name=${tipoIcon(t)} size=${34} stroke=${1.6} /></span>
            <b>${TIPO_LABEL[t]}</b>
            ${t === 'conjunto' && html`<small>Superior + Inferior</small>`}
          </button>`,
        )}
      </div>
    </${Sheet}>`;
  }

  const back = isNew && !template && !conferencia
    ? html`<button class="icon-btn" onClick=${() => up({ step: 'tipo' })} aria-label="Voltar"><${Icon} name="back" /></button>`
    : null;

  const pecas = preview ? lotePieces(preview) : 0;
  const diffPecas = conferencia ? pecas - plannedPieces(preview) : 0;

  // Rodapé fixo: total sempre visível ao lado do botão salvar
  const footer = html`
    ${tried && errors.length > 0 && html`<p class="form-error"><${Icon} name="alert" size=${14} /> ${errors[0]}</p>`}
    <div class="lf-foot">
      <div class=${'lf-total' + (conferencia ? ' conf' : '')}>
        <small>${conferencia ? 'Valor do lote' : 'Total previsto'}</small>
        <strong>${brl(total)}</strong>
        <span>${pecas} pçs${extra > 0 ? ` · +${brl(extra)} adicional` : ''}</span>
      </div>
      <button class=${'btn lf-save ' + (conferencia ? 'accent' : 'primary')} disabled=${saving} onClick=${save}>
        <${Icon} name="check" />
        ${saving ? 'Salvando…' : conferencia && !wasFinal ? 'Confirmar' : 'Salvar'}
      </button>
    </div>`;

  return html`<${Sheet} title=${title} onClose=${onClose} left=${back} footer=${footer}>
    <div class="form lf">

      ${hadDraft && html`
        <div class="note">
          <span>Rascunho restaurado.</span>
          <button class="link" onClick=${discardDraft}>Começar do zero</button>
        </div>`}

      <!-- Identificação: foto + referência + tamanhos -->
      <section class="lf-card">
        <div class="lf-id">
          <div class="lf-photo-wrap">
            <button type="button" class=${'lf-photo' + (f.foto ? ' has' : '')} onClick=${() => fileRef.current?.click()} aria-label=${f.foto ? 'Trocar foto' : 'Adicionar foto'}>
              ${f.foto ? html`<img src=${f.foto} alt="" />` : html`<${Icon} name="camera" size=${22} /><small>Foto</small>`}
            </button>
            ${f.foto && html`<button class="lf-photo-del" onClick=${() => up({ foto: null })} aria-label="Remover foto"><${Icon} name="x" size=${12} stroke=${3} /></button>`}
          </div>
          ${conferencia
            ? html`<div class="lf-ref-show">
                <b><span class="hash">#</span>${fmtRef(ref)}</b>
                <small>${TIPO_LABEL[f.tipo]}</small>
              </div>`
            : html`<div class="lf-ref">
                <span class="lf-label">Referência</span>
                <div class="ref-input" onClick=${(e) => e.target === e.currentTarget && e.currentTarget.querySelector(f.refNum.length === 3 ? ".ref-char" : ".ref-num").focus()}>
                  <span class="ref-zero">0</span>
                  <input class="input ref-num" type="text" inputmode="numeric" maxlength="3" placeholder="000" value=${f.refNum}
                    autoFocus=${isNew && !f.refNum}
                    onInput=${(e) => {
                      const v = onlyDigits(e.target.value, 3);
                      e.target.value = v;
                      up({ refNum: v });
                      if (v.length === 3) charRef.current?.focus();
                    }} />
                  <input ref=${charRef} class="input ref-char" type="text" maxlength="2" placeholder="A" value=${f.refChar}
                    onInput=${(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
                      e.target.value = v;
                      up({ refChar: v });
                    }} />
                </div>
              </div>`}
          <input ref=${fileRef} type="file" accept="image/*" capture="environment" hidden onChange=${onPhoto} />
        </div>

        ${sugestao && html`
          <button class="suggest" onClick=${applySugestao}>
            <${Icon} name="copy" size=${16} />
            <span>Usar preço anterior: <b>${[sugestao.sup != null && brl(sugestao.sup), sugestao.inf != null && f.tipo === 'conjunto' && brl(sugestao.inf)].filter(Boolean).join(' / ')}</b></span>
          </button>`}

        <div class="lf-sizes">
          <span class="lf-label">Tamanhos</span>
          <div class="sizes">
            ${settings.tamanhos.map(
              (s) => html`<button type="button" class=${'size-btn sm' + (f.tamanhos.includes(s) ? ' on' : '')} disabled=${conferencia} onClick=${() => toggleSize(s)}>${s}</button>`,
            )}
          </div>
        </div>

        ${hasExtraSizes && html`
          <button type="button" class=${'lf-extra' + (f.cobra ? ' on' : '')} onClick=${() => up({ cobra: !f.cobra })} role="switch" aria-checked=${f.cobra}>
            <span>Adicional tam. 6/8 <b>+${brl(f.adicional)}</b>/peça</span>
            <span class="switch"><span class="knob"></span></span>
          </button>`}
      </section>

      <!-- Quantidades e valores -->
      <div class=${'lf-parts' + (parts.length > 1 ? ' two' : '')}>
        ${parts.map((k) => {
          const p = f.partes[k];
          const show6 = f.cobra && f.tamanhos.includes(6);
          const show8 = f.cobra && f.tamanhos.includes(8);
          const over = (p.t6 || 0) + (p.t8 || 0) > (p.total || 0);
          return html`<section class=${'lf-card' + (conferencia ? ' conf' : '')} key=${k}>
            ${parts.length > 1 && html`<div class="lf-part-head"><${Icon} name=${k === 'sup' ? 'shirt' : 'pants'} size=${16} /> ${PART_LABEL[k]}
              <span>${partQty(preview, k)} pçs · <b>${brl(partValue(preview, k))}</b></span></div>`}

            <div class="lf-grid">
              <label class="lf-field">
                <span class="lf-label">Valor/peça</span>
                <${MoneyInput} value=${p.preco} onChange=${(v) => upPart(k, { preco: v })} />
              </label>
              ${!conferencia && html`
                <label class="lf-field">
                  <span class="lf-label">Quantidade</span>
                  <${NumInput} value=${p.total} onChange=${(v) => upPart(k, { total: v })} />
                </label>`}
              ${!conferencia && show6 && html`
                <label class="lf-field">
                  <span class="lf-label">Quantas tam. 6</span>
                  <${NumInput} class=${over ? 'bad' : ''} maxDigits=${3} value=${p.t6} onChange=${(v) => upPart(k, { t6: v })} />
                </label>`}
              ${!conferencia && show8 && html`
                <label class="lf-field">
                  <span class="lf-label">Quantas tam. 8</span>
                  <${NumInput} class=${over ? 'bad' : ''} maxDigits=${3} value=${p.t8} onChange=${(v) => upPart(k, { t8: v })} />
                </label>`}
            </div>

            ${conferencia && html`
              <span class="lf-label">Entregue por tamanho <em>· vazio = ${p.total || 0} planejadas</em></span>
              <div class="real-grid">
                ${f.tamanhos.map(
                  (s) => html`<label class="real-cell" key=${s}>
                    <span>Tam ${s}</span>
                    <${NumInput} maxDigits=${3} value=${p.real[s]} onChange=${(v) => setReal(k, s, v)} />
                  </label>`,
                )}
              </div>`}
          </section>`;
        })}
      </div>

      <!-- Comparação planejado x entregue -->
      ${conferencia && html`
        <div class="lf-compare">
          <span>Planejado: <b>${plannedPieces(preview)} pçs</b> · ${brl(plannedValue(preview))}</span>
          <span class=${'diff ' + (diffPecas >= 0 ? 'pos' : 'neg')}>${diffPecas > 0 ? '+' : ''}${diffPecas} pçs</span>
        </div>`}

      <!-- Datas -->
      <section class="lf-card lf-dates">
        <label class="lf-field">
          <span class="lf-label">Início</span>
          <input class="input" type="date" value=${f.dataInicio} max=${today()} onInput=${(e) => up({ dataInicio: e.target.value || today() })} />
        </label>
        ${conferencia
          ? html`<label class="lf-field">
              <span class="lf-label">Entregue em</span>
              <input class="input" type="date" value=${f.dataFim} onInput=${(e) => up({ dataFim: e.target.value || today() })} />
            </label>`
          : html`<label class="lf-field">
              <span class="lf-label">Prazo</span>
              <input class="input" type="date" value=${f.dataPrevista} min=${f.dataInicio} onInput=${(e) => up({ dataPrevista: e.target.value })} />
            </label>`}
      </section>

      ${conferencia && html`<${Toggle} on=${f.pago} onChange=${(v) => up({ pago: v })} label="Já recebi o pagamento"
          hint=${f.pago ? (lote?.dataPagamento ? 'Pago em ' + dmy(lote.dataPagamento) : 'Marcado como pago') : 'Fica em "A receber" até marcar'} />`}

      <!-- Observação (recolhida até precisar) -->
      ${showObs
        ? html`<textarea class="input lf-obs" rows="2" maxlength="500" placeholder="Observação (ex.: linha especial, defeito no tecido…)" value=${f.obs}
            autoFocus=${!f.obs} onInput=${(e) => up({ obs: e.target.value })}></textarea>`
        : html`<button class="more-toggle" onClick=${() => setShowObs(true)}><${Icon} name="plus" size=${16} /> Adicionar observação</button>`}

      <!-- Ações secundárias -->
      ${!isNew && html`
        <div class="lf-actions">
          ${!conferencia && html`<button class="btn accent-soft wide" onClick=${() => { setConferencia(true); up({ dataFim: today() }); }}><${Icon} name="check" /> Finalizar (conferir entrega)</button>`}
          ${conferencia && !wasFinal && html`<button class="btn ghost wide" onClick=${() => setConferencia(false)}><${Icon} name="back" /> Voltar ao planejamento</button>`}
          ${wasFinal && html`<button class="btn ghost" onClick=${reopen}><${Icon} name="undo" /> Reabrir</button>`}
          <button class="btn ghost" onClick=${() => onDuplicate(lote)}><${Icon} name="copy" /> Duplicar</button>
          <button class="btn danger-soft" onClick=${remove}><${Icon} name="trash" /> Excluir</button>
        </div>`}
    </div>
  </${Sheet}>`;
};
