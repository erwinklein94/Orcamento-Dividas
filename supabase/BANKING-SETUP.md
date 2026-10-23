# Finanças reais

O módulo `bancos.html` preserva o orçamento, dívidas, simulador e áreas da vida. Usa o login existente e o projeto `smdoxlutxhcwjxrqeaeo`.

## Pronto para uso

- Visão geral com receitas, despesas, resultado, gastos por categoria, dia e titular.
- Saldos bancários atuais separados dos gastos mensais e dos cartões; quantidade de conexões e data da consulta. Uma falha em uma conta não impede a sincronização das demais.
- Extrato com filtros por mês, conta, titular e busca; classificação de categoria e tratamento.
- Contas bancárias e cartões separados; valores em BRL. Cartões seguem a data da compra fornecida pelo banco. Pagamentos de fatura e transferências devem ser classificados como transferência para não duplicar despesas.
- Lançamentos manuais, importação CSV/OFX com prévia e exportação CSV.
- Tabelas `bank_accounts` e `bank_transactions` com RLS por usuário e vínculo composto conta/usuário. Credenciais e identificadores do provedor só podem ser gravados pelo servidor.

Contas solicitadas, depois da retirada do Bradesco:

| Titular | Banco |
| --- | --- |
| Raquel | Nubank |
| Raquel | Banco do Brasil |
| Erwin | Itaú |
| Erwin | Santander |
| Erwin | Banco do Brasil |

O botão “Cadastrar nossas cinco contas” cria os cadastros manuais ausentes. Não cria contas bancárias nem contrata serviços.

## Ativar a API pessoal

