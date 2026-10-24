# Equipe técnica por planilha (Excel) — design

**Aplicativo de partida:** 1.10.0-obras • **Aprovação do design:** Cesar Augusto Secco (conversa de 05–06/10/2026)

## 1. Objetivo

Permitir manter o cadastro da equipe técnica pelo Excel — edição em massa, lista do RH, entradas e saídas — sem perder o histórico de presença, registrando a equipe de cada pessoa **mês a mês** (transferências entre equipes) e as mudanças de função com a data em que passam a valer.

### Decisões do usuário

| Tema | Decisão |
|---|---|
| Identificação | Matrícula do registro de funcionários é a chave |
| Formato da planilha | Uma linha por pessoa; colunas MATRÍCULA, NOME, FUNÇÃO e uma coluna por mês; a célula do mês contém a **equipe** naquele mês; vazia = não esteve na obra |
| Presença diária | Continua no app; a lista do mês define quem aparece na grade e em qual equipe |
| Função | Fixa na planilha; o app registra quando muda e os meses anteriores mantêm a função antiga |
| Onde editar | App e Excel, com conciliação por prévia na importação ("exporte antes de editar") |
| Abordagem | Importar/exportar `.xlsx` e `.csv` com prévia (não há arquivo vinculado) |

### Restrições

Operação offline; única mudança no servidor é o motivo opcional em `POST /api/backups` (3.4); nenhuma dependência nova (leitura de `.xlsx` com o `fflate` já instalado; escrita com `xlsxWriter.ts` existente); dados continuam dentro de `projeto.json` (`config.equipe`); nada é apagado sem confirmação explícita; projetos existentes abrem sem perda.

## 2. Modelo de dados

### 2.1 Tipos (`src/types.ts`)

```ts
export interface MudancaFuncao { desde: string; funcao: string; anterior: string } // desde = 'YYYY-MM'
export interface EquipeMember {
  id: string;            // código interno; liga a pessoa às presenças diárias
  matricula?: string;    // chave da planilha; vazia em cadastros antigos até a primeira importação
  nome: string;
  funcao: string;        // função atual
  equipe?: string;       // equipe mais recente — só sugestão ao adicionar no app
  meses?: Record<string, string>;          // 'YYYY-MM' -> equipe naquele mês
  historicoFuncao?: MudancaFuncao[];       // em ordem crescente de 'desde'
}
export interface EquipeConfig {
  members: EquipeMember[];
  efetivo: Record<string, Record<string, number>>; // 'YYYY-MM-DD' -> id -> 1 (sem mudança)
}
```

### 2.2 Regras (`src/services/equipe.ts`)

- `funcaoNoMes(m, mes)`: percorre `historicoFuncao` em ordem; para um `mes` anterior ao `desde` de uma mudança, vale o `anterior` daquela mudança; sem histórico, vale `funcao`.
- `equipeNoMes(m, mes)`: `m.meses?.[mes]` ou `undefined`.
- `membrosDoMes(cfg, mes)`: pessoas com `meses[mes]` definido **mais** pessoas com presença marcada em algum dia desse mês sem `meses[mes]` (estas recebem a marca `semEquipeNoMes: true` para a tela avisar).
- `histogramaPorEquipe(cfg, datasDoMes)`: agrupa presenças diárias por `equipeNoMes` da pessoa no mês da data e por `funcaoNoMes`; pessoas sem equipe no mês caem em "SEM EQUIPE".
- `migrarEquipe(cfg, mesAtual)` — **idempotente**, aplicada ao abrir o painel e antes de exportar/importar:
  - pessoa sem `meses`: para cada mês em que ela tem presença em `efetivo`, `meses[mes] = equipe || 'SEM EQUIPE'`; se não tiver presença nenhuma, `meses[mesAtual] = equipe || 'SEM EQUIPE'`;
  - pessoa que já tem `meses` não é alterada;
  - devolve o mesmo objeto quando nada muda (para não disparar gravação).
- Ao alterar a equipe de um mês pelo app ou pela importação, `equipe` (sugestão) passa a ser a equipe do mês mais recente da pessoa.

### 2.3 Normalização

