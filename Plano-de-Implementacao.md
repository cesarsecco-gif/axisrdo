# Plano de implementação — Relatório Fotográfico DER/PR

**Versão:** 1.6 • **Data:** 06/10/2026 • **Responsável pela avaliação funcional:** Cesar Augusto Secco • **Aplicativo:** 1.14.0-efetivo-no-rdo

> **Para retomar o desenvolvimento, comece pela seção 21**, que reúne o que está pronto, o que falta conferir no Windows e a fila de trabalho priorizada.

## Andamento — situação em 06/10/2026 (aplicativo 1.14.0)

O aplicativo distribuído é a versão **1.14.0-efetivo-no-rdo**. Desde a primeira entrega da etapa A (1.1.0) foram implementadas as melhorias listadas abaixo. A compilação, a conferência de TypeScript e a suíte de testes automatizados estão aprovadas; a homologação visual e de diálogos no Windows de destino segue pendente, como desde a etapa A.

### Versões entregues e onde estão as alterações

| Versão | Entrega | Registro |
|---|---|---|
| 1.1.0 | Etapa A — IMP-01 a IMP-04 (PDF, rascunhos, backup, diagnóstico) | Seção “primeira entrega da etapa A”, abaixo |
| 1.2.0 | Editor de estampas com OCR offline | Seção 9 |
| 1.3.0 | Tags reutilizáveis e pastas diárias | Seção 10 |
| 1.4.0 | Módulo RDO — diário de obras | Seção 11 |
| 1.4.1 | RDO em lote por pasta | Seção 12 |
| 1.6.0 | Filtro por intervalo e exportação PDF/XLSX | `RDO-V1.6.0-ALTERACOES.md` |
| 1.7.0 | Gerar/Atualizar RDOs a partir do relatório fotográfico | `RDO-V1.7.0-ALTERACOES.md` |
| 1.8.0 | Responsáveis centralizados nas configurações do relatório | `RDO-V1.8.0-ALTERACOES.md` |
| 1.9.1 | Pacote de distribuição com RDO em lote e recursos anteriores | `LEIA-ME.txt` |
| 1.9.2 | Revisão técnica de falhas e correções | Seção 13 |
| 1.9.3 | Gerenciar obras — IMP-07 | Seção 14 |
| 1.9.4 | Excluir pasta com fotos, estrutura `Obras\<nome>`, trocar local da obra, excluir e limitar backups | Seção 15 |
| 1.9.5 a 1.9.7 | Importar obra de backup, pluviometria em uma folha e outras alterações | **Sem registro** — ver seção 16 |
| 1.9.8 | Importação de fotos rápida (OCR opcional) e salvamento agrupado | `RDO-V1.9.8-ALTERAÇÕES.md` e seção 17 |
| 1.10.0 | Gerenciamento de obras redesenhado, com estado "nenhuma obra aberta" | `RDO-V1.10.0-ALTERAÇÕES.md` e seção 18 |
| 1.11.0 | Equipe técnica pelo Excel, com equipe mês a mês e matrícula | `RDO-V1.11.0-ALTERAÇÕES.md` e seção 19 |
| 1.12.0 | Catálogos dos campos repetitivos | `RDO-V1.12.0-ALTERAÇÕES.md` e seção 20 |
| 1.12.1 | Auto-preenchimento do efetivo pelo RDO | `RDO-V1.12.1-ALTERAÇÕES.md` |
| 1.13.0 | Equipe técnica em duas abas e marca de ativo | `RDO-V1.13.0-ALTERAÇÕES.md` e seção 22 |
| 1.14.0 | O efetivo deixa de ser palpite no RDO | `RDO-V1.14.0-ALTERAÇÕES.md` e seção 23 |

Notas: a numeração da distribuição (1.6 a 1.9.1) segue a linha do RDO e não repete a numeração original do plano (1.4.x); não há registro próprio para a versão 1.5. O histórico detalhado das versões 1.6 a 1.8 está nos arquivos `RDO-V*-ALTERACOES.md` da raiz, e as versões 1.9.2 a 1.9.4 nas seções 13 a 15 deste plano.

As versões 1.10.0, 1.11.0 e 1.12.0 têm, além do arquivo de alterações, **especificação e plano de implementação** em `docs/superpowers/specs/` e `docs/superpowers/plans/`. Quem for retomar o trabalho deve ler a especificação da área que vai mexer: ela registra as decisões do usuário e o porquê de cada regra.

### Situação das melhorias da seção 3

| Item | Situação em 1.12.0 |
|---|---|
| IMP-01 a IMP-04 | Entregues na etapa A; correções adicionais aplicadas na 1.9.2 (seção 13) |
| IMP-05 | **Não iniciado.** É o item de maior retorno que resta: tirar as fotos de dentro do `projeto.json` (hoje ~30 MB com 108 fotos) resolve de vez a lentidão de gravação, que a 1.9.8 apenas atenuou |
| IMP-06 | Não iniciado (janela própria do Windows) |
| IMP-07 | **Concluído.** Implementado na 1.9.3, ampliado na 1.9.4 e **redesenhado na 1.10.0**, que entregou as pendências de 14.5 (busca e ordenação) e de 15.5 (mover obra não aberta). Continua pendente apenas exportar o registro de obras entre computadores |
| IMP-08 | **Não iniciado.** Toda foto ainda entra com a data do dia; os recursos 15.7 e 15.8 e a data padrão do grupo contornam, mas não leem a data da própria foto |
| IMP-09 | **Parcial.** A 1.12.0 entregou os catálogos (edição em massa por item) e a 1.11.0 a importação da equipe por planilha; faltam lixeira, desfazer e revisão antes da emissão |
| IMP-10 a IMP-15 | Não iniciados |

### Verificação corrente

- **Testes (12 de 12 aprovados):** `catalogos`, `equipe`, `estampas`, `etapa-a`, `gravacao`, `obras`, `organizacao`, `pastas-backups`, `rdo-lote`, `rdo`, `remover-obra`, `sem-obra`. Rodar dentro de `codigo-fonte` com `node --import tsx test-<nome>.mjs`. `tsc --noEmit` sem erros.
- **Antes de testar:** os testes de servidor rodam contra `dist/server.cjs`; depois de alterar o servidor, rodar `node build-tmp.mjs`. Depois de alterar a interface, `npx vite build`.
- **Distribuição:** `dist` da raiz reconstruído e sincronizado com `codigo-fonte/dist` (conferido por soma de verificação), com a versão 1.12.0 em `codigo-fonte/version.ts`, `desktop-launcher.cjs`, `package.json` e `LEIA-ME.txt`. A versão fica em **um só arquivo** (`codigo-fonte/version.ts`) desde a 1.9.8; só o `desktop-launcher.cjs` mantém cópia própria, e as duas precisam ser mudadas juntas.
- **Pendente em todas as versões:** homologação no Windows de destino — ver a lista consolidada na seção 21.1.

### Ressalvas do checklist da seção 8

Cobertos por teste automatizado: seleção de pasta por caminho e por janela nativa (endpoint), cópia e abertura de projetos sem sobrescrita silenciosa, restauração e verificação de backup, recuperação dos dados após reabertura, rejeição de gravação conflitante entre janelas, geração de PDF do relatório e do RDO com paginação, e identificação de versão, obra e pasta de trabalho. Desde a 1.10.0 entraram também: abrir sem obra nenhuma sem criar projeto sozinho, remover obra apagando só os arquivos do aplicativo, e abrir um projeto cujo catálogo foi gravado por outra versão.

Seguem pendentes de conferência manual no Windows: abertura sem permissão de administrador, PDF com fotografias reais do acervo, atualização sem apagar projetos e as instruções de uso e recuperação. A lista completa do que falta conferir está na seção 21.1.

## Andamento — primeira entrega da etapa A (1.1.0 — registro histórico)

Registro original da primeira entrega, mantido como referência. O aplicativo citado abaixo foi substituído pelas versões descritas na seção anterior.

**Pacote:** Relatorio-Fotografico-DER-PR-Etapa-A.zip • **Aplicativo:** 1.1.0-etapa-a.

O usuário autorizou o início das tarefas. Esta entrega implementa o primeiro conjunto da etapa A; as etapas B a E ainda não foram iniciadas. Os requisitos originais abaixo são mantidos como referência, distinguindo implementação de homologação.

| Item | Implementado nesta entrega | Situação de aceite |
|---|---|---|
| IMP-01 | Progresso por foto/página; cancelamento entre operações; relatório completo ou página atual; qualidade compacta/padrão/alta; estimativa de tamanho durante a geração; fotos sem corte por preenchimento; erro de imagem identificável | Compilação aprovada. Homologação visual com 1, 4, 5 e 40 fotos no Windows pendente; o navegador de testes bloqueou o endereço local. |
| IMP-02 | Rascunhos e fotos em preparação incorporados ao projeto; conservação entre abas; gravação conjunta ao adicionar fotos; aviso ao fechar com gravação pendente; horário do salvamento; nova tentativa; rejeição de edição conflitante entre janelas | Persistência após reinício e rejeição de conflito aprovadas em teste de integração. Fluxo visual e encerramento Windows pendentes. Fechar diretamente o terminal continua fora da proteção do navegador; janela própria pertence à etapa B. |
| IMP-03 | Backup datado da sessão/dia; backup antes de remoção/restauração; verificação SHA-256; restauração assistida; segundo destino; retenção configurável com padrão de 7 diárias e 4 semanais | Testadas cópia secundária, restauração, rejeição de adulteração, preservação do estado anterior e recuperação de projeto corrompido. A segunda cópia usa caminho digitado. Cópias manuais e anteriores a remoções/restaurações não são eliminadas pela retenção automática. |
| IMP-04 | Tela de diagnóstico com versão, pasta, espaço livre, horários e último erro; exportação local sem fotografias; mensagens de gravação e conflito; versão no iniciador | Compilação e endpoint de diagnóstico aprovados. Último erro pertence à sessão atual; histórico persistente de suporte ainda não foi implementado. |

**Evidência técnica:** teste de integração `test-etapa-a.mjs` incluído no código-fonte; conferência TypeScript e compilação de distribuição. Uma falha de escrita foi simulada e preservou o projeto anterior. A pasta e os arquivos de teste são independentes dos dados do usuário.

**Próximo marco:** validar a versão 1.1.0 no Windows com fotografias reais, especialmente PDF, recuperação visual dos rascunhos e seleção de pastas. A etapa A não está marcada como integralmente homologada enquanto esses critérios permanecerem pendentes.

## 1. Objetivo e recomendação principal

Evoluir o aplicativo para uma ferramenta confiável de documentação de obras rodoviárias, com operação integralmente offline, arquivos no computador e emissão de relatórios consistentes.

A sequência recomendada é: **estabilizar PDF e salvamento → proteger e organizar os arquivos → acelerar o cadastro → ampliar os relatórios e o acompanhamento**. Recursos de IA devem vir depois da confiabilidade dos dados e permanecer opcionais.

