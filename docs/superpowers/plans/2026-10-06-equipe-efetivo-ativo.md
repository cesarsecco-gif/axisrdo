# Equipe técnica: abas separadas e marca de ativo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar a tela de Equipe Técnica em duas abas internas (Efetivo do mês e Cadastro) e dar a cada pessoa uma marca de **ativo** que decide se ela entra no preenchimento automático do efetivo pelo RDO.

**Architecture:** O campo `ativo` entra em `EquipeMember`; a regra é `ativo===true` (ausente = inativa), e a conversão que já roda ao abrir o painel grava `true` em quem não tem o campo. Só `preencherEfetivoComRdo` muda de comportamento. A planilha da equipe ganha a coluna ATIVO, com leitura tolerante que nunca desliga ninguém por omissão. O painel, hoje com 314 linhas e três tabelas, é dividido em casca + duas abas.

**Tech Stack:** TypeScript 5.8, React 19, Tailwind 4, Express 4; testes `node --import tsx`.

**Spec:** `docs/superpowers/specs/2026-10-06-equipe-efetivo-ativo-design.md`

## Global Constraints

- Diretório dos comandos: `codigo-fonte`. A pasta **não é repositório git**: sem commits; marcar as caixas deste plano ao concluir cada tarefa.
- Depois de alterar a interface, `npx vite build`; depois de alterar o servidor, `node build-tmp.mjs`. Esta entrega **não altera o servidor**.
- Nenhuma dependência nova. Nenhuma presença já gravada é alterada ou apagada por esta mudança.
- Regra do campo: `estaAtivo(m) = m.ativo === true`. **Ausente significa inativa.**
- Toda pessoa criada pelo aplicativo grava `ativo` explicitamente (`true` ou `false`), para que a conversão nunca a reative por engano.
- Coluna da planilha: `MATRÍCULA | NOME | FUNÇÃO | ATIVO | <meses>`. Exportação escreve `SIM` ou `NÃO`.
- Leitura da coluna: `SIM, S, 1, VERDADEIRO, ATIVO, TRUE` → `true`; `NAO, N, 0, FALSO, INATIVO, FALSE` → `false`; vazio ou texto não reconhecido → `undefined`. Comparação sem acento, sem distinguir caixa, com `trim`.
- **Coluna ausente no arquivo → a marca de ninguém muda.**
- Interface em português; comentários de código em inglês e só para restrições não óbvias.
- `@types/react` não está instalado: não passar `key` como prop de componente com props tipadas (usar `React.Fragment key`).
- Versão desta entrega: `1.13.0-equipe-ativo` (`codigo-fonte/version.ts`, `desktop-launcher.cjs`), `1.13.0` (`package.json`).

## Review Focus

1. Planilha exportada **antes** desta versão (sem coluna ATIVO), importada numa obra que já tem inativos — ninguém pode ser ativado nem desativado. Teste na Tarefa 3.
2. Pessoa nova vinda da planilha sem informação nasce inativa **e a conversão não a reativa** na abertura seguinte. Teste na Tarefa 3.
3. Mês com pessoas cadastradas mas **nenhuma ativa** — mensagem própria, distinta de "não há ninguém no mês", e nada é gravado. Teste na Tarefa 2.
4. A coluna ATIVO não pode ser interpretada como mês nem cair em `colunasIgnoradas`. Teste na Tarefa 3.
5. Com "sobrescrever" ligado, um dia cuja única marcação era de pessoa inativa é regravado sem ela — comportamento autorizado pelo usuário, mas precisa estar demonstrado. Teste na Tarefa 2.

---

### Task 1: Campo `ativo`, regra e conversão

**Files:**
- Modify: `codigo-fonte/src/types.ts` (interface `EquipeMember`)
- Modify: `codigo-fonte/src/services/equipe.ts` (`migrarEquipe`, funções novas)
- Modify: `codigo-fonte/test-equipe.mjs` (acrescentar ao fim)

**Interfaces:**
- Produces: `estaAtivo(m: EquipeMember): boolean`; `membrosAtivosDoMes(cfg: EquipeConfig, mes: string)` com o mesmo formato de `membrosDoMes`; `migrarEquipe` passa a gravar `ativo: true` em quem não tem o campo.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `codigo-fonte/test-equipe.mjs`:

```js

import {estaAtivo,membrosAtivosDoMes} from './src/services/equipe.ts';

// a regra é literal: sem o campo, a pessoa é inativa
assert.equal(estaAtivo({id:'x',nome:'X',funcao:'F'}),false,'sem o campo = inativa');
assert.equal(estaAtivo({id:'x',nome:'X',funcao:'F',ativo:true}),true);
assert.equal(estaAtivo({id:'x',nome:'X',funcao:'F',ativo:false}),false);

// a conversão marca como ativas as pessoas que já existiam
const antigas={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-09':'DRENAGEM'}},
 {id:'b',nome:'BIA',funcao:'APONTADOR',meses:{'2026-09':'OBRA'},ativo:false}],efetivo:{}};
const conv=migrarEquipe(antigas,'2026-10');
assert.equal(conv.members[0].ativo,true,'quem não tinha o campo vira ativa');
assert.equal(conv.members[1].ativo,false,'quem já estava inativa continua inativa');
assert.equal(migrarEquipe(conv,'2026-10'),conv,'conversão idempotente');

// a conversão continua convertendo os meses, e grava ativo no mesmo passo
const semMeses={members:[{id:'c',nome:'CARLOS',funcao:'PEDREIRO',equipe:'Pavimentação'}],efetivo:{'2026-08-03':{c:1}}};
const conv2=migrarEquipe(semMeses,'2026-10');
assert.deepEqual(conv2.members[0].meses,{'2026-08':'PAVIMENTAÇÃO'},'mês deduzido da presença');
assert.equal(conv2.members[0].ativo,true);

// lista de ativos do mês: mesma ordem de membrosDoMes, só com os ativos
const comInativo={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true},
 {id:'b',nome:'BIA',funcao:'APONTADOR',meses:{'2026-10':'DRENAGEM'},ativo:false},
 {id:'c',nome:'CLARA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true}],efetivo:{}};
assert.deepEqual(membrosDoMes(comInativo,'2026-10').map(x=>x.membro.id),['a','b','c']);
assert.deepEqual(membrosAtivosDoMes(comInativo,'2026-10').map(x=>x.membro.id),['a','c'],'só os ativos, na mesma ordem');
console.log('test-equipe: marca de ativo ok');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-equipe.mjs`
Expected: FAIL com `SyntaxError: ... does not provide an export named 'estaAtivo'`.

