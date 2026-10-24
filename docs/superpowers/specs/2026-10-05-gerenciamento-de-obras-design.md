# Gerenciamento de obras — redesenho

**Data:** 05/10/2026 • **Aplicativo de partida:** 1.9.8-importacao-rapida • **Aprovação do design:** Cesar Augusto Secco (conversa de 05/10/2026)

## 1. Objetivo

Tornar clara a criação e a manipulação de obras, separar os dois tipos de importação e permitir remover qualquer obra — inclusive a única ou a que está em uso — para que o usuário possa "zerar" o sistema e recomeçar com uma obra nova.

### Problemas atuais (motivo do redesenho)

- Uma única janela sobreposta (`ObrasModal.tsx`) concentra listar, criar em 3 modos, importar backup, renomear, remover, alterar local em 2 modos e abrir.
- "Pasta destino (base)" muda de sentido conforme o modo: em criar e copiar é a pasta-mãe onde se cria `Obras\Nome`; em registrar é a pasta do próprio projeto.
- Recomeçar do zero está escondido em *Alterar local → Iniciar repositório vazio*.
- "Remover" só tira da lista e é bloqueado para a obra em uso; não há como zerar o sistema.
- Há dois caminhos de importação diferentes em lugares diferentes: "Importar obra de backup" (Obras, cria obra nova) e "Restaurar" (Backup e Info, substitui a obra atual).
- O servidor sempre tem uma pasta ativa; sem preferência salva, usa a pasta interna do app e cria ali um projeto vazio sem o usuário escolher.

### Decisões do usuário

| Tema | Decisão |
|---|---|
| Remover obra | Padrão: só sai da lista. Opção marcável "apagar também os arquivos do disco", com confirmação forte |
| Após remover a obra em uso | Tela inicial obrigatória com Nova obra, Abrir obra existente e Importar backup; abas bloqueadas até escolher |
| Importação | Duas funções separadas: "Importar obra de backup (como nova obra)" em Obras e "Restaurar esta obra para um backup anterior" só em Backup e Info |
| Local das obras | Pasta-raiz única; criar obra pede só o nome, com "Escolher outro local" opcional |
| Ações | Topo: Nova obra, Abrir obra de outra pasta, Importar backup. Por obra: Abrir, Renomear, Duplicar, Mover, Remover. Sai "Iniciar repositório vazio" |
| Estrutura da interface | Obras vira tela própria no menu lateral (abordagem 1) |

### Restrições mantidas