Este documento especifica melhorias futuras. Não significa que elas já foram implementadas. A elaboração deste plano não autoriza alterações adicionais no aplicativo: cada etapa poderá ser usada como uma solicitação de implementação independente. A situação de cada item já entregue está na seção “Andamento — situação em 01/10/2026”, no início deste documento.

## 2. Situação de partida

Avaliação baseada no código trabalhado nesta conversa e nos problemas apresentados pelo usuário; não houve acesso ao computador ou aos projetos reais do usuário.

Referência do estado inicial do aplicativo, anterior às versões 1.2.0 a 1.9.3. As alterações posteriores estão nas seções 9 a 14.

| Recurso | Situação observada |
|---|---|
| Execução local | Pacote portátil Windows x64, aberto por INICIAR.cmd; depende de manter a janela de execução aberta. |
| Google e IA remota | Removidos do fluxo offline. |
| Pasta de trabalho | Escolha por janela do Windows ou caminho digitado; permite copiar o projeto ou abrir um existente. Janela nativa ainda precisa de confirmação no Windows de destino. |
| Dados e fotos | Projeto JSON com imagens incorporadas; cópias das imagens em subpastas mensais. |
| Proteção existente | Cópia do estado anterior, backup manual, recusa de sobrescrita ao copiar para um destino com projeto e bloqueio de gravação de janela com pasta desatualizada. |
| Relatórios | Filtros, organização mensal, inclusão/exclusão de fotos e quatro fotos por página. |
| PDF | Correção de compatibilidade preparada: componente atualizado, carregamento das imagens e exportação de todas as páginas. A geração final com fotos no Windows ainda precisa de validação. |
| Limitações | JSON completo regravado nas alterações; imagens duplicadas entre JSON e disco; rascunhos de importação em memória; ausência de histórico completo e de instalador integrado. |

## 3. Prioridades

**P0:** confiabilidade básica; **P1:** melhoria relevante de operação; **P2:** expansão após estabilização. Esforço relativo: pequeno, médio ou grande; não representa prazo contratado.

| ID | Melhoria | Prioridade | Esforço | Dependência principal |
|---|---|---|---|---|
| IMP-01 | Homologar e tornar previsível a exportação PDF | P0 | Médio | Pacote com correção do PDF |
| IMP-02 | Proteger rascunhos e impedir encerramento com gravação pendente | P0 | Médio | Estado de salvamento confiável |
| IMP-03 | Backups automáticos e recuperação assistida | P0 | Médio | Inventário consistente de dados e imagens |
| IMP-04 | Diagnóstico local e mensagens de erro úteis | P0 | Pequeno | Nenhuma |
| IMP-05 | Separar banco de dados, originais e miniaturas | P1 | Grande | IMP-02 e IMP-03 |
| IMP-06 | Aplicativo Windows com janela própria e atualização segura | P1 | Grande | IMP-04; formato de dados versionado |
| IMP-07 | Cadastro de obras e projetos recentes | P1 | Médio | IMP-03; preferencialmente IMP-05 |
| IMP-08 | Importação com EXIF, orientação e detecção de duplicatas | P1 | Médio | Identificação estável das imagens |
| IMP-09 | Edição em lote, modelos de descrição e validações | P1 | Médio | Campos e regras definidos |
| IMP-10 | Padronização técnica por disciplina e localização | P1 | Médio | IMP-09 |
| IMP-11 | Modelos de relatório, marcas reais e versões de emissão | P1 | Médio | IMP-01 e cadastro da obra |
| IMP-12 | Painel de cobertura e pendências fotográficas | P2 | Médio | IMP-10 |
| IMP-13 | Exportação estruturada e vínculo com planejamento | P2 | Médio | IMP-10 |
| IMP-14 | OCR offline para carimbos NoteCam/GPS | P2 | Grande | IMP-08 e conjunto de fotos para avaliação |
| IMP-15 | Localização visual e comparativo antes/depois | P2 | Médio/grande | Coordenadas e identificação de locais |

## 4. Especificação das melhorias

### IMP-01 — Exportação PDF confiável

**Implementar:** indicação de progresso por página, cancelamento seguro, identificação de imagem inválida e distinção clara entre “exportar relatório completo” e “exportar página atual”. Fixar tamanho A4, margens, proporção das fotos e quebras de página. Não cortar carimbos de data/GPS para preencher uma moldura. Oferecer qualidade de imagem com estimativa aproximada do tamanho final.

**Critérios de aceite:** gerar relatórios com 1, 4, 5 e 40 fotos; conferir número de páginas, ordem, caracteres acentuados, fotos verticais/horizontais e descrições extensas. Nenhuma foto ou linha pode desaparecer silenciosamente. Uma imagem corrompida deve ser identificada antes da emissão. O modo de visualização não pode limitar a exportação completa. Repetir a geração totalmente sem internet no Windows de destino.

**Decisão técnica:** manter a correção atual como primeira abordagem. Se a captura visual continuar instável, avaliar um gerador de PDF com layout próprio; essa troca exige comparar o resultado com um modelo aprovado, pois pode alterar a aparência.

### IMP-02 — Rascunhos, salvamento e encerramento

**Implementar:** persistir a fila de fotos ainda não adicionadas ao relatório e os campos já preenchidos. Avisar ao trocar de aba ou de projeto com rascunho. Serializar gravações e exibir “Salvando”, “Salvo” e “Falha ao salvar”, com horário da última confirmação. Oferecer nova tentativa. Bloquear ou coordenar uma segunda instância de edição do mesmo projeto.

**Critérios de aceite:** importar dez fotos, preencher parte das descrições, fechar e reabrir: o rascunho deve ser recuperado. Simular falha de gravação e verificar que não aparece “Salvo”. Alterações concorrentes devem ser recusadas ou conciliadas, nunca substituídas silenciosamente. Na janela própria futura, só encerrar após concluir a gravação ou após escolha explícita do usuário.

### IMP-03 — Backup automático e restauração assistida

**Implementar:** cópias datadas ao iniciar uma sessão com alterações e antes de migração, restauração ou exclusão relevante. Retenção inicial proposta: sete cópias diárias e quatro semanais, configurável conforme espaço disponível. Permitir escolher um segundo destino. Verificar integridade e apresentar data, obra e quantidade de fotos antes de restaurar. Preservar o estado atual antes da substituição.

**Critérios de aceite:** restaurar um backup em outra pasta e conferir metadados e imagens. Arquivo incompleto ou corrompido deve ser recusado. Uma falha no disco de destino não pode apagar o projeto original. Cópia no mesmo disco deve ser identificada como proteção contra alterações, sem prometer proteção contra falha física do disco.

### IMP-04 — Diagnóstico e suporte

**Implementar:** tela “Sobre e diagnóstico” com versão do aplicativo, pasta ativa, espaço disponível, último salvamento e último backup. Mensagens específicas para porta ocupada, arquivo ausente, pasta sem permissão e imagem inválida. Criar botão para exportar um relatório técnico local, sem fotografias e sem credenciais por padrão.

**Critérios de aceite:** reproduzir cada falha e apresentar uma ação compreensível ao usuário. O registro de erro deve permitir identificar o componente responsável, sem expor o projeto inteiro. Mostrar a versão também na janela de inicialização para evitar executar um pacote antigo por engano.

### IMP-05 — Armazenamento eficiente e migração

**Implementar:** avaliar SQLite local para os registros e manter fotografias como arquivos separados, referenciados por identificadores e caminhos relativos. Gerar miniaturas para navegação. Preservar originais e orientação; imagens reduzidas serão derivadas, não substitutas do original. Gravar somente o registro alterado.

**Organização proposta:** banco do projeto; diretório de originais; miniaturas regeneráveis; relatórios emitidos; backups e manifesto da versão do formato. Os diretórios mensais podem ser uma organização de exportação, sem duplicar o original para cada alteração de nome.

**Migração:** criar backup do JSON atual; extrair imagens; conferir hashes e contagens; migrar metadados para uma área temporária; validar referências; somente então ativar o novo formato. Manter os arquivos anteriores disponíveis para retorno. Interromper a migração se uma etapa falhar.

**Critérios de aceite:** mover a pasta completa para outro local sem perder as referências. Editar a descrição de uma foto sem regravar todas as imagens. Medir abertura, memória e navegação com 100, 1.000 e 5.000 registros em máquina de referência documentada. Os tempos serão medidos antes de assumir metas comerciais.

### IMP-06 — Experiência de aplicativo Windows

**Implementar:** janela própria, atalho e inicialização sem terminal exposto. Integrar o seletor nativo de pastas, prevenção de segunda instância e encerramento seguro. Separar atualização do programa e dados de trabalho; disponibilizar atualização por pacote local, sem internet obrigatória.

**Critérios de aceite:** abrir por dois cliques em Windows 10/11 x64 com conta comum. Atualizar o aplicativo sem alterar os projetos. Pasta com espaços e acentos deve funcionar. O encerramento deve parar o processo do aplicativo, preservando serviços de outros programas.

**Decisão técnica:** comparar alternativas de empacotamento após a etapa de estabilidade. Não escolher uma tecnologia apenas para ocultar a janela atual; validar tamanho, dependências, distribuição e compatibilidade com o ambiente de TI do usuário.

### IMP-07 — Obras e projetos recentes

**Situação (1.9.3): implementado.** Ver a seção 14, com modelo, API, interface, verificação e pendências remanescentes (14.5).

**Implementar:** ficha de obra com contrato, rodovia, trecho, empresa, fiscalização e responsáveis; lista de projetos recentes com caminho completo e último acesso. Manter a hierarquia obra → período → registros. Ao copiar, oferecer nome de identificação e informar claramente qual cópia ficará ativa.

**Critérios de aceite:** alternar entre duas obras sem misturar fotos, cabeçalhos ou responsáveis. Caminho indisponível deve ser sinalizado, sem criação automática de um projeto vazio no lugar do anterior.

### IMP-08 — Importação assistida e duplicatas

**Implementar:** ler data de captura, orientação e GPS do EXIF quando presentes; distinguir metadados da fotografia de data de modificação do arquivo e de data da importação. Detectar duplicatas exatas por hash, apresentando manter, ignorar ou vincular o registro existente. Permitir rotação e conferir formatos suportados antes da importação.

**Critérios de aceite:** importar a mesma imagem com outro nome e detectar a duplicata. Fotografia sem data não pode receber a data atual como se fosse a data comprovada da captura. Nunca inventar coordenadas. Preservar original, fonte do dado e eventual correção manual.

### IMP-09 — Edição em lote e qualidade do cadastro

**Implementar:** aplicar rodovia, trecho, disciplina, lado e pasta a várias fotos; modelos de descrição editáveis; desfazer alterações recentes; lixeira para registros excluídos. Validar datas, campos mínimos e localização. Apresentar uma revisão antes de emitir o relatório.

**Critérios de aceite:** editar vinte fotos em lote e mostrar um resumo antes da aplicação. Desfazer sem perder imagens. Excluir um registro não deve apagar definitivamente o original sem uma ação separada. Distinguir campos obrigatórios de campos opcionais, conforme modelo aprovado pelo usuário.

### IMP-10 — Identificação técnica dos serviços

