# Catálogos de campos repetitivos — design

**Aplicativo de partida:** 1.11.0-equipe • **Aprovação do design:** Cesar Augusto Secco (conversa de 06/10/2026)

## 1. Objetivo

Dar a todo campo repetitivo do aplicativo um **catálogo guardado na obra**: uma lista que acelera o preenchimento, aceita item novo digitado direto no campo, e que pode ser administrada à parte — incluir, editar (corrigindo o texto em todos os registros de uma vez) e excluir o que não serve mais.

### Decisões do usuário

| Tema | Decisão |
|---|---|
| Alcance | Todos os campos repetitivos: equipes, funções, equipamentos, placas, rodovias, trechos, estacas, lados, categorias, descrições de serviço e ações corretivas |
| Editar um item | Atualiza o texto em **todos** os registros que o usam, sem perguntar |
| Onde o catálogo mora | Dentro da obra (no projeto), com a opção de trazer o catálogo de outra obra |
| Excluir item em uso | **Bloqueado**: o app mostra quantos registros usam e quais são, com o atalho "Corrigir agora"; depois de corrigidos, a exclusão passa |
| Onde administrar | Tela "Catálogos" no menu lateral, com atalho ao lado de cada campo |
| Descrição do serviço | Mantém as três sugestões por uso recente **e** passa a ter catálogo |
| Abordagem | Mecanismo único (registro de catálogos + componente de campo único), aplicado a todos os painéis |

### Decisões tomadas pelo implementador (registradas para correção)

- Como a escolha foi editar sem confirmação, toda edição que altere registros cria **backup automático antes** e mostra **depois** quantos registros foram alterados.
- *Lado* e *categoria* viram catálogo já preenchido com os valores de hoje, aceitando itens novos.
- **Campos que faltam na tela são criados**, porque catálogo de campo sem controle não serve: hoje `categoria` não é editável em lugar nenhum, `estaca` só em Gerenciar fotos e `rodovia`/`trecho` só na importação (ver 4.3).

### Restrições

Operação offline; nenhuma dependência nova; os dados continuam em `projeto.json`; nenhuma operação de catálogo apaga registro, foto ou arquivo em disco; projetos existentes abrem sem perda e sem exigir migração manual; a trava de revisão entre janelas continua valendo.

## 2. Modelo de dados

### 2.1 Armazenamento

```ts
// src/types.ts
export type CatalogoId='equipes'|'funcoes'|'equipamentos'|'placas'|'rodovias'|'trechos'
 |'estacas'|'lados'|'categorias'|'servicos'|'acoes';
// em ReportConfig:
catalogos?: Partial<Record<CatalogoId,string[]>>;
```

O servidor valida ao gravar (`valid()` em `server.ts`): objeto simples, chaves pertencentes a `CatalogoId`, valores em array de textos não vazios com até 200 caracteres, no máximo 5.000 itens por catálogo. Projeto sem `catalogos` continua válido.

`PhotoRecord.categoria` deixa de ser união fechada e passa a `string` (o catálogo assume a padronização). `PhotoRecord.lado` já aceita `string`.

### 2.2 Normalização e identidade

```ts
export const chaveItem=(v:string)=>String(v??'')
 .normalize('NFD').replace(/[̀-ͯ]/g,'')   // acentos
 .replace(/[‐-―]/g,'-')                   // travessões
 .replace(/\s+/g,' ').trim().toUpperCase();
```

Dois textos com a mesma `chaveItem` são **o mesmo item** ("IGUARAÇU - MARINGÁ" e "Iguaraçu – Maringá"). O texto é guardado como digitado; só a comparação é tolerante. Um item com mais de uma grafia em uso é exibido agrupado, com a contagem de grafias e o botão Unificar.

### 2.3 Registro dos catálogos

