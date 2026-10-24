# Equipe técnica: abas separadas e marca de ativo — design

**Aplicativo de partida:** 1.12.1-efetivo-rdo • **Aprovação do design:** Cesar Augusto Secco (conversa de 06/10/2026)

## 1. Objetivo

Separar a tela de Equipe Técnica em duas abas internas — cadastro e efetivo do mês — e dar a cada pessoa uma marca de **ativo**, que decide se ela entra no **preenchimento automático** do efetivo pelo RDO. Serve para quem está de férias, afastado ou desligado: a pessoa continua no cadastro e no histórico, mas deixa de ser marcada automaticamente.

### Decisões do usuário

| Tema | Decisão |
|---|---|
| O que a marca significa | Vale só para o **presente** e só para o **preenchimento automático**. Presença já marcada é fato consumado e nunca muda |
| Forma da marca | Liga-desliga simples, **sem** data de início e fim |
| Efeito no histórico | Nenhum: a pessoa continua no cadastro, na equipe do mês e no histograma dos dias em que trabalhou |
| Campo ausente | Significa **inativa** |
| Pessoas já cadastradas | Na atualização, **todas passam a ativas** (são 123 na obra em uso, com setembro e outubro preenchidos) |
| Abas | **Um** item de menu, com duas abas internas |
| Divisão | Aba 1 = cadastro (com a marca e a planilha); aba 2 = grade diária + histograma por equipe |
| Planilha da equipe | **Leva** a marca, em uma coluna ATIVO |
| "Resumo" | É o que já existe: linha de Total Presentes e subtotais por equipe. Nenhum bloco novo |

### Decisões do implementador (registradas para correção)

- O formulário de cadastro traz a caixa **Ativo marcada por padrão**: nada fica "ausente", o usuário decide na hora, e o caso comum (a pessoa chegou para trabalhar) continua em um clique.
- A aba **Efetivo do mês** é a que abre primeiro, por ser o trabalho do dia a dia.
- A aba Cadastro ganha **busca por nome, matrícula ou função**: com 123 linhas, achar uma pessoa rolando a tabela é inviável no uso diário.

### Restrições

Operação offline; nenhuma dependência nova; os dados continuam em `projeto.json`; nenhuma presença já gravada é alterada ou apagada por esta mudança; projetos existentes abrem sem perda e sem exigir conversão manual.

## 2. Modelo de dados

### 2.1 Campo

```ts
// src/types.ts, em EquipeMember
ativo?: boolean; // ausente = inativa (ver 2.2: a conversão grava true nas que já existem)
```

### 2.2 Regra e conversão

```ts
// src/services/equipe.ts
export const estaAtivo = (m: EquipeMember) => m.ativo === true;
```

A regra é literal: **sem o campo, a pessoa é inativa**. O que evita desligar as 123 pessoas existentes é a conversão que já roda ao abrir o painel (`migrarEquipe`), hoje responsável por converter a equipe para o formato mensal. Ela passa a gravar também `ativo: true` em quem não tiver o campo.

- É **idempotente**: rodar de novo não muda nada.
- Não toca em quem já tem o campo, inclusive quem está com `false`.
- A condição de saída rápida, hoje `cfg.members.every(m => m.meses)`, passa a exigir também que `m.ativo` esteja definido.

### 2.3 Lista de ativos do mês

```ts
export const membrosAtivosDoMes = (cfg: EquipeConfig, mes: string) =>
  membrosDoMes(cfg, mes).filter(x => estaAtivo(x.membro));
```

`membrosDoMes` **não muda**: a grade diária e o histograma continuam mostrando todo mundo do mês.

## 3. Preenchimento automático

`preencherEfetivoComRdo` passa a usar `membrosAtivosDoMes` no lugar de `membrosDoMes`. O resto da função é preservado: dia sem número não é tocado, dia com zero grava vazio, marcação manual só é substituída com autorização.

`ResumoSyncRdo` ganha dois campos:

```ts
  inativos: number;    // pessoas da lista do mês puladas por estarem inativas
  semAtivos: boolean;  // o mês tem gente, mas nenhuma ativa
```

`semMembros` continua significando "não há ninguém na lista do mês". As duas situações têm **mensagens diferentes**: "não há ninguém neste mês" e "há N pessoas neste mês, mas nenhuma está ativa". Sem essa distinção, o usuário procuraria o problema no cadastro do mês quando o problema é a marca.

O diálogo de confirmação, que desde a 1.12.1 faz um ensaio antes de aplicar, passa a informar **quantas pessoas foram puladas por estarem inativas e quem são** (as primeiras, com o total). É isso que torna visível o esquecimento de religar alguém: o aviso aparece toda vez que o botão é usado.

**Marcar presença à mão continua valendo para quem está inativo.** A marca governa apenas o preenchimento automático.

## 4. Interface

### 4.1 Estrutura

Um item de menu, **Equipe Técnica**, com:

- o **seletor de mês acima das abas**, compartilhado pelas duas (o cadastro mostra função e equipe do mês selecionado);
- duas abas internas: **Efetivo do mês** (abre primeiro) e **Cadastro**.

### 4.2 Aba "Efetivo do mês"

Conteúdo atual, sem mudança de comportamento: botões Auto-preencher com RDO, XLSX e Imprimir; a grade diária; a linha Total Presentes com a comparação contra o RDO; o histograma por equipe com subtotais.