- [ ] **Step 3: Acrescentar o campo em `src/types.ts`**

Dentro de `export interface EquipeMember`, logo após a linha de `matricula`:

```ts
  ativo?: boolean; // ausente = inativa; migrarEquipe grava true nas que já existiam
```

- [ ] **Step 4: Implementar em `src/services/equipe.ts`**

Acrescentar logo depois de `funcaoNoMes`:

```ts
export const estaAtivo=(m:EquipeMember)=>m.ativo===true;
```

Substituir `migrarEquipe` inteira por:

```ts
export function migrarEquipe(cfg:EquipeConfig,mesAtual:string):EquipeConfig{
 if(cfg.members.every(m=>m.meses&&m.ativo!==undefined))return cfg;
 const mesesComPresenca=new Map<string,Set<string>>();
 for(const [data,dia] of Object.entries(cfg.efetivo||{}))for(const [id,v] of Object.entries(dia||{}))if(v){
  const s=mesesComPresenca.get(id)||new Set<string>();s.add(mesDe(data));mesesComPresenca.set(id,s);
 }
 const members=cfg.members.map(m=>{
  // Projects written before this version carry no "ativo": everyone already registered is active.
  const base=m.ativo===undefined?{...m,ativo:true}:m;
  if(base.meses)return base;
  const equipe=normalizarTexto(base.equipe)||SEM_EQUIPE;
  const meses:Record<string,string>={};
  for(const mes of [...(mesesComPresenca.get(base.id)||[])].sort())meses[mes]=equipe;
  if(!Object.keys(meses).length)meses[mesAtual]=equipe;
  return {...base,meses};
 });
 return {...cfg,members};
}
```

Acrescentar logo depois de `membrosDoMes`:

```ts
export const membrosAtivosDoMes=(cfg:EquipeConfig,mes:string)=>membrosDoMes(cfg,mes).filter(x=>estaAtivo(x.membro));
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-equipe.mjs`
Expected: todas as seções `ok`, terminando em `test-equipe: marca de ativo ok`.

---

### Task 2: Preenchimento automático só com os ativos

**Files:**
- Modify: `codigo-fonte/src/services/equipe.ts` (`ResumoSyncRdo`, `preencherEfetivoComRdo`)
- Modify: `codigo-fonte/test-equipe.mjs` (acrescentar ao fim)

**Interfaces:**
- Consumes: `estaAtivo`, `membrosAtivosDoMes` (Tarefa 1).
- Produces: `ResumoSyncRdo` com `inativos:number` e `semAtivos:boolean`; `preencherEfetivoComRdo` marcando só ativos.

- [ ] **Step 1: Ajustar o bloco de teste que já existe**

O bloco "auto-preenchimento" (de `const equipeRdo=` até `console.log('test-equipe: auto-preenchimento ok')`) usa pessoas **sem** o campo `ativo`, que pela regra nova são inativas: ele passaria a falhar inteiro. Duas correções nesse bloco:

1. Acrescentar `,ativo:true` aos três membros de `equipeRdo` (`'a'`, `'b'` e `'c'`).
2. A asserção que compara o resumo inteiro ganha os dois campos novos:

```js
assert.deepEqual(um.res,{preenchidos:1,zerados:1,marcacoes:2,semNumero:['2026-09-02'],mantidos:0,substituidos:0,semMembros:false,inativos:0,semAtivos:false});
```

Nenhuma outra asserção do bloco muda.

- [ ] **Step 2: Escrever o teste que falha**

Acrescentar ao fim de `codigo-fonte/test-equipe.mjs`. `preencherEfetivoComRdo` **já está importado** na linha 133 do arquivo: não repetir o `import`, que seria declaração duplicada.