```ts
export type Tela='fotos'|'equipe'|'equipamentos'|'acoes';
export type Dados={config:ReportConfig;photos:PhotoRecord[]};
export type Uso={id:string;tela:Tela;descricao:string}; // descrição curta para a lista
export type DefinicaoCatalogo={
 id:CatalogoId; rotulo:string; singular:string; tela:Tela; sementes:string[];
 valores:(d:Dados)=>string[];                       // todo texto em uso, com repetição
 usos:(d:Dados,item:string)=>Uso[];                 // registros que usam (chaveItem)
 renomear:(d:Dados,de:string,para:string)=>Dados;   // troca o texto em todos eles
};
export const CATALOGOS:DefinicaoCatalogo[];
```

Onde cada catálogo lê e escreve:

| Catálogo | Tela | Campos alcançados |
|---|---|---|
| equipes | equipe | `equipe.members[].meses[mês]` e `equipe.members[].equipe` |
| funcoes | equipe | `equipe.members[].funcao` **e** `historicoFuncao[].funcao` e `.anterior` |
| equipamentos | equipamentos | `equipamentos.items[].nome` **e as chaves de** `equipamentos.efetivo[data][nome]` |
| placas | equipamentos | `equipamentos.items[].placa` |
| rodovias | fotos | `photos[].rodovia` **e** `config.rodoviaPadrao` |
| trechos | fotos | `photos[].trecho` **e** `config.trechoPadrao` |
| estacas | fotos | `photos[].estaca` |
| lados | fotos | `photos[].lado` |
| categorias | fotos | `photos[].categoria`, a **tag derivada** das fotos sem tags próprias e a entrada correspondente em `config.tagCatalog` |
| servicos | fotos | `photos[].servico` |
| acoes | acoes | `config.acoes[].acao` |

Três casos delicados, cobertos por teste:

1. **Funções** vivem também no histórico (a função antiga de cada mês).
2. **Equipamentos** são a própria chave do efetivo diário (`efetivo[data][NOME]`, em maiúsculas).
3. **Categorias** são a tag inicial da foto: `photoTags()` devolve `photo.tags ?? [photo.categoria || 'Geral']`. Renomear a categoria muda a tag das fotos que não têm tags próprias (correto e desejado) e precisa renomear junto a entrada em `config.tagCatalog`, senão o filtro de tags passa a exibir um nome antigo sem fotos. Fotos com tags próprias não são tocadas.

### 2.4 Sementes de fábrica

- **equipes:** TERRAPLENAGEM, DRENAGEM, PAVIMENTAÇÃO, CONTENÇÃO E ESTRUTURAS, SINALIZAÇÃO E SEGURANÇA, ADMINISTRAÇÃO.
- **funcoes:** AJUDANTE GERAL, APONTADOR, ARMADOR, CARPINTEIRO, ENCARREGADO, MOTORISTA, OPERADOR, PEDREIRO, SERVENTE, TOPÓGRAFO, VIGIA, MECÂNICO, SOLDADOR, AUXILIAR DE LABORATÓRIO.
- **equipamentos:** as oito já embutidas hoje em `EquipamentosPanel` (ESCAVADEIRA HIDRÁULICA, RETROESCAVADEIRA, MOTONIVELADORA, ROLO COMPACTADOR, TRATOR DE ESTEIRA, CAMINHÃO BASCULANTE, CAMINHÃO PIPA, PÁ CARREGADEIRA).
- **lados:** LD, LE, MD, ME, PISTA, AMBOS (os do `select` atual).
- **categorias:** Terraplenagem, Drenagem e Obras de Arte, Pavimentação, Contenção e Estruturas, Sinalização e Segurança, Geral (a união que existe hoje em `types.ts`).
- **placas, rodovias, trechos, estacas, servicos, acoes:** sem sementes.

### 2.5 Preenchimento inicial

`semearCatalogos(d: Dados): Dados` — idempotente, executada ao abrir a tela Catálogos e antes de exportar/registrar: para cada catálogo, acrescenta ao que já está salvo os valores em uso (`valores()`) e as sementes, descartando repetições por `chaveItem` e preservando a grafia já presente no catálogo. Não altera registro algum.

## 3. Operações

### 3.1 Registrar item novo

- **Pelo campo:** `registrarValor(config, id, texto)` acrescenta o texto ao catálogo. É chamada **quando o registro é gravado** (adicionar pessoa, salvar foto, salvar equipamento, aplicar importação de planilha), nunca a cada tecla.
- **Pela tela:** botão "Adicionar item", que grava direto no catálogo, sem registro associado.
- Em ambos: texto vazio é ignorado; texto cuja `chaveItem` já existe não duplica.