Única adição: na grade, quem está inativo recebe uma **marca discreta ao lado do nome**, para que a ausência de preenchimento automático tenha explicação à vista.

### 4.3 Aba "Cadastro"

- Botões Exportar e Importar planilha.
- **Contagem no alto:** "118 de 123 ativas".
- **Busca** por nome, matrícula ou função, ignorando acento e caixa.
- Formulário de inclusão com matrícula, equipe do mês, nome, função e a caixa **Ativo** (marcada por padrão).
- Tabela com Matrícula, Nome, Função no mês, Equipe no mês, **Ativo** (caixa que liga e desliga na hora) e as ações de editar e remover.

### 4.4 Organização dos arquivos

`EquipePanel.tsx` tem hoje 314 linhas e três tabelas. Passa a ser dividido, no padrão já usado em Obras e Catálogos:

- `components/equipe/EquipePanel.tsx` — a casca: mês, abas, estado compartilhado e gravação;
- `components/equipe/CadastroEquipe.tsx` — a aba de cadastro, com planilha e busca;
- `components/equipe/EfetivoDoMes.tsx` — a grade, os totais e o histograma.

## 5. Planilha da equipe

### 5.1 Coluna

A coluna **ATIVO** entra depois de FUNÇÃO e antes das colunas de mês:

`MATRÍCULA | NOME | FUNÇÃO | ATIVO | ABR/2026 | MAI/2026 | …`

A exportação escreve **SIM** ou **NÃO** para todas as pessoas. A coluna é excluída do reconhecimento de meses (hoje a leitura tenta interpretar como mês toda coluna que não seja MATRÍCULA, NOME ou FUNÇÃO; sem isso, ATIVO cairia na lista de colunas ignoradas).

### 5.2 Leitura

`LinhaPlanilha` ganha `ativo?: boolean` — `undefined` significa "a planilha não disse".

| Conteúdo da célula | Resultado |
|---|---|
| Coluna ausente no arquivo | `undefined` em todas as linhas: **a marca de ninguém muda** |
| SIM, S, 1, VERDADEIRO, ATIVO | `true` |
| NÃO, NAO, N, 0, FALSO, INATIVO | `false` |
| Vazia ou texto não reconhecido | `undefined` |

A comparação ignora acento, caixa e espaços nas pontas. Textos não reconhecidos são recolhidos para exibição na prévia.

### 5.3 Aplicação

- Pessoa **que já existe** com `ativo: undefined` → a marca não muda.
- Pessoa **nova** com `ativo: undefined` → nasce **inativa**, e o campo é gravado **explicitamente como `false`**. Deixar o campo ausente não serviria: a conversão descrita em 2.2 preenche com `true` tudo que estiver sem o campo e reativaria essa pessoa na próxima abertura da tela.
- Pessoa com `true` ou `false` → recebe o valor.

Pela mesma razão, **toda pessoa criada pelo aplicativo grava o campo explicitamente**. O estado "ausente" só existe em projetos anteriores a esta versão, e dura até a primeira abertura da tela.

### 5.4 Prévia

A prévia da importação ganha a seção **Situação**, com: quantas passam a inativas, quantas voltam a ativas e os textos não reconhecidos na coluna ATIVO (com a linha de cada um). As demais seções continuam como estão.

## 6. Erros

- Coluna ATIVO ausente: nenhuma mensagem de erro; é um caso normal (planilha gerada antes desta versão).
- Texto não reconhecido: a marca não muda e o caso é listado na prévia.
- As demais situações de erro da importação, do auto-preenchimento e da gravação continuam como estão.

## 7. Testes

Acrescentar a `test-equipe.mjs`, sobre as funções puras:

- `estaAtivo`: sem o campo é inativa; `true` é ativa; `false` é inativa.
- `migrarEquipe`: grava `ativo: true` em quem não tem; não altera quem está com `false`; rodar duas vezes devolve o mesmo objeto; continua convertendo os meses como antes.
- `membrosAtivosDoMes` devolve só os ativos, na mesma ordem de `membrosDoMes`.
- `preencherEfetivoComRdo`: pula os inativos; conta `inativos`; marca os N primeiros **ativos** na ordem da grade; `semAtivos` verdadeiro quando o mês tem gente e nenhuma ativa, com `semMembros` falso; mês sem ninguém mantém `semMembros` verdadeiro; dia sem número continua intocado; marcação manual de pessoa inativa não é apagada.
- Planilha: a exportação escreve a coluna ATIVO com SIM e NÃO; a ida e volta preserva a marca.
- Leitura: coluna ausente devolve `undefined` em todas as linhas; as grafias de sim e não; vazio e texto não reconhecido devolvem `undefined`; ATIVO não aparece em `colunasIgnoradas`.
- Aplicação: pessoa existente com `undefined` não muda; pessoa nova com `undefined` nasce inativa **com o campo gravado como `false`**, e passar `migrarEquipe` em seguida **não a reativa**; `true` e `false` são aplicados.

Critérios de aceite: `tsc --noEmit`, suíte completa aprovada, `vite build`, `dist` reconstruído e sincronizado com a raiz.

## 8. Fora do escopo

- Período de férias com data de início e fim, e qualquer controle de ausências.
- Resumo mensal novo (homens-dia, média diária, dias trabalhados).
- Mudanças no RDO ou na forma como o número de profissionais é informado.
