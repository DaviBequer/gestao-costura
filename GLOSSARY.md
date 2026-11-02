# Glossário — Gestão Costura

Os nomes do domínio, para o código, as conversas e as revisões usarem as mesmas palavras.

**Lote** — um pedido de costura recebido da confecção: uma referência, um tipo, tamanhos, partes com preço e quantidade, e a situação (em andamento ou finalizado). Só o module `js/lote.js` cria e altera um lote.

**Referência** — o código do modelo: `0` + 3 números + uma letra opcional (`0454`, `0454D`).

**Tipo** — `superior` (blusa), `inferior` (calça/saia) ou `conjunto` (os dois).

**Parte** — o lado superior (`sup`) ou inferior (`inf`) de um lote, cada um com seu preço por peça, quantidade planejada e quantidades conferidas. Conjunto tem as duas partes.

**Planejado** — o que foi combinado ao receber o lote: total de peças e quantas são tamanho 6 e 8.

**Conferência** — a contagem do que foi entregue, por tamanho, feita ao finalizar. Quando existe, o valor do lote passa a ser o do entregue; vazia, vale o planejado.

**Finalizar** — conferir a entrega e fechar o lote, com data de fim. **Reabrir** volta para em andamento sem perder a conferência.

**Adicional 6/8** — valor extra por peça nos tamanhos 6 e 8 (padrão em Ajustes, R$ 0,20). Só conta quando o lote "cobra adicional".

**Pago / A receber** — situação do pagamento de um lote finalizado, com a data do pagamento.

**Pagamento a confirmar** — lote finalizado vindo do app antigo, que não controlava pagamento; fica assim até a pessoa dizer se já recebeu.

**Meta** — quanto se quer faturar no mês. **Faturado** é a soma dos lotes finalizados no mês; **na máquina** é o valor dos lotes em produção.

**App antigo** — a primeira versão (Angular). Seus lotes e backups são convertidos para o formato novo na importação.
