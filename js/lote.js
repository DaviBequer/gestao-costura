// Lote: o único lugar que cria e altera um lote e que sabe o que é um lote válido.
// Funções puras: recebem dados e devolvem um lote novo; quem grava é o store.
// A data de hoje sempre vem de quem chama. Datas 'AAAA-MM-DD'; dinheiro em centavos.
//
// Estrutura de um lote:
// {
//   id, ref: '0123A', tipo: 'superior' | 'inferior' | 'conjunto', cliente: '',
//   tamanhos: [2, 3, 4, 6, 8], obs: '',
//   partes: {
//     sup?: { preco, plan: { total, t6, t8 }, real: { [tamanho]: qtd } | null },
//     inf?: { ... mesmo formato ... }
//   },
//   cobraAdicional: true, adicional: 20,       // centavos por peça tam. 6/8
//   status: 'em_andamento' | 'finalizado',
//   dataInicio, dataPrevista, dataFim,         // dataPrevista: só guardada, o app não usa mais
//   pago: false, dataPagamento: null,
//   pagamentoAConfirmar?: true,                // veio do app antigo e ninguém disse se já foi pago
//   foto: dataURL | null, criadoEm, atualizadoEm
// }
//
// "Dados" (o que montar recebe, vindo do formulário ou do app antigo):
// { ref, tipo, tamanhos, partes: { sup?: { preco, total, t6, t8, real } }, cobraAdicional, adicional,
//   dataInicio, obs, foto, cliente }

import { partsForTipo, PART_LABEL, isFinal, lotePieces } from './calc.js';

const REF = /^0\d{3}[A-Za-z]?$/;
const ADICIONAL_ANTIGO = 20; // lotes guardados antes de existir o campo "adicional"

const PADRAO = {
  cliente: '',
  obs: '',
  dataPrevista: null,
  dataFim: null,
  pago: false,
  dataPagamento: null,
  foto: null,
  cobraAdicional: true,
  adicional: ADICIONAL_ANTIGO,
};

const semAConfirmar = ({ pagamentoAConfirmar, ...l }) => l;

/** Lote a partir dos dados. Lote novo nasce em andamento; editando, mantém situação e pagamento da base. */
export const montar = (dados, base = null) => {
  const tamanhos = [...new Set((dados.tamanhos || []).map(Number))].sort((a, b) => a - b);
  const cobra = dados.cobraAdicional !== false;
  const partes = {};
  partsForTipo(dados.tipo).forEach((k) => {
    const p = dados.partes?.[k] || {};
    const real = {};
    tamanhos.forEach((s) => {
      if (p.real?.[s]) real[s] = p.real[s];
    });
    partes[k] = {
      preco: p.preco || 0,
      plan: {
        total: p.total || 0,
        t6: cobra && tamanhos.includes(6) ? p.t6 || 0 : 0,
        t8: cobra && tamanhos.includes(8) ? p.t8 || 0 : 0,
      },
      real: Object.keys(real).length ? real : null,
    };
  });
  return {
    ...(base || {}),
    ref: dados.ref,
    tipo: dados.tipo,
    cliente: dados.cliente || '',
    tamanhos,
    partes,
    cobraAdicional: cobra,
    adicional: dados.adicional ?? ADICIONAL_ANTIGO,
    status: base?.status || 'em_andamento',
    dataInicio: dados.dataInicio,
    dataPrevista: base?.dataPrevista ?? null,
    dataFim: base?.dataFim ?? null,
    obs: (dados.obs || '').trim(),
    foto: dados.foto ?? null,
    pago: base?.pago ?? false,
    dataPagamento: base?.dataPagamento ?? null,
  };
};

/** Entrega conferida. Sem data, usa hoje. Pago guarda a data de pagamento (a antiga, se já tinha). */
export const finalizar = (lote, { dataFim, pago } = {}, hoje) =>
  semAConfirmar({
    ...lote,
    status: 'finalizado',
    dataFim: dataFim || hoje,
    pago: !!pago,
    dataPagamento: pago ? lote.dataPagamento || hoje : null,
  });

/** Volta para em andamento; as quantidades conferidas ficam guardadas. */
export const reabrir = (lote) =>
  semAConfirmar({ ...lote, status: 'em_andamento', dataFim: null, pago: false, dataPagamento: null });

/** Pago ou a receber. Só vale para lote finalizado. */
export const marcarPago = (lote, pago, hoje) =>
  isFinal(lote) ? semAConfirmar({ ...lote, pago: !!pago, dataPagamento: pago ? hoje : null }) : lote;

/** Lote novo com a mesma referência, tamanhos e preços, começando hoje e sem conferência. */
export const duplicar = (lote, hoje) => {
  const partes = {};
  Object.entries(lote.partes || {}).forEach(([k, p]) => (partes[k] = { preco: p.preco, plan: { ...p.plan }, real: null }));
  return {
    ref: lote.ref,
    tipo: lote.tipo,
    cliente: lote.cliente || '',
    tamanhos: [...(lote.tamanhos || [])],
    partes,
    cobraAdicional: lote.cobraAdicional,
    adicional: lote.adicional,
    status: 'em_andamento',
    dataInicio: hoje,
    dataPrevista: null,
    dataFim: null,
    obs: '',
    foto: lote.foto || null,
    pago: false,
    dataPagamento: null,
  };
};

/** Lote guardado ou importado: só preenche o que falta, nunca muda o que já existe. */
export const normalizar = (lote) => {
  const out = { ...lote };
  Object.entries(PADRAO).forEach(([k, v]) => {
    if (out[k] === undefined) out[k] = v;
  });
  if (!Array.isArray(out.tamanhos)) out.tamanhos = [];
  if (lote.pago === undefined && isFinal(out) && !out.pagamentoAConfirmar) out.pagamentoAConfirmar = true;
  return out;
};

/** O que está errado ou faltando, em português, na ordem em que a pessoa deve corrigir. */
export const problemas = (lote) => {
  const lista = [];
  if (!REF.test(lote.ref || '')) lista.push('Informe os 3 números da referência');
  if (!lote.tamanhos?.length) lista.push('Escolha pelo menos um tamanho');
  const final = isFinal(lote);
  const ks = partsForTipo(lote.tipo).filter((k) => lote.partes?.[k]);
  ks.forEach((k) => {
    const p = lote.partes[k];
    const nome = ks.length > 1 ? ` (${PART_LABEL[k].toLowerCase()})` : '';
    if (!p.preco) lista.push(`Informe o valor por peça${nome}`);
    if (!final) {
      if (!p.plan?.total) lista.push(`Informe a quantidade${nome}`);
      if (lote.cobraAdicional && (p.plan?.t6 || 0) + (p.plan?.t8 || 0) > (p.plan?.total || 0)) lista.push(`Tam. 6 + 8 maior que o total${nome}`);
    }
  });
  if (final) {
    if (lotePieces(lote) === 0) lista.push('Digite as quantidades entregues');
    if (!lote.dataFim) lista.push('Finalizado sem data de fim');
    else if (lote.dataInicio && lote.dataFim < lote.dataInicio) lista.push('A data de fim é antes do início');
  }
  return lista;
};