```js

const tresPessoas={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true},
 {id:'b',nome:'BIA',funcao:'APONTADOR',meses:{'2026-10':'DRENAGEM'},ativo:false},
 {id:'c',nome:'CLARA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true}],efetivo:{}};
const dias=[{date:'2026-10-01',professionals:2}];

// marca só os ativos, na ordem da grade
let r=preencherEfetivoComRdo(tresPessoas,dias,'2026-10',false);
assert.deepEqual(r.efetivo['2026-10-01'],{a:1,c:1},'a inativa não é marcada');
assert.equal(r.res.inativos,1,'conta quantas foram puladas');
assert.equal(r.res.semMembros,false);assert.equal(r.res.semAtivos,false);
assert.equal(r.res.marcacoes,2);

// o total pedido é limitado ao número de ativos, não ao de pessoas do mês
r=preencherEfetivoComRdo(tresPessoas,[{date:'2026-10-01',professionals:3}],'2026-10',false);
assert.deepEqual(r.efetivo['2026-10-01'],{a:1,c:1},'não inventa uma terceira presença');
assert.equal(r.res.marcacoes,2);

// mês com gente, nenhuma ativa: nada é gravado e a situação é distinguível
const todasInativas={members:tresPessoas.members.map(m=>({...m,ativo:false})),efetivo:{}};
r=preencherEfetivoComRdo(todasInativas,dias,'2026-10',false);
assert.deepEqual(r.efetivo,{},'nada é gravado');
assert.equal(r.res.semAtivos,true,'o mês tem gente, mas nenhuma ativa');
assert.equal(r.res.semMembros,false,'não é o caso de mês vazio');
assert.equal(r.res.inativos,3);

// mês sem ninguém continua sendo semMembros
r=preencherEfetivoComRdo({members:[],efetivo:{}},dias,'2026-10',false);
assert.equal(r.res.semMembros,true);assert.equal(r.res.semAtivos,false);assert.equal(r.res.inativos,0);

// marcação manual de pessoa inativa é preservada quando não se autoriza sobrescrever
const comMarcaManual={...tresPessoas,efetivo:{'2026-10-01':{b:1}}};
r=preencherEfetivoComRdo(comMarcaManual,dias,'2026-10',false);
assert.deepEqual(r.efetivo['2026-10-01'],{b:1},'o dia já marcado fica intacto');
assert.equal(r.res.mantidos,1);

// com autorização para sobrescrever, o dia é regravado só com ativos
r=preencherEfetivoComRdo(comMarcaManual,dias,'2026-10',true);
assert.deepEqual(r.efetivo['2026-10-01'],{a:1,c:1},'a marcação da inativa sai porque o usuário autorizou');
assert.equal(r.res.substituidos,1);

// dia sem número continua intocado
r=preencherEfetivoComRdo(tresPessoas,[{date:'2026-10-02',professionals:null}],'2026-10',false);
assert.deepEqual(r.efetivo,{});assert.deepEqual(r.res.semNumero,['2026-10-02']);
console.log('test-equipe: auto-preenchimento com ativos ok');
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `node --import tsx test-equipe.mjs`
Expected: FAIL em `a inativa não é marcada` (hoje grava `{a:1,b:1}`).

- [ ] **Step 4: Implementar em `src/services/equipe.ts`**

Acrescentar ao tipo `ResumoSyncRdo`, depois da linha de `semMembros`:

```ts
 inativos:number;      // pessoas da lista do mês puladas por estarem inativas
 semAtivos:boolean;    // o mês tem gente, mas nenhuma está ativa
```

Substituir as duas primeiras linhas do corpo de `preencherEfetivoComRdo` por:

```ts
 const doMesTodos=membrosDoMes(cfg,mes);
 const ativos=doMesTodos.filter(x=>estaAtivo(x.membro));
 const ids=ativos.map(x=>x.membro.id);
 const efetivo:Record<string,Record<string,number>>={...cfg.efetivo};
 const res:ResumoSyncRdo={preenchidos:0,zerados:0,marcacoes:0,semNumero:[],mantidos:0,substituidos:0,
  semMembros:!doMesTodos.length,inativos:doMesTodos.length-ativos.length,semAtivos:!!doMesTodos.length&&!ativos.length};
```

O restante da função fica como está: ela já usa `ids`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-equipe.mjs`
Expected: termina em `test-equipe: auto-preenchimento com ativos ok`.

---

### Task 3: Coluna ATIVO na planilha

**Files:**
- Modify: `codigo-fonte/src/services/equipePlanilha.ts`
- Modify: `codigo-fonte/test-equipe.mjs` (acrescentar ao fim)

**Interfaces:**
- Consumes: `estaAtivo` (Tarefa 1).
- Produces:
  - `LinhaPlanilha` com `ativo?:boolean`
  - `PlanilhaEquipe` com `situacoesIgnoradas:{linha:number;texto:string}[]`
  - `Alteracao.tipo` aceitando `'ativa'|'inativa'`
  - `Previa` com `situacoesIgnoradas:{linha:number;texto:string}[]`
  - `gerarPlanilhaEquipe` escrevendo a coluna ATIVO

- [ ] **Step 1: Ajustar a ida e volta que já existe**

A asserção da linha 54 compara a linha lida inteira. A planilha gerada passa a ter a coluna ATIVO, então a marca aparece na leitura. No fixture `cad`, acrescentar `,ativo:true` aos dois membros, e na asserção seguinte acrescentar `ativo:true` ao objeto esperado:

```js
assert.deepEqual(lida.linhas,[{linha:2,matricula:'00123',nome:'HIDICLEVIO CONCEIÇÃO DE LIMA',funcao:'AJUDANTE GERAL',ativo:true,meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'','2026-06':'DRENAGEM'}}],'ida e volta preserva acentos e zeros');
```

As asserções de `doExcel.linhas` e `ansi.linhas` **não mudam**: esses arquivos não têm coluna ATIVO e a implementação do Step 4 omite a chave quando não há informação.

- [ ] **Step 2: Escrever o teste que falha**

Acrescentar ao fim de `codigo-fonte/test-equipe.mjs` (`lerPlanilhaEquipe`, `gerarPlanilhaEquipe`, `montarPrevia`, `aplicarPrevia` e `migrarEquipe` **já estão importados**; não repetir os `import`):

