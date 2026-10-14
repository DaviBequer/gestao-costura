// Conversão de dados do app antigo (Angular / AI Studio) para o formato novo,
// e geração/leitura dos arquivos de backup.

import { toCents, isoToLocalDate, today, uid } from './util.js';
import { partsForTipo, EXTRA_SIZES } from './calc.js';

export const BACKUP_APP = 'Gestão Costura';
export const BACKUP_VERSION = '2.0.0';

export const DEFAULT_SETTINGS = {
  appName: 'Gestão Costura',
  logo: null, // null = usa o ícone padrão do app
  metaMensal: 300000, // R$ 3.000,00
  adicionalPadrao: 20, // R$ 0,20 por peça tam. 6/8
  tamanhos: [2, 3, 4, 6, 8],
  whatsapp: '',
  tema: 'auto',
  declaracoes: {}, // { '2026': { 0: centavos, 1: ... } }
  ultimoBackup: null,
  versiculo: true,
  versiculoTexto: 'Ao Rei eterno, o Deus único, imortal e invisível, sejam honra e glória para todo o sempre. Amém.',
  versiculoRef: '1 Timóteo 1:17',
};

const numMap = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    const n = Number(v) || 0;
    if (n > 0) out[Number(k)] = n;
  });
  return Object.keys(out).length ? out : null;
};

/** Detecta se um lote está no formato antigo */
export const isV1Lote = (l) => l && typeof l === 'object' && 'referencia' in l;

/** Converte um lote do app antigo. Recupera preços que o bug antigo zerava em lotes "Inferior". */
export const fromV1Lote = (o) => {
  const tipo = ['superior', 'inferior', 'conjunto'].includes(o.tipo) ? o.tipo : 'superior';
  const finalizado = o.status === 'finalizado';
  const cobra = o.cobraAdicionalTam6 !== false;
  const adicional = 20;
  const partes = {};

  const t6S = o.qtdTamanho6Superior ?? (tipo !== 'inferior' ? o.qtdTamanho6 || 0 : 0);
  const t6I = o.qtdTamanho6Inferior ?? (tipo !== 'superior' ? (tipo === 'conjunto' ? 0 : o.qtdTamanho6 || 0) : 0);
  const t8S = o.qtdTamanho8Superior ?? (tipo !== 'inferior' ? o.qtdTamanho8 || 0 : 0);
  const t8I = o.qtdTamanho8Inferior ?? (tipo !== 'superior' ? (tipo === 'conjunto' ? 0 : o.qtdTamanho8 || 0) : 0);

  const currentSup = (o.qtdSuperior || 0) + (t6S || 0) + (t8S || 0);
  const currentInf = (o.qtdInferior || 0) + (t6I || 0) + (t8I || 0);

  partsForTipo(tipo).forEach((k) => {
    // Preço: tenta o campo específico, depois o outro, depois valorPeca
    let precoReais =
      k === 'sup'
        ? o.valorUnitarioSuperior || (tipo !== 'conjunto' ? o.valorUnitarioInferior : 0) || o.valorPeca || 0
        : o.valorUnitarioInferior || (tipo !== 'conjunto' ? o.valorUnitarioSuperior : 0) || o.valorPeca || 0;

    let real = null;
    if (finalizado) {
      if (tipo === 'conjunto') real = numMap(k === 'sup' ? o.realizedQuantitiesSup : o.realizedQuantitiesInf) || numMap(o.realizedQuantities);
      else real = numMap(o.realizedQuantities);
    }

    // Planejado: lote aberto usa as quantidades atuais; finalizado usa o "snapshot" salvo
    let planTotal = k === 'sup' ? currentSup : currentInf;
    let t6 = k === 'sup' ? t6S : t6I;
    let t8 = k === 'sup' ? t8S : t8I;
    // Finalizado com conferência por tamanho: o planejado vem do "snapshot" salvo.
    // Finalizado sem conferência (dados bem antigos): as quantidades atuais valem como planejado,
    // e como `real` fica vazio, os cálculos usam o planejado.
    if (finalizado && real && o.plannedQtdSuperior !== undefined) {
      if (tipo === 'conjunto') {
        const inf = o.plannedQtdInferior || 0;
        planTotal = k === 'inf' ? inf : Math.max(0, (o.plannedQtdSuperior || 0) - inf);
      } else {
        planTotal = o.plannedQtdSuperior || 0;
      }
      t6 = 0;
      t8 = 0;
    }

    partes[k] = { preco: toCents(precoReais), plan: { total: planTotal || 0, t6: t6 || 0, t8: t8 || 0 }, real };
  });

  // Recupera preço zerado (bug antigo) a partir do valor total salvo
  const zeradas = Object.keys(partes).filter((k) => !partes[k].preco);
  if (zeradas.length === 1 && o.valorTotal > 0) {
    const k = zeradas[0];
    const totalCents = toCents(o.valorTotal);
    const outros = Object.keys(partes)
      .filter((x) => x !== k)
      .reduce((a, x) => a + qtyOf(partes[x], finalizado) * partes[x].preco + (cobra ? extraOf(partes[x], finalizado) * adicional : 0), 0);
    const qty = qtyOf(partes[k], finalizado);
    const extra = cobra ? extraOf(partes[k], finalizado) * adicional : 0;
    if (qty > 0) partes[k].preco = Math.max(0, Math.round((totalCents - outros - extra) / qty));
  }

  const dataInicio = isoToLocalDate(o.dataInicio) || today();
  return {
    id: o.id || uid(),
    ref: String(o.referencia || ''),
    tipo,
    tamanhos: Array.isArray(o.tamanhos) ? o.tamanhos.map(Number) : [],
    cliente: '',
    obs: '',
    partes,
    cobraAdicional: cobra,
    adicional,
    status: finalizado ? 'finalizado' : 'em_andamento',
    dataInicio,
    dataPrevista: null,
    dataFim: finalizado ? isoToLocalDate(o.dataFim) || dataInicio : null,
    pago: undefined, // decidido pelo usuário após a importação
    dataPagamento: null,
    foto: typeof o.foto === 'string' ? o.foto : null,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  };
};