**Implementar:** campos estruturados de disciplina, serviço, estaca inicial/final, complemento, lado e identificação da estrutura. Exemplos de classificação: pavimentação, drenagem, terraplenagem, contenções e sinalização; identificação de PV, bueiro, muro ou segmento quando aplicável. Permitir vincular código de atividade/EAP e item contratual, sem inferir quantitativos a partir de fotografias.

**Critérios de aceite:** filtrar um mesmo local por datas e serviços; manter texto livre para situações não previstas. Ordenação por estaca deve considerar o valor numérico. Qualquer conversão de estaca para distância precisa do intervalo de estaqueamento explicitamente configurado para aquela obra.

### IMP-11 — Relatórios, identidade e emissão

**Implementar:** modelos de 2, 4 e 6 fotos por página; marcas fornecidas pelo usuário; cabeçalho, rodapé, responsáveis e legendas configuráveis. Salvar perfil do relatório por obra. Registrar número de emissão, data, revisão e conjunto exato de fotos utilizadas; preservar cópia do PDF emitido.

**Critérios de aceite:** comparar com um relatório de referência aprovado pelo usuário. Não substituir marcas institucionais por símbolos aproximados. Alterar o cadastro posteriormente não deve mudar um PDF já emitido. Indicar expressamente que inserir nome ou imagem de assinatura não equivale a implementar assinatura digital certificada.

### IMP-12 — Painel de acompanhamento documental

**Implementar:** indicadores de fotos por período/disciplina, registros sem revisão, datas sem documentação, locais acompanhados e relatórios emitidos. Mostrar também a quantidade de registros incluídos e excluídos da emissão atual.

**Critérios de aceite:** cada indicador deve informar definição, período e filtro, permitindo abrir os registros que o compõem. Quantidade de fotos mede documentação, não produção, produtividade ou avanço físico. Esses indicadores de obra só poderão ser calculados após incorporar quantidades, unidades, planejamento e recursos efetivamente utilizados.

### IMP-13 — Exportação e vínculo com planejamento

**Implementar:** exportar uma linha por registro em CSV e, posteriormente, XLSX; incluir identificador estável, data, serviço, localização, disciplina, EAP e referência relativa da imagem. Importar cadastros de serviços e atividades com prévia de validação e indicação de duplicatas.

**Critérios de aceite:** abrir a exportação com acentos e datas corretos no Excel usado pelo usuário. Valores textuais não podem virar fórmulas executáveis. A associação com uma atividade de planejamento deve ser explícita e reversível; nenhuma foto comprova, sozinha, uma quantidade executada.

### IMP-14 — OCR offline de carimbos

**Implementar:** reconhecimento local de textos NoteCam/GPS, com área do carimbo selecionável, texto original reconhecido e proposta de preenchimento. Recursos e modelos devem vir no pacote ou ser importados previamente; não depender de downloads durante o trabalho de campo.

**Critérios de aceite:** avaliar em um conjunto autorizado de fotografias reais com diferentes resoluções e carimbos. Medir acerto por campo. Dados com baixa confiança devem permanecer pendentes. A confirmação humana é necessária antes de tratar a informação como revisada. Reconhecimento do serviço executado por IA visual será uma avaliação separada, não uma consequência automática do OCR.

### IMP-15 — Localização e antes/depois

**Implementar:** comparar fotografias do mesmo ponto e montar sequência temporal. Começar por diagrama linear de estacas/segmentos, que funciona sem mapas externos. Mapa geográfico offline será opcional, mediante base cartográfica local com direito de uso e referência espacial conhecida.

**Critérios de aceite:** mostrar origem e precisão disponível das coordenadas. Não localizar automaticamente uma fotografia sem dados suficientes. Uma comparação antes/depois precisa explicitar datas e local; não atribuir evolução técnica apenas por semelhança visual.

## 5. Modelo de dados proposto

| Entidade | Campos essenciais |
|---|---|
| Obra | ID, nome, contrato, rodovia, trecho, responsáveis, dados da empresa e perfil de relatório |
| Período | ID, obra, nome, mês/ano ou intervalo de datas |
| Imagem | ID, hash, nome original, caminho relativo, formato, dimensões, tamanho e metadados de captura |
| Registro | ID, imagem, período, data informada, origem da data, descrição, disciplina, localização, atividade e estado de revisão |
| Emissão | ID, obra/período, revisão, data, perfil, lista ordenada de registros e caminho do PDF |
| Histórico | Registro afetado, operação, instante, valor anterior e identificação local do operador |
| Backup | Data, versão do formato, destino, tamanho e resultado da verificação |

Os nomes técnicos atuais de campos ligados ao Drive poderão ser migrados para nomes locais. A migração deve manter os identificadores e vínculos das pastas existentes; apenas renomear campos não pode separar fotos de seus períodos.

**Situação em 1.12.0:** além do que está descrito abaixo para a 1.9.3, o projeto ganhou três estruturas novas, todas dentro de `projeto.json`:

- **Equipe mensal (1.11.0):** cada pessoa tem `matricula`, `meses` (mês → equipe naquele mês) e `historicoFuncao` (a função anterior e a partir de quando a nova vale). A presença diária continua ligada ao código interno da pessoa, e não ao nome, por isso corrigir o nome nunca perde presença.
- **Catálogos (1.12.0):** `config.catalogos` guarda onze listas de textos reaproveitáveis. Não são entidades novas: são o vocabulário dos campos que já existem.
- **Estado sem obra aberta (1.10.0):** `pasta-trabalho.json` aceita `{"path": null}`. As rotas que leem ou gravam projeto respondem 409 nesse estado e nunca criam projeto sozinhas.

As entidades **Período**, **Registro**, **Emissão** e **Histórico** continuam embutidas no `projeto.json` e não foram separadas (IMP-05).

**Situação em 1.9.3:** a entidade **Obra** foi implementada em forma reduzida no registro `obras.json` (id, nome, caminho, criação, último acesso, ficha, contagem de fotos/rascunhos e último salvamento — seção 14), mantendo cada obra em sua própria pasta com `projeto.json`, `fotos/` e `backups/`. As entidades **Período**, **Registro**, **Emissão** e **Histórico** continuam embutidas no `projeto.json` e não foram separadas (IMP-05).

## 6. Etapas e critérios de liberação

| Etapa | Entrega | Condição para avançar |
|---|---|---|
| A — Estabilização | IMP-01 a IMP-04 | PDF validado no Windows; rascunhos recuperáveis; restauração de backup demonstrada |
| B — Estrutura local | IMP-05 a IMP-07 | Migração sem perdas, projetos independentes, atualização preservando dados |
| C — Operação técnica | IMP-08 a IMP-11 | Importação e edição em lote consistentes; modelo de relatório aprovado |
| D — Acompanhamento | IMP-12 e IMP-13 | Indicadores conciliados com os registros e exportação conferida |
| E — Recursos assistidos | IMP-14 e IMP-15 | Qualidade medida em fotos reais e funcionamento sem rede demonstrado |

As estimativas de prazo devem ser elaboradas após a validação da etapa A, informando tamanho típico do acervo, configuração do PC, formato de relatório de referência e disponibilidade para testes. Não há compromisso de prazo neste documento.

**Situação em 1.12.0:** os itens IMP-01 a IMP-04 da etapa A foram entregues e receberam correções na 1.9.2. **IMP-07 foi concluído** (1.9.3, 1.9.4 e o redesenho da 1.10.0), fora da ordem prevista para a etapa B. **IMP-05 e IMP-06 continuam pendentes**, portanto a etapa B **não** está concluída. Da etapa C, a 1.11.0 e a 1.12.0 entregaram parte do IMP-09 (edição em massa pela planilha da equipe e pelos catálogos); IMP-08, IMP-10 e IMP-11 não foram iniciados. As etapas D e E não foram iniciadas.

Vale registrar que a ordem das etapas deixou de ser seguida: as entregas passaram a atender pedidos do usuário conforme surgiam. Isso não é um problema em si, mas explica por que a etapa B segue aberta enquanto partes da C já existem.

## 7. Regras para implementação

- Preservar operação offline, pasta de trabalho e compatibilidade com projetos existentes.
- Não reintroduzir Google, contas externas, telemetria ou upload de fotografias como requisito.
- Nunca migrar dados sem backup, validação e estratégia de retorno.
- Não apagar originais como consequência automática de filtros, exclusões do relatório ou limpeza de miniaturas.
- Testar falhas reais: disco sem espaço, permissão negada, pasta movida, arquivo corrompido e encerramento durante gravação.
- Documentar a versão e as alterações de cada pacote; manter o código-fonte correspondente à distribuição.
- Usar nomes simples na interface e conservar as informações técnicas relevantes para o relatório.
- Colaboração simultânea em rede fica fora deste plano inicial. Não apresentar uma pasta compartilhada como solução multiusuário sem controle de concorrência e arquitetura própria.

## 8. Checklist de aceite da próxima versão

Situação por item na seção “Ressalvas do checklist da seção 8”, no início deste documento, e a lista completa do que falta conferir na seção 21.1.

- [ ] Abre no Windows sem internet e sem permissões de administrador.
- [ ] Identifica claramente versão, obra e pasta de trabalho.
- [ ] Recupera os dados e os rascunhos após reabertura.
- [ ] Não confirma salvamento quando há erro de gravação.
- [ ] Seleciona pasta por janela nativa e por caminho digitado.
- [ ] Copia e abre projetos sem sobrescrever dados de forma silenciosa.
- [ ] Gera PDF de várias páginas com fotos reais, sem cortes indevidos.
- [ ] Mantém ordem, legendas, período e vínculo das fotos com suas pastas.
- [ ] Restaura um backup em outra pasta e confere sua integridade.
- [ ] Atualiza o programa sem apagar projetos.
- [ ] Tem instruções de uso e procedimento de recuperação.

## 9. Editor de estampas — versão 1.2.0

Implementado a pedido do usuário:

- Faixa externa inferior com descrição corrigida, sem alterar os pixels decodificados da fotografia. A estampa recebida permanece visível.
- Substituição dentro de um retângulo selecionado: reconstrução aproximada por interpolação dos contornos e aplicação do novo texto. Não recupera o fundo real e pode apagar detalhes dentro da seleção.
- Assistente de leitura OCR em português (Tesseract), com arquivos locais incluídos para operação offline, sem conta ou envio da fotografia.
- Revisão manual do texto, tamanho da fonte, prévia antes/depois e salvamento como cópia PNG.
- Original preservado, vínculo com a foto de origem e registro do modo, texto, região e data da edição. A cópia começa fora do relatório e pode ser incluída após revisão.

Verificação: TypeScript, compilação, teste de leitura OCR com modelo local e imagem sintética; comparação de pixels para os dois modos; rejeição de texto que não cabe. A reconstrução é um algoritmo local, não um modelo generativo de IA.

Pendente: homologação interativa no Windows e avaliação do OCR com as fotos reais do acervo; os demais itens e critérios de aceite anteriores continuam válidos. A criação deste editor não conclui automaticamente as etapas A a E.

## 10. Tags reutilizáveis e pastas diárias — versão 1.3.0