```js

// ---- coluna ATIVO na planilha ----
const comAtivo={members:[
 {id:'1',matricula:'10',nome:'ANA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true},
 {id:'2',matricula:'20',nome:'BIA',funcao:'APONTADOR',meses:{'2026-10':'DRENAGEM'},ativo:false}],efetivo:{}};
const idaVolta=lerPlanilhaEquipe({nome:'equipe.xlsx',bytes:gerarPlanilhaEquipe(comAtivo,'2026-10')});
assert.deepEqual(idaVolta.linhas.map(l=>[l.matricula,l.ativo]),[['10',true],['20',false]],'ida e volta preserva a marca');
assert.deepEqual(idaVolta.colunasIgnoradas,[],'ATIVO não entra em colunas ignoradas');
assert.deepEqual(idaVolta.meses,['2026-10'],'ATIVO não é lido como mês');

// grafias aceitas e recusadas
const csv=(corpo)=>lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;ATIVO;OUT/2026\n'+corpo,'utf8'))});
assert.equal(csv('1;ANA;ARMADOR;SIM;DRENAGEM\n').linhas[0].ativo,true);
assert.equal(csv('1;ANA;ARMADOR;s;DRENAGEM\n').linhas[0].ativo,true);
assert.equal(csv('1;ANA;ARMADOR;NÃO;DRENAGEM\n').linhas[0].ativo,false,'com acento');
assert.equal(csv('1;ANA;ARMADOR;nao;DRENAGEM\n').linhas[0].ativo,false);
assert.equal(csv('1;ANA;ARMADOR;0;DRENAGEM\n').linhas[0].ativo,false);
assert.equal(csv('1;ANA;ARMADOR;;DRENAGEM\n').linhas[0].ativo,undefined,'vazio não diz nada');
const naoEntendido=csv('1;ANA;ARMADOR;FÉRIAS;DRENAGEM\n');
assert.equal(naoEntendido.linhas[0].ativo,undefined,'texto não reconhecido não diz nada');
assert.deepEqual(naoEntendido.situacoesIgnoradas,[{linha:2,texto:'FÉRIAS'}],'e fica listado');

// coluna ausente: ninguém muda
const semColuna=lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;OUT/2026\n10;ANA;ARMADOR;DRENAGEM\n20;BIA;APONTADOR;DRENAGEM\n','utf8'))});
assert.deepEqual(semColuna.linhas.map(l=>l.ativo),[undefined,undefined]);
const pSem=montarPrevia(comAtivo,semColuna);
assert.deepEqual(pSem.alteracoes.filter(a=>a.tipo==='ativa'||a.tipo==='inativa'),[],'planilha antiga não propõe mudança de situação');
const aplicadoSem=aplicarPrevia(comAtivo,pSem,{mesFuncao:'2026-10',desvincular:new Set(),remover:new Set()});
assert.deepEqual(aplicadoSem.members.map(m=>m.ativo),[true,false],'a marca de ninguém muda');

// mudança de situação proposta e aplicada
const comColuna=lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;ATIVO;OUT/2026\n10;ANA;ARMADOR;NAO;DRENAGEM\n20;BIA;APONTADOR;SIM;DRENAGEM\n','utf8'))});
const pCom=montarPrevia(comAtivo,comColuna);
assert.deepEqual(pCom.alteracoes.filter(a=>a.tipo==='inativa').map(a=>a.nome),['ANA']);
assert.deepEqual(pCom.alteracoes.filter(a=>a.tipo==='ativa').map(a=>a.nome),['BIA']);
const aplicadoCom=aplicarPrevia(comAtivo,pCom,{mesFuncao:'2026-10',desvincular:new Set(),remover:new Set()});
assert.deepEqual(aplicadoCom.members.map(m=>[m.nome,m.ativo]),[['ANA',false],['BIA',true]]);

// pessoa nova sem informação nasce inativa, com o campo gravado, e a conversão não a reativa
const nova=lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;ATIVO;OUT/2026\n99;NOVA PESSOA;SERVENTE;;DRENAGEM\n','utf8'))});
const pNova=montarPrevia({members:[],efetivo:{}},nova);
const comNova=aplicarPrevia({members:[],efetivo:{}},pNova,{mesFuncao:'2026-10',desvincular:new Set(),remover:new Set()});
assert.equal(comNova.members[0].ativo,false,'nasce inativa');
assert.equal(migrarEquipe(comNova,'2026-10').members[0].ativo,false,'a conversão não a reativa');
console.log('test-equipe: coluna ATIVO ok');
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `node --import tsx test-equipe.mjs`
Expected: FAIL em `ida e volta preserva a marca` (`l.ativo` é `undefined`).

- [ ] **Step 4: Implementar em `src/services/equipePlanilha.ts`**

1. No import de `./equipe`, acrescentar `estaAtivo`.

2. Trocar os tipos de leitura:

```ts
export type LinhaPlanilha={linha:number;matricula:string;nome:string;funcao:string;ativo?:boolean;meses:Record<string,string>};
export type Recusa={linha:number;motivo:string};
export type PlanilhaEquipe={meses:string[];linhas:LinhaPlanilha[];recusadas:Recusa[];colunasIgnoradas:string[];situacoesIgnoradas:{linha:number;texto:string}[]};
```

3. Acrescentar, logo antes de `export function lerPlanilhaEquipe`:

```ts
const SIM=['SIM','S','1','VERDADEIRO','ATIVO','TRUE'];
const NAO=['NAO','N','0','FALSO','INATIVO','FALSE'];
// Returns undefined when the cell says nothing: the caller must not change the flag.
function interpretarAtivo(c:Celula){
 const t=String(c??'').trim();
 if(!t)return {};
 const k=t.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
 if(SIM.includes(k))return {ativo:true};
 if(NAO.includes(k))return {ativo:false};
 return {texto:t};
}
```

4. Dentro de `lerPlanilhaEquipe`, depois da linha que define `cFunc` e lança o erro de FUNÇÃO:

```ts
 const cAtivo=cab.findIndex(c=>chaveCabecalho(c)==='ATIVO');
```

5. Na detecção de colunas de mês, excluir também a coluna ATIVO. Trocar a linha:

```ts
  if(i===cMat||i===cNome||i===cFunc||c===null||c==='')return;
```

por:

```ts
  if(i===cMat||i===cNome||i===cFunc||i===cAtivo||c===null||c==='')return;
```

6. Declarar a lista junto de `lidas` e `recusadas`:

```ts
 const situacoesIgnoradas:{linha:number;texto:string}[]=[];
```

7. No laço das linhas, **depois** dos três `continue` (linha em branco, sem matrícula, sem nome) e imediatamente antes de `lidas.push`, para não reclamar da coluna ATIVO de linhas que nem serão importadas:

```ts
  const sit=cAtivo>=0?interpretarAtivo(l[cAtivo]):{};
  if(sit.texto)situacoesIgnoradas.push({linha:i+1,texto:sit.texto});
  // The key is left out when the sheet says nothing, so nobody's flag changes.
  lidas.push({linha:i+1,matricula,nome,funcao,...(sit.ativo===undefined?{}:{ativo:sit.ativo}),meses});