- Nome, função e equipe: `trim`, espaços repetidos viram um, `toLocaleUpperCase('pt-BR')`.
- Matrícula: texto, `trim`, sem zeros à esquerda para **comparação** (`'00123'` ≡ `'123'`); é gravada como veio na planilha.

## 3. Planilha

### 3.1 Exportar (`gerarPlanilhaEquipe` em `src/services/equipePlanilha.ts`)

- Arquivo `Equipe-<obra ou contrato>-<AAAA-MM-DD>.xlsx` gerado com `createXlsx`.
- Aba **Equipe**: cabeçalho `MATRÍCULA | NOME | FUNÇÃO | <meses>`; meses em ordem crescente, do primeiro mês com dados de qualquer pessoa até o mês atual, rótulo `MMM/AAAA` em maiúsculas (`ABR/2026`), gravado como texto; uma linha por pessoa ordenada por nome; célula do mês = equipe ou vazia.
- Aba **Leia-me**: (1) não altere a MATRÍCULA de quem já existe; (2) célula de mês vazia = não esteve na obra no mês; (3) nova pessoa = nova linha com matrícula; (4) novo mês = nova coluna `MMM/AAAA`; (5) para mudar a função, edite a coluna FUNÇÃO — o app pergunta a partir de qual mês vale; (6) exporte de novo antes de editar se o cadastro foi alterado no app.

### 3.2 Leitura (`lerPlanilhaEquipe(arquivo: {nome, bytes})`)

- `.xlsx`: `src/services/xlsxLeitor.ts` lê a **primeira aba** (via `xl/workbook.xml` + `xl/_rels/workbook.xml.rels`), `sharedStrings`, strings inline e números; devolve matriz de células (`string | number | null`).
- `.csv`: decodifica como UTF-8 (com ou sem BOM); se houver caractere de substituição (`�`), decodifica como Windows-1252; separador `;` se a primeira linha tiver mais `;` que `,`, senão `,`; respeita aspas.
- Cabeçalho: primeira linha que contenha MATRÍCULA (ou MATRICULA) e NOME; FUNÇÃO (ou FUNCAO) obrigatória.
- Coluna de mês reconhecida quando o cabeçalho for: `MMM/AAAA` ou `MMM/AA` (jan…dez, com ou sem acento, maiúsculas ou minúsculas), `MM/AAAA`, `AAAA-MM`, ou número entre 36526 e 73050 (data serial do Excel, convertida para o mês). Colunas não reconhecidas são ignoradas e listadas em `colunasIgnoradas`.
- Erro (nada muda) quando: arquivo ilegível; sem cabeçalho MATRÍCULA/NOME/FUNÇÃO; nenhuma coluna de mês reconhecida.

### 3.3 Prévia (`montarPrevia(cfg, planilha, mesFuncao)`)

Reconhecimento, por linha válida:
1. matrícula igual (normalizada) a de uma pessoa → **mesma pessoa**;
2. senão, nome normalizado igual ao de uma pessoa **sem matrícula** → **vínculo proposto** (marcado por padrão, desmarcável);
3. senão → **pessoa nova**.

Linhas recusadas (listadas): sem matrícula; sem nome; matrícula repetida no arquivo (todas as ocorrências).

A prévia contém: `novas`, `vinculadas`, `nomeAlterado`, `funcaoAlterada` (com `mesFuncao`, padrão = mês mais recente da planilha, editável uma vez para todas), `transferencias` (pessoa, mês, de → para), `entradasNoMes`, `saidasDoMes` (célula vazia onde havia equipe), `saidasRecusadas` (célula vazia em mês com presença diária — mantida e avisada), `equipesNovas` (equipes que não existem em nenhum mês do cadastro), `foraDaPlanilha` (pessoas do cadastro ausentes do arquivo; padrão = manter; cada uma com opção "remover" e o número de presenças que seriam perdidas), `recusadas`, `colunasIgnoradas`.

Somente os meses presentes como coluna na planilha são alterados; os demais meses de cada pessoa ficam intactos.

### 3.4 Aplicar (`aplicarPrevia(cfg, previa, escolhas)`)