- Tags editáveis por foto, várias por registro, criação de descrições e catálogo persistente no projeto. A categoria legada permanece como tag inicial, até ser alterada pelo usuário.
- Edição do nome somente na foto escolhida; tags anteriores continuam disponíveis no catálogo. Remoção individual ou de todas as tags da foto, sem afetar outros registros.
- Filtro por qualquer tag e opção Sem tags, em cartões e tabela.
- Navegação por subpastas diárias dentro da pasta principal; datas completas exibidas para diferenciar meses quando Todas as Pastas está selecionado.
- Cópias locais organizadas em fotos/09_SETEMBRO_2026/12, por exemplo. Nomes de pastas repetidos recebem um sufixo para evitar colisão. Datas legadas inválidas ficam em Sem-data.
- Alterar a data remaneja a cópia para o novo dia, mantendo a pasta principal escolhida. A estampa da imagem não é usada automaticamente como fonte da data.
- Migração das cópias antigas reconhecidas pelo app. A cópia antiga só é removida após gravar o projeto e conferir os bytes; arquivos modificados externamente são preservados com aviso. Exclusões de registros continuam preservando as cópias no disco.
- Testes aprovados: persistência de tags e catálogo após reinício; datas e ano bissexto; migração da organização anterior; movimento entre dias; preservação de outras fotos; falha de gravação sem exclusão antecipada; preservação de cópias modificadas externamente. Validação interativa no Windows permanece pendente.

## 11. Módulo RDO — versão 1.4.0

O usuário considerou o módulo de relatório fotográfico concluído na versão 1.3.0. Os componentes de importação, gestão, estampas, tags, pastas e emissão fotográfica foram preservados nesta revisão. O novo módulo está na aba 4. RDO — Diário de obras.

Regras implementadas conforme alinhamento:

- Um RDO por data dentro do projeto, com numeração sequencial a partir de 1, por ordem de criação. Continuação identifica página e total, mantendo o mesmo número do RDO.
- Serviços originados exclusivamente das fotos marcadas para o relatório fotográfico daquela data, na ordem cronológica usada pelo relatório. Descrições iguais são consolidadas, com comparação sem diferença entre maiúsculas, minúsculas ou espaços repetidos. O texto é apresentado em maiúsculas.
- Correções de serviço são feitas nas fotos e refletidas automaticamente no RDO. Mudanças que afetem um RDO finalizado o devolvem a rascunho para conferência. PDFs previamente baixados devem ser gerados novamente.
- Configurações próprias de empresa, contrato, supervisora, preposto, três responsáveis e observações padrão da supervisora e fiscalização, aplicadas a todos os RDOs do projeto. Valores iniciais extraídos do modelo para conferência.
- Clima manual; quantidade de profissionais por seleção/digitação; indicação de suficiência e presença do preposto; dia da semana calculado pela data.
- Observações da contratada editáveis por dia, para serviços adicionais e justificativas. Dias sem fotos podem ser criados e exigem um motivo antes da finalização.
- Estados Rascunho e Finalizado, reabertura manual e validação dos campos e do PDF antes de finalizar. Assinaturas preenchidas com nomes configurados, mantendo o espaço para assinatura posterior.
- PDF separado, gerado localmente sem Excel, internet ou captura de tela. Primeira página baseada no modelo A4 fornecido, com os 19 espaços de serviços e demais campos. Continuação dos serviços repete o cabeçalho e usa a área restante da folha. Observações muito extensas recebem continuação identificada, sem truncamento ou redução da fonte.
- PDF com texto selecionável, logotipos extraídos do modelo e fontes incorporadas. Usa Arial do Windows quando disponível, com fonte compatível incluída como alternativa. O campo Código do clima permanece em branco, como no exemplo, sem inventar códigos.
- RDO integrado ao projeto, salvamento automático, controle de concorrência, backup, restauração e troca de pasta existentes.

Validações realizadas: compilação e TypeScript; ordem e consolidação de descrições; alterações de data, texto, inclusão e exclusão de fontes; estados e reabertura; sequência e duplicidade de datas; dias sem fotos; geração com 0, 1, 19, 20, 68 e 69 serviços; descrições e observações extensas; persistência após reinício e restauração completa por backup; proteção contra janela desatualizada. PDFs renderizados e inspecionados visualmente, incluindo as páginas de continuação, e limites de texto conferidos. Os testes anteriores de salvamento, backup, tags e pastas passaram.

Pendente: homologação da interface e dos diálogos no Windows do usuário, incluindo a prévia no navegador escolhido e as fontes disponíveis naquele PC.

## 12. RDO em lote por pasta — versão 1.4.1

- Seleção da pasta e criação, em uma única operação, dos rascunhos de todas as datas com fotos marcadas e válidas. Numeração dos novos registros em ordem de data, a partir do próximo número disponível.
- Valores iniciais comuns para clima, profissionais, suficiência, presença e observações, revisáveis individualmente. Campos podem ficar pendentes, sem inventar informações.
- Opção de incluir dias sem fotos entre a primeira e a última data marcada da pasta; o motivo continua sendo preenchido manualmente.
- Registros existentes são preservados, mesmo quando são de outra pasta ou foram criados individualmente. Datas ignoradas são apresentadas ao usuário. Permanece a regra de um RDO por data no projeto.
- Novos RDOs em lote vinculam seus serviços à pasta escolhida. RDOs individuais anteriores conservam o vínculo original por data com todas as pastas, identificado na tela.
- Download dos PDFs da pasta em um ZIP, mantendo identificação de rascunhos. Inclui os RDOs vinculados à pasta e os individuais existentes nas datas de suas fotos. Não finaliza registros automaticamente.
- Verificação: lotes repetidos não duplicam registros nem sobrescrevem correções; fotos desmarcadas e datas inválidas não geram dias; separação de serviços entre pastas; intervalo sem fotos; persistência e ZIP com PDFs. Testes de RDO anteriores mantidos.

## 13. Revisão técnica de falhas e correções — versão 1.9.2

Revisão do código-fonte completo (frontend, painéis, servidor e exportações) com foco em falhas reais de uso. Nenhuma mudança de funcionalidade nova: apenas correções, proteções e consistência.

### 13.1 Achados principais

- **Distribuição desatualizada em relação ao código-fonte.** Os `dist` da raiz e de `codigo-fonte/dist` eram builds de 20/09 com `VERSION = 1.4.1-rdo-lote`, enquanto o código-fonte declarava 1.9.1. Ou seja, o app executado era anterior às versões 1.6–1.9 descritas neste plano e nos `RDO-V*-ALTERACOES.md`. Reconstruído (`vite build` + esbuild do `server.ts`) e sincronizado com a raiz.
- **Parâmetro opcional quebrava um teste pré-existente.** `syncRdo(...)` recebia `pluviometria` sem default, gerando erro em `test-rdo.mjs`. Corrigido com parâmetro opcional e guards.
- **Versionamento divergente entre build, launcher e testes.** `desktop-launcher.cjs` exigia uma versão exata e `test-etapa-a.mjs` comparava contra string fixa `1.4.1-rdo-lote`. Agora o teste importa `VERSION` do código e o launcher avisa quando existe sessão aberta com outra versão, em vez de tentar iniciar um segundo servidor na porta ocupada.
- **Definição de `NODE_ENV` no build desktop.** O comando do `package.json` não aplicava o `--define` por causa do escape no shell, deixando no bundle o caminho de desenvolvimento do Vite. Build desktop refeito via API do esbuild com `define` correto (bundle menor e somente produção).

### 13.2 Correções no aplicativo

- **PDF do RDO** (`rdoPdf.ts`): o campo reduz a fonte (piso 5pt) antes de lançar erro de estouro; descrições longas não derrubam mais a geração.
- **Configurações do RDO** (`SettingsModal.tsx`): incluídos os campos que só existiam na planilha modelo (empresa, contrato, supervisora, observações da supervisora/fiscal e do inspetor) com `maxLength` compatível com a largura medida no PDF — antes era possível digitar texto que o PDF rejeitava.
- **Subtítulo do relatório** (`organization.ts`, `ReportViewer.tsx`): helper `reportSubtitle(rodovia, trecho, periodo)` e regex `AUTO_SUBTITLE`; subtítulo digitado não é sobrescrito ao trocar de relatório; slots vazios do cabeçalho usam `photosPerPage` corretamente; o `useEffect` cancela o PDF em andamento ao sair da tela.
- **Importação de fotos** (`PhotoUploader.tsx`): trava de reentrância, commit parcial com relatório dos arquivos ignorados (o lote inteiro deixava de importar por um erro), data/hora sem `NaN`, `value` do input de arquivo limpo após uso e subtítulos automáticos.
- **Busca de serviços** (`PhotoList.tsx`): guards para campos vazios e paginação por `photosPerPage`.
- **Painéis** (`Equipe`, `Equipamentos`, `Pluviometria`, `AcoesCorretivas`): `await flush()` com `try`/`catch` — antes uma falha de gravação era promovida a erro não tratado; normalização de configurações salvas por versões antigas (ausência de chaves não quebrava a tela).
- **Equipamentos**: renomear item leva o histórico de efetivo junto (antes o histórico era perdido); remoção limpa registros órfãs; anotações tipadas como `Record<string, number>` (evitava erro de compilação).
- **Pluviometria**: importação de CSV valida data (usa `photoDate`), precipitação finita entre 0 e 5000 mm e informa a contagem; confirmação antes de sobrescrever; gráfico com escala máxima segura; `fetchApi` verifica `res.ok`; limites `min`/`max` nos inputs.
- **Painel de confiabilidade**: verifica `res.ok` com fallback da mensagem HTTP em vez de interpretar HTML como JSON (travava com erro silencioso); limites de retenção com clamp.
- **XLSX** (`xlsxWriter.ts`): remove caracteres ilegais de XML e sanitiza/deduplica nomes de aba.
- **Legenda e exportação**: filtros e legendas derivados da paginação real, evitando "página 1 de 1" com fotos escondidas.

### 13.3 Verificação

- `tsc --noEmit` sem erros (observação: `@types/react`/`@types/react-dom` não instalados — ver 13.4).
- Testes passando: `test-organizacao.mjs`, `test-etapa-a.mjs`, `test-rdo.mjs`, `test-rdo-lote.mjs`, `test-estampas.mjs`.
- Bundle reconstruído e distribuição sincronizada; versão unificada em 1.9.2 (`reliability.ts`, `App.tsx`, `package.json`, `desktop-launcher.cjs`, `LEIA-ME.txt`).

### 13.4 Melhorias pendentes (não aplicadas nesta revisão)

- Instalar `@types/react` e `@types/react-dom` e ligar `strict`/`noUnusedLocals`: sem eles a checagem dos `.tsx` é praticamente ineficaz (muitos dos problemas acima passariam em compilação).
- Error boundary global no React e tratamento de erro de renderização.
- Migrar o histórico de efetivo registrado com o nome antigo quando o item da equipe é renomeado (hoje só equipamentos migram o histórico).
- Padronizar o formato de testes (asserts de mensagem) e adicionar teste de regressão para o limite de campos do PDF.
- Automatizar a sincronização `codigo-fonte/dist` → `dist` da raiz em um único script de publicação, evitando repetir o desalinhamento da 13.1.