### 3.2 Editar (renomear) e unificar

`renomearItem(d: Dados, id: CatalogoId, de: string, para: string): {dados: Dados; alterados: number}`

1. Sem `para`, ou `de` igual a `para`, nada acontece.
2. Se a `chaveItem` de `para` já existir no catálogo, os dois itens viram um só (fusão) — é também o que o botão **Unificar** faz entre grafias.
3. `renomear()` do catálogo troca o texto em todos os registros que casam por `chaveItem`, inclusive as chaves do efetivo de equipamentos e o histórico de função.
4. O catálogo passa a conter só a grafia nova.

Na tela, a sequência é: `flush()` → `POST /api/backups` com motivo `antes-de-editar-catalogo` → aplica → aviso "Trechos: 107 registros atualizados". Se o backup falhar, **nada é aplicado**. Quando o item não é usado por nenhum registro, o backup é dispensado.

### 3.3 Excluir

- Item **sem uso**: confirmação simples no próprio painel e sai do catálogo.
- Item **em uso**: a exclusão não acontece. O painel mostra a contagem, os 20 primeiros registros (descrição curta) e dois botões: **Corrigir agora**, que fecha a tela e abre a tela dos registros filtrada apenas pelos afetados, e **Cancelar**.
- Nenhum registro, foto ou arquivo é apagado em qualquer caso.

### 3.4 Trazer catálogo de outra obra

- Diálogo com a lista de obras registradas (sem a atual), as caixas dos catálogos a trazer (todas marcadas) e a contagem de itens de cada um.
- Acrescenta itens ao catálogo local, sem remover nem renomear nada e sem tocar nos registros.
- **Rota nova:** `GET /api/obras/:id/catalogos` → `{catalogos}` lido do `projeto.json` daquela obra, já passado por `semearCatalogos` para incluir o que está em uso lá. Obra indisponível ou sem projeto → 400 com mensagem.

### 3.5 Servidor

- `POST /api/backups` passa a aceitar, além de `antes-de-importar-equipe`, o motivo `antes-de-editar-catalogo`; qualquer outro → 400.
- `GET /api/obras/:id/catalogos` (acima).
- `valid()` valida `config.catalogos` (2.1).

## 4. Interface

### 4.1 Tela Catálogos

Item **Catálogos** no menu lateral, imediatamente antes de Configurações (desabilitado quando não há obra aberta).

- **Coluna esquerda:** os onze catálogos com a contagem de itens.
- **Coluna direita:** busca, **Adicionar item**, **Trazer catálogo de outra obra** e a lista de itens. Cada item traz: o texto, **"N registros"**, editar (campo no lugar, confirmando com Enter) e excluir. Item com mais de uma grafia aparece agrupado, com "2 grafias" e **Unificar**. Item sem uso recebe a marca "sem uso".
- Ordenação alfabética; a busca ignora acento e caixa.
- A tela recebe `config` e `photos` e devolve os dois, porque renomear altera registros e configuração ao mesmo tempo. A gravação é a existente de `App.tsx` (agrupada, 0,8 s), precedida de `flush()` quando há backup a criar.

### 4.2 Campo com catálogo

`CampoCatalogo` substitui os controles atuais: `input` com `list` (aceita texto novo), o ícone que abre a tela Catálogos naquela lista e, opcionalmente, sugestões extras exibidas abaixo (usado pela descrição do serviço, que mantém as três sugestões por uso recente).

### 4.3 Onde cada campo passa a existir

| Tela | Hoje | Depois |
|---|---|---|
| Importar fotos | lado (`select` fixo), rodovia, trecho, serviço | os mesmos com catálogo, **mais estaca e categoria** |
| Gerenciar fotos (edição) | data, hora, estaca, lado (`select` fixo), serviço, pasta | os mesmos com catálogo, **mais rodovia, trecho e categoria** |
| Equipe Técnica | equipe, função | com catálogo |
| Equipamentos | equipamento, placa | com catálogo |
| Ações Corretivas | ação | com catálogo |
| Configurações do relatório | rodovia padrão, trecho padrão | com catálogo |

