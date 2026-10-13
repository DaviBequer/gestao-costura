// Ajustes: aparência, regras dos lotes, backup/restauração, verificação de dados.

import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { Icon, Sheet, MoneyInput, Field, Toggle, confirmDialog, toast, run } from '../ui.js';
import { brl, dmy, fmtRef, readFileText, resizeImage, downloadBlob, num } from '../util.js';
import { loteProblems, loteValue, lotePieces, TIPO_LABEL, isFinal } from '../calc.js';
import { useStore, updateSettings, exportBackup, restoreBackup, clearEverything, deleteLote, setPago, getState } from '../store.js';
import { storageEstimate } from '../db.js';

const ALL_SIZES = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16];

// ---------- Verificação de dados (antigo "Diagnóstico") ----------

const DataCheck = ({ onClose, onOpen }) => {
  const { lotes } = useStore();
  const withProblems = lotes.map((l) => ({ l, p: loteProblems(l) })).sort((a, b) => b.p.length - a.p.length);
  const bad = withProblems.filter((x) => x.p.length).length;
  return html`<${Sheet} title="Verificar dados" onClose=${onClose}>
    <p class=${'note ' + (bad ? 'warn' : 'ok')}>${bad ? `${bad} lote(s) com algo a revisar.` : lotes.length === 1 ? 'Tudo certo com o lote.' : `Tudo certo com os ${lotes.length} lotes.`}</p>
    <div class="check-list">
      ${withProblems.map(({ l, p }) => html`
        <div class=${'check-item' + (p.length ? ' bad' : '')} key=${l.id}>
          <button class="line-main" onClick=${() => onOpen(l)}>
            <b>#${fmtRef(l.ref)} <small>${TIPO_LABEL[l.tipo]} · ${isFinal(l) ? 'finalizado' : 'em andamento'}</small></b>
            <small>${num(lotePieces(l))} pçs · ${brl(loteValue(l))}</small>
            ${p.map((t) => html`<em>⚠ ${t}</em>`)}
          </button>
          <button class="icon-btn sm danger" aria-label="Excluir" onClick=${async () => {
            if (await confirmDialog({ title: 'Excluir lote?', text: `#${l.ref} será apagado permanentemente.`, ok: 'Excluir', danger: true, icon: 'trash' }))
              run(() => deleteLote(l.id), 'Lote excluído');
          }}><${Icon} name="trash" size=${16} /></button>
        </div>`)}
    </div>
  </${Sheet}>`;
};

// ---------- Tela ----------

