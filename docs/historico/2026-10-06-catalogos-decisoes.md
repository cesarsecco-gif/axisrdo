# SDD ledger — plan: docs/superpowers/plans/2026-10-06-catalogos.md
Setup: Ruling: sem git — cópia em scratchpad/antes-catalogos para retorno — custo se errado: rollback manual.
Pre-flight: T2 consome tipos/chaveItem/catalogoDe de T1 (ok; T1 deixa usos/renomear dos 5 de cadastro como stub e T2 os substitui).
Pre-flight: T3 consome semearCatalogos de T1 (ok) e acrescenta ctx.catalogosDe em obras.ts.
Pre-flight: T4-T9 consomem CampoCatalogo (T4), CATALOGOS/itensDoCatalogo/renomearItem/excluirItem/registrarValor (T1-T2) e a rota de T3 (ok).
Task 1: Ruling: teste esperava a grafia do padrão do relatório vencendo na semeadura; a implementação usa a primeira encontrada (fotos antes do padrão) — a especificação não define e a tela agrupa grafias com Unificar — custo se errado: o catálogo mostra a grafia das fotos em vez da do padrão até o usuário unificar.
Task 1: complete (tests: tsc + test-catalogos base RED(module)→GREEN)
Task 2: complete (tests: tsc + test-catalogos usos/renomeação RED(export)→GREEN)
Task 3: complete (tests: tsc + test-pastas-backups PASS + test-obras PASS; RED: motivo 400 e rota 404→GREEN)
Task 5: complete (tests: tsc + vite build + suite 12 ok/0)
Task 6: complete (tests: tsc + vite build + suite 12 ok/0)
Task 7: Ruling: CampoCatalogo ganhou inputClassName/rotuloClassName/multiline — os cartões da importação usam campos menores (text-xs px-2 py-1) e a descrição é textarea; sem isso o layout da importação quebraria — custo se errado: nenhum funcional, só aparência.
Task 7: Ruling: no campo multilinha a lista do datalist não se aplica (textarea não aceita list); as sugestões continuam pelos botões abaixo — limitação do HTML — custo se errado: a descrição do serviço não tem lista suspensa, só os botões de sugestão e a tela Catálogos.
Task 7: complete (tests: tsc + vite build + suite 12 ok/0)
Task 8: complete (tests: tsc + vite build + suite 12 ok/0)
Task 9: complete (tests: tsc + vite build + suite 12 ok/0)
Task 10: steps 1-3 complete (suite 12/12, dist sincronizado, bundle 1.12.0); step 4 manual pendente
Final review: subagente feature-dev:code-reviewer (modelo fable) — 1 Critical, 5 Important, 3 Minor.
Final: fixed texto longo travava todo o salvamento — limite 500 no cliente e no servidor, tag limitada a 64, catálogo inválido descartado na leitura — testes "texto acima do limite" e test-gravacao RED→GREEN, suite 12/12.
Final: fixed renomear equipamento perdia o efetivo quando a grafia da chave diferia — chaves movidas por chaveItem, somando — teste "chave do efetivo com grafia diferente" RED→GREEN.
Final: fixed "Limpar filtro" não limpava a lista em Gerenciar fotos (correcao fora das dependências do useMemo) — sem teste automático (UI).
Final: fixed "Corrigir agora" escondia registros de outras pastas — os demais filtros são zerados ao receber a correção — sem teste automático (UI).
Final: fixed renomear equipe/função com caixa mista dividia o histograma — equipes, funções, equipamentos, placas e lados gravam em maiúsculas — teste "equipe gravada em maiúsculas" RED→GREEN.
Final: fixed itensDoCatalogo refazia a contagem por grupo (lentidão futura) — contagem em uma passada por catálogo (tally) — asserções de contagem existentes como regressão.
Final: Ruling: semente excluída voltava a cada abertura (revisor classificou Minor; reclassificado por efeito, pois excluir era pedido explícito do usuário) — sementes só na criação do catálogo — teste "semente excluída não volta" RED→GREEN.
Final: Ruling: renomear para o mesmo texto criava backup e alterava registros (revisor Minor; a especificação 3.2 exige que nada aconteça) — corrigido — teste "texto igual não altera nada" RED→GREEN.
Final: Ruling: atalho do catálogo removido do formulário de edição da foto e das Configurações — trocar de aba descartaria o que estava sendo digitado — custo se errado: nesses dois lugares o catálogo é alcançado pelo menu.
Final: Ruling: textos acima de 500 caracteres não entram no catálogo — o servidor recusaria o projeto inteiro; as três sugestões por uso recente continuam funcionando para essas descrições — custo se errado: descrição muito longa não aparece na tela Catálogos.
Final: minor (deferred): com maiúsculas automáticas, digitar no meio do campo leva o cursor para o fim.
Final: Ruling: membros antigos só com m.equipe e sem meses não são alcançados pelo catálogo de equipes (revisor não julgou) — a migração roda ao abrir a aba Equipe e a especificação da 1.11.0 já cobre isso — custo se errado: numa obra nunca aberta na aba Equipe, renomear equipe não alcança esses membros até a primeira abertura.