- Função pura que devolve o novo `EquipeConfig`; não altera `efetivo`, exceto ao remover pessoas marcadas para remoção (remove também as presenças delas).
- Mudança de função: acrescenta `{desde: mesFuncao, funcao: nova, anterior: atual}` em `historicoFuncao` e atualiza `funcao`.
- Antes de aplicar, a tela cria um backup pela rota existente `POST /api/backups`, que passa a aceitar o corpo opcional `{reason: 'antes-de-importar-equipe'}` (único motivo extra aceito; qualquer outro valor → 400; sem corpo continua `manual`). Como os backups `manual`, ele não é apagado pela retenção diária/semanal, só pelo limite máximo. Se falhar, nada é aplicado e o erro é exibido.

## 4. Interface

- `EquipePanel.tsx`:
  - cadastro: colunas MATRÍCULA, NOME, FUNÇÃO, EQUIPE NO MÊS (do mês selecionado); formulário de inclusão com matrícula (opcional no app, recomendada), nome, função e equipe — inclui a pessoa no mês selecionado; editar nome/função/matrícula; trocar ou retirar a equipe da pessoa no mês selecionado;
  - mudança de função feita no app também registra `historicoFuncao` com `desde` = mês selecionado;
  - matrícula duplicada é recusada no app;
  - grade diária e histograma usam `membrosDoMes` e `histogramaPorEquipe`; pessoas `semEquipeNoMes` aparecem com aviso;
  - botões **Exportar planilha** e **Importar planilha**; o "Auto-preencher com RDO" atual permanece como está (fora do escopo);
  - remover pessoa no app continua com confirmação e passa a avisar quantas presenças serão apagadas, apagando-as junto (corrige o resíduo de presenças órfãs).
- `PreviaImportacaoEquipe.tsx`: painel com totais e seções da prévia (3.3), campo "Mudanças de função valem a partir de" (mês), caixas de vínculo e de remoção, e botões Cancelar / **Aplicar importação**.

## 5. Erros

- Leitura: mensagens específicas para arquivo ilegível, cabeçalho ausente e nenhum mês reconhecido.
- Linhas inválidas são listadas e não impedem as demais.
- Backup antes de aplicar falhou: importação não aplicada.
- Gravação após aplicar: tratada pelo salvamento normal ("Falha ao salvar").

## 6. Testes

`test-equipe.mjs` (`node --import tsx`), sobre as funções puras:

- `migrarEquipe`: equipe fixa vira equipe por mês nos meses com presença; sem presença recebe o mês atual; segunda execução devolve o mesmo objeto;
- `funcaoNoMes` com histórico;
- ida e volta: `gerarPlanilhaEquipe` → `lerPlanilhaEquipe` preserva matrículas, nomes acentuados ("CONCEIÇÃO"), funções e equipes por mês;
- `.csv` com `;` em Windows-1252 e com `,` em UTF-8 com BOM;
- cabeçalhos `ABR/2026`, `abr/26`, `04/2026`, `2026-04` e data serial 46113;
- matrícula `00123` na planilha casa com `123` no cadastro;
- prévia: pessoa nova; vínculo por nome de quem não tinha matrícula; nome corrigido mantém o `id` e as presenças; transferência PAVIMENTAÇÃO → DRENAGEM; função alterada a partir de um mês com meses anteriores mantendo a antiga; célula vazia em mês com presença recusada; pessoa fora da planilha mantida por padrão e removida (com presenças) quando escolhida; matrícula duplicada recusada; equipe nova sinalizada; mês ausente da planilha intacto;
- `histogramaPorEquipe` agrupa pela equipe do mês;
- erro sem cabeçalho e sem coluna de mês.

Servidor (acrescentar a `test-pastas-backups.mjs`): `POST /api/backups` com `{reason:'antes-de-importar-equipe'}` cria backup com esse motivo; motivo desconhecido → 400.

Critérios de aceite: `tsc --noEmit`, suíte completa aprovada, `vite build`, `dist` reconstruído e sincronizado.

## 7. Fora do escopo

- Folha A4 do relatório mensal de Equipe Técnica (cabeçalho do DER) — próxima etapa, usando `membrosDoMes` e `funcaoNoMes`.
- Alterações no "Auto-preencher com RDO" e na integração do efetivo com o número de profissionais do RDO.
- Importar a grade diária de presença pelo Excel.
