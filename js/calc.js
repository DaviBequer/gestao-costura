// Regras de negócio puras (sem tela). Todo valor em dinheiro é em centavos.
//
// Estrutura de um lote:
// {
//   id, ref: '0123A', tipo: 'superior' | 'inferior' | 'conjunto',
//   tamanhos: [2, 3, 4, 6, 8], obs: '',
//   partes: {
//     sup?: { preco, plan: { total, t6, t8 }, real: { [tamanho]: qtd } | null },
//     inf?: { ... mesmo formato ... }
//   },
//   cobraAdicional: true, adicional: 20,       // centavos por peça tam. 6/8
//   status: 'em_andamento' | 'finalizado',
//   dataInicio, dataPrevista, dataFim,         // 'AAAA-MM-DD'
//   pago: false, dataPagamento: null,
//   foto: dataURL | null, criadoEm, atualizadoEm
// }

import { sameMonth, daysBetween, today, parseDate, daysInMonth } from './util.js';

export const EXTRA_SIZES = [6, 8];
export const PART_LABEL = { sup: 'Superior', inf: 'Inferior' };
export const TIPO_LABEL = { superior: 'Superior', inferior: 'Inferior', conjunto: 'Conjunto' };

/** Quais partes um tipo de lote tem */
export const partsForTipo = (tipo) => (tipo === 'conjunto' ? ['sup', 'inf'] : tipo === 'superior' ? ['sup'] : ['inf']);
export const partsOf = (lote) => partsForTipo(lote.tipo).filter((k) => lote.partes && lote.partes[k]);

const sumObj = (o) => Object.values(o || {}).reduce((a, v) => a + (Number(v) || 0), 0);
const extraFromReal = (r) => EXTRA_SIZES.reduce((a, s) => a + (Number(r?.[s]) || 0), 0);

export const isFinal = (l) => l.status === 'finalizado';
const useReal = (l, p) => isFinal(l) && p.real && Object.keys(p.real).length > 0;

/** Peças de uma parte (realizado se finalizado, senão planejado) */
export const partQty = (l, k) => {
  const p = l.partes[k];
  if (!p) return 0;
  return useReal(l, p) ? sumObj(p.real) : p.plan?.total || 0;
};

/** Peças tamanho 6/8 de uma parte */
export const partExtraQty = (l, k) => {
  const p = l.partes[k];
  if (!p) return 0;
  if (useReal(l, p)) return extraFromReal(p.real);
  return (p.plan?.t6 || 0) + (p.plan?.t8 || 0);
};

export const partRegularValue = (l, k) => partQty(l, k) * (l.partes[k]?.preco || 0);
export const partExtraValue = (l, k) => (l.cobraAdicional ? partExtraQty(l, k) * (l.adicional || 0) : 0);
export const partValue = (l, k) => partRegularValue(l, k) + partExtraValue(l, k);

export const lotePieces = (l) => partsOf(l).reduce((a, k) => a + partQty(l, k), 0);
export const loteExtraPieces = (l) => (l.cobraAdicional ? partsOf(l).reduce((a, k) => a + partExtraQty(l, k), 0) : 0);
export const loteRegularValue = (l) => partsOf(l).reduce((a, k) => a + partRegularValue(l, k), 0);
export const loteExtraValue = (l) => partsOf(l).reduce((a, k) => a + partExtraValue(l, k), 0);
export const loteValue = (l) => loteRegularValue(l) + loteExtraValue(l);

/** Valor e peças planejados (para comparar na conferência) */
export const plannedPieces = (l) => partsOf(l).reduce((a, k) => a + (l.partes[k].plan?.total || 0), 0);
export const plannedValue = (l) =>
  partsOf(l).reduce((a, k) => {
    const p = l.partes[k];
    const extra = l.cobraAdicional ? ((p.plan?.t6 || 0) + (p.plan?.t8 || 0)) * (l.adicional || 0) : 0;
    return a + (p.plan?.total || 0) * (p.preco || 0) + extra;
  }, 0);

/** Data usada para colocar o lote em um mês: fim se finalizado, senão início */
export const loteDate = (l) => (isFinal(l) ? l.dataFim || l.dataInicio : l.dataInicio);

// ---------- Filtros ----------

export const FILTERS = [
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: 'todos', label: 'Todos' },
];

/** Mês alvo de um filtro de mês */
export const filterMonth = (filter, now = new Date()) => {
  if (filter === 'mes_passado') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }
  return { y: now.getFullYear(), m: now.getMonth() };
};

export const sortLotes = (lotes) =>
  [...lotes].sort((a, b) => {
    // Em andamento primeiro (os que vencem antes no topo), depois finalizados mais recentes
    if (isFinal(a) !== isFinal(b)) return isFinal(a) ? 1 : -1;
    if (!isFinal(a)) {
      const pa = a.dataPrevista || '9999', pb = b.dataPrevista || '9999';
      if (pa !== pb) return pa < pb ? -1 : 1;
      return (b.dataInicio || '').localeCompare(a.dataInicio || '');
    }
    return (b.dataFim || '').localeCompare(a.dataFim || '');
  });