## 14. Gerenciar obras — versão 1.9.3 (IMP-07)

Implementação da melhoria **IMP-07 — Obras e projetos recentes**, permitindo administrar várias obras no mesmo aplicativo.

### 14.1 Modelo

- **Uma obra = uma pasta de trabalho própria**, com o seu `projeto.json`, `fotos/`, `backups/` e `backup-config.json`. Nada é compartilhado entre obras.
- **Registro de obras** em `obras.json`, na pasta de dados do aplicativo (`DER_DATA_DIR`/`LOCALAPPDATA`): id, nome, caminho, criação, último acesso, ficha, contagem de fotos/rascunhos e último salvamento. O registro é somente de histórico — nunca apaga arquivos do disco.
- **Ficha da obra** extraída automaticamente de cada salvamento: contrato, rodovia, trecho, empresa, fiscalização (engenheiro da supervisora/fiscal) e responsável. Assim a lista abre rápido mesmo com projetos grandes, sem reler o `projeto.json` de cada obra.
- O registro é atualizado em três pontos: salvamento do projeto, troca de pasta (inclusive pelo fluxo legado) e criação/abertura de obra.

### 14.2 API

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/api/obras` | Lista obras com ficha, último acesso, fotos, `available` e `hasProject`, mais a obra ativa |
| POST | `/api/obras` | Cria/registra obra: `mode` = `new` (projeto vazio), `copy` (copia a obra atual) ou `open` (projeto existente); `open:true` ativa em seguida |
| POST | `/api/obras/:id/open` | Troca a obra ativa (valida revisão da pasta, disponibilidade e existência de `projeto.json`) |
| PUT | `/api/obras/:id` | Renomeia a obra |
| DELETE | `/api/obras/:id` | Remove do histórico (bloqueado para a obra em uso; disco preservado) |

Regras de segurança mantidas: caminho absoluto, deduplicação por caminho, recusa de sobrescrever `projeto.json` existente, trava de revisão antes de trocar, escrita atômica e nenhuma criação automática de projeto quando a pasta está ausente.

### 14.3 Interface

- Botão **Obras** na barra superior (substitui o antigo "Abrir pasta") abre `ObrasModal` com a lista, a obra ativa destacada, ficha, caminho, último acesso, fotos e avisos de **Pasta indisponível** / **Sem projeto**.
- Ações por obra: **Abrir** (espera o salvamento e recarrega a aplicação), **Renomear** e **Remover do histórico** com confirmação explícita de que os arquivos são preservados.
- Formulário **Adicionar obra**: nome, pasta (campo manual ou seletor do Windows) e os três modos, com a opção **Abrir esta obra em seguida**; a ajuda deixa claro qual cópia fica ativa e que a pasta atual é preservada.
- Rodapé da barra lateral mostra o nome da obra aberta acima do caminho da pasta.

### 14.4 Verificação

- `test-obras.mjs`: registro inicial; ficha preenchida após salvar; criação nova e por cópia; abertura isolada (a obra nova não herda fotos nem ficha); retorno sem misturar dados; pasta removida sinalizada como indisponível e troca recusada sem criar `projeto.json` no lugar; remoção do histórico sem apagar disco; validações de nome, caminho, modo e duplicidade; renomear; e compatibilidade com a troca legada de pasta.
- Suíte completa (6 testes) e `tsc --noEmit` aprovados; distribuição reconstruída e sincronizada com a raiz.

### 14.5 Pendências do IMP-07

- Painel de obras recentes em tela cheia com ordenação por último acesso e busca.
- Ordenação/filtro por status (ativa, indisponível) e contagem de backups por obra.
- Exportar/importar o registro de obras entre computadores (hoje o registro fica em uma única pasta de dados).

## 15. Excluir pasta com fotos, estrutura de repositório e administrar backups — versão 1.9.4

Três pedidos do usuário, atendidos com confirmação explícita em todos os casos: apagar a pasta de fotos junto com seus registros, mudar a pasta da obra inteira seguindo a estrutura `Obras\<nome>` e controlar a quantidade de backups.

### 15.1 Excluir pasta de fotos (apaga cópias e registros)

O fluxo de **Excluir Pasta**, em *Importar fotos → Editar Dados da Pasta*, deixou de recusar pastas com fotos:

1. O aviso informa o nome da pasta e a quantidade de fotos e lista as consequências (pasta sai da lista, registros saem do projeto, cópias são apagadas do disco, backup antes da gravação).
2. Confirmado, o app sincroniza o salvamento pendente (`flush`), chama `POST /api/photos/delete-copies` e só então remove a pasta das opções e as fotos de `photos` (novas props `flush`, `headers` e `onDeletePhotos` em `PhotoUploader`).
3. Se alguma cópia não puder ser apagada, o servidor devolve a lista em `failed`; o usuário pode optar por concluir a remoção das mesmo (as cópias remanescentes ficam órfãs, sem registro) ou abortar.
4. A gravação seguinte dispara o backup `antes-de-remover` automaticamente (regra existente em `reliability.beforeWrite`).
5. A remoção respeita a trava de revisão (`X-Project-Revision`) e exige ao menos uma pasta cadastrada.

**Endpoint novo:** `POST /api/photos/delete-copies` (`server.ts`) — recebe `{ids}`, resolve cada id para o caminho relativo dentro de `<pasta de trabalho>/fotos` (nunca para fora), recusa atalhos, apaga os arquivos e remove diretórios vazios; devolve `{removed, missing, failed}`.

### 15.2 Estrutura de repositório e troca de local da obra

**Estrutura `Obras\<nome>`** (pedido do usuário): o usuário escolhe apenas a **pasta base** de destino; o servidor compõe o caminho final como `<base>\Obras\<nome da obra>` em três pontos:

- **Criar obra nova** e **copiar a obra atual** (`POST /api/obras`, modos `new`/`copy`): a obra nasce em `<base>\Obras\<nome>`, com `projeto.json`, `fotos/` e `backups/` juntos — mover ou excluir a obra afeta a estrutura inteira.
- **Abrir projeto existente** (`mode: 'open'`): aceita a pasta do projeto como está; se ela não tiver `projeto.json`, o servidor tenta `<base>\Obras\<nome>` antes de recusar.
- **Trocar local** (`POST /api/obras/:id/move`): o destino também é `<base>\Obras\<nome>`, nos dois modos.

Como o nome da obra vira nome de pasta, `cleanNome` passou a recusar caracteres inválidos do Windows (`<>:"/\|?*`, caracteres de controle, ponto no fim) e nomes reservados (`CON`, `PRN`, …), com mensagem explicando o motivo. A interface mostra o caminho final em destaque antes de confirmar (“A obra será criada em: …” / “A obra ficará em: …”).

Em *Gerenciar obras*, a obra em uso passou a ter **Alterar local**. A escolha tem dois modos, ambos com confirmação antes de executar:

- **Mover todo o conteúdo** — copia `projeto.json`, `fotos/`, `backups/` e `backup-config.json` para o destino, confere bytes e quantidade de arquivos item a item, ativa a nova pasta e só então apaga o conteúdo gerenciado da origem (a pasta origem vazia também sai). Se a cópia falhar, o destino é removido e a origem não é tocada; se a limpeza da origem falhar, o usuário recebe aviso com o caminho do conteúdo antigo.
- **Iniciar repositório vazio** — cria um `projeto.json` novo no destino e ativa a pasta; a pasta anterior permanece intacta e deixa de fazer parte da obra (o aviso informa isso).

Regras: destino vazio ou inexistente, fora da pasta atual (sem aninhamento), sem `projeto.json` próprio, caminho absoluto, trava de revisão, escrita atômica do registro de obras e nenhuma sobrescrita. A troca vale apenas para a obra ativa e atualiza `pasta-trabalho.json` e o registro em `obras.json`.

**Endpoint novo:** `POST /api/obras/:id/move` (`obras.ts`) — `{revision, path, mode: 'move' | 'fresh'}`.

### 15.3 Backups: exclusão individual e limite máximo

- **Excluir:** cada item de *Backups e diagnóstico* ganhou o botão **Excluir** com confirmação; `DELETE /api/backups/:id` valida o padrão do nome (`backup-*.json`, sem caminho para fora), apaga no diretório local e também no segundo destino quando configurado, e devolve a lista restante.
- **Limite:** novo campo **Máximo de backups** nas opções (0 a 1000; 0 = sem limite, que era o comportamento anterior). O valor entra em `backup-config.json` e passa a valer em `prune()`: ao criar ou reconfigurar, as cópias além do limite — inclusive manuais e as de segurança — são apagadas das mais antigas para as mais recentes. A retenção diária/semanal continua valendo só para as cópias `automatico`.

### 15.4 Verificação e distribuição

- **Diagnóstico do erro relatado (“Recurso indisponível na versão offline.” na troca de local):** a mensagem vem do *catch-all* de 404 do `server.ts`, ou seja, a rota não existia **no processo em execução**. Como o `express.static` lê os arquivos do disco a cada requisição e as rotas ficam em memória desde a abertura, atualizar o `dist` com o app aberto serve a tela nova com o servidor antigo. Correção operacional: fechar janela e terminal e reabrir pelo `INICIAR.cmd`; salvaguarda nova: `ObrasModal` consulta `/api/health` e mostra aviso em vermelho quando a versão do servidor não confere com a da interface.
- `test-obras.mjs` estendido: criação e cópia na estrutura `<base>\Obras\<nome>` (caminho no registro e no disco), abertura pela base resolvendo `Obras\<nome>` sem duplicar, nome inválido (`/`) e nome reservado (`CON`) recusados; mover conteúdo para a nova estrutura (projeto copiado, conteúdo antigo removido, pasta origem vazia eliminada, ficha preservada, registro atualizado), repositório vazio (pasta anterior intacta, projeto sem fotos/ficha) e validações (mesma pasta, destino aninhado, destino com `projeto.json`, destino não vazio, revisão desatualizada, obra não ativa, modo desconhecido e nada criado quando a troca falha).
- `test-pastas-backups.mjs` novo: cópias apagadas e diretórios vazios removidos, chamada repetida sem falha, entradas inválidas e conflito de revisão recusados, backup `antes-de-remover`, exclusão individual no local e no destino secundário, nome fora do diretório recusado, limite máximo aplicado (arquivos no disco batem com a lista) e validado, e máximo zero sem limite.
- Suíte completa (7 testes) e `tsc --noEmit` aprovados; `dist` reconstruído (Vite + esbuild), sincronizado com a raiz e verificado por teste de fumaça na porta 3999 (`/api/health` = 1.9.4-obras, rota `move` respondendo com a mensagem da própria rota, criação em `Obras\<nome>`, nome inválido recusado e bundle com `v1.9.4`).
- `LEIA-ME.txt` recebeu as seções “ESTRUTURA DE PASTAS DAS OBRAS”, “SE APARECER ‘Recurso indisponível na versão offline’” e a lista de testes atualizada.

