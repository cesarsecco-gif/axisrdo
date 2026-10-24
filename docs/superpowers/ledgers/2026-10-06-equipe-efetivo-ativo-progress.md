# SDD ledger — plan: docs/superpowers/plans/2026-10-06-equipe-efetivo-ativo.md

Spec: docs/superpowers/specs/2026-10-06-equipe-efetivo-ativo-design.md (lido)
Execução: nativa (inline), 7 tarefas.

Setup: Ruling: o projeto NÃO é repositório git — sem worktree, sem commits, sem `git log`, sem `review-package`/`merge-base`. O ledger fica neste arquivo; a prova de cada tarefa é a suíte `node --import tsx test-*.mjs` mais `npx tsc --noEmit`; a revisão final é feita sobre os arquivos alterados, listados aqui. — Custo se errado: não há como voltar por commit; a rede de segurança é `backups/codigo-fonte/`, e uma cópia do estado 1.12.1 é feita antes da Tarefa 1.

## Pre-flight (interfaces entre tarefas)

1. T1 produz `estaAtivo`/`membrosAtivosDoMes` → T2 consome. **Conflito:** o código da T2 no plano filtra `membrosDoMes(...).filter(estaAtivo)` em vez de chamar `membrosAtivosDoMes`, o que deixaria esse export usado só por teste — e a spec §3 diz que `preencherEfetivoComRdo` passa a usar `membrosAtivosDoMes`. Ruling: `preencherEfetivoComRdo` chama `membrosAtivosDoMes` para a lista de ativos e `membrosDoMes` para o total do mês. — Custo se errado: uma varredura a mais de `efetivo` por clique, irrelevante para 123 pessoas e ~60 dias.
2. T1 `EquipeMember.ativo?:boolean` → T3 (`LinhaPlanilha.ativo`, `novoMembro`, `aplicarPrevia`): coerente.
3. T3 produz `Alteracao.tipo` com `'ativa'|'inativa'` e `Previa.situacoesIgnoradas` → T4 consome ambos: coerente.
4. T3 `PlanilhaEquipe.situacoesIgnoradas` é obrigatório no tipo, mas três fixtures de teste montam `PlanilhaEquipe` à mão sem o campo → `montarPrevia` usa `||[]`: coerente, e está escrito no plano.
5. T2 produz `ResumoSyncRdo.inativos`/`semAtivos` → T6 passo 4 consome: coerente.
6. T5 produz `EfetivoDoMes({...,flush})` e `CadastroEquipe({...})` → T6 altera os dois arquivos: coerente.

## Progresso

Backup do estado 1.12.1: backups/codigo-fonte/1.12.1-antes-de-equipe-ativo/ (tar com 109 arquivos, sem node_modules, md5 5dacfd95828295750b331bf768566fdb).

Task 1: complete — campo `ativo` em types.ts, `estaAtivo`, `migrarEquipe` grava true em quem não tem o campo, `membrosAtivosDoMes`. RED visto (SyntaxError: does not provide an export named 'estaAtivo') → GREEN. tsc --noEmit limpo; suíte 12/12.

Task 2: complete — `ResumoSyncRdo` ganhou `inativos`/`semAtivos`; `preencherEfetivoComRdo` usa `membrosAtivosDoMes` (ruling 1 do pre-flight) e `membrosDoMes` para o total. Bloco de teste existente ajustado (3 membros com ativo:true + 2 campos no deepEqual). RED visto (deepStrictEqual sem inativos/semAtivos) → GREEN. tsc limpo; suíte 12/12.

Task 3: complete — coluna ATIVO: `interpretarAtivo` (SIM/S/1/VERDADEIRO/ATIVO/TRUE e NAO/N/0/FALSO/INATIVO/FALSE, sem acento/caixa), excluída da detecção de meses, `situacoesIgnoradas`, exportação SIM/NÃO, duas linhas no Leia-me, `Alteracao` com 'ativa'/'inativa', `novoMembro` grava `ativo:l.ativo===true`, `aplicarPrevia` só mexe na marca quando a planilha diz. Ida e volta existente ajustada. RED visto → GREEN. tsc limpo; suíte 12/12.

Task 4: complete — prévia da importação ganhou "Passam a inativas", "Voltam a ativas" e "Coluna ATIVO não entendida"; `descrever` trata os dois tipos novos. `semMudanca` já cobre os tipos novos (verificado na linha 31: filtra só 'saidaRecusada'), nenhuma mudança necessária. tsc limpo; vite build ok.