Preços consultados em 23/10/2026: [Meu Pluggy pessoal](https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use) gratuito até 5 conexões, sem uso comercial; [Pluggy Dados](https://www.pluggy.ai/precos) a partir de R$ 2.500/mês; [Belvo Launch](https://belvo.com/pt-br/planos-precos/) R$ 1.500/mês. Condições podem mudar. O uso por dois CPFs precisa ser validado no cadastro do provedor; cada titular autoriza suas contas. Um login compartilhado no site não substitui os consentimentos bancários.

1. Os titulares criam seus acessos e autorizam os bancos em https://meu.pluggy.ai.
2. No https://dashboard.pluggy.ai, habilite o conector **MeuPluggy (200)**. Na Demo da aplicação, conecte o perfil pessoal pelo conector MeuPluggy e copie o `itemId` de cada banco. Não escolha os conectores diretos pagos dos bancos. Guarde os IDs; a listagem de itens não está disponível neste plano.
3. No Supabase, em Edge Functions → Secrets, adicione `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` da aplicação. Nunca adicione essas credenciais ao JavaScript do site ou ao Git. Não envie senhas bancárias para o site ou o chat.

   Compatibilidade com o cadastro existente: quando o secret foi salvo com o UUID do Client ID como nome, o backend também reconhece esse nome. O valor de `PLUGGY_CLIENT_ID` precisa ser um UUID válido; o alias nunca pode apontar para secrets reservados da plataforma. O nome recomendado para novos cadastros continua sendo `PLUGGY_CLIENT_SECRET`.
4. A função `bank-sync` deve estar publicada com o conteúdo de `functions/bank-sync/index.ts`. Ela valida o usuário por `auth.getUser()` em cada chamada, antes de usar a chave privilegiada. `verify_jwt=false` é necessário para aceitar as chaves publicáveis modernas; isso não remove a autenticação implementada dentro da função.
5. Em Finanças reais → Conectar bancos, informe banco, titular e itemId e clique Vincular. A função associa uma conta manual correspondente quando existe uma única candidata; havendo várias candidatas, cria uma conta distinta para evitar escolher a errada.
6. Clique **Sincronizar contas conectadas**. A API usa `/v2/transactions` com paginação por cursor e grava somente BRL com status POSTED. O provedor renova os dados a cada 24 horas; o botão lê a versão disponível, sem forçar atualização bancária. Esta versão não agenda leituras em segundo plano. Os consentimentos precisam ser renovados no provedor quando vencerem.

### Autorização diretamente no site

Em Conectar bancos → Autorizar um banco já conectado, escolha banco e titular e use “Autorizar pelo Meu Pluggy”. O widget oficial 2.8.2 é carregado sob demanda, com `selectedConnectorId: 200` e `connectorIds: [200]`. Ele não oferece conectores diretos de bancos nem a atualização manual de um proxy já existente. O backend gera somente um Connect Token temporário; a chave da API nunca vai ao navegador.

O usuário aceita termos e autoriza a leitura no provedor. Ao concluir, a tela vincula e sincroniza os dados automaticamente. O itemId recebido nos eventos fica em um registro pendente no navegador, separado por usuário, para permitir retomar o vínculo se a janela/página for fechada antes do callback de sucesso. “Concluir vínculo pendente” retoma a consulta no servidor e só grava contas depois de validar o item e a disponibilidade dos dados. O formulário manual continua disponível para conexões autorizadas no Dashboard.

Sem credenciais, as telas de importação e relatórios funcionam; a API mostra “aguardando configuração”. Nenhum serviço pago foi contratado. Integração real depende dessas etapas; a publicação da função, sozinha, não conecta os bancos.

## Importação

Use OFX com moeda BRL ou CSV UTF-8/Windows-1252 com colunas `data`, `descrição`, `valor` e opcional `id`; pode usar nomes equivalentes em inglês. Datas: DD/MM/AAAA ou AAAA-MM-DD. Saídas negativas e entradas positivas. Limites: 5 MB e 5.000 linhas por arquivo. Arquivo incompatível deve ser convertido para o modelo disponível na tela.

Identificação: FITID no OFX, id no CSV, ou hash de data/descrição/valor com número de ocorrência. Reimportar a mesma origem na mesma conta preserva registros e classificação. Sem IDs estáveis, extratos parcialmente sobrepostos com compras idênticas podem exigir conferência. Origens diferentes (CSV, OFX, API) não são conciliadas automaticamente; prefira uma única origem por conta/período. A importação é feita em lotes; em falha parcial, reenviar o mesmo arquivo retoma sem duplicar os lotes já salvos.

A sincronização atualiza valores, datas e descrições mantendo categorias e tratamento escolhidos. Ela não apaga lançamentos ausentes ou removidos no provedor; uma exclusão/estorno precisa ser conferido no extrato. Os saldos são snapshots da API, não o resultado dos extratos importados.

Novos lançamentos da API recebem sugestões locais de categoria por descrições reconhecidas, sem contratar o enriquecimento do provedor. Pagamentos explicitamente identificados como fatura são inicialmente classificados como transferência para não contar a fatura e as compras duas vezes; Pix genérico não é excluído automaticamente. Revise essas sugestões no Extrato. `banking-classification.sql` atualiza somente a ingestão; ressincronizar preserva a classificação já salva.

## Painel e classificação

O painel combina distribuição por categoria, tabela com participação e comparação, evolução de seis meses, curva diária acumulada, destinos agrupados e maiores saídas. Mês, titular, conta, categoria, tipo de movimentação e busca filtram os relatórios e o extrato. Clicar em categorias ou destinos abre somente suas despesas; o filtro Tipo também permite consultar entradas, transferências e ignorados. Saldos atuais e últimos lançamentos ficam em seções recolhíveis.

A comparação do mês em andamento usa os mesmos dias do mês anterior; o histórico de seis meses mantém os totais disponíveis de cada mês e identifica o atual com asterisco. Períodos fechados comparam meses completos. Relatórios dependem da cobertura do histórico importado, sem estimar dados ausentes.

Em Extrato → Organizar categorias, a prévia analisa todo o histórico. A regra compartilhada `js/banking-categories.js` reconhece estabelecimentos, despesas identificáveis, transferências exatas entre os titulares, faturas, aplicações/resgates e entradas explícitas de crédito financiado. Pix genérico fica para revisão. Só preenche categorias vazias; categorias anteriores são mantidas mesmo quando sugere alterar o tratamento de uma movimentação para transferência. O usuário seleciona os grupos antes de salvar no Supabase; as atualizações verificam a categoria e o tratamento anteriores para preservar edições concorrentes.

O normalizador da Edge Function usa o mesmo arquivo. Para publicar, inclua os caminhos completos de `supabase/functions/bank-sync/index.ts`, `supabase/functions/bank-sync/transactions.mjs` e `js/banking-categories.js`, com o primeiro como entrypoint, preservando os imports relativos.

## Validação

`node --test tests/banking-model.test.cjs tests/banking-provider.test.cjs tests/banking-insights.test.cjs tests/life-store.test.cjs tests/scenarios.test.cjs`

`node tests/browser-preview.cjs` disponibiliza `/__bank-qa` com dados fictícios, sem chamadas ao Supabase, para validar telas e ações. O módulo usa números inteiros de centavos na soma dos indicadores. `banking.sql` registra a migração aplicada no Supabase. Alterações posteriores de schema devem ser migrações aditivas.