export const applyFilter = (lotes, filter, now = new Date()) => {
  if (filter === 'todos') return sortLotes(lotes);
  if (filter === 'em_andamento') return sortLotes(lotes.filter((l) => !isFinal(l)));
  // "Este mês" = finalizados no mês + tudo que está em produção agora.
  // "Mês passado" = só o que foi finalizado no mês passado.
  const { y, m } = filterMonth(filter, now);
  return sortLotes(lotes.filter((l) => (isFinal(l) ? sameMonth(l.dataFim, y, m) : filter === 'este_mes')));
};

// ---------- Resumos por mês ----------

export const finishedInMonth = (lotes, { y, m }) => lotes.filter((l) => isFinal(l) && sameMonth(l.dataFim, y, m));
export const openLotes = (lotes) => lotes.filter((l) => !isFinal(l));

export const monthSummary = (lotes, despesas, ym) => {
  const fin = finishedInMonth(lotes, ym);
  const faturado = fin.reduce((a, l) => a + loteValue(l), 0);
  const pecas = fin.reduce((a, l) => a + lotePieces(l), 0);
  const gastos = despesas.filter((d) => sameMonth(d.data, ym.y, ym.m)).reduce((a, d) => a + (d.valor || 0), 0);
  return { lotes: fin, faturado, pecas, gastos, lucro: faturado - gastos };
};

/** Semanas S1..S5 de um mês (dias 1-7, 8-14, 15-21, 22-28, 29+) */
export const weeksOfMonth = (lotes, { y, m }) => {
  const weeks = [0, 0, 0, 0, 0].map((_, i) => ({ label: `S${i + 1}`, value: 0, pecas: 0 }));
  finishedInMonth(lotes, { y, m }).forEach((l) => {
    const day = Number(l.dataFim.slice(8, 10));
    const i = Math.min(4, Math.floor((day - 1) / 7));
    weeks[i].value += loteValue(l);
    weeks[i].pecas += lotePieces(l);
  });
  return weeks;
};

export const currentWeekIndex = (now = new Date()) => Math.min(4, Math.floor((now.getDate() - 1) / 7));

// ---------- Prazos ----------

/** Situação do prazo de entrega de um lote em andamento */
export const prazoInfo = (l, hoje = today()) => {
  if (isFinal(l) || !l.dataPrevista) return null;
  const dias = daysBetween(hoje, l.dataPrevista);
  if (dias < 0) return { tipo: 'atrasado', dias: -dias, texto: `Atrasado ${-dias} dia${-dias > 1 ? 's' : ''}` };
  if (dias === 0) return { tipo: 'hoje', dias: 0, texto: 'Entrega hoje' };
  if (dias <= 2) return { tipo: 'proximo', dias, texto: dias === 1 ? 'Entrega amanhã' : `Entrega em ${dias} dias` };
  return { tipo: 'ok', dias, texto: `Entrega em ${dias} dias` };
};

// ---------- Pagamentos ----------

export const aReceber = (lotes) => lotes.filter((l) => isFinal(l) && !l.pago);
export const totalAReceber = (lotes) => aReceber(lotes).reduce((a, l) => a + loteValue(l), 0);

// ---------- Produtividade ----------

export const loteDuration = (l) => {
  const fim = isFinal(l) ? l.dataFim : today();
  return Math.max(1, daysBetween(l.dataInicio, fim) + 1);
};

export const productivity = (lotes, { y, m }, now = new Date()) => {
  const fin = finishedInMonth(lotes, { y, m });
  const pecas = fin.reduce((a, l) => a + lotePieces(l), 0);
  const valor = fin.reduce((a, l) => a + loteValue(l), 0);
  const isCurrent = now.getFullYear() === y && now.getMonth() === m;
  const diasCorridos = isCurrent ? now.getDate() : daysInMonth({ y, m });
  const diasComEntrega = new Set(fin.map((l) => l.dataFim)).size;
  const duracoes = fin.map(loteDuration);
  return {
    lotes: fin.length,
    pecas,
    valor,
    pecasDia: diasCorridos ? pecas / diasCorridos : 0,
    valorDia: diasCorridos ? valor / diasCorridos : 0,
    mediaPecasLote: fin.length ? pecas / fin.length : 0,
    mediaDiasLote: duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : 0,
    valorMedioPeca: pecas ? valor / pecas : 0,
    diasComEntrega,
  };
};

/** Último preço usado para uma referência (sugestão no formulário) */
export const lastPriceForRef = (lotes, ref, excludeId) => {
  if (!ref) return null;
  const same = lotes
    .filter((l) => l.ref === ref && l.id !== excludeId)
    .sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
  if (!same.length) return null;
  const l = same[0];
  return { tipo: l.tipo, sup: l.partes.sup?.preco ?? null, inf: l.partes.inf?.preco ?? null };
};

/** Problemas encontrados num lote (tela de verificação) */
export const loteProblems = (l) => {
  const p = [];
  if (!l.ref || l.ref.length < 4) p.push('Referência incompleta');
  if (!l.tamanhos?.length) p.push('Sem tamanhos');
  partsOf(l).forEach((k) => {
    if (!l.partes[k].preco) p.push(`Sem preço (${k === 'sup' ? 'superior' : 'inferior'})`);
    if (!partQty(l, k)) p.push(`Sem quantidade (${k === 'sup' ? 'superior' : 'inferior'})`);
  });
  if (isFinal(l) && !l.dataFim) p.push('Finalizado sem data de fim');
  if (l.dataFim && l.dataInicio && parseDate(l.dataFim) < parseDate(l.dataInicio)) p.push('Fim antes do início');
  return p;
};
