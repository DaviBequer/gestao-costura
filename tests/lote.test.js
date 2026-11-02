// Testes do module Lote: abra tests/lote.html no navegador (com o servidor local rodando).

import { montar, finalizar, reabrir, marcarPago, duplicar, normalizar, problemas } from '../js/lote.js';
import { fromV1Lote, parseBackup } from '../js/migrate.js';
import { loteValue, lotePieces, loteExtraValue, plannedValue, plannedPieces, isFinal } from '../js/calc.js';

// ---------- Mini executor ----------

const resultados = [];
const teste = (nome, fn) => {
  try {
    fn();
    resultados.push({ nome, ok: true });
  } catch (e) {
    resultados.push({ nome, ok: false, erro: e.message });
  }
};
const igual = (atual, esperado, msg = '') => {
  const a = JSON.stringify(atual);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg}\n  esperado: ${b}\n  veio:     ${a}`);
};
const verdade = (v, msg) => {
  if (!v) throw new Error(msg);
};

// ---------- Dados de apoio ----------

const HOJE = '2026-11-02';

const dadosSup = (extra = {}) => ({
  ref: '0454',
  tipo: 'superior',
  tamanhos: [8, 2, 6, 4],
  partes: { sup: { preco: 350, total: 100, t6: 10, t8: 5, real: {} } },
  cobraAdicional: true,
  adicional: 20,
  dataInicio: '2026-10-20',
  obs: '  levar linha  ',
  foto: null,
  cliente: '',
  ...extra,
});

// ---------- montar ----------

teste('montar: lote novo fica em andamento, com tamanhos em ordem e obs sem espaços', () => {
  const l = montar(dadosSup());
  igual(l.status, 'em_andamento');
  igual(l.tamanhos, [2, 4, 6, 8]);
  igual(l.obs, 'levar linha');
  igual([l.dataFim, l.pago, l.dataPagamento], [null, false, null]);
  igual(l.partes.sup, { preco: 350, plan: { total: 100, t6: 10, t8: 5 }, real: null });
});

teste('montar: valor e peças planejados batem com o cálculo', () => {
  const l = montar(dadosSup());
  igual([loteValue(l), lotePieces(l), loteExtraValue(l)], [35300, 100, 300]);
});

teste('montar: sem cobrar adicional, 6/8 vão para zero', () => {
  const l = montar(dadosSup({ cobraAdicional: false }));
  igual(l.partes.sup.plan, { total: 100, t6: 0, t8: 0 });
});

teste('montar: tamanho 6/8 não escolhido zera a quantidade dele', () => {
  const l = montar(dadosSup({ tamanhos: [2, 4, 8] }));
  igual(l.partes.sup.plan, { total: 100, t6: 0, t8: 5 });
});

teste('montar: só guarda conferência dos tamanhos escolhidos e com quantidade', () => {
  const l = montar(dadosSup({ tamanhos: [2, 4], partes: { sup: { preco: 350, total: 100, real: { 2: 40, 4: 0, 6: 9 } } } }));
  igual(l.partes.sup.real, { 2: 40 });
});

teste('montar: conjunto tem as duas partes; parte que sobra do formulário é ignorada', () => {
  const l = montar(dadosSup({ tipo: 'inferior', partes: { sup: { preco: 1 }, inf: { preco: 300, total: 50 } } }));
  igual(Object.keys(l.partes), ['inf']);
  const c = montar(dadosSup({ tipo: 'conjunto', partes: { sup: { preco: 300, total: 50 }, inf: { preco: 200, total: 50 } } }));
  igual(Object.keys(c.partes), ['sup', 'inf']);
});

teste('montar: editando, mantém id, situação, pagamento e data prevista guardados', () => {
  const base = finalizar(montar(dadosSup()), { dataFim: '2026-10-28', pago: true }, '2026-10-29');
  const editado = montar(dadosSup({ obs: 'novo' }), { ...base, id: 'x1', dataPrevista: '2026-10-30' });
  igual([editado.id, editado.status, editado.pago, editado.dataPagamento, editado.dataFim, editado.dataPrevista], ['x1', 'finalizado', true, '2026-10-29', '2026-10-28', '2026-10-30']);
  igual(editado.obs, 'novo');
});

// ---------- finalizar / reabrir / marcarPago ----------

teste('finalizar: usa hoje se não vier data, e começa a receber', () => {
  const l = finalizar(montar(dadosSup()), {}, HOJE);
  igual([l.status, l.dataFim, l.pago, l.dataPagamento], ['finalizado', HOJE, false, null]);
});

teste('finalizar: pago grava a data de pagamento (mantém a antiga se já tinha)', () => {
  const l = finalizar(montar(dadosSup()), { dataFim: '2026-10-30', pago: true }, HOJE);
  igual([l.dataFim, l.pago, l.dataPagamento], ['2026-10-30', true, HOJE]);
  const de_novo = finalizar(l, { dataFim: '2026-10-30', pago: true }, '2026-12-01');
  igual(de_novo.dataPagamento, HOJE);
});

teste('finalizar: com conferência, o valor passa a ser o entregue', () => {
  const m = montar(dadosSup({ partes: { sup: { preco: 350, total: 100, t6: 10, t8: 5, real: { 2: 40, 4: 45, 6: 9, 8: 4 } } } }));
  const l = finalizar(m, {}, HOJE);
  igual([lotePieces(l), loteValue(l), plannedPieces(l), plannedValue(l)], [98, 98 * 350 + 13 * 20, 100, 35300]);
});

teste('reabrir: volta para em andamento, limpa fim e pagamento, guarda a conferência', () => {
  const m = montar(dadosSup({ partes: { sup: { preco: 350, total: 100, real: { 2: 50 } } } }));
  const l = reabrir(finalizar(m, { pago: true }, HOJE));
  igual([l.status, l.dataFim, l.pago, l.dataPagamento], ['em_andamento', null, false, null]);
  igual(l.partes.sup.real, { 2: 50 });
});

teste('marcarPago: grava e apaga a data do pagamento', () => {
  const fin = finalizar(montar(dadosSup()), {}, '2026-10-30');
  const pago = marcarPago(fin, true, HOJE);
  igual([pago.pago, pago.dataPagamento], [true, HOJE]);
  const volta = marcarPago(pago, false, HOJE);
  igual([volta.pago, volta.dataPagamento], [false, null]);
});

teste('marcarPago: lote em andamento não muda', () => {
  const l = montar(dadosSup());
  igual(marcarPago(l, true, HOJE), l);
});

teste('pagamento a confirmar some ao finalizar, reabrir ou marcar pago/a receber', () => {
  const fin = { ...finalizar(montar(dadosSup()), {}, HOJE), pagamentoAConfirmar: true };
  verdade(!('pagamentoAConfirmar' in marcarPago(fin, false, HOJE)), 'marcarPago(false)');
  verdade(!('pagamentoAConfirmar' in marcarPago(fin, true, HOJE)), 'marcarPago(true)');
  verdade(!('pagamentoAConfirmar' in reabrir(fin)), 'reabrir');
  verdade(!('pagamentoAConfirmar' in finalizar(fin, {}, HOJE)), 'finalizar');
});

// ---------- duplicar ----------

teste('duplicar: lote novo de hoje, sem id, datas, pagamento, obs nem conferência', () => {
  const orig = { ...finalizar(montar(dadosSup({ partes: { sup: { preco: 350, total: 100, real: { 2: 9 } } } })), { pago: true }, '2026-10-01'), id: 'z', criadoEm: 'x', dataPrevista: '2026-10-09' };
  const d = duplicar(orig, HOJE);
  igual([d.id, d.criadoEm, d.status, d.dataInicio, d.dataFim, d.dataPrevista, d.pago, d.dataPagamento, d.obs], [undefined, undefined, 'em_andamento', HOJE, null, null, false, null, '']);
  igual([d.ref, d.tipo, d.tamanhos, d.partes.sup.preco, d.partes.sup.plan.total, d.partes.sup.real], ['0454', 'superior', [2, 4, 6, 8], 350, 100, null]);
});

// ---------- normalizar ----------

teste('normalizar: preenche só o que falta', () => {
  const l = normalizar({ id: 'n', ref: '0101', tipo: 'superior', status: 'em_andamento', dataInicio: '2026-01-01', partes: { sup: { preco: 100, plan: { total: 10, t6: 0, t8: 0 }, real: null } } });
  igual([l.cliente, l.obs, l.dataPrevista, l.dataFim, l.pago, l.dataPagamento, l.foto, l.cobraAdicional, l.adicional, l.tamanhos], ['', '', null, null, false, null, null, true, 20, []]);
});

teste('normalizar: nunca muda o que já existe (valores, datas, pagamento)', () => {
  const guardado = {
    id: 'mae', ref: '0300B', tipo: 'conjunto', tamanhos: [2, 4], cliente: 'Loja', obs: 'x', foto: 'data:abc',
    partes: { sup: { preco: 333, plan: { total: 7, t6: 9, t8: 0 }, real: { 2: 3, 10: 1 } }, inf: { preco: 1, plan: { total: 1, t6: 0, t8: 0 }, real: null } },
    cobraAdicional: false, adicional: 35, status: 'finalizado', dataInicio: '2026-02-01', dataPrevista: '2026-02-03',
    dataFim: '2026-02-01', pago: true, dataPagamento: '2026-02-09', criadoEm: 'c', atualizadoEm: 'a',
  };
  const antes = JSON.stringify(guardado);
  igual(normalizar(guardado), JSON.parse(antes));
  igual(JSON.stringify(guardado), antes, 'não pode alterar o objeto recebido');
});

teste('normalizar: pagamento indefinido vira "a confirmar" só em lote finalizado', () => {
  const fin = normalizar({ id: 'p', status: 'finalizado', pago: undefined, partes: {} });
  igual([fin.pago, fin.pagamentoAConfirmar], [false, true]);
  const aberto = normalizar({ id: 'q', status: 'em_andamento', pago: undefined, partes: {} });
  igual([aberto.pago, 'pagamentoAConfirmar' in aberto], [false, false]);
});

// ---------- problemas ----------

teste('problemas: lote certo não tem nenhum', () => {
  igual(problemas(montar(dadosSup())), []);
});

teste('problemas: referência precisa ser 0 + 3 números + letra opcional', () => {
  ['0454', '0454D', '0454d'].forEach((ref) => igual(problemas(montar(dadosSup({ ref }))), [], ref));
  ['045', '454', '0454DD', '04X4', ''].forEach((ref) =>
    igual(problemas(montar(dadosSup({ ref })))[0], 'Informe os 3 números da referência', ref));
});

teste('problemas: planejamento pede tamanho, preço, quantidade e 6+8 dentro do total', () => {
  igual(problemas(montar(dadosSup({ tamanhos: [] }))), ['Escolha pelo menos um tamanho']);
  igual(problemas(montar(dadosSup({ partes: { sup: { preco: 0, total: 0 } } }))), ['Informe o valor por peça', 'Informe a quantidade']);
  igual(problemas(montar(dadosSup({ partes: { sup: { preco: 100, total: 10, t6: 8, t8: 5 } } }))), ['Tam. 6 + 8 maior que o total']);
});

teste('problemas: conjunto diz qual parte', () => {
  const c = montar(dadosSup({ tipo: 'conjunto', partes: { sup: { preco: 100, total: 10 }, inf: { preco: 0, total: 10 } } }));
  igual(problemas(c), ['Informe o valor por peça (inferior)']);
});

teste('problemas: finalizado pede peças entregues e datas coerentes', () => {
  const zerado = finalizar(montar(dadosSup({ partes: { sup: { preco: 100, total: 0 } } })), {}, HOJE);
  igual(problemas(zerado), ['Digite as quantidades entregues']);
  const antes = finalizar(montar(dadosSup()), { dataFim: '2026-10-01' }, HOJE);
  igual(problemas(antes), ['A data de fim é antes do início']);
  igual(problemas({ ...finalizar(montar(dadosSup()), {}, HOJE), dataFim: null }), ['Finalizado sem data de fim']);
});

teste('problemas: data prevista não é mais conferida', () => {
  igual(problemas({ ...montar(dadosSup()), dataPrevista: '2020-01-01' }), []);
});

// ---------- Lotes do app antigo (valores gravados antes da mudança) ----------

const V1 = [
  { id: 'a', referencia: '0454', tipo: 'superior', status: 'em_andamento', tamanhos: [2, 4, 6, 8], qtdSuperior: 100, qtdTamanho6: 10, qtdTamanho8: 5, valorUnitarioSuperior: 3.5, cobraAdicionalTam6: true, dataInicio: '2025-03-01T12:00:00Z' },
  { id: 'b', referencia: '0455B', tipo: 'inferior', status: 'finalizado', tamanhos: [2, 4, 6], qtdInferior: 80, qtdTamanho6: 8, valorUnitarioInferior: 0, valorUnitarioSuperior: 0, valorPeca: 0, valorTotal: 250.6, realizedQuantities: { 2: 30, 4: 40, 6: 9 }, plannedQtdSuperior: 88, dataInicio: '2025-03-02T12:00:00Z', dataFim: '2025-03-08T12:00:00Z' },
  { id: 'c', referencia: '0460', tipo: 'conjunto', status: 'finalizado', tamanhos: [2, 4], qtdSuperior: 50, qtdInferior: 50, qtdTamanho6Superior: 4, valorUnitarioSuperior: 4, valorUnitarioInferior: 3, cobraAdicionalTam6: false, realizedQuantitiesSup: { 2: 25, 4: 24 }, realizedQuantitiesInf: { 2: 26, 4: 25 }, plannedQtdSuperior: 104, plannedQtdInferior: 50, dataInicio: '2025-04-01T12:00:00Z', dataFim: '2025-04-09T12:00:00Z' },
  { id: 'd', referencia: '453', tipo: 'superior', status: 'finalizado', tamanhos: [6, 8], qtdSuperior: 20, qtdTamanho6: 5, qtdTamanho8: 5, valorUnitarioSuperior: 5, dataInicio: '2025-05-01T12:00:00Z', dataFim: '2025-05-03T12:00:00Z' },
  { id: 'e', referencia: '0470A', tipo: 'superior', status: 'finalizado', tamanhos: [2, 4], qtdSuperior: 40, qtdTamanho6: 6, valorUnitarioSuperior: 2, cobraAdicionalTam6: true, realizedQuantities: { 2: 20, 4: 21 }, plannedQtdSuperior: 46, dataInicio: '2025-06-01T12:00:00Z', dataFim: '2025-06-05T12:00:00Z' },
  { id: 'f', referencia: '0480', tipo: 'superior', status: 'em_andamento', tamanhos: [2, 4], qtdSuperior: 30, qtdTamanho6: 3, valorUnitarioSuperior: 2, cobraAdicionalTam6: true, dataInicio: '2025-07-01T12:00:00Z' },
];
// Resultado do app ANTES do module Lote (f: tamanho 6 com peças, mas fora da lista de tamanhos)
const V1_ESPERADO = [
  { id: 'a', ref: '0454', status: 'em_andamento', dataInicio: '2025-03-01', dataFim: null, valor: 40550, pecas: 115, extra: 300, planejadoValor: 40550, planejadoPecas: 115, adicional: 20, cobra: true },
  { id: 'b', ref: '0455B', status: 'finalizado', dataInicio: '2025-03-02', dataFim: '2025-03-08', valor: 25065, pecas: 79, extra: 180, planejadoValor: 27720, planejadoPecas: 88, adicional: 20, cobra: true },
  { id: 'c', ref: '0460', status: 'finalizado', dataInicio: '2025-04-01', dataFim: '2025-04-09', valor: 34900, pecas: 100, extra: 0, planejadoValor: 36600, planejadoPecas: 104, adicional: 20, cobra: false },
  { id: 'd', ref: '453', status: 'finalizado', dataInicio: '2025-05-01', dataFim: '2025-05-03', valor: 15200, pecas: 30, extra: 200, planejadoValor: 15200, planejadoPecas: 30, adicional: 20, cobra: true },
  { id: 'e', ref: '0470A', status: 'finalizado', dataInicio: '2025-06-01', dataFim: '2025-06-05', valor: 8200, pecas: 41, extra: 0, planejadoValor: 9200, planejadoPecas: 46, adicional: 20, cobra: true },
  { id: 'f', ref: '0480', status: 'em_andamento', dataInicio: '2025-07-01', dataFim: null, valor: 6660, pecas: 33, extra: 60, planejadoValor: 6660, planejadoPecas: 33, adicional: 20, cobra: true },
];

const resumoV1 = (l) => ({
  id: l.id, ref: l.ref, status: l.status, dataInicio: l.dataInicio, dataFim: l.dataFim,
  valor: loteValue(l), pecas: lotePieces(l), extra: loteExtraValue(l), planejadoValor: plannedValue(l), planejadoPecas: plannedPieces(l),
  adicional: l.adicional, cobra: l.cobraAdicional,
});

V1.forEach((o, i) =>
  teste(`app antigo ${o.id}: valores iguais aos de antes`, () => igual(resumoV1(fromV1Lote(o)), V1_ESPERADO[i])));

teste('app antigo: finalizados ficam com pagamento a confirmar, abertos não', () => {
  V1.map(fromV1Lote).forEach((l) => {
    igual(l.pago, false, l.id);
    igual(!!l.pagamentoAConfirmar, isFinal(l), l.id);
  });
});

teste('app antigo: tamanho com peças entra na lista de tamanhos', () => {
  igual(fromV1Lote(V1[5]).tamanhos, [2, 4, 6]);
});

teste('backup novo: lotes passam por normalizar sem mudar valores', () => {
  const l = { ...finalizar(montar(dadosSup()), { pago: true }, HOJE), id: 'k' };
  const lido = parseBackup(JSON.stringify({ app: 'Gestão Costura', version: '2.0.0', data: { lotes: [l], despesas: [], settings: {} } }));
  igual(lido.lotes[0], l);
});

// ---------- Resultado na tela ----------

const falhas = resultados.filter((r) => !r.ok);
const resumo = document.getElementById('resumo');
resumo.textContent = falhas.length ? `${falhas.length} de ${resultados.length} falharam` : `Todos os ${resultados.length} testes passaram`;
resumo.className = falhas.length ? 'falhou' : 'ok';
document.getElementById('lista').innerHTML = resultados
  .map((r) => `<li class="${r.ok ? 'ok' : 'falhou'}">${r.nome}${r.ok ? '' : `<pre>${r.erro.replace(/</g, '&lt;')}</pre>`}</li>`)
  .join('');
window.__testes = { total: resultados.length, falhas };