### 4.4 "Corrigir agora"

`App.tsx` guarda `correcao: {tela: Tela; ids: string[]; item: string} | null`. A tela Catálogos preenche esse estado e troca de aba. A tela de destino mostra uma faixa — "Mostrando 12 registros que usam AJUDANTE GERAL · Limpar filtro" — e lista apenas esses registros. Em Gerenciar fotos isso é um filtro novo por conjunto de identificadores, que convive com os filtros existentes. Limpar o filtro, trocar de aba ou concluir as correções devolve a tela ao estado normal.

## 5. Erros

- Backup antes da edição falhou: nada é alterado, erro no painel.
- Texto vazio, igual ao atual ou só com espaços: nada acontece.
- Obra de origem indisponível ao trazer catálogo: mensagem, nada é alterado.
- Catálogo gravado por versão anterior ou corrompido: tratado como ausente e recriado por `semearCatalogos`, sem erro.
- Conflito de revisão entre janelas: mensagem existente ("A pasta mudou. Reabra o aplicativo.").

## 6. Testes

`test-catalogos.mjs` (`node --import tsx`), sobre funções puras:

- `chaveItem`: acento, caixa, espaços repetidos e travessão `–`/`—` produzem a mesma chave.
- `semearCatalogos`: preenche a partir dos registros e das sementes; rodar duas vezes não duplica nem muda a grafia já salva.
- `registrarValor`: acrescenta; não duplica por `chaveItem`; ignora vazio.
- `usos` e contagem, por catálogo, incluindo registro com o valor em grafia diferente.
- `renomearItem` propaga em: função **e** histórico de função; equipamento **e** chaves do efetivo; rodovia **e** `config.rodoviaPadrao`; trecho **e** `config.trechoPadrao`; equipe nos meses; lado, categoria, estaca, serviço e ação nas fotos/ações.
- `renomearItem` para um item existente funde os dois e devolve a contagem correta de alterados.
- Renomear uma **categoria** atualiza a tag derivada da foto sem tags próprias e a entrada em `config.tagCatalog`, sem alterar fotos que têm tags próprias.
- Unificar grafias: "IGUARAÇU - MARINGÁ" e "Iguaraçu – Maringá" viram uma só em todas as fotos.
- Exclusão: bloqueada com uso (com a lista de registros), liberada sem uso.
- Nenhuma operação altera a quantidade de fotos, de pessoas, de equipamentos nem o efetivo diário.

Servidor (acrescentar a `test-obras.mjs` e `test-pastas-backups.mjs`):

- `GET /api/obras/:id/catalogos` devolve os catálogos daquela obra, inclusive valores em uso; obra sem projeto → 400.
- `POST /api/backups` com `{reason:'antes-de-editar-catalogo'}` aceito; motivo desconhecido → 400.
- `PUT /api/project` recusa `config.catalogos` inválido (valor não textual) e aceita o válido.

Critérios de aceite: `tsc --noEmit`, suíte completa aprovada, `vite build`, `dist` reconstruído e sincronizado com a raiz.

## 7. Entrega em etapas

O desenho é único, mas a implementação pode parar com valor entregue ao fim de cada etapa:

1. Mecanismo (registro, funções puras, testes) + servidor.
2. Tela Catálogos + `CampoCatalogo` nas telas de cadastro (Equipe, Equipamentos, Ações).
3. Campos das fotos (importação, gerenciamento e padrões do relatório), incluindo os campos que faltam (4.3), e o "Corrigir agora" em Gerenciar fotos.
4. Trazer catálogo de outra obra.

## 8. Fora do escopo

- As *tags* das fotos, que já têm catálogo (`tagCatalog`) e editor próprios.
- Os responsáveis e textos do RDO, que são valores únicos do projeto e não listas.
- Edição em lote dos registros a partir da tela Catálogos (além da renomeação de um item).
- Catálogo compartilhado entre obras de forma automática — a cópia é sempre explícita.