### 15.5 Pendências da 1.9.4

- Confirmar em janela nativa (em vez de `confirm` do navegador) as três confirmações, na homologação de Windows.
- Oferecer relatório do que foi apagado em “Excluir pasta” (nomes dos arquivos removidos) caso o usuário precise de conferência.
- Permitir mover obra que não está em uso (hoje é preciso abri-la antes).

### 15.6 Visualização ampliada das fotos na importação

Dois ajustes pedidos na aba *Importar fotos* (`PhotoUploader`):

- **Correção do preview:** a caixa da miniatura passou de `sm:w-44 h-44` (recorte por `object-cover`) para `sm:w-72 h-48/sm:h-56` com `object-contain` — a foto aparece inteira, sem cortar as laterais, com a altura mantida.
- **Clique para ampliar:** clicar na miniatura abre um visualizador em tela cheia (`z-[60]`) com o nome do arquivo. Ampliação de 100% a 600% pelos botões − / + ou teclas `+`/`-`, clique duplo alterna entre ajustar e 250%, arraste com o ponteiro move a imagem quando ampliada, `Ajustar` volta ao início e `Esc` ou clique fora fecha. A dica de uso fica no rodapé do visualizador.

Verificação: `tsc --noEmit`, suíte completa (7 testes) e reconstrução do `dist` sincronizado com a raiz; a presença do visualizador foi conferida no bundle servido (`assets/index-*.js`).

### 15.7 Data padrão do grupo de fotos na importação

Pedido na aba *Importar fotos* (`PhotoUploader`): as fotos importadas recebem sempre a data atual, mas o grupo pode ter sido fotografado em outra data.

- Novo campo `Data padrão do grupo` (`input type="date"`, estado `dataGrupo`) no cabeçalho da lista *Fotos Prontas para Envio*, com botões **Aplicar às N foto(s)**, **Hoje** e texto de ajuda. O botão converte a data escolhida para `DD/MM/AAAA` e grava em `data` de todas as `stagedPhotos` (`aplicarDataGrupo`), exibindo aviso temporário de 5 s.
- Enquanto o campo estiver preenchido, novas importações (`handleFiles`) já nascem com essa data em vez de `new Date().toLocaleDateString('pt-BR')` — a data padrão vale para o grupo inteiro da sessão.
- A data escolhida alimenta o mesmo campo `data` editável por foto, portanto vale para o salvamento (`handleProcessAndSave`) e para a organização por data já existente.

Verificação: `tsc --noEmit` limpo, `vite build` + `build-tmp.mjs` sem erros, suíte completa (7 testes) e `dist` sincronizado com a raiz (hashes iguais; texto “Data padrão do grupo” presente no bundle).

### 15.8 Alteração de data em lote das fotos salvas

Pedido na aba *Gerenciador de fotos* (`PhotoList`): por engano um grupo de fotos foi cadastrado com a data errada e alterá-las uma a uma era inviável.

- A barra de exclusão em lote virou a barra **Seleção em lote** (mesma `deleteSelection`): contador, *Selecionar todas as exibidas*, *Limpar seleção*, campo **Nova data** (`input type="date"`, estado `dataLote`), botão **Aplicar data às selecionadas** e o botão *Excluir selecionadas* preservado. O checkbox dos cartões/tabela passou de “Excluir” para **Selecionar** (rótulo e `aria-label`).
- `aplicarDataSelecionadas` valida a data com `photoDate`, confirma com a quantidade, e para cada foto selecionada grava `data` nova mantendo a `hora` e recalculando `timestamp` (ordem cronológica preservada), limpando a seleção e exibindo aviso de 6 s.
- O remanejamento das cópias não exige ação extra: `mirror()` (`photoStorage.ts`) monta o caminho com `photoDate(p.data)?.day` e move a cópia para a subpasta do novo dia na gravação seguinte, com limpeza da cópia antiga verificada por bytes — mesma mecânica já usada na edição individual de data.
- Dica de uso impressa na própria barra: filtrar o dia em *Subpastas por dia da foto* → *Selecionar todas as exibidas* → aplicar a nova data.

Verificação: `tsc --noEmit` limpo, `vite build` + `build-tmp.mjs`, suíte completa (7 testes) e `dist` sincronizado com a raiz (hashes iguais; texto “Aplicar data às selecionadas” presente no bundle).

### 15.9 Mover fotos de uma pasta para outra

- Nova opção de **realocar fotos ou grupos de fotos** de uma pasta para outra, na aba **Gerenciar fotos**.
- Barra **Seleção em lote** com os botões **Mover selecionadas** e **Mover todas as exibidas**.
- No seletor **1. Escolher Pasta das Fotos que Comporão o Relatório**, o botão **Mover toda a pasta** leva todas as fotos da pasta filtrada para outra.
- Em cada foto (cartão e tabela), novo ícone de mover individual.
- Na edição da foto, campo **Pasta de destino da foto** para troca pontual.
- O diálogo de movimentação mostra todas as pastas com a contagem de fotos, permite **criar nova pasta de destino ali mesmo** (nome + período) e pede confirmação antes de mover.
- Ao confirmar, `folderId`/`folderName` são atualizados e as **cópias em disco são realocadas** na próxima gravação automática, mantendo a subpasta do dia da foto; as cópias antigas são removidas somente após conferência do conteúdo.
- Fotos já estantes na pasta de destino são identificadas e não são contadas na movimentação.
- RDOs e relatório da pasta de destino passam a considerar as fotos movidas.

### 15.10 Busca dinâmica na descrição do serviço

- Ao digitar a **Descrição do Serviço** (importação e edição da foto), o sistema oferece **até 3 sugestões** com as descrições já cadastradas nas fotos do projeto, começando pelas mais recentes.
- Com o campo vazio (ou com 1 caractere) são exibidas as **3 últimas descrições usadas**.
- Ordenação da sugestão: início do texto → início de qualquer palavra → trecho no meio da frase.
- A comparação **ignora acento, maiúsculas e espaços extras** (`colocacao` encontra `COLOCAÇÃO...`) e não repete o texto já digitado no campo.
- Clique na sugestão preenche o campo com o texto completo; os modelos padrão continuam no fim do catálogo.

### 15.11 Ordenação manual das fotos

- Novo botão **Reordenar fotos** na barra de controles do **Gerenciar fotos** (ao lado do botão de ordem).
- Em modo de ordenação, cada foto ganha quatro botões: **subir**, **descer**, **levar ao início** e **levar ao fim** (desabilitados nas bordas da lista).
- A sequência escolhida passa a ser a ordem das páginas do **relatório fotográfico**, do **RDO** e das **exportações** — antes era sempre por data/hora.
- A ordem é gravada automaticamente a cada clique; o número **#** do cartão mostra a posição atual.
- Guarda no projeto: `PhotoRecord.manualOrder` (índice absoluto, opcional). Sem `manualOrder`, tudo continua cronológico — projetos antigos não mudam.
- **Fotos novas entram na posição cronológica** sem quebrar a sequência manual (renumeração automática); editar, mover de pasta ou excluir fotos preserva a ordem.
- Faixa **Ordem manual ativa** com **Continuar ordenando** e **Restaurar ordem cronológica** (descarta `manualOrder` de todas as fotos, com confirmação).
- Com filtros ativos, as setas reordenam apenas as **fotos exibidas**; as demais mantêm as posições atuais (aviso no modo de ordenação).
- No modo de ordenação o botão de ordem cronológica fica inativo e a lista sempre exibe a sequência real do relatório (independente de "Recentes ➔ Antigas").
- `rdoPhotos()` e o relatório usam a mesma sequência: mudou a ordem, o `rdoSignature` muda e o RDO do dia volta a rascunho (mesmo comportamento já existente para alterações relevantes).
- `manualOrder` é validado pelo servidor (inteiro ≥ 0) ao gravar o projeto.

### 15.12 Correção: RDO vazio quando a pasta de origem mudou

- **Sintoma**: dias de RDO anteriores a uma mudança de pasta mostravam "0 fotos marcadas / Dia sem fotos marcadas", mesmo com as fotos marcadas — acontece quando as fotos são movidas para uma pasta nova (id novo `folder-<timestamp>`) e a pasta antiga é removida, deixando dias de RDO com `folderId` órfão (ex.: `folder-set-2026`).
- Nova função `repairRdoFolderIds()` em `src/services/rdo.ts`: um dia cuja pasta não existe mais é **revinculado à pasta onde estão as fotos daquela data** (quando única); se a data tiver fotos em mais de uma pasta ou nenhuma, o dia passa a valer para todas as fotos da data (RDO individual).
- Aplicado em três pontos, de forma idempotente (nada muda quando não há pasta órfã):
  - na abertura/alteração de fotos no app (`App.tsx`, junto ao `syncRdo`);
  - no servidor, nos endpoints de RDO (`/api/rdo/pdf`, `/api/rdo/pages`, `/api/rdo/export`, `/api/rdo/batch`);
  - ao gravar o projeto (`PUT /api/project`), corrigindo o arquivo de dados.

## 16. Versões 1.9.5 a 1.9.7 — registro ausente

Estas três versões foram distribuídas sem arquivo de alterações, sem seção neste plano e sem seção no `LEIA-ME.txt`. O que segue foi **reconstruído a partir do código**, não de um registro de quem as fez, e deve ser tratado como incompleto:

- **1.9.5-importar-obra:** importar uma obra a partir de um arquivo de backup, criando uma obra nova. Rota `POST /api/obras/import` e o formulário correspondente na tela de obras. Coberta por `test-obras.mjs`.
- **1.9.6:** não foi possível identificar o conteúdo. Nenhum vestígio no código, nos documentos ou nos testes.
- **1.9.7-pluviometria-uma-folha:** impressão do controle pluviométrico em uma única folha A4, com escolha de orientação (retrato ou paisagem) e estilos próprios de impressão em `PluviometriaPanel`.

Também não constam neste plano, embora existam desde pelo menos a 1.9.2 (citadas na seção 13.2): as abas **Equipe Técnica**, **Equipamentos**, **Ações Corretivas** e **Pluviometria**, e o botão **Pacote Consolidado (XLSX)**. A ausência de registro dessas entregas foi o que motivou a revisão da seção 21.3.

## 17. Importação de fotos rápida — versão 1.9.8

Detalhe em `RDO-V1.9.8-ALTERAÇÕES.md`. Resumo e decisões:

- **A leitura do carimbo NoteCam virou opcional e vem desligada.** Medida em fotos reais da obra, levava de 3,5 a 7 segundos por foto (30 fotos ≈ 2 a 3 minutos). Nas fotos em uso o carimbo fica no alto à direita e traz data, local e altitude, **não a descrição do serviço**; como a leitura olha o canto inferior direito, devolvia texto sem sentido. A escolha fica guardada no navegador do PC.
- **Filtro de confiança no OCR:** só linhas com confiança ≥ 60 são aceitas. Nos testes, cascalho, céu e logotipos ficaram entre 0 e 45.
- **Salvamento agrupado:** gravação 0,8 s após a última alteração, em vez de uma gravação completa por tecla digitada. Exportar, trocar de obra e restaurar backup forçam a gravação pendente.
- **Servidor:** a leitura do `projeto.json`, o hash de revisão e a conferência das cópias de fotos passaram a ser reaproveitados. De ~530 ms para ~385 ms por gravação, medido com cópia do projeto real.
- **Correção:** a tela de Obras mostrava sempre o aviso de versão divergente desde a 1.9.6, porque comparava com um valor fixo.