```

(a linha `lidas.push({linha:i+1,matricula,nome,funcao,meses});` é substituída pelas quatro acima)

8. No `return` da função, acrescentar `situacoesIgnoradas` ao objeto devolvido.

9. Na exportação, trocar o corpo de `gerarPlanilhaEquipe`:

```ts
 const rows=[...cfg.members].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
  .map(m=>[m.matricula||'',m.nome,m.funcao,estaAtivo(m)?'SIM':'NÃO',...meses.map(k=>m.meses?.[k]||'')]);
 return createXlsx([
  {name:'Equipe',headers:['MATRÍCULA','NOME','FUNÇÃO','ATIVO',...meses.map(rotuloMes)],rows},
  {name:'Leia-me',headers:['Como usar esta planilha'],rows:LEIA_ME.map(t=>[t])},
 ]);
```

10. Acrescentar duas linhas ao `LEIA_ME`, antes da última:

```ts
 'Coluna ATIVO: SIM para quem está à disposição, NÃO para quem está de férias, afastado ou desligado.',
 'A coluna ATIVO só afeta o preenchimento automático do efetivo; presenças já marcadas nunca mudam.',
```

11. No tipo `Alteracao`, acrescentar os dois valores à união de `tipo`:

```ts
export type Alteracao={tipo:'matricula'|'nome'|'funcao'|'ativa'|'inativa'|'entrada'|'transferencia'|'saida'|'saidaRecusada';matricula:string;nome:string;mes?:string;de?:string;para?:string;porNome:boolean;presencas?:number};
```

12. No tipo `Previa`, acrescentar `situacoesIgnoradas:{linha:number;texto:string}[];`.

13. Em `montarPrevia`, dentro do laço dos pares, logo após a linha que trata a alteração de função:

```ts
  if(linha.ativo!==undefined&&linha.ativo!==estaAtivo(membro))alteracoes.push({...base,tipo:linha.ativo?'ativa':'inativa'});
```

e acrescentar ao objeto devolvido:

```ts
situacoesIgnoradas:planilha.situacoesIgnoradas||[],
```

O `||[]` importa: há três testes que montam um `PlanilhaEquipe` à mão, sem esse campo, e a prévia percorre a lista com `.map`.

14. Em `novoMembro`, gravar o campo explicitamente:

```ts
 return {id:crypto.randomUUID(),matricula:l.matricula,nome:l.nome,funcao:l.funcao,ativo:l.ativo===true,meses,equipe:equipeMaisRecente(meses)};
```

15. Em `aplicarPrevia`, na montagem de `r` para cada par:

```ts
  let r:EquipeMember={...m,matricula:par.linha.matricula,nome:par.linha.nome,...(par.linha.ativo===undefined?{}:{ativo:par.linha.ativo})};
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-equipe.mjs`
Expected: todas as seções do arquivo passam, terminando em `test-equipe: coluna ATIVO ok`.

---

### Task 4: Seção "Situação" na prévia da importação

**Files:**
- Modify: `codigo-fonte/src/components/PreviaImportacaoEquipe.tsx`

**Interfaces:**
- Consumes: `Alteracao` com `'ativa'|'inativa'` e `Previa.situacoesIgnoradas` (Tarefa 3).

- [ ] **Step 1: Descrever os dois tipos novos**

Em `descrever`, antes do `return` final (o que trata `saidaRecusada`), acrescentar:

```tsx
 if(a.tipo==='ativa')return `${a.nome}: passa a ATIVA`;
 if(a.tipo==='inativa')return `${a.nome}: passa a INATIVA`;
```

- [ ] **Step 2: Exibir as seções**

Logo após a seção de "Função alterada", acrescentar:

```tsx
   {secao('Passam a inativas — ficam fora do preenchimento automático',de('inativa'),'border-amber-300')}
   {secao('Voltam a ativas',de('ativa'),'border-emerald-200')}
   {secao('Coluna ATIVO não entendida — a marca não muda',previa.situacoesIgnoradas.map(s=>`Linha ${s.linha}: "${s.texto}"`),'border-slate-200')}
```

- [ ] **Step 3: Incluir a situação no teste de "sem mudança"**

A constante `semMudanca` decide se o botão Aplicar fica desabilitado. As alterações de situação já entram nela, porque são `alteracoes`; nenhuma mudança é necessária. Conferir lendo a linha de `semMudanca` e confirmar que ela olha `previa.alteracoes.some(a=>a.tipo!=='saidaRecusada')`.

- [ ] **Step 4: Verificar compilação**

Run: `npx tsc --noEmit && npx vite build`
Expected: sem erros; `✓ built`.

---

### Task 5: Dividir o painel em três arquivos, sem mudar comportamento

**Files:**
- Create: `codigo-fonte/src/components/equipe/EquipePanel.tsx`
- Create: `codigo-fonte/src/components/equipe/CadastroEquipe.tsx`
- Create: `codigo-fonte/src/components/equipe/EfetivoDoMes.tsx`
- Delete: `codigo-fonte/src/components/EquipePanel.tsx`
- Modify: `codigo-fonte/src/App.tsx` (caminho do import)

**Interfaces:**
- Produces:
  - `EquipePanel(props)` com a mesma assinatura de hoje: `{config,onChange,flush,headers,onAbrirCatalogo,correcao,onLimparCorrecao}`
  - `CadastroEquipe({config,cfg,monthFilter,rotulo,salvar,salvarCom,onChange,flush,headers,onAbrirCatalogo,correcao,onLimparCorrecao})`
  - `EfetivoDoMes({cfg,monthFilter,rotulo,monthDates,rdoDays,salvar,flush})`

Esta tarefa é uma **mudança de arrumação**: nenhum comportamento muda. A prova é a suíte continuar passando e a compilação limpa.

- [ ] **Step 1: Criar a casca `equipe/EquipePanel.tsx`**

```tsx
import React,{useEffect,useMemo,useState} from 'react';
import {ReportConfig,EquipeConfig} from '../../types';
import {migrarEquipe} from '../../services/equipe';
import {rotuloMes} from '../../services/equipePlanilha';
import {registrarValores,CatalogoId} from '../../services/catalogos';
import {CadastroEquipe} from './CadastroEquipe';
import {EfetivoDoMes} from './EfetivoDoMes';

