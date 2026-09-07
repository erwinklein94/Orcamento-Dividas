Painel de Dívidas — Família Klein

Persistência: Supabase smdoxlutxhcwjxrqeaeo, tabela public.finance_workspaces.
Os três cenários iniciais e os seis contratos completos foram gravados no banco.
Cada cenário armazena rendas, descontos, dependentes, custos, 13º, PPR,
amortização, dívidas, estratégia, valor do simulador, titular e aba selecionados.
O período de referência e o modelo inicial também estão no banco.

Primeiro acesso:
1. Abra a versão atualizada do site por HTTPS (ou localhost para desenvolvimento).
2. Use erwinklein1994@gmail.com e escolha uma senha de pelo menos 10 caracteres.
3. Clique em “Primeiro acesso: criar minha conta” e confirme o e-mail recebido.
4. Volte ao site e entre com sua senha. A confirmação vincula automaticamente
   a conta ao orçamento já salvo; nenhuma outra conta recebe acesso.
O login antigo com senha validada no JavaScript foi substituído pelo Supabase Auth.
Nenhum e-mail de cadastro é enviado até você clicar para criar sua conta.

Cenários:
- Ativar cenário troca os valores usados em todo o painel.
- Copiar selecionado cria e ativa uma cópia independente do cenário escolhido.
- Novo cenário usa o modelo inicial salvo no banco. É possível ter mais de três.
- Renomear altera o nome do cenário ativo.
- Aguarde “salvo no Supabase” antes de fechar a página. Use a mesma conta para
  recuperar os dados em outro dispositivo. Ao voltar à janela, o painel consulta
  atualizações da nuvem quando não há edições locais pendentes.
- Cenários da versão anterior podem ser importados como cópias pelo botão que
  aparece no navegador onde foram salvos. Os dados originais locais são preservados.
- Falhas de rede mantêm um rascunho local por conta. A página avisa antes de fechar
  e tenta novamente ao recuperar a conexão, ou pelo botão de retentativa.
- Conflitos entre dispositivos não sobrescrevem dados: recupere as edições como
  cópias. Ao reabrir, um rascunho antigo também é recuperado como cópias se necessário.

Publicação:
Publique index.html e as pastas css/ e js/ (incluindo js/vendor/).
Não publique tests/, supabase/, .git/ ou arquivos privados/de ambiente.
Não há etapa de build. A biblioteca Supabase 2.115.0 está incluída e fixada localmente.
O banco remoto já foi configurado; os arquivos locais atualizados precisam ser
publicados pelo fluxo de hospedagem do projeto.

Estrutura:
- js/app.js: cálculos, renderização e eventos do orçamento; sem os registros financeiros iniciais.
- js/finance-store.js: validação, cópias, importação e fila de gravação com revisão.
- js/scenarios.js: integração do painel com a tabela e recuperação de rascunhos.
- js/auth.js: login, cadastro confirmado, sessão e saída.
- js/supabase-config.js: endereço do projeto e chave publicável (nenhuma chave administrativa).
- supabase/schema.sql: estrutura e políticas aplicadas pela API de migrations.
- supabase/retire-fmt.sql: registro da remoção autorizada das tabelas e contas antigas;
  não executar novamente. O endpoint criar-usuario foi desativado com resposta 410.

Segurança e validação:
RLS restringe SELECT/UPDATE ao owner_id vinculado após confirmação do e-mail.
Clientes só podem atualizar payload, não o proprietário nem a revisão.
Uma revisão monotônica impede sobrescritas concorrentes. A API anônima nega leitura.
O banco foi testado com transações revertidas: confirmação de e-mail, acesso do dono,
isolamento de outra conta e rejeição de revisão desatualizada.
Referência: https://supabase.com/docs/guides/database/postgres/row-level-security

Testes: node --test tests/scenarios.test.cjs
Prévia local: node tests/browser-preview.cjs
  http://127.0.0.1:4173/ mostra o login real.
  /__qa usa exclusivamente dados sintéticos e um adaptador em memória, sem Supabase.