## 18. Gerenciamento de obras redesenhado — versão 1.10.0

Especificação: `docs/superpowers/specs/2026-10-05-gerenciamento-de-obras-design.md`. Detalhe em `RDO-V1.10.0-ALTERAÇÕES.md`.

Decisões do usuário registradas na especificação: remover obra tira só da lista por padrão, com opção de apagar arquivos; depois de remover a obra em uso, uma tela inicial obrigatória; catálogo de obras dentro da obra, com cópia explícita entre obras; e uma tela própria no menu, em vez da janela sobreposta.

Pontos que importam para quem for mexer:

- Existe agora o estado **"nenhuma obra aberta"**. Instalação nova começa nele. Nenhuma rota cria projeto sozinha.
- **Apagar arquivos apaga só o que o app criou** (`projeto.json` e cópias, `fotos/`, `backups/`, `backup-config.json`). Tudo o mais é preservado e listado. A conferência é feita **antes** de apagar qualquer item, e o `projeto.json` é o último a sair, para que uma falha no meio nunca deixe a obra sem projeto.
- Saiu o modo "iniciar repositório vazio"; o mesmo resultado é "Remover + Nova obra".
- **Correção da revisão final:** quando a pasta da obra aberta está indisponível (disco desconectado, OneDrive fora de sincronia), a tela Obras continua acessível. Antes o app travava com todas as abas bloqueadas e sem saída.

## 19. Equipe técnica pela planilha — versão 1.11.0

Especificação: `docs/superpowers/specs/2026-10-06-equipe-planilha-design.md`. Detalhe em `RDO-V1.11.0-ALTERAÇÕES.md`.

Decisões do usuário: a **matrícula** identifica a pessoa; a planilha tem uma coluna por mês, e a célula do mês contém a **equipe** daquela pessoa naquele mês; a presença diária continua no app; a função é fixa na planilha, mas o app registra a partir de qual mês a mudança vale; o cadastro pode ser editado no app e no Excel, com conciliação por prévia.

Pontos que importam:

- A conversão dos cadastros antigos é automática e idempotente: a equipe atual entra nos meses em que a pessoa tinha presença marcada.
- A importação **nunca apaga ninguém sozinha**; quem ficou fora da planilha é mantido salvo escolha explícita, e um mês com presença marcada não é esvaziado.
- O app lê `.xlsx` com um leitor próprio (sem dependência nova) e `.csv` em UTF-8 ou ANSI, aceitando os formatos de cabeçalho de mês que o Excel produz, inclusive data convertida.
- **Correções da revisão final:** preencher só as matrículas que faltavam ficava bloqueado; corrigir a função duas vezes no mesmo mês estragava os meses anteriores; e dois nomes iguais na planilha eram ligados pela ordem das linhas.

## 20. Catálogos dos campos repetitivos — versão 1.12.0

Especificação: `docs/superpowers/specs/2026-10-06-catalogos-design.md`. Detalhe em `RDO-V1.12.0-ALTERAÇÕES.md`.

Decisões do usuário: catálogo para **todos** os campos repetitivos; editar um item corrige o texto em **todos** os registros, sem perguntar; o catálogo mora na obra, com cópia explícita de outra obra; excluir item em uso fica **bloqueado**, com o atalho "Corrigir agora"; administração numa tela própria no menu; e a descrição do serviço mantém as três sugestões por uso recente.

Pontos que importam:

- São onze catálogos. O que faz tudo funcionar é um registro central em `src/services/catalogos.ts`: cada catálogo sabe listar valores, dizer quem usa e renomear em todos os registros. Acrescentar um catálogo novo é acrescentar uma entrada.
- Três lugares escondidos que a renomeação precisa alcançar, e alcança: o **histórico de função**, as **chaves do efetivo de equipamentos** (indexado pelo nome) e a **tag da foto** derivada da categoria.
- **Limite de 500 caracteres por item**, no cliente e no servidor. Sem isso, uma descrição longa entrava no catálogo e fazia o servidor recusar o projeto inteiro, bloqueando todas as gravações seguintes — foi o problema mais grave achado na revisão final.
- Equipes, funções, equipamentos, placas e lados são gravados em maiúsculas; rodovia, trecho, estaca, categoria, descrição e ação mantêm a grafia digitada.
- As sugestões de fábrica entram só na criação do catálogo, para que um item excluído não volte.

## 21. Situação para retomada — 06/10/2026

Esta seção é o ponto de partida de quem voltar ao projeto.

### 21.1 Conferência pendente no Windows

Nada do que foi entregue de 1.9.8 a 1.12.0 passou por conferência na máquina de destino. A interface **não tem testes automatizados** neste projeto: a compilação e os 12 testes cobrem o servidor e as regras, não as telas. A lista abaixo é o que precisa ser visto com os olhos, em uma sessão só:

1. **Importar fotos (1.9.8):** a caixa "Ler descrição do carimbo NoteCam" desligada; importar um lote real e confirmar que entra na hora.
2. **Obras (1.10.0):** criar obra só com o nome; duplicar e mover uma obra fechada; remover a obra em uso marcando "apagar arquivos" e conferir o backup baixado, a lista de preservados e a tela "Nenhuma obra aberta".
3. **Equipe (1.11.0):** exportar a planilha, conferir acentos e colunas de mês no Excel; preencher matrículas, transferir alguém de equipe, mudar uma função, acrescentar pessoa; importar e conferir a prévia; importar de novo e confirmar que não há alterações.
4. **Catálogos (1.12.0):** unificar as duas grafias do trecho (hoje 100 e 7 fotos); editar uma função em uso e conferir o aviso e o backup; tentar excluir um item em uso e usar "Corrigir agora"; conferir os campos novos (estaca e categoria na importação; rodovia, trecho e categoria na edição da foto).
5. **Pendências antigas, nunca conferidas:** abrir sem permissão de administrador, PDF com fotografias reais, atualizar o programa sem apagar projetos, e as instruções de recuperação.

### 21.2 Fila de trabalho sugerida

Em ordem de retorno pelo esforço, com base na análise de 05/10/2026 e no que foi entregue depois:

1. **Correções rápidas que sobraram da análise** (nenhuma foi feita):
   - **"Auto-preencher com RDO" inventa presença.** Se o RDO diz 12 profissionais, marca os 12 primeiros nomes da lista, sejam quem forem. Em documento oficial isso é registro de presença falso. O sentido correto é o inverso: o RDO receber a contagem a partir do efetivo marcado.
   - **Relatório de mobilização de equipamentos com lógica errada:** "Mobilizado" é calculado pelo tipo e não pela unidade (se uma motoniveladora trabalhou, todas aparecem como "SIM"); "Desmobilizado" é só o contrário de "Mobilizado", então equipamento que nunca foi mobilizado aparece como desmobilizado. Na prévia, o Executante está fixo no texto, o "Relatório Nº" está fixo em 13, o período usa `mesAno` em vez do mês escolhido, e o que se edita na tela some ao fechar.
   - **Botão de buscar chuva por URL nunca funciona:** a regra de segurança do próprio servidor bloqueia conexão externa, e o recurso contraria a operação offline. **Decisão em aberto** (perguntei e não foi respondida): remover o botão ou fazer a busca passar pelo servidor como opção explícita.
   - **Dependências sem uso:** `@google/genai`, `firebase`, `motion` e `dotenv`. As duas primeiras contrariam a regra de não reintroduzir Google.
   - **Dados fixos no código:** nomes reais dos responsáveis em `src/services/rdo.ts` e a pasta padrão `folder-jul-2026`.
2. **Relatórios mensais conforme a planilha-modelo** (`modelo/modelos para implementação.xlsx`), hoje a maior lacuna funcional:
   - cabeçalho mensal comum (Executante, Contrato, Rodovia, Trecho, Relatório Nº, Período), com numeração automática;
   - **Ações Corretivas completas:** implementada Sim/Não, eficaz, totais e comentários — hoje faltam todos, e não dá para editar uma ação depois de criada;
   - **Pluviometria em mm por período** (manhã/tarde/noite registram o clima, não milímetros), com acumulado do período anterior, acumulado desde o início da obra, totais mês a mês e contagem de dias praticáveis, com chuva e impraticáveis;
   - **folha A4 da Equipe Técnica** — a base já existe desde a 1.11.0 (`membrosDoMes` e `funcaoNoMes`).
3. **IMP-08 — ler data, orientação e GPS da própria foto.** Hoje toda foto entra com a data do dia.
4. **IMP-05 — separar as fotos do `projeto.json`.** É a solução definitiva da lentidão; a 1.9.8 só atenuou.
5. **IMP-06, IMP-10 a IMP-15**, na ordem do plano original.

### 21.3 Pendências de processo

- **Registrar toda versão.** As versões 1.9.5 a 1.9.7 ficaram sem registro (seção 16) e uma delas não pôde sequer ser identificada. Toda entrega precisa de um `RDO-V<versão>-ALTERAÇÕES.md` e de uma seção neste plano.
- **Conferência de tipos fraca na interface.** `@types/react` e `@types/react-dom` continuam sem instalar; sem eles o `tsc` quase não confere os arquivos `.tsx`. Era a primeira pendência da seção 13.4 e segue aberta. Enquanto isso, a revisão de código por um segundo leitor é o que tem pego os erros de tela.
- **Sem repositório git.** A pasta não é um repositório, então não há histórico de alterações nem como voltar atrás por commit. As cópias do código anterior a cada entrega ficaram em pasta temporária do sistema e **não sobrevivem ao desligamento**. Decisão em aberto na seção 21.5.
- **Onde ficam os registros.** Detalhe de cada entrega nos `RDO-V<versão>-ALTERAÇÕES.md` da raiz; decisões do usuário e regras em `docs/superpowers/specs/`; passo a passo da execução em `docs/superpowers/plans/`; e as decisões tomadas durante a execução, com o custo de cada uma se estiver errada, em `docs/historico/`.
- **Automatizar a publicação:** a sincronização `codigo-fonte/dist` → `dist` da raiz continua manual (pendência de 13.4).
- Restam abertas, da seção 13.4: tratamento global de erro de tela e teste de regressão para o limite de campos do PDF.

### 21.4 Como o trabalho foi conduzido nesta etapa

As versões 1.10.0, 1.11.0 e 1.12.0 seguiram o mesmo caminho, e vale repeti-lo: **perguntas ao usuário → especificação escrita e aprovada → plano de implementação → execução com teste antes do código → revisão por um segundo leitor independente → correção dos achados**.

A revisão independente pagou-se nas três: encontrou 2 problemas importantes na 1.10.0, 3 na 1.11.0 e 6 na 1.12.0 — entre eles um que travaria **todas as gravações** do aplicativo. Nenhum deles aparecia nos testes automatizados nem na conferência do próprio autor.