const mesCorrente=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};

export function EquipePanel({config,onChange,flush,headers,onAbrirCatalogo,correcao,onLimparCorrecao}:{
 config:ReportConfig;onChange:(c:Partial<ReportConfig>)=>void;flush:()=>Promise<unknown>;headers:()=>Record<string,string>;
 onAbrirCatalogo?:(c:CatalogoId)=>void;correcao?:{ids:string[];item:string};onLimparCorrecao?:()=>void;
}){
 const base=useMemo<EquipeConfig>(()=>({members:Array.isArray(config.equipe?.members)?config.equipe!.members:[],efetivo:config.equipe?.efetivo||{}}),[config.equipe]);
 const cfg=useMemo(()=>migrarEquipe(base,mesCorrente()),[base]);
 useEffect(()=>{if(cfg!==base)onChange({equipe:cfg});},[cfg,base]);
 const salvar=(next:EquipeConfig)=>onChange({equipe:next});
 const salvarCom=(next:EquipeConfig,pares:[CatalogoId,string][])=>onChange({equipe:next,catalogos:registrarValores(config,pares).catalogos});

 const rdoDays=config.rdo?.days||[];
 const allDates=useMemo(()=>{const s=new Set(rdoDays.map(d=>d.date));Object.keys(cfg.efetivo).forEach(d=>s.add(d));return [...s].sort();},[rdoDays,cfg.efetivo]);
 const [monthFilter,setMonthFilter]=useState(()=>allDates.length?allDates[allDates.length-1].slice(0,7):mesCorrente());
 const monthDates=allDates.filter(d=>d.startsWith(monthFilter));
 const rotulo=rotuloMes(monthFilter);

 const [aba,setAba]=useState<'efetivo'|'cadastro'>('efetivo');
 // "Corrigir agora" aponta para pessoas do cadastro: a aba certa é a do cadastro.
 useEffect(()=>{if(correcao)setAba('cadastro');},[correcao]);
 const estilo=(id:'efetivo'|'cadastro')=>`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 ${aba===id?'border-emerald-700 text-emerald-800 bg-white':'border-transparent text-slate-500 hover:text-slate-800'}`;

 return <div className="space-y-4 print:space-y-2">
  <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-bold">Equipe Técnica</h2>
    <p className="text-sm text-slate-600">A equipe de cada pessoa é registrada mês a mês. O mês escolhido vale para as duas abas.</p>
   </div>
   <label className="flex items-center gap-2 text-sm font-semibold">Mês
    <input type="month" className="border p-2 rounded font-normal" value={monthFilter} onChange={e=>{if(e.target.value)setMonthFilter(e.target.value);}}/>
   </label>
  </div>

  <div className="flex gap-1 border-b border-slate-200 print:hidden" role="tablist">
   <button role="tab" aria-selected={aba==='efetivo'} className={estilo('efetivo')} onClick={()=>setAba('efetivo')}>Efetivo do mês</button>
   <button role="tab" aria-selected={aba==='cadastro'} className={estilo('cadastro')} onClick={()=>setAba('cadastro')}>Cadastro</button>
  </div>

  {aba==='efetivo'
   ?<EfetivoDoMes cfg={cfg} monthFilter={monthFilter} rotulo={rotulo} monthDates={monthDates} rdoDays={rdoDays} salvar={salvar} flush={flush}/>
   :<CadastroEquipe config={config} cfg={cfg} monthFilter={monthFilter} rotulo={rotulo} salvar={salvar} salvarCom={salvarCom}
     onChange={onChange} flush={flush} headers={headers} onAbrirCatalogo={onAbrirCatalogo}
     correcao={correcao} onLimparCorrecao={onLimparCorrecao}/>}
 </div>;
}
```

- [ ] **Step 2: Criar `equipe/CadastroEquipe.tsx` com o que hoje é o primeiro bloco**

Mover para este arquivo, do `EquipePanel.tsx` atual: o estado `novo`, `editando`, `erro`, `aviso`, `previa`, `arquivoRef`; as funções `matriculaEmUso`, `adicionar`, `salvarEdicao`, `remover`, `trocarEquipe`, `exportarPlanilha`, `importar`, `aplicar`; o `useMemo` de `cadastro`; o componente auxiliar `EquipeDoMes` (o campo de equipe por mês); e o JSX do primeiro `<div className="bg-white border rounded-xl p-4 space-y-4">`, sem o `<h2>` e sem o seletor de mês, que passaram para a casca. Mantém também a `<FaixaCorrecao>` e o `<PreviaImportacaoEquipe>`.

Assinatura:

```tsx
export function CadastroEquipe({config,cfg,monthFilter,rotulo,salvar,salvarCom,onChange,flush,headers,onAbrirCatalogo,correcao,onLimparCorrecao}:{
 config:ReportConfig;cfg:EquipeConfig;monthFilter:string;rotulo:string;
 salvar:(next:EquipeConfig)=>void;salvarCom:(next:EquipeConfig,pares:[CatalogoId,string][])=>void;
 onChange:(c:Partial<ReportConfig>)=>void;flush:()=>Promise<unknown>;headers:()=>Record<string,string>;
 onAbrirCatalogo?:(c:CatalogoId)=>void;correcao?:{ids:string[];item:string};onLimparCorrecao?:()=>void;
}){
```

- [ ] **Step 3: Criar `equipe/EfetivoDoMes.tsx` com os outros dois blocos**

Mover para este arquivo: `togglePresence`, `syncWithRdo`, `linhasHistograma`, `exportarEfetivo`, `totalHistograma`, os `useMemo` de `doMes` e `histograma`, os auxiliares `baixar`, `diaSemana`, `curto`, `listaDatas`, e o JSX dos dois últimos blocos (grade e histograma). O estado de `erro`/`aviso` passa a ser local deste arquivo, e os dois parágrafos de mensagem (`role="alert"` e `role="status"`), hoje no primeiro bloco, são repetidos aqui logo abaixo do cabeçalho.

Assinatura:

```tsx
export function EfetivoDoMes({cfg,monthFilter,rotulo,monthDates,rdoDays,salvar,flush}:{
 cfg:EquipeConfig;monthFilter:string;rotulo:string;monthDates:string[];
 rdoDays:{date:string;professionals:number|null}[];salvar:(next:EquipeConfig)=>void;flush:()=>Promise<unknown>;
}){
```

O `button` e os auxiliares de módulo (`baixar`, `diaSemana`, `curto`, `listaDatas`) são constantes de arquivo: cada um dos dois novos arquivos declara as que usa. `CadastroEquipe` usa `button`; `EfetivoDoMes` usa todas.

- [ ] **Step 4: Apagar o arquivo antigo e corrigir o import**

Run: `rm src/components/EquipePanel.tsx`

Em `src/App.tsx`, trocar `from './components/EquipePanel'` por `from './components/equipe/EquipePanel'`.

- [ ] **Step 5: Verificar que nada quebrou**

Run: `npx tsc --noEmit && npx vite build && grep -rn "components/EquipePanel'" src || echo "sem referências antigas"`
Expected: sem erros de TypeScript, `✓ built`, e `sem referências antigas`.

- [ ] **Step 6: Rodar a suíte**

Run: `node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: nenhuma linha `FALHOU`.

---

### Task 6: A marca na tela

**Files:**
- Modify: `codigo-fonte/src/components/equipe/CadastroEquipe.tsx`
- Modify: `codigo-fonte/src/components/equipe/EfetivoDoMes.tsx`

**Interfaces:**
- Consumes: `estaAtivo`, `membrosAtivosDoMes` (Tarefa 1); `ResumoSyncRdo.inativos/semAtivos` (Tarefa 2).

- [ ] **Step 1: Cadastro — contagem e busca**

No topo de `CadastroEquipe`, junto dos demais `useMemo`:

```tsx
 const [busca,setBusca]=useState('');
 const semAcento=(v:string)=>v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('pt-BR');
 const ativas=useMemo(()=>cfg.members.filter(estaAtivo).length,[cfg.members]);
 const visiveis=useMemo(()=>{
  const t=semAcento(busca.trim());
  if(!t)return cadastro;
  return cadastro.filter(m=>[m.nome,m.matricula||'',m.funcao].some(v=>semAcento(v).includes(t)));
 },[cadastro,busca]);
```

Acrescentar `estaAtivo` ao import de `../../services/equipe`.

No JSX, acima da tabela:

```tsx
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm text-slate-600"><strong>{ativas}</strong> de <strong>{cfg.members.length}</strong> pessoas ativas</p>
    <input className="border rounded-lg p-2 text-sm min-w-[220px]" placeholder="Buscar por nome, matrícula ou função"
     value={busca} onChange={e=>setBusca(e.target.value)} aria-label="Buscar pessoa"/>
   </div>
```

Trocar `cadastro.map(` por `visiveis.map(` no corpo da tabela e, quando a busca não achar nada, mostrar:

```tsx
   {!visiveis.length&&cadastro.length>0&&<p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">Nenhuma pessoa corresponde à busca.</p>}
```

- [ ] **Step 2: Cadastro — caixa Ativo no formulário e na tabela**

No estado `novo`, acrescentar `ativo:true`:

```tsx
 const [novo,setNovo]=useState({matricula:'',nome:'',funcao:'',equipe:'',ativo:true});
```

No formulário de inclusão, antes do botão Adicionar:

```tsx
    <label className="flex items-center gap-2 text-sm font-semibold pb-2">
     <input type="checkbox" checked={novo.ativo} onChange={e=>setNovo({...novo,ativo:e.target.checked})}/> Ativo
    </label>
```

Em `adicionar`, gravar o campo e preservar a escolha para o próximo cadastro:

```tsx
  const m:EquipeMember={id:crypto.randomUUID(),matricula:novo.matricula.trim()||undefined,nome,funcao,ativo:novo.ativo,meses:{[monthFilter]:equipe},equipe};
  salvarCom({...cfg,members:[...cfg.members,m]},[['equipes',equipe],['funcoes',funcao]]);
  setNovo({matricula:'',nome:'',funcao:'',equipe:novo.equipe,ativo:novo.ativo});
```

Na tabela, acrescentar a coluna. No cabeçalho, antes da coluna de ações:

```tsx
      <th className="p-3 w-20">Ativo</th>
```

e na linha de cada pessoa, antes da célula de ações:

```tsx
         <td className="p-3">
          <input type="checkbox" checked={estaAtivo(m)} aria-label={`Ativo: ${m.nome}`}
           onChange={e=>salvar({...cfg,members:cfg.members.map(x=>x.id===m.id?{...x,ativo:e.target.checked}:x)})}/>
         </td>
```

Na linha em edição, acrescentar uma célula vazia (`<td/>`) na mesma posição, para as colunas continuarem alinhadas.

- [ ] **Step 3: Efetivo — marca do inativo na grade**

Em `EfetivoDoMes`, na primeira célula de cada linha da grade, entre o `AlertTriangle` de `semEquipeNoMes` e `{m.nome}`:

```tsx
         {!estaAtivo(m)&&<span className="text-[9px] bg-slate-200 text-slate-700 rounded px-1 py-0.5 mr-1 align-middle" title="Inativo: fica fora do preenchimento automático">INATIVO</span>}
```

E no aviso de mês vazio, trocar "no cadastro acima" por "na aba Cadastro":

```tsx
   {!doMes.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Ninguém está na lista de {rotulo}. Informe a equipe das pessoas neste mês na aba Cadastro ou importe a planilha.</p>
```

- [ ] **Step 4: Efetivo — avisos do auto-preenchimento**

Em `syncWithRdo`, a linha que hoje trata o mês vazio:

```tsx
  if(sem.res.semMembros){setErro(`Ninguém está na lista de ${rotulo}. Informe a equipe das pessoas no cadastro acima antes de preencher.`);return;}
```

passa a ser:

```tsx
  if(sem.res.semMembros){setErro(`Ninguém está na lista de ${rotulo}. Informe a equipe das pessoas na aba Cadastro antes de preencher.`);return;}
  const inativosDoMes=membrosDoMes(cfg,monthFilter).filter(x=>!estaAtivo(x.membro)).map(x=>x.membro.nome);
  const nomesInativos=inativosDoMes.length<=5?inativosDoMes.join(', '):inativosDoMes.slice(0,5).join(', ')+`… (+${inativosDoMes.length-5})`;
  if(sem.res.semAtivos){setErro(`As ${inativosDoMes.length} pessoas de ${rotulo} estão marcadas como inativas, então não há quem preencher. Marque como ativa, na aba Cadastro, quem está à disposição.`);return;}
```

Logo depois, no bloco que monta `partes`, acrescentar como primeira linha da lista:

```tsx
  if(sem.res.inativos)partes.push(`${sem.res.inativos} pessoa(s) não serão marcadas por estarem inativas: ${nomesInativos}`);
```

Isso faz o aviso aparecer na pergunta de confirmação toda vez que o botão é usado, que é o que torna visível o esquecimento de religar alguém.

Acrescentar `membrosDoMes` e `estaAtivo` ao import de `../../services/equipe`.

- [ ] **Step 5: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 7: Versão, documentação, distribuição e conferência

**Files:**
- Modify: `codigo-fonte/version.ts`, `desktop-launcher.cjs`, `codigo-fonte/package.json`
- Create: `RDO-V1.13.0-ALTERAÇÕES.md` (raiz)
- Modify: `LEIA-ME.txt` (raiz), `Plano-de-Implementacao.md` (raiz)
- Modify: `dist/` (raiz)

- [ ] **Step 1: Versão**

- `codigo-fonte/version.ts`: `export const VERSION='1.13.0-equipe-ativo';`
- `desktop-launcher.cjs`: `VERSAO 1.13.0 - ...` e `const EXPECTED_VERSION = '1.13.0-equipe-ativo';`
- `codigo-fonte/package.json`: `"version": "1.13.0",`

- [ ] **Step 2: Documentação**

`RDO-V1.13.0-ALTERAÇÕES.md` no formato dos anteriores: as duas abas; a marca de ativo e o que ela **não** faz (não altera presença, não altera histórico, não impede marcar à mão); a conversão que marca as 123 existentes como ativas; a coluna ATIVO na planilha com a regra de coluna ausente; os avisos novos do auto-preenchimento; a busca e a contagem no cadastro; Uso; Arquivos alterados; Verificação; Limitações conhecidas (sem período de férias; a marca é do presente, então rodar o preenchimento para um mês passado usa a situação de hoje).

No `LEIA-ME.txt`, seção curta sem acentos após a da equipe, explicando as duas abas, a marca de ativo e a coluna ATIVO.

No `Plano-de-Implementacao.md`, acrescentar a seção 22 com a entrega e atualizar a tabela de versões do início.

- [ ] **Step 3: Reconstruir e sincronizar**

Run (em `codigo-fonte`):

```bash
npx tsc --noEmit && npx vite build && node build-tmp.mjs \
 && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done \
 && cp -r dist/. ../dist/ \
 && for f in ../dist/assets/*; do [ -e "dist/assets/$(basename "$f")" ] || rm "$f"; done \
 && rm -f ../dist/server.cjs.map \
 && (cd dist && find . -type f -exec md5sum {} + | sort -k2) > /tmp/a.txt \
 && (cd ../dist && find . -type f -exec md5sum {} + | sort -k2) > /tmp/b.txt \
 && diff /tmp/a.txt /tmp/b.txt && echo "dist sincronizado" \
 && grep -c "1.13.0-equipe-ativo" dist/server.cjs
```

Expected: nenhuma linha `FALHOU`; `dist sincronizado`; `1`.

- [ ] **Step 4: Conferência manual no Windows (com o usuário)**

1. Abrir Equipe Técnica: duas abas, mês acima delas, Efetivo do mês aberta primeiro.
2. Na aba Cadastro: a contagem mostra "123 de 123 pessoas ativas"; a busca acha uma pessoa por nome, matrícula e função.
3. Desmarcar Ativo de uma pessoa que está na lista de outubro; voltar à aba Efetivo e conferir a marca INATIVO ao lado do nome.
4. Usar **Auto-preencher com RDO**: o aviso informa quantas foram puladas por estarem inativas e quem são; a pessoa inativa não é marcada.
5. Marcar presença **à mão** para essa mesma pessoa inativa e confirmar que funciona.
6. Exportar a planilha: conferir a coluna ATIVO com SIM e NÃO.
7. Importar a planilha com uma mudança de SIM para NÃO: a prévia mostra a seção "Passam a inativas"; aplicar e conferir.
8. Importar uma planilha antiga, **sem** a coluna ATIVO: a prévia não propõe mudança de situação e ninguém é ativado ou desativado.
