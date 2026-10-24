# SDD ledger — plan: docs/superpowers/plans/2026-10-06-equipe-planilha.md
Setup: Ruling: sem git — cópia em scratchpad/antes-equipe para retorno — custo se errado: rollback manual.
Pre-flight: T3 consome normalizarTexto/chaveMatricula de T2 (ok); T4 consome tipos de T3 e funções de T2 (ok, troca de import prevista); T5 consome T1-T4 (ok).
Task 1: complete (tests: tsc + test-pastas-backups RED→GREEN)
Task 2: complete (tests: tsc + test-equipe modelo RED(module)→GREEN)
Task 3: complete (tests: tsc + test-equipe planilha RED(module)→GREEN)
Task 4: complete (tests: tsc + test-equipe prévia RED(export)→GREEN)
Task 5: complete (tests: tsc + vite build + suite 11 ok/0; UI sem teste automático)
Task 6: steps 1-3 complete (suite, dist sincronizado, bundle 1.11.0); step 4 manual pendente
Final review: subagente feature-dev:code-reviewer (modelo fable) — 3 Important, 1 Minor, 0 Critical.
Final: fixed vínculo por nome sem outras mudanças não podia ser aplicado — alteração tipo 'matricula' — teste "preencher só a matrícula" RED→GREEN, suite 11/11.
Final: fixed segunda mudança de função no mesmo mês corrompia o histórico — reaproveita 'anterior' do mesmo mês e desfaz se voltar à original — teste "corrigir a função no mesmo mês" RED→GREEN, suite 11/11.
Final: fixed homônimos na planilha ligados pela ordem das linhas — vínculo por nome exige nome único também na planilha — teste "nome repetido na planilha" RED→GREEN, suite 11/11.
Final: minor (deferred): interpretarMes aceita palavras que começam com sigla de mês ("SETOR 10" vira SET/2010); aparece na prévia, não é silencioso.
Final: Ruling: campo de edição da função mostra a função atual mesmo vendo um mês passado — UX, a mudança grava a partir do mês selecionado e isso está escrito sob o campo — custo: alguém pode achar que edita a função daquele mês só.