### 21.5 Decisões em aberto

Duas questões levantadas em 06/10/2026. A primeira foi atendida em parte no mesmo dia; a segunda segue sem decisão e, enquanto isso, nada foi alterado no aplicativo por causa dela.

**1. Cópia de segurança do código-fonte.**

Durante as entregas 1.10.0, 1.11.0 e 1.12.0 foram guardadas cópias do código anterior a cada alteração, em pasta temporária do sistema (53 MB no total, três cópias de 16 MB). Essas cópias ficavam em pasta temporária e não sobreviveriam ao desligamento; em 06/10/2026 foram salvas dentro do projeto (ver abaixo).

O que está em jogo: **os dados da obra não correm risco nenhum** — fotos, RDOs e configurações ficam em `Obras\<nome>\` e têm o sistema de backup próprio do aplicativo. O que se perde é a possibilidade de **voltar atrás no programa** caso apareça um defeito que não compense corrigir na hora. O risco é maior agora justamente porque nada de 1.9.8 a 1.12.0 passou pela conferência no Windows (seção 21.1).

Atenuante parcial: a pasta do projeto fica dentro do OneDrive, que mantém histórico de versões de arquivo. Dá para recuperar arquivo por arquivo pela interface do OneDrive, mas é manual e depende da retenção configurada na conta — convém confirmar antes de contar com isso.

**Resolvido em 06/10/2026:** as três cópias foram salvas em `backups/codigo-fonte/`, uma pasta por ponto de retorno (1.9.8, 1.10.0 e 1.11.0), com soma de verificação conferida contra a origem. O `LEIA-ME.md` dessa pasta explica o que cada cópia contém e o passo a passo para voltar a uma versão.

**Continua em aberto:** essa cópia protege apenas as três entregas de 06/10/2026. **As entregas futuras não estão cobertas** — a cada nova alteração seria preciso repetir a cópia à mão. A solução definitiva continua sendo **iniciar um repositório git** na pasta, que daria histórico completo, comparação entre versões e volta atrás por comando. A ressalva é que a pasta `.git` ficaria dentro do OneDrive, o que pode gerar conflitos de sincronização.

**3. Sentido do botão "Auto-preencher com RDO" (aba Efetivo do mês).**

Aberta em 06/10/2026, durante a 1.14.0. O botão continua lendo o número do RDO e marcando as N primeiras pessoas ativas da lista — é o que ainda inventa presença. Inverter o sentido parecia simples, mas na implementação apareceram três casos que precisam de decisão:

- **dia com `0` no RDO** (chuva, domingo): marcar os ativos seria inventar presença onde o RDO diz que ninguém trabalhou;
- **dia com número digitado de propósito**, diferente da contagem de ativos: sobrescrever descartaria uma informação deliberada;
- **dia sem número**: o único caso em que preencher é claramente seguro.

A proposta é o botão passar a marcar os ativos **apenas nos dias sem número**, preenchendo o número junto, e relatar os dias que deixou intactos — com uma segunda pergunta para sobrescrever, como já existe hoje. Custa reescrever os testes do preenchimento entregues na 1.12.1 e na 1.13.0. Enquanto não houver decisão, o botão continua como está e o caminho recomendado é o botão novo do RDO, dia a dia.

**2. Botão de buscar chuva por URL (aba Pluviometria).**

O botão chama uma URL externa, mas a regra de segurança do próprio servidor bloqueia conexão externa: ele **nunca funciona**. Além disso, o recurso contraria a regra de operação offline da seção 7. As opções são remover o botão ou fazer a busca passar pelo servidor, como opção explícita e desligada por padrão. Enquanto não houver decisão, o botão continua na tela sem funcionar.

---

## 22. Equipe técnica em duas abas e marca de ativo — versão 1.13.0

**Data:** 06/10/2026 • **Documento de alterações:** `RDO-V1.13.0-ALTERAÇÕES.md` • **Spec:** `docs/superpowers/specs/2026-10-06-equipe-efetivo-ativo-design.md` • **Plano:** `docs/superpowers/plans/2026-10-06-equipe-efetivo-ativo.md` • **Ledger:** `docs/superpowers/ledgers/2026-10-06-equipe-efetivo-ativo-progress.md`

### 22.1 Problema

A tela de Equipe Técnica juntava, em uma rolagem só, o cadastro das pessoas, a grade diária de presença e o histograma por equipe — 314 linhas de componente e três tabelas. E o auto-preenchimento do efetivo pelo RDO, entregue na 1.12.1, marcava **todo mundo da lista do mês**, inclusive quem estava de férias, afastado ou desligado. Corrigir isso exigia desmarcar pessoa por pessoa depois de cada preenchimento.

### 22.2 O que foi decidido

A marca de ativo é **do presente** e serve **só ao preenchimento automático**. Decisões do usuário, registradas na spec:

| Tema | Decisão |
|---|---|
| Efeito no histórico | Nenhum. Presença já marcada é fato consumado |
| Forma | Liga-desliga simples, sem data de início e fim |
| Campo ausente | Significa inativa |
| Pessoas já cadastradas | Na atualização, todas passam a ativas (eram 123 na obra em uso) |
| Abas | Um item de menu, duas abas internas |
| Planilha | Leva a marca, em uma coluna ATIVO |

O usuário recusou duas recomendações do implementador, e as duas recusas estão implementadas como ele pediu: a marca **entra** na planilha (a recomendação era deixá-la fora, para não misturar cadastro com situação), e **ausente significa inativa** (a recomendação era o contrário, por ser o padrão mais seguro). A segunda só é segura porque a conversão grava `true` em quem já existia e porque toda pessoa criada pelo aplicativo grava o campo explicitamente — sem isso, qualquer registro antigo reapareceria desligado.

### 22.3 O que foi feito

1. **Modelo.** `EquipeMember.ativo?: boolean`; `estaAtivo(m) = m.ativo === true`; `membrosAtivosDoMes`. A conversão que já rodava ao abrir o painel (`migrarEquipe`) passa a gravar `ativo: true` em quem não tem o campo, no mesmo passo em que converte os meses.
2. **Preenchimento automático.** `preencherEfetivoComRdo` usa a lista de ativos. `ResumoSyncRdo` ganhou `inativos` e `semAtivos`, para que "o mês está vazio" e "o mês tem gente, mas nenhuma ativa" tenham mensagens diferentes.
3. **Planilha.** Coluna ATIVO entre FUNÇÃO e os meses, escrita como SIM/NÃO e excluída do reconhecimento de meses. Leitura tolerante: coluna ausente não muda a marca de ninguém; texto não reconhecido é listado na prévia. Pessoa nova sem informação nasce inativa, com o campo gravado.
4. **Prévia da importação.** Três seções novas: Passam a inativas, Voltam a ativas e Coluna ATIVO não entendida.
5. **Divisão da tela.** `components/EquipePanel.tsx` (314 linhas) virou `components/equipe/`: `EquipePanel.tsx` (54, casca com mês e abas), `CadastroEquipe.tsx` (158), `EfetivoDoMes.tsx` (153) e `comum.ts` (auxiliares compartilhados).
6. **Interface.** Contagem "N de M pessoas ativas", busca por nome/matrícula/função sem acento e sem caixa, coluna Ativo na tabela, caixa Ativo no formulário marcada por padrão, etiqueta INATIVO na grade e o aviso de quem ficou de fora na confirmação do auto-preenchimento.

### 22.4 Verificação

`tsc --noEmit` limpo, 12 arquivos de teste aprovados, `vite build` e `build-tmp.mjs` sem erros, `dist` da raiz sincronizado por checksum. Os testes novos cobrem, entre outros, os casos que o plano listou como mais prováveis de incomodar: planilha antiga sem a coluna não altera ninguém; pessoa nova nasce inativa e a conversão não a reativa; mês sem nenhuma pessoa ativa; ATIVO fora da detecção de meses.

A revisão independente apontou um achado grave e dois importantes, todos corrigidos com teste que falhou antes e passou depois: a pergunta de sobrescrever não avisava dos inativos quando todos os dias do mês já tinham marcação (risco real de apagar presença sem aviso); a aba voltava sozinha para Cadastro enquanto houvesse faixa de correção; e pessoa nova importada sem a coluna ATIVO entrava inativa sem nada dizer na prévia.

**Conferência manual no Windows: não feita** — entra na lista da seção 21.1.

### 22.5 Limitação assumida

A marca não tem período. Rodar o preenchimento automático para um **mês passado** usa a situação de hoje, não a daquele mês. Controle de ausências com datas ficou fora do escopo por decisão do usuário.

---

## 23. O efetivo deixa de ser palpite no RDO — versão 1.14.0

**Data:** 06/10/2026 • **Documento de alterações:** `RDO-V1.14.0-ALTERAÇÕES.md`

### 23.1 Problema

Relatado pelo usuário: ao preencher "Profissionais em atividade" no RDO, não havia como saber quantas pessoas estavam ativas. Era preciso sair do RDO, ir ao cadastro da Equipe Técnica e contar — e nem lá a contagem aparecia. O número virava palpite, e o palpite decidia **quem** entrava no efetivo, porque o preenchimento automático marcava as N primeiras pessoas da lista. Era o item que a seção 21.2 já apontava como registro de presença inventado.

### 23.2 O que foi entregue

- **Botão "Usar o efetivo (N)" no RDO**, com o N visível antes do clique. Clicar marca essas N pessoas no efetivo daquele dia e põe N no campo. Pergunta antes de substituir um dia já marcado; avisa, com nomes, quem foi pulado por estar inativo.
- **O número do RDO passa a seguir o efetivo**: marcar ou desmarcar alguém na grade atualiza o número daquele dia. É o que faz a revisão posterior valer para o documento.
- **RDO finalizado não é alterado** por nenhum dos dois caminhos.

Duas funções puras novas, ambas com teste: `marcarAtivosNoDia` (em `src/services/equipe.ts`) e `definirProfissionais` (em `src/services/rdo.ts`).

### 23.3 A regra e por que ela é assim

O botão marca **quem está na equipe daquele mês e está ativo hoje**. Ao preencher um RDO antigo, alguém desligado depois daquela data fica de fora e aparece no aviso pelo nome.

A escolha é deliberada: deixar de marcar quem trabalhou é um erro **visível**, com o nome na tela e correção em um clique; marcar quem estava de férias é inventar presença, e passaria despercebido. Errar para menos é corrigível; errar para mais, não.

### 23.4 O que ficou pendente

O botão "Auto-preencher com RDO" da aba Efetivo **não foi alterado** — ver a decisão em aberto 3 da seção 21.5.

### 23.5 Observação de processo

Esta entrega **não teve cópia do código anterior** salva em `backups/codigo-fonte/` antes de começar, ao contrário das anteriores. O ponto de retorno mais recente continua sendo o da 1.12.1. Reforça a decisão em aberto 1 da seção 21.5: enquanto não houver repositório, a cópia depende de alguém lembrar de fazê-la.