const qtyOf = (p, fin) => (fin && p.real ? Object.values(p.real).reduce((a, b) => a + b, 0) : p.plan.total);
const extraOf = (p, fin) => (fin && p.real ? EXTRA_SIZES.reduce((a, s) => a + (p.real[s] || 0), 0) : p.plan.t6 + p.plan.t8);

export const fromV1Settings = (s = {}) => {
  const declaracoes = {};
  Object.entries(s.manualRevenue || {}).forEach(([year, months]) => {
    declaracoes[year] = {};
    Object.entries(months || {}).forEach(([m, v]) => {
      if (Number(v) > 0) declaracoes[year][Number(m)] = toCents(v);
    });
  });
  const logo = typeof s.logo === 'string' && s.logo.startsWith('data:') ? s.logo : null;
  return {
    ...DEFAULT_SETTINGS,
    appName: s.appName || DEFAULT_SETTINGS.appName,
    logo,
    metaMensal: s.monthlyGoal ? toCents(s.monthlyGoal) : DEFAULT_SETTINGS.metaMensal,
    whatsapp: s.whatsappNumber || '',
    declaracoes,
  };
};

/** Normaliza um lote v2 (garante campos que podem faltar) */
export const normalizeLote = (l) => ({
  cliente: '',
  obs: '',
  dataPrevista: null,
  dataFim: null,
  pago: false,
  dataPagamento: null,
  foto: null,
  cobraAdicional: true,
  adicional: 20,
  ...l,
  tamanhos: Array.isArray(l.tamanhos) ? l.tamanhos : [],
});

export const normalizeSettings = (s) => ({ ...DEFAULT_SETTINGS, ...(s || {}) });

/** Monta o objeto de backup */
export const buildBackup = ({ lotes, despesas, settings }) => ({
  app: BACKUP_APP,
  version: BACKUP_VERSION,
  timestamp: new Date().toISOString(),
  data: { lotes, despesas, settings },
});

/**
 * Lê um backup (formato antigo ou novo) e devolve os dados no formato novo.
 * Lança Error com mensagem amigável se o arquivo não for válido.
 */
export const parseBackup = (raw) => {
  let json;
  try {
    json = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    throw new Error('O arquivo não é um backup válido (JSON corrompido).');
  }
  if (!json || typeof json !== 'object' || !json.data) throw new Error('Estrutura do arquivo de backup não reconhecida.');
  const { lotes, despesas, settings } = json.data;
  if (!Array.isArray(lotes)) throw new Error('O backup não contém uma lista de lotes válida.');

  const isV1 = String(json.version || '').startsWith('1') || lotes.some(isV1Lote);
  if (isV1) {
    return {
      lotes: lotes.map((l) => (isV1Lote(l) ? fromV1Lote(l) : normalizeLote(l))),
      despesas: [],
      settings: fromV1Settings(settings),
      fromV1: true,
    };
  }
  return {
    lotes: lotes.map(normalizeLote),
    despesas: Array.isArray(despesas) ? despesas : [],
    settings: normalizeSettings(settings),
    fromV1: false,
  };
};

/** Dados do app antigo, se ele rodou neste mesmo endereço (mesmo navegador) */
export const readLegacyLocalStorage = () => {
  try {
    const rawLotes = localStorage.getItem('atelie_lotes_data');
    if (!rawLotes) return null;
    const lotes = JSON.parse(rawLotes);
    const settings = JSON.parse(localStorage.getItem('atelie_settings') || '{}');
    if (!Array.isArray(lotes) || !lotes.length) return null;
    return { lotes: lotes.map(fromV1Lote), despesas: [], settings: fromV1Settings(settings), fromV1: true };
  } catch (e) {
    return null;
  }
};

/** Depois de migrar, guarda os dados antigos com outro nome para não importar de novo */
export const markLegacyMigrated = () => {
  try {
    ['atelie_lotes_data', 'atelie_settings', 'lote_form_draft'].forEach((k) => {
      const v = localStorage.getItem(k);
      if (v !== null) {
        localStorage.setItem(k + '__migrado', v);
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    /* ignora */
  }
};