export const Settings = ({ onOpenLote, focus }) => {
  const { settings, lotes, despesas, persisted } = useStore();
  const [checking, setChecking] = useState(false);
  const [usage, setUsage] = useState(null);
  const restoreRef = useRef(null);
  const logoRef = useRef(null);
  const backupRef = useRef(null);
  const [name, setName] = useState(settings.appName);

  useEffect(() => {
    storageEstimate().then(setUsage);
  }, [lotes.length]);
  useEffect(() => {
    if (focus === 'backup') backupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus]);

  const save = (patch, msg) => run(() => updateSettings(patch), msg);

  const doBackup = async () => {
    const data = exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const fileName = `backup_costura_${stamp}.json`;
    // No celular, o compartilhamento permite mandar para o Drive/WhatsApp/e-mail
    let shared = false;
    try {
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Backup Gestão Costura' });
        shared = true;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    if (!shared) downloadBlob(blob, fileName);
    await updateSettings({ ultimoBackup: new Date().toISOString() });
    toast('Backup feito!');
  };

  const onRestore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text;
    try {
      text = await readFileText(file);
    } catch (err) {
      return toast('Não foi possível ler o arquivo', 'error');
    }
    const substituir = await confirmDialog({
      title: 'Como restaurar?',
      text: 'Substituir apaga os dados atuais e coloca os do backup. Juntar mantém os atuais e acrescenta/atualiza com os do backup.',
      ok: 'Substituir tudo',
      cancel: 'Juntar',
      icon: 'upload',
    });
    const res = await run(() => restoreBackup(text, substituir ? 'substituir' : 'juntar'));
    if (!res) return;
    toast(`${res.total} lote(s) restaurado(s)`);
    // Backup do app antigo não tinha "pago": pergunta o que fazer com os finalizados
    const semInfo = getState().lotes.filter((l) => isFinal(l) && l.pago === undefined);
    if (semInfo.length) {
      const todosPagos = await confirmDialog({
        title: 'Lotes antigos já foram pagos?',
        text: `${semInfo.length} lote(s) finalizado(s) vieram do app antigo, que não controlava pagamento. Marcar todos como pagos?`,
        ok: 'Sim, já recebi',
        cancel: 'Não, deixar a receber',
        icon: 'money',
      });
      await setPago(semInfo.map((l) => l.id), todosPagos);
    }
  };

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const data = await run(() => resizeImage(file, 512, 'image/png'));
    if (data) save({ logo: data }, 'Logo atualizada');
  };

  const toggleSize = (s) => {
    const t = settings.tamanhos.includes(s) ? settings.tamanhos.filter((x) => x !== s) : [...settings.tamanhos, s].sort((a, b) => a - b);
    if (!t.length) return toast('Deixe pelo menos um tamanho', 'error');
    save({ tamanhos: t });
  };

  const wipe = async () => {
    const yes = await confirmDialog({ title: 'Apagar TODOS os dados?', text: 'Lotes, despesas e ajustes serão apagados deste aparelho. Faça um backup antes!', ok: 'Apagar tudo', danger: true, icon: 'trash' });
    if (!yes) return;
    const sure = await confirmDialog({ title: 'Tem certeza mesmo?', text: 'Não tem como desfazer.', ok: 'Sim, apagar', danger: true });
    if (sure) run(() => clearEverything(), 'Dados apagados');
  };

  const mb = (b) => (b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return html`
    <div class="page">
      <header class="page-head"><h1>Ajustes</h1></header>

      <section class="block">
        <h2>Aparência</h2>
        <div class="logo-row">
          <button class="logo-pick" onClick=${() => logoRef.current?.click()} aria-label="Trocar logo">
            <img src=${settings.logo || 'icons/icon-192.png'} alt="Logo" />
            <span><${Icon} name="camera" size=${14} /></span>
          </button>
          <div class="grow">
            <${Field} label="Nome do app">
              <input class="input" value=${name} maxlength="40" onInput=${(e) => setName(e.target.value)} onBlur=${() => name.trim() && name !== settings.appName && save({ appName: name.trim() }, 'Nome salvo')} />
            </${Field}>
            ${settings.logo && html`<button class="link" onClick=${() => save({ logo: null }, 'Logo padrão')}>Usar logo padrão</button>`}
          </div>
          <input ref=${logoRef} type="file" accept="image/*" hidden onChange=${onLogo} />
        </div>
        <div class="field">
          <span class="field-label">Tema</span>
          <div class="seg full">
            ${[['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']].map(([id, label]) => html`<button class=${settings.tema === id ? 'on' : ''} onClick=${() => save({ tema: id })}>${label}</button>`)}
          </div>
        </div>
      </section>

      <section class="block">
        <h2>Lotes e metas</h2>
        <div class="field">
          <span class="field-label">Tamanhos que você costura</span>
          <div class="sizes">
            ${ALL_SIZES.map((s) => html`<button class=${'size-btn sm' + (settings.tamanhos.includes(s) ? ' on' : '')} onClick=${() => toggleSize(s)}>${s}</button>`)}
          </div>
        </div>
        <${Field} label="Adicional por peça tam. 6/8" hint="Vale para lotes novos. Lotes antigos guardam o valor que tinham.">
          <${MoneyInput} value=${settings.adicionalPadrao} maxDigits=${4} onChange=${(v) => save({ adicionalPadrao: v })} />
        </${Field}>
        <${Field} label="Meta mensal">
          <${MoneyInput} value=${settings.metaMensal} maxDigits=${9} onChange=${(v) => save({ metaMensal: v })} />
        </${Field}>
        <${Field} label="WhatsApp para enviar resumos" hint="Com DDD. Deixe vazio para escolher o contato na hora.">
          <input class="input" type="tel" inputmode="tel" placeholder="(11) 99999-9999" value=${settings.whatsapp} maxlength="20"
            onBlur=${(e) => e.target.value !== settings.whatsapp && save({ whatsapp: e.target.value.trim() }, 'WhatsApp salvo')} />
        </${Field}>
        <${Toggle} on=${settings.versiculo !== false} onChange=${(v) => save({ versiculo: v })} label="Versículo no relatório" hint="1 Timóteo 1:17 no rodapé do PDF" />
      </section>

      <section class="block" ref=${backupRef}>
        <h2>Backup e segurança</h2>
        <p class="muted small">
          Seus dados ficam só neste aparelho. Faça backup toda semana e guarde o arquivo no Google Drive ou mande para você no WhatsApp.
        </p>
        <div class="backup-status">
          <span><${Icon} name="shield" size=${16} /> ${settings.ultimoBackup ? 'Último backup: ' + dmy(settings.ultimoBackup.slice(0, 10)) : 'Nenhum backup feito ainda'}</span>
          <span><${Icon} name="check" size=${16} /> ${persisted ? 'Armazenamento protegido pelo navegador' : 'Armazenamento comum (instale o app para proteger)'}</span>
          ${usage && html`<span><${Icon} name="layers" size=${16} /> ${lotes.length} lotes · ${despesas.length} despesas · ${mb(usage.usage || 0)} MB usados</span>`}
        </div>
        <div class="row gap wrap">
          <button class="btn primary grow" onClick=${doBackup}><${Icon} name="download" /> Backup</button>
          <button class="btn ghost grow" onClick=${() => restoreRef.current?.click()}><${Icon} name="upload" /> Restaurar</button>
        </div>
        <small class="muted">Aceita backups do app antigo também.</small>
        <input ref=${restoreRef} type="file" accept=".json,application/json" hidden onChange=${onRestore} />
      </section>

      <section class="block">
        <h2>Manutenção</h2>
        <button class="list-btn" onClick=${() => setChecking(true)}><${Icon} name="search" /> Verificar dados dos lotes <${Icon} name="next" size=${16} class="end" /></button>
        <button class="list-btn danger" onClick=${wipe}><${Icon} name="trash" /> Apagar todos os dados <${Icon} name="next" size=${16} class="end" /></button>
      </section>

      <p class="version">Gestão Costura 2.0 · funciona offline</p>

      ${checking && html`<${DataCheck} onClose=${() => setChecking(false)} onOpen=${(l) => { setChecking(false); onOpenLote(l); }} />`}
    </div>`;
};