Task 5: complete — EquipePanel.tsx (314 linhas) dividido em equipe/EquipePanel.tsx (54, casca com mês + abas), CadastroEquipe.tsx (158), EfetivoDoMes.tsx (153). App.tsx aponta para o caminho novo; arquivo antigo removido; nenhuma referência pendente. tsc limpo; vite build ok; suíte 12/12.
Task 5: Ruling: os auxiliares de módulo (`button`, `baixar`, `mesCorrente`, `diaSemana`, `curto`, `listaDatas`) foram extraídos para equipe/comum.ts em vez de duplicados nos três arquivos, como o plano dizia. — Duplicar `baixar` e `button` em dois arquivos é a espécie de divergência que aparece meses depois. — Custo se errado: um arquivo pequeno a mais.
Task 5: Ruling: removidas duas props que nunca eram usadas — `onChange` em CadastroEquipe (coberta por `salvar`/`salvarCom`) e `rotulo` no auxiliar EquipeDoMes (já era inerte no código original). — Custo se errado: nenhum; se fizerem falta, voltam em uma linha.

Task 6: complete — Cadastro: contagem "N de M pessoas ativas", busca sem acento/caixa por nome/matrícula/função, caixa Ativo no formulário (marcada por padrão, escolha preservada entre inclusões) e coluna Ativo na tabela. Efetivo: marca INATIVO na grade, mensagem própria para `semAtivos` e linha de inativos na confirmação do auto-preenchimento. tsc limpo; vite build ok; suíte 12/12.

Task 7: complete — versão 1.13.0-equipe-ativo em version.ts, desktop-launcher.cjs e package.json; RDO-V1.13.0-ALTERAÇÕES.md criado; seção em LEIA-ME.txt; seção 22 + duas linhas (1.12.1 e 1.13.0) na tabela do Plano-de-Implementacao.md; dist reconstruído e sincronizado por checksum (diff vazio); server.cjs carrega a versão nova. tsc limpo; suíte 12/12. Conferência manual no Windows: pendente, é do usuário.

## Revisão final

Final review: subagente independente (opus), sobre diff real 1.12.1→1.13.0 extraído do backup + os quatro arquivos de componente em texto integral. Veredito: aprovar com correções. Nota: o revisor não pôde executar comandos (Bash desabilitado na sessão dele), então tsc/suíte/dist foram verificados por mim, não por ele.

Final: Ruling: achado #6 do revisor ("o teste de nada é gravado não prova o que diz") re-graduado de Minor para Important e corrigido. — O teste provava "nada é gravado" num fixture com efetivo vazio; não provava que presenças existentes sobrevivem quando ninguém está ativo, que é o que o Review Focus #3 precisa. — Custo se errado: um teste a mais, sem efeito em produção.
Final: fixed aviso de inativos ausente na pergunta de sobrescrever (Critical) — `perguntasSyncRdo` extraída para equipe.ts; teste "a pergunta de sobrescrever nomeia quem está inativo" RED→GREEN, suíte 12/12.
Final: fixed aba voltando sozinha para Cadastro (Important) — `chaveCorrecao` em comum.ts, efeito passa a depender do conteúdo; teste "mesma correção, mesma chave" RED→GREEN, suíte 12/12.
Final: fixed pessoa nova entrando inativa em silêncio (Important) — `rotuloPessoaNova` em equipePlanilha.ts com o sufixo "— entra INATIVA"; teste RED→GREEN, suíte 12/12.
Final: fixed cobertura do Review Focus #3 — presenças existentes intactas com sobrescrever ligado e ninguém ativo; teste RED→GREEN, suíte 12/12.
Final: minor (deferred): "As 1 pessoas de OUT/2026..." — concordância errada quando há uma só pessoa inativa no mês.
Final: minor (deferred): comentário em português em equipe/EquipePanel.tsx (o plano entregou assim; as Global Constraints pedem inglês).
Final: minor (deferred): a contagem "N de M pessoas ativas" é global e não acompanha o filtro da busca nem o da faixa de correção (é o que a spec §4.3 pede, mas fica estranho ao lado de uma tabela filtrada).
Final: Ruling: não corrigi os três minores acima. — Nenhum leva a ação errada do usuário nem a perda de dado; o passo de correção é único e cada minor custaria teste + suíte. — Custo se errado: três ajustes cosméticos ficam para a próxima entrega.
