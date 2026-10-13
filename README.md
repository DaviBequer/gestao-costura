# Gestão Costura 2.0

App para controlar lotes de costura: produção, conferência de entrega, pagamentos, prazos, despesas, lucro e relatórios em PDF.
Funciona **offline**, pode ser **instalado no celular** como app e **não precisa de servidor nem de instalar nada** para desenvolver.

---

## Como abrir no computador

Clique duas vezes em **`Abrir-App.bat`**. O navegador abre em `http://localhost:8080`.
Deixe a janela preta aberta enquanto usa o app; feche-a para parar.

> Os dados ficam salvos no navegador do aparelho onde o app é aberto. Celular e computador têm dados separados: use **Backup → Restaurar** para levar de um para o outro.

## Como colocar no celular (grátis)

O app precisa estar em um endereço `https://` para ser instalado no celular. O jeito mais fácil:

1. Acesse **https://app.netlify.com/drop** e crie uma conta grátis.
2. Arraste a pasta **Costura** inteira para a página.
3. Abra o link gerado no celular (Chrome no Android ou Safari no iPhone).
4. Android: menu ⋮ → **Instalar app**. iPhone: botão compartilhar → **Adicionar à Tela de Início**.

Para publicar uma atualização, arraste a pasta de novo em *Deploys* do mesmo site.
**Antes disso, aumente o número em `sw.js`** (`const VERSAO = 'costura-v2.0.1'`). Assim os celulares baixam a versão nova e mostram o aviso "Nova versão disponível".

## Trazendo os dados do app antigo

1. No app antigo: **Configurações → Fazer Backup** (gera um arquivo `.json`).
2. No app novo: **Ajustes → Restaurar** e escolha esse arquivo.
3. O app pergunta se os lotes antigos já finalizados foram pagos (o app antigo não controlava pagamento).

Na conversão, os preços que o app antigo zerava em lotes "Inferior" são recalculados a partir do valor total salvo.

---

## O que tem no app

**Início**
- Meta do mês com barra de progresso (faturado + o que está em produção) e quanto falta por dia
- Alertas: lotes atrasados, entregas próximas, valor a receber, lembrete de backup
- Desempenho semanal (S1–S5) com meta proporcional aos dias de cada semana
- Filtros: Em andamento, Este mês, Mês passado, Todos
- Cartões de lote com foto, prazo, botão Finalizar, Pago/A receber; deslize para a esquerda para excluir
- Busca por referência ou observação

**Lote**
- Tipos Superior, Inferior e Conjunto (duas colunas)
- Referência `0` + 3 números + letra, tamanhos, adicional por peça dos tamanhos 6/8 (pode ligar ou desligar)
- Sugestão do preço usado na última vez com a mesma referência
- Prazo de entrega, observação, foto; total sempre visível no rodapé
- Conferência na entrega: peças por tamanho, comparação planejado × entregue
- Reabrir, duplicar, excluir; rascunho salvo automaticamente

**Finanças**: faturado, despesas e lucro do mês; lotes a receber com "marcar todos pagos"; lançamento de despesas por categoria; resumo pelo WhatsApp.

**Números**: peças/dia, ganho/dia, valor médio por peça, dias por lote, comparação com o mês anterior, gráfico de 12 meses, referências que mais renderam, tempo de cada lote.

**Relatório**: folha A4 por mês (ou todo o período), PDF para compartilhar ou salvar, versículo no rodapé (pode desligar).

**Faturamento anual**: produção × valores declarados por mês (mínimo R$ 999,99), lucro do ano.

**Ajustes**: logo, nome, tema claro/escuro/automático, tamanhos, valor do adicional, meta, WhatsApp, backup/restauração (juntar ou substituir), verificação de dados, apagar tudo.

---

## Para quem for mexer no código

Não tem etapa de build: é HTML + JavaScript (módulos ES) + CSS. Para ver uma mudança, basta salvar o arquivo e recarregar a página.

```
index.html              página única
css/app.css             todo o visual (cores em variáveis no topo, tema escuro incluso)
js/app.js               abas, janelas, botão voltar, tema, service worker
js/store.js             estado + gravação no banco (IndexedDB)
js/db.js                acesso ao IndexedDB
js/calc.js              regras de negócio (valores em centavos)
js/migrate.js           conversão do app antigo e formato de backup
js/ui.js                ícones, campos de dinheiro, diálogos, avisos
js/charts.js            gráficos em SVG
js/views/*.js           telas
vendor/                 Preact + htm (interface) e html2pdf (PDF), versões fixas
sw.js                   cache offline (aumente VERSAO a cada publicação)
servidor.ps1            servidor local usado pelo Abrir-App.bat
```

Dinheiro é sempre guardado em **centavos inteiros**, para não ter erro de arredondamento.
Datas são guardadas como `AAAA-MM-DD` no horário local.

A versão antiga (Angular / AI Studio) está guardada em `_versao-antiga-angular.zip`.
