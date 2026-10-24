# SDD ledger — plan: docs/superpowers/plans/2026-10-05-gerenciamento-de-obras.md
Setup: Ruling: sem git (pasta não é repositório) — sem worktree/commits; cópia do código-fonte em scratchpad/antes-obras para retorno — custo se errado: rollback manual pelo tar.
Pre-flight: T2 consome ctx.workspace() string|null de T1 (ok); T5 consome rotas T1-4 com formatos do Produces (ok); T6 consome PainelBase/obrasApi de T5 (ok).
Task 1: complete (tests: tsc + suite 9 ok/0 falhas, incl. test-sem-obra RED→GREEN)
Task 2: complete (tests: tsc + test-obras PASS + test-sem-obra ok; RED: /duplicate 404→GREEN)
Task 3: complete (tests: tsc + test-obras PASS; RED: move obra fechada 400→GREEN). Ruling: lastAccessAt só atualiza ao mover a obra aberta — mover obra fechada não é 'acesso' — custo se errado: ordenação por último acesso ligeiramente diferente.
Task 4: complete (tests: tsc + suite 10 ok/0 falhas; RED: semObra undefined→GREEN)
Task 5: complete (tests: tsc OK + vite build OK; sem testes de UI no repo). Ruling: key em React.Fragment ao redor de ObraCard — sem @types/react o tsc rejeita key em props tipadas — custo se errado: nenhum em runtime.
Task 6: complete (tests: tsc + vite build + suite 10 ok/0). Ruling: aviso beforeunload só com obra aberta — sem obra o status nunca vira 'Salvo neste PC' e cada recarga dos painéis pediria confirmação — custo se errado: nenhum dado em risco, não há o que salvar sem obra.
Task 7: steps 1-3 complete (tsc, build, suite 10/0, dist sincronizado, bundle 1.10.0-obras); step 4 (conferência manual no Windows) pendente com o usuário.
Final review: subagente feature-dev:code-reviewer (modelo fable) — 1 Important, 1 Minor, 0 Critical; 5 focos confirmados.
Final: fixed pasta da obra aberta indisponível travava o app sem acesso a Obras — App.tsx falhaAbertura libera só a tela Obras; servidor: caso em test-sem-obra (passou de primeira: cobre as rotas, não a tela); suite 10/10. UI sem teste automatizado: verificação manual pendente.
Final: Ruling: Minor (apagar parcial) reclassificado como Important pelo efeito — pasta da obra aberta ficaria sem projeto.json e o app recriaria projeto vazio — corrigido: conferência prévia de tudo e projeto.json por último — test-remover-obra caso "Obra F" (junction) RED→GREEN, suite 10/10.
Final: Ruling: confirmarRaiz grava a pasta das obras antes da operação — mantido, inofensivo e reaproveitado na próxima tentativa — custo: pasta definida mesmo se a criação falhar.
Final: Ruling: download do backup cancelado não é detectável pelo navegador — só falha de geração bloqueia a exclusão — custo: usuário pode cancelar o salvamento e apagar sem backup.
Final: Ruling: arquivos-fantasma do OneDrive podem ser vistos como atalho por treeInfo — comportamento já existia em Mover; agora a remoção recusa sem apagar nada — custo: remover com apagar pode falhar em pasta OneDrive não sincronizada; remover só da lista sempre funciona.