Operação offline; uma obra = uma pasta com `projeto.json`, `fotos\`, `backups\` e `backup-config.json`; escrita atômica; trava de revisão (`X-Workspace-Revision`, `X-Project-Revision` ou `revision` no corpo); nunca sobrescrever um `projeto.json` existente; nunca criar projeto automaticamente; compatibilidade com `obras.json` e `pasta-trabalho.json` existentes.

## 2. Servidor

### 2.1 Estado "nenhuma obra aberta"

- `pasta-trabalho.json` passa a aceitar `{"path": null}`.
- Na inicialização:
  - preferência com caminho válido → comportamento atual;
  - preferência com `path: null` → sem obra aberta;
  - **sem `pasta-trabalho.json`** → sem obra aberta (antes: usava a pasta de dados `DER_DATA_DIR`/`LOCALAPPDATA` como obra). Exceção de compatibilidade: se a pasta de dados já contém `projeto.json` (instalação antiga que usava esse modo), ela continua sendo a obra aberta e é registrada.
  - preferência com caminho inválido (não absoluto ou JSON corrompido) → continua recusando iniciar, como hoje.
- `workspace` em `server.ts` passa a ser `string | null`; `revision` continua existindo (troca a cada ativação, inclusive para "sem obra").
- Nova função `requireWorkspace()` em `server.ts`: devolve a pasta ativa ou lança erro `409` com a mensagem **"Nenhuma obra aberta. Crie ou abra uma obra."** e código `NO_WORKSPACE`.
- Usam `requireWorkspace()`: `GET/PUT /api/project`, `POST /api/photos/delete-copies`, rotas `/api/rdo/*`, `POST /api/workspace/switch` (modo `copy`), e no `reliability.ts`: `GET/POST /api/backups`, `PUT /api/backups/settings`, `DELETE /api/backups/:id`, `POST /api/project/restore`.
- Sem obra aberta:
  - `GET /api/workspace` → `{path: null, revision, contentRevision: 'empty'}`;
  - `GET /api/project` → `409 NO_WORKSPACE`;
  - `GET /api/diagnostics` → responde normalmente com `workspace: null`, `freeBytes: null`, `lastSaved: null`, `lastBackup: null`;
  - `reliability.hash()` → `'empty'`.
- `ctx.activate(next: string | null)` grava a preferência, atualiza `workspace` e gera nova `revision`. `activate(null)` é o único caminho para o estado sem obra.
- `registerActive()` em `obras.ts` não registra nada quando não há obra aberta; `GET /api/obras` com lista vazia não inventa uma obra.

### 2.2 Pasta-raiz das obras

- Guardada no registro `obras.json` em um campo novo e opcional `raiz: string | null`. Registros antigos sem o campo continuam válidos.
- `GET /api/obras/raiz` → `{raiz: string | null, sugestao: string}`. A `sugestao` é:
  1. a pasta acima de `Obras` quando a obra aberta está em `…\Obras\<nome>`;
  2. caso contrário, `<Documentos do usuário>\SIS RDO` (`path.join(os.homedir(), 'Documents', 'SIS RDO')`).
- `PUT /api/obras/raiz` `{raiz}` → valida caminho absoluto, cria a pasta se não existir, confere permissão de escrita e grava. Não move obras existentes.
- `GET /api/obras` passa a devolver também `raiz`.

### 2.3 Rotas de obra

| Método e rota | Corpo | Comportamento |
|---|---|---|
| `POST /api/obras` | `{nome, mode: 'new'\|'open', path?, open?}` | `new`: destino `path ?? raiz` + `\Obras\<nome>`; se não houver `path` nem `raiz`, erro 400 "Defina a pasta das obras." `open`: `path` obrigatório e é a pasta do próprio projeto; mantém o recurso atual de procurar `path\Obras\<nome>` quando a pasta não tem `projeto.json`. O modo `copy` sai desta rota (vira `duplicate`). |
| `POST /api/obras/:id/duplicate` | `{revision, nome, path?}` | Lê o `projeto.json` **da obra :id** (aberta ou não), cria `path ?? raiz` + `\Obras\<nome>` com projeto e cópias de fotos. Recusa destino existente. Não ativa a cópia. |
| `POST /api/obras/import` | `{revision, nome, project, backupHash?, path?}` | Igual ao atual, com `path` opcional (padrão: raiz). Continua abrindo a obra importada. |
| `POST /api/obras/:id/open` | `{revision}` | Igual ao atual; também funciona a partir do estado sem obra. |
| `POST /api/obras/:id/move` | `{revision, path}` | Só o modo "mover todo o conteúdo"; o modo `fresh` é removido. Vale para **qualquer obra**: se for a aberta, ativa o novo caminho como hoje; se não for, apenas atualiza `path` no registro. `path` é a pasta-base; destino `path\Obras\<nome>`. Regras atuais de destino vazio, sem aninhamento e verificação de bytes mantidas. |
| `PUT /api/obras/:id` | `{nome}` | Renomear (sem mudança). |
| `GET /api/obras/:id/backup` | — | Devolve o `projeto.json` da obra :id (aberta ou não) no envelope de backup atual (`kind: 'der-backup'`, `sha256`), como download `DER-backup-<nome>-<data>.json`. Para a obra aberta, a interface chama `flush()` antes. Pasta indisponível ou sem projeto → 400. |
| `DELETE /api/obras/:id` | `{revision, apagarArquivos?: boolean, confirmacao?: string}` | Ver 2.4. |

### 2.4 Remover obra

1. Valida `revision` (409 se divergente).
2. Sem `apagarArquivos`: remove a entrada do registro. Arquivos intocados.
3. Com `apagarArquivos: true`:
   - `confirmacao` deve ser igual ao nome da obra (comparação sem diferença de maiúsculas/minúsculas e com espaços normalizados); senão, 400 "Digite o nome da obra para confirmar.";
   - chama `apagarConteudoGerenciado(pasta)` — função isolada em `obras.ts`, exportada para teste:
     - apaga apenas: `projeto.json`, `projeto.json.bak`, `projeto.json.tmp`, `fotos\`, `backups\`, `backup-config.json`;
     - recusa atalhos (symlink/junction) em qualquer item gerenciado;
     - remove a pasta da obra somente se ficar vazia; se a pasta-pai for `Obras` e ficar vazia, ela permanece (não apagar pastas acima da obra);
     - devolve `{apagados: string[], preservados: string[], falhas: string[]}`, sendo `preservados` os nomes de itens não gerenciados que ficaram na pasta;
   - pasta indisponível: nada a apagar; a remoção do registro segue e o aviso informa.
4. Se houver `falhas`, a obra **permanece no registro** e a resposta é 500 com a lista do que foi e do que não foi apagado.
5. Se a obra removida for a aberta: `ctx.activate(null)` e `activeId = null`.
6. Resposta: `{success, semObra: boolean, apagados, preservados}`.

O backup prévio é responsabilidade da interface (3.4): o servidor não é chamado enquanto o download não terminar.

## 3. Interface

### 3.1 Navegação

- Novo item **Obras** no topo do menu lateral (`App.tsx`, lista `TABS`); o botão "Obras" da barra superior é removido.
- O rodapé da barra lateral continua mostrando nome e pasta da obra aberta; clicar nele abre a tela Obras.
- `ObrasModal.tsx` é removido.

### 3.2 Tela Obras (`src/components/obras/ObrasPage.tsx`)

- Cabeçalho: "Pasta das obras: `<raiz>`" com **Alterar** (painel com seletor de pasta). Se a raiz não estiver definida, mostra a sugestão e o botão **Usar esta pasta**.
- Botões principais: **Nova obra**, **Abrir obra de outra pasta**, **Importar backup**.
- Busca por nome, contrato, rodovia ou caminho; ordenação por **último acesso** (padrão) ou **nome**.
- Lista de `ObraCard.tsx`: a obra em uso sempre primeiro, destacada com "EM USO"; avisos atuais de "Pasta indisponível" e "Sem projeto" mantidos.
- Ações por cartão: **Abrir** (só nas não abertas, com pasta disponível e projeto), **Renomear** (edição no próprio cartão), **Duplicar**, **Mover**, **Remover**.
- Aviso de versão divergente entre interface e servidor mantido (usando `version.ts`).

### 3.3 Painéis (`src/components/obras/paineis/*.tsx`)

Um painel por vez, sobre a tela, com título, texto do que acontece, campos, erro dentro do painel e botões Cancelar / ação principal. Confirmações no próprio painel, substituindo `confirm()` do navegador.

| Painel | Campos e textos |
|---|---|
| `NovaObra` | Nome. "Será criada em: `<raiz>\Obras\<nome>`". Link "Escolher outro local" (seletor). Caixa "Abrir esta obra em seguida" marcada. |
| `AbrirOutraPasta` | Pasta do projeto (seletor ou digitação), nome para a lista (sugestão: nome da pasta). Valida antes de registrar e abre em seguida. |
| `ImportarBackup` | Arquivo `.json`, nome (sugerido pelo contrato), "Será criada em: …", link "Escolher outro local". Texto: "Cria uma **obra nova** a partir do backup. A obra aberta não é alterada." |
| `Duplicar` | Nome da cópia (sugestão: "`<nome>` (cópia)"), "Será criada em: …". Texto: "A cópia é independente; a obra original continua aberta." |
| `Mover` | Pasta-base de destino, "A obra ficará em: …". Texto: projeto, fotos e backups são copiados, conferidos e removidos da pasta atual. |
| `Remover` | Ver 3.4. |

### 3.4 Painel Remover

- Texto padrão: "A obra sai da lista. Os arquivos continuam em `<pasta>`."
- Caixa **"Apagar também os arquivos do disco"**. Ao marcar, aparecem:
  - "Serão apagados: projeto, fotos copiadas pelo app, backups da obra." e "Outros arquivos da pasta serão preservados.";
  - caixa **"Baixar um backup completo antes de apagar"**, marcada por padrão, para qualquer obra com projeto disponível; o arquivo vem de `GET /api/obras/:id/backup` e pode ser importado depois por *Importar backup*;
  - campo **"Digite o nome da obra para confirmar"**; o botão de remover só habilita quando o texto confere.
- Se for a obra em uso: aviso "Depois disso nenhuma obra ficará aberta. Você escolherá ou criará outra."
- Sequência ao confirmar a obra em uso: `flush()` → (se marcado) download do backup → `DELETE` → recarrega a aplicação, que abre na tela inicial.
- Resultado com itens preservados: a tela seguinte mostra a lista de preservados.

### 3.5 Tela inicial sem obra (`src/components/obras/BoasVindas.tsx`)

- Exibida por `App.tsx` quando `GET /api/workspace` devolve `path: null`. O salvamento automático não é iniciado; todos os itens do menu, exceto Obras, ficam desativados; a barra superior mostra apenas "Nenhuma obra aberta".
- Conteúdo: título "Nenhuma obra aberta", três cartões (**Nova obra**, **Abrir obra existente**, **Importar backup**) que abrem os mesmos painéis de 3.3, e, se houver obras registradas, a lista curta com botão **Abrir**.
- Se a raiz não estiver definida, o painel Nova obra pede a pasta com a sugestão preenchida.

### 3.6 Backup e Info (`ReliabilityPanel.tsx`)

- O botão de restaurar passa a se chamar **"Restaurar esta obra para um backup anterior"**, com o texto: "Substitui o conteúdo da obra aberta. Um backup do estado atual é criado antes." Sem obra aberta, o painel mostra só o diagnóstico.
- As funções `backup`/`restore` e a referência `backupInput` em `App.tsx` não estão ligadas a nenhum botão (código morto) e são removidas; restaurar fica apenas em Backup e Info.

### 3.7 Chamadas à API

Todas as chamadas de obras ficam em `src/services/obrasApi.ts` (listar, raiz, criar, abrir, importar, duplicar, mover, renomear, remover, escolher pasta), com o tratamento de erro único (`res.ok` e mensagem do servidor).

## 4. Erros

- Cada painel mostra o erro dentro dele e permanece aberto.
- Remoção com apagar arquivos e falha parcial: a obra continua na lista; o painel lista o que foi e o que não foi apagado.
- Download do backup prévio cancelado ou com falha: nada é apagado e o painel informa.
- Conflito de revisão (409): mensagem atual "A pasta mudou. Reabra o aplicativo."
- Pasta-raiz sem permissão ou indisponível: erro no painel de raiz ou de criação, sem criar nada.
- Rota chamada sem obra aberta: 409 `NO_WORKSPACE`; a interface volta à tela inicial.

## 5. Testes

`test-obras.mjs` (ajustado e ampliado):

- instalação nova sem `pasta-trabalho.json` e sem projeto na pasta de dados → sem obra; `GET /api/project` 409; nenhum `projeto.json` criado;
- instalação antiga com `projeto.json` na pasta de dados → continua aberta e registrada;
- raiz: `GET` com sugestão, `PUT` com caminho relativo recusado, `PUT` válido gravado;
- nova obra só com nome → criada em `raiz\Obras\<nome>`; sem raiz e sem `path` → 400;
- duplicar obra não aberta → cópia com fotos e projeto; original intacta; destino existente recusado;
- mover obra não aberta → registro atualizado, conteúdo movido, sem ativação; modo `fresh` recusado;
- remover só do registro (obra não aberta) → arquivos intactos;
- remover obra aberta sem apagar → estado sem obra; arquivos intactos; `PUT /api/project` 409;
- remover com apagar e nome errado → 400, nada apagado;
- remover com apagar → itens gerenciados apagados, arquivo e subpasta alheios preservados e listados, pasta mantida por não estar vazia; em outra obra só com itens gerenciados, a pasta é removida;
- abrir obra a partir do estado sem obra → volta a ter obra aberta;
- `GET /api/obras/:id/backup` de obra não aberta → envelope válido, aceito por `POST /api/obras/import`;
- casos atuais de criação, abertura, importação, renomear e troca legada mantidos, ajustando os que usam `copy` ou `fresh`.

Critério de aceite: `tsc --noEmit` sem erros e suíte completa aprovada (`node --import tsx test-*.mjs`), `dist` reconstruído e sincronizado com a raiz.

## 6. Fora do escopo

- Exportar/importar o registro de obras entre computadores (pendência 14.5).
- Separar fotos do `projeto.json` (IMP-05).
- Janela nativa do Windows para confirmações (IMP-06); as confirmações passam a ser painéis da própria interface.
- Contagem de backups por obra na lista.
