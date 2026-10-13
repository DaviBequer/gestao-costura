// Estado central do app: carrega do IndexedDB, guarda em memória
// e avisa as telas quando algo muda.

import { useEffect, useState } from '../vendor/preact-htm.js';
import * as db from './db.js';
import { STORES } from './db.js';
import { DEFAULT_SETTINGS, normalizeLote, normalizeSettings, readLegacyLocalStorage, markLegacyMigrated, buildBackup, parseBackup } from './migrate.js';
import { uid, today } from './util.js';

const state = {
  ready: false,
  lotes: [],
  despesas: [],
  settings: { ...DEFAULT_SETTINGS },
  persisted: false,
  error: null,
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const getState = () => state;

/** Hook: re-renderiza o componente quando o estado muda */
export const useStore = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return state;
};

const set = (patch) => {
  Object.assign(state, patch);
  emit();
};

// ---------- Inicialização ----------

export const init = async () => {
  try {
    let [lotes, despesas, settings] = await Promise.all([db.getAll(STORES.lotes), db.getAll(STORES.despesas), db.kvGet('settings')]);

    // Primeira vez neste navegador: traz os dados do app antigo, se existirem
    let legacyImported = false;
    if (!lotes.length && !settings) {
      const legacy = readLegacyLocalStorage();
      if (legacy) {
        await db.replaceAll(STORES.lotes, legacy.lotes);
        await db.kvSet('settings', legacy.settings);
        lotes = legacy.lotes;
        settings = legacy.settings;
        legacyImported = true;
        markLegacyMigrated();
      }
    }

    set({
      ready: true,
      lotes: lotes.map(normalizeLote),
      despesas,
      settings: normalizeSettings(settings),
      legacyImported,
    });
    db.requestPersistence().then((persisted) => set({ persisted }));
  } catch (e) {
    console.error(e);
    set({ ready: true, error: 'Não foi possível abrir o banco de dados do navegador. ' + (e?.message || '') });
  }
};

// ---------- Lotes ----------

export const saveLote = async (lote) => {
  const now = new Date().toISOString();
  const l = normalizeLote({ ...lote, id: lote.id || uid(), criadoEm: lote.criadoEm || now, atualizadoEm: now });
  await db.put(STORES.lotes, l);
  const exists = state.lotes.some((x) => x.id === l.id);
  set({ lotes: exists ? state.lotes.map((x) => (x.id === l.id ? l : x)) : [l, ...state.lotes] });
  return l;
};

export const deleteLote = async (id) => {
  await db.del(STORES.lotes, id);
  set({ lotes: state.lotes.filter((l) => l.id !== id) });
};

export const setPago = async (ids, pago) => {
  const list = Array.isArray(ids) ? ids : [ids];
  const updated = [];
  for (const id of list) {
    const l = state.lotes.find((x) => x.id === id);
    if (!l) continue;
    const n = { ...l, pago, dataPagamento: pago ? today() : null, atualizadoEm: new Date().toISOString() };
    await db.put(STORES.lotes, n);
    updated.push(n);
  }
  const map = new Map(updated.map((l) => [l.id, l]));
  set({ lotes: state.lotes.map((l) => map.get(l.id) || l) });
};

// ---------- Despesas ----------

export const saveDespesa = async (d) => {
  const item = { ...d, id: d.id || uid() };
  await db.put(STORES.despesas, item);
  const exists = state.despesas.some((x) => x.id === item.id);
  set({ despesas: exists ? state.despesas.map((x) => (x.id === item.id ? item : x)) : [item, ...state.despesas] });
};

export const deleteDespesa = async (id) => {
  await db.del(STORES.despesas, id);
  set({ despesas: state.despesas.filter((d) => d.id !== id) });
};

// ---------- Configurações ----------

export const updateSettings = async (patch) => {
  const settings = { ...state.settings, ...patch };
  await db.kvSet('settings', settings);
  set({ settings });
};

// ---------- Backup ----------

export const exportBackup = () => buildBackup({ lotes: state.lotes, despesas: state.despesas, settings: state.settings });

/** Restaura um backup. modo 'substituir' apaga tudo antes; 'juntar' mantém o que existe e atualiza pelo id. */
export const restoreBackup = async (raw, modo = 'substituir') => {
  const data = parseBackup(raw);
  let lotes = data.lotes;
  let despesas = data.despesas;
  let settings = data.settings;
  if (modo === 'juntar') {
    const ml = new Map(state.lotes.map((l) => [l.id, l]));
    data.lotes.forEach((l) => ml.set(l.id, l));
    lotes = [...ml.values()];
    const md = new Map(state.despesas.map((d) => [d.id, d]));
    data.despesas.forEach((d) => md.set(d.id, d));
    despesas = [...md.values()];
    settings = { ...state.settings, declaracoes: { ...state.settings.declaracoes, ...settings.declaracoes } };
  }
  await db.replaceAll(STORES.lotes, lotes);
  await db.replaceAll(STORES.despesas, despesas);
  await db.kvSet('settings', settings);
  set({ lotes, despesas, settings });
  return { total: data.lotes.length, fromV1: data.fromV1 };
};

export const clearEverything = async () => {
  await db.clearAll();
  set({ lotes: [], despesas: [], settings: { ...DEFAULT_SETTINGS } });
};
