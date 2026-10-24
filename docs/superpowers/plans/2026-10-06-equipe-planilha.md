# Equipe técnica por planilha — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter o cadastro da equipe técnica pelo Excel (exportar/importar `.xlsx`/`.csv` com prévia), com a equipe de cada pessoa registrada mês a mês, matrícula como chave e histórico de função.

**Architecture:** Regras puras em `src/services/equipe.ts` (modelo mensal), `src/services/xlsxLeitor.ts` (leitor mínimo de `.xlsx` com `fflate`) e `src/services/equipePlanilha.ts` (ler/gerar planilha, montar e aplicar prévia), testadas por `test-equipe.mjs`. `EquipePanel.tsx` é reescrito sobre essas regras e ganha `PreviaImportacaoEquipe.tsx`. No servidor, só `POST /api/backups` passa a aceitar o motivo `antes-de-importar-equipe`.

**Tech Stack:** TypeScript 5.8, React 19, Tailwind 4, Express 4, `fflate` (já instalado), `xlsxWriter.ts` (existente); testes `node --import tsx`.

**Spec:** `docs/superpowers/specs/2026-10-06-equipe-planilha-design.md`

## Global Constraints

- Diretório dos comandos: `codigo-fonte`. A pasta **não é repositório git**: sem passos de commit; marcar as caixas deste plano ao concluir.
- Testes de servidor rodam contra `dist/server.cjs`: após alterar o servidor, `node build-tmp.mjs` antes de testar.
- Nenhuma dependência nova.
- Normalização de nome, função e equipe: `trim`, espaços repetidos viram um, `toLocaleUpperCase('pt-BR')`.
- Matrícula: gravada como veio na planilha; comparada sem zeros à esquerda (`'00123'` ≡ `'123'`).
- Mês interno sempre `'YYYY-MM'`; rótulo na planilha `MMM/AAAA` em maiúsculas (`ABR/2026`); meses: `JAN FEV MAR ABR MAI JUN JUL AGO SET OUT NOV DEZ`.
- Equipe ausente no mês com presença: rótulo `SEM EQUIPE`.
- Motivo de backup aceito além de `manual`: exatamente `antes-de-importar-equipe`.
- Interface em português; comentários de código em inglês e só para restrições não óbvias.
- `@types/react` não está instalado: não passar `key` como prop de componente com props tipadas (usar `React.Fragment key` se precisar).
- Versão desta entrega: `1.11.0-equipe` (`codigo-fonte/version.ts`, `desktop-launcher.cjs`), `1.11.0` (`package.json`).

## Review Focus

1. Planilha salva pelo próprio Excel (textos em `sharedStrings`, matrícula como número, cabeçalho de mês convertido em data serial, texto com formatação mista) — deve ser lida igual à exportada. Teste na Tarefa 3.
2. Homônimos sem matrícula no cadastro (dois "JOSE SILVA") — não vincular automaticamente por nome; tratar como pessoa nova e manter os dois. Teste na Tarefa 4.
3. Importar duas vezes a mesma planilha — a segunda prévia não deve propor alterações. Teste na Tarefa 4.
4. Linhas em branco no meio ou no fim (comum no Excel) — ignoradas sem virar "linha recusada". Teste na Tarefa 3.
5. Duas colunas para o mesmo mês (ex.: `ABR/2026` e `abr/26`) — usar a primeira e listar a outra como ignorada. Teste na Tarefa 3.

---

### Task 1: Motivo "antes-de-importar-equipe" no backup

**Files:**
- Modify: `codigo-fonte/reliability.ts` (rota `POST /api/backups`)
- Test: `codigo-fonte/test-pastas-backups.mjs` (antes da linha `}finally{await stop();}`)

**Interfaces:**
- Produces: `POST /api/backups` com corpo opcional `{reason:'antes-de-importar-equipe'}` → `{id, warning}`; outro `reason` → 400.

- [ ] **Step 1: Escrever o teste que falha**

Em `test-pastas-backups.mjs`, imediatamente antes de `}finally{await stop();}`, inserir:

```js
 const bk=await request('/api/backups','POST',{reason:'antes-de-importar-equipe'},await headers());
 assert.equal(bk.status,200,bk.data&&bk.data.error);
 assert.ok((await request('/api/backups')).data.items.some(b=>b.id===bk.data.id&&b.reason==='antes-de-importar-equipe'),'backup antes de importar equipe');
 assert.equal((await request('/api/backups','POST',{reason:'qualquer'},await headers())).status,400,'motivo desconhecido recusado');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node build-tmp.mjs && node --import tsx test-pastas-backups.mjs`
Expected: FAIL em `backup antes de importar equipe` (o motivo gravado hoje é `manual`).

- [ ] **Step 3: Implementar**

Em `reliability.ts`, substituir a linha da rota:

```ts
 app.post('/api/backups',(q,r)=>{try{guard(q);r.json(backup());}catch(e:any){r.status(e.status||500).json({error:error(e,'criar-backup')});}});
```

por:

```ts
 app.post('/api/backups',(q,r)=>{try{
  guard(q);const reason=q.body&&q.body.reason;
  if(reason!==undefined&&reason!=='antes-de-importar-equipe')throw Object.assign(new Error('Motivo de backup inválido.'),{status:400});
  r.json(backup(reason||'manual'));
 }catch(e:any){r.status(e.status||500).json({error:error(e,'criar-backup')});}});
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node build-tmp.mjs && node --import tsx test-pastas-backups.mjs`
Expected: PASS (sem AssertionError).

---

### Task 2: Modelo mensal da equipe

**Files:**
- Modify: `codigo-fonte/src/types.ts` (interfaces `EquipeMember`, `EquipeConfig`)
- Create: `codigo-fonte/src/services/equipe.ts`
- Create: `codigo-fonte/test-equipe.mjs`

**Interfaces:**
- Produces (em `src/services/equipe.ts`):
  - `normalizarTexto(v: unknown): string`
  - `chaveMatricula(v: unknown): string`
  - `mesDe(data: string): string` (`'YYYY-MM-DD'` → `'YYYY-MM'`)
  - `SEM_EQUIPE = 'SEM EQUIPE'`
  - `funcaoNoMes(m: EquipeMember, mes: string): string`
  - `equipeMaisRecente(meses?: Record<string,string>): string | undefined`
  - `registrarFuncao(m: EquipeMember, nova: string, desde: string): EquipeMember`
  - `definirEquipeNoMes(cfg: EquipeConfig, id: string, mes: string, equipe: string | null): EquipeConfig`
  - `contarPresencas(cfg: EquipeConfig, id: string): number`
  - `contarPresencasNoMes(cfg: EquipeConfig, id: string, mes: string): number`
  - `removerMembros(cfg: EquipeConfig, ids: Set<string>): EquipeConfig`
  - `migrarEquipe(cfg: EquipeConfig, mesAtual: string): EquipeConfig` (mesmo objeto se nada mudar)
  - `membrosDoMes(cfg: EquipeConfig, mes: string): {membro: EquipeMember; equipe: string; semEquipeNoMes: boolean}[]`
  - `type LinhaHistograma = {equipe: string; funcao: string; porData: Record<string, number>}`
  - `histogramaPorEquipe(cfg: EquipeConfig, datas: string[]): LinhaHistograma[]`

- [ ] **Step 1: Escrever o teste que falha**

Criar `codigo-fonte/test-equipe.mjs`:

```js
import assert from 'node:assert/strict';
import {migrarEquipe,funcaoNoMes,membrosDoMes,histogramaPorEquipe,definirEquipeNoMes,registrarFuncao,removerMembros,contarPresencas,normalizarTexto,chaveMatricula} from './src/services/equipe.ts';

const antigo={members:[{id:'a',equipe:'Pavimentação',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL'},{id:'b',equipe:'',nome:'SEM DIAS',funcao:'ARMADOR'}],efetivo:{'2026-04-10':{a:1},'2026-05-02':{a:1},'2026-05-03':{b:0}}};
const migrado=migrarEquipe(antigo,'2026-06');
assert.deepEqual(migrado.members[0].meses,{'2026-04':'PAVIMENTAÇÃO','2026-05':'PAVIMENTAÇÃO'},'equipe fixa vira equipe nos meses com presença');
assert.deepEqual(migrado.members[1].meses,{'2026-06':'SEM EQUIPE'},'sem presença recebe o mês atual');
assert.equal(migrarEquipe(migrado,'2026-06'),migrado,'segunda migração não muda nada');
assert.equal(migrado.efetivo,antigo.efetivo,'presenças intactas');

let m={id:'x',nome:'JOAO',funcao:'AJUDANTE GERAL',meses:{}};
m=registrarFuncao(m,'oficial armador','2026-06');
m=registrarFuncao(m,'encarregado','2026-09');
assert.equal(funcaoNoMes(m,'2026-05'),'AJUDANTE GERAL');
assert.equal(funcaoNoMes(m,'2026-06'),'OFICIAL ARMADOR');
assert.equal(funcaoNoMes(m,'2026-08'),'OFICIAL ARMADOR');
assert.equal(funcaoNoMes(m,'2026-10'),'ENCARREGADO');
assert.equal(registrarFuncao(m,' Encarregado ','2026-11'),m,'mesma função não gera histórico');
const m2=registrarFuncao(m,'MESTRE','2026-07');
assert.deepEqual(m2.historicoFuncao.map(h=>h.desde),['2026-06','2026-07'],'mudança anterior a outra reescreve o histórico a partir dela');
assert.equal(funcaoNoMes(m2,'2026-06'),'OFICIAL ARMADOR');assert.equal(funcaoNoMes(m2,'2026-12'),'MESTRE');

let cfg={members:[{id:'e',matricula:'37',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO'}},{id:'f',matricula:'41',nome:'VALDINEI',funcao:'ARMADOR',meses:{'2026-04':'DRENAGEM'}}],efetivo:{'2026-04-01':{e:1,f:1},'2026-05-04':{e:1,f:1}}};
cfg=definirEquipeNoMes(cfg,'e','2026-05','drenagem');
assert.equal(cfg.members[0].equipe,'DRENAGEM','equipe mais recente atualizada');
assert.deepEqual(membrosDoMes(cfg,'2026-05').map(x=>[x.membro.id,x.equipe,x.semEquipeNoMes]),[['e','DRENAGEM',false],['f','SEM EQUIPE',true]]);
const hist=histogramaPorEquipe(cfg,['2026-04-01','2026-05-04']);
const linha=(eq,fn)=>hist.find(l=>l.equipe===eq&&l.funcao===fn);
assert.equal(linha('PAVIMENTAÇÃO','AJUDANTE GERAL').porData['2026-04-01'],1);
assert.equal(linha('DRENAGEM','AJUDANTE GERAL').porData['2026-05-04'],1,'transferido conta na equipe do mês');
assert.equal(linha('DRENAGEM','ARMADOR').porData['2026-04-01'],1);
assert.equal(linha('SEM EQUIPE','ARMADOR').porData['2026-05-04'],1);
assert.equal(definirEquipeNoMes(cfg,'e','2026-05',null).members[0].meses['2026-05'],undefined,'retirar do mês');

assert.equal(contarPresencas(cfg,'f'),2);
const sem=removerMembros(cfg,new Set(['f']));
assert.equal(sem.members.length,1);assert.equal(contarPresencas(sem,'f'),0);assert.equal(sem.efetivo['2026-04-01'].e,1);
assert.equal(normalizarTexto('  conceição   de lima '),'CONCEIÇÃO DE LIMA');
assert.equal(chaveMatricula('00123'),'123');assert.equal(chaveMatricula('0'),'0');
console.log('test-equipe: modelo ok');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-equipe.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `src/services/equipe.ts`.

- [ ] **Step 3: Atualizar os tipos**

Em `src/types.ts`, substituir as interfaces `EquipeMember` e `EquipeConfig` por:

```ts
export interface MudancaFuncao {
  desde: string; // YYYY-MM
  funcao: string;
  anterior: string;
}

export interface EquipeMember {
  id: string;
  matricula?: string;
  equipe?: string; // most recent month's team; suggestion only
  nome: string;
  funcao: string;
  meses?: Record<string, string>; // YYYY-MM -> team in that month
  historicoFuncao?: MudancaFuncao[]; // ascending by desde
}

export interface EquipeConfig {
  members: EquipeMember[];
  efetivo: Record<string, Record<string, number>>; // YYYY-MM-DD -> memberId -> value
}
```

- [ ] **Step 4: Criar `src/services/equipe.ts`**

```ts
import type {EquipeConfig,EquipeMember} from '../types';

export const SEM_EQUIPE='SEM EQUIPE';
export const normalizarTexto=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
export const chaveMatricula=(v:unknown)=>String(v??'').trim().replace(/^0+(?=.)/,'');
export const mesDe=(data:string)=>data.slice(0,7);

export function funcaoNoMes(m:EquipeMember,mes:string){
 for(const h of m.historicoFuncao||[])if(mes<h.desde)return h.anterior;
 return m.funcao;
}

export function equipeMaisRecente(meses?:Record<string,string>){
 const chaves=Object.keys(meses||{}).sort();
 return chaves.length?meses![chaves[chaves.length-1]]:undefined;
}

export function registrarFuncao(m:EquipeMember,nova:string,desde:string):EquipeMember{
 const funcao=normalizarTexto(nova);
 if(!funcao||funcao===normalizarTexto(m.funcao))return m;
 const anterior=funcaoNoMes(m,desde);
 const historicoFuncao=[...(m.historicoFuncao||[]).filter(h=>h.desde<desde),{desde,funcao,anterior}];
 return {...m,funcao,historicoFuncao};
}

export function definirEquipeNoMes(cfg:EquipeConfig,id:string,mes:string,equipe:string|null):EquipeConfig{
 return {...cfg,members:cfg.members.map(m=>{
  if(m.id!==id)return m;
  const meses={...(m.meses||{})};
  const valor=equipe?normalizarTexto(equipe):'';
  if(valor)meses[mes]=valor;else delete meses[mes];
  return {...m,meses,equipe:equipeMaisRecente(meses)};
 })};
}

export function contarPresencas(cfg:EquipeConfig,id:string){
 let n=0;for(const dia of Object.values(cfg.efetivo||{}))if(dia?.[id])n++;return n;
}

export function contarPresencasNoMes(cfg:EquipeConfig,id:string,mes:string){
 let n=0;for(const [data,dia] of Object.entries(cfg.efetivo||{}))if(data.startsWith(mes)&&dia?.[id])n++;return n;
}

export function removerMembros(cfg:EquipeConfig,ids:Set<string>):EquipeConfig{
 const efetivo:Record<string,Record<string,number>>={};
 for(const [data,dia] of Object.entries(cfg.efetivo||{})){const novo={...dia};for(const id of ids)delete novo[id];efetivo[data]=novo;}
 return {members:cfg.members.filter(m=>!ids.has(m.id)),efetivo};
}

export function migrarEquipe(cfg:EquipeConfig,mesAtual:string):EquipeConfig{
 if(cfg.members.every(m=>m.meses))return cfg;
 const mesesComPresenca=new Map<string,Set<string>>();
 for(const [data,dia] of Object.entries(cfg.efetivo||{}))for(const [id,v] of Object.entries(dia||{}))if(v){
  const s=mesesComPresenca.get(id)||new Set<string>();s.add(mesDe(data));mesesComPresenca.set(id,s);
 }
 const members=cfg.members.map(m=>{
  if(m.meses)return m;
  const equipe=normalizarTexto(m.equipe)||SEM_EQUIPE;
  const meses:Record<string,string>={};
  for(const mes of [...(mesesComPresenca.get(m.id)||[])].sort())meses[mes]=equipe;
  if(!Object.keys(meses).length)meses[mesAtual]=equipe;
  return {...m,meses};
 });
 return {...cfg,members};
}

export function membrosDoMes(cfg:EquipeConfig,mes:string){
 const comPresenca=new Set<string>();
 for(const [data,dia] of Object.entries(cfg.efetivo||{}))if(data.startsWith(mes))for(const [id,v] of Object.entries(dia||{}))if(v)comPresenca.add(id);
 return cfg.members
  .filter(m=>m.meses?.[mes]||comPresenca.has(m.id))
  .map(m=>({membro:m,equipe:m.meses?.[mes]||SEM_EQUIPE,semEquipeNoMes:!m.meses?.[mes]}))
  .sort((a,b)=>a.equipe.localeCompare(b.equipe,'pt-BR')||a.membro.nome.localeCompare(b.membro.nome,'pt-BR'));
}

export type LinhaHistograma={equipe:string;funcao:string;porData:Record<string,number>};
export function histogramaPorEquipe(cfg:EquipeConfig,datas:string[]):LinhaHistograma[]{
 const linhas=new Map<string,LinhaHistograma>();
 for(const m of cfg.members)for(const data of datas){
  const mes=mesDe(data);const presente=cfg.efetivo?.[data]?.[m.id]?1:0;
  if(!presente&&!m.meses?.[mes])continue;
  const equipe=m.meses?.[mes]||SEM_EQUIPE;const funcao=funcaoNoMes(m,mes)||'SEM FUNÇÃO';
  const chave=equipe+'\u0000'+funcao;
  const l=linhas.get(chave)||{equipe,funcao,porData:{}};
  l.porData[data]=(l.porData[data]||0)+presente;linhas.set(chave,l);
 }
 return [...linhas.values()].sort((a,b)=>a.equipe.localeCompare(b.equipe,'pt-BR')||a.funcao.localeCompare(b.funcao,'pt-BR'));
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-equipe.mjs`
Expected: `test-equipe: modelo ok`. (O `tsc` pode acusar erros em `EquipePanel.tsx` só se o tipo antigo era usado de forma incompatível; o campo `equipe` continua opcional, então não deve haver erro.)

---

### Task 3: Leitor de `.xlsx`, leitura e geração da planilha

**Files:**
- Create: `codigo-fonte/src/services/xlsxLeitor.ts`
- Create: `codigo-fonte/src/services/equipePlanilha.ts`
- Modify: `codigo-fonte/test-equipe.mjs` (acrescentar ao fim)

**Interfaces:**
- Consumes: `normalizarTexto`, `chaveMatricula` (Tarefa 2); `createXlsx(sheets: {name:string;headers:string[];rows:(string|number|null)[][]}[]): Uint8Array` de `xlsxWriter.ts`.
- Produces:
  - `xlsxLeitor.ts`: `type Celula = string | number | null`; `lerPrimeiraAba(bytes: Uint8Array): Celula[][]`
  - `equipePlanilha.ts`:
    - `rotuloMes(mes: string): string`
    - `interpretarMes(c: Celula): string | null`
    - `type LinhaPlanilha = {linha: number; matricula: string; nome: string; funcao: string; meses: Record<string, string>}` (mês → equipe, `''` quando vazia)
    - `type Recusa = {linha: number; motivo: string}`
    - `type PlanilhaEquipe = {meses: string[]; linhas: LinhaPlanilha[]; recusadas: Recusa[]; colunasIgnoradas: string[]}`
    - `lerPlanilhaEquipe(arq: {nome: string; bytes: Uint8Array}): PlanilhaEquipe`
    - `gerarPlanilhaEquipe(cfg: EquipeConfig, mesAtual: string): Uint8Array`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `test-equipe.mjs`:

```js
import {lerPlanilhaEquipe,gerarPlanilhaEquipe,interpretarMes,rotuloMes} from './src/services/equipePlanilha.ts';
import {zipSync,strToU8} from 'fflate';

assert.equal(rotuloMes('2026-04'),'ABR/2026');
for(const [c,esperado] of [['ABR/2026','2026-04'],['abr/26','2026-04'],['Abril/2026','2026-04'],['04/2026','2026-04'],['2026-04','2026-04'],[46113,'2026-04'],['MARÇO/2026','2026-03'],['TOTAL',null],[12,null]])
 assert.equal(interpretarMes(c),esperado,'mês: '+c);

const cad={members:[
 {id:'1',matricula:'00123',nome:'HIDICLEVIO CONCEIÇÃO DE LIMA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-06':'DRENAGEM'}},
 {id:'2',nome:'SEM MATRÍCULA',funcao:'APONTADOR',meses:{'2026-05':'ADMINISTRAÇÃO'}}],efetivo:{}};
const lida=lerPlanilhaEquipe({nome:'equipe.xlsx',bytes:gerarPlanilhaEquipe(cad,'2026-06')});
assert.deepEqual(lida.meses,['2026-04','2026-05','2026-06']);
assert.deepEqual(lida.linhas,[{linha:2,matricula:'00123',nome:'HIDICLEVIO CONCEIÇÃO DE LIMA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'','2026-06':'DRENAGEM'}}],'ida e volta preserva acentos e zeros');
assert.deepEqual(lida.recusadas,[{linha:3,motivo:'sem matrícula'}]);

const excel=zipSync({
 'xl/workbook.xml':strToU8('<workbook xmlns:r="r"><sheets><sheet name="Equipe" sheetId="1" r:id="rId7"/></sheets></workbook>'),
 'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="rId7" Target="worksheets/planilha.xml"/></Relationships>'),
 'xl/sharedStrings.xml':strToU8('<sst><si><t>MATRÍCULA</t></si><si><t>NOME</t></si><si><t>FUNÇÃO</t></si><si><r><t xml:space="preserve">EDMAR </t></r><r><t>ALVES</t></r></si><si><t>AJUDANTE GERAL</t></si><si><t>PAVIMENTAÇÃO</t></si><si><t>DRENAGEM</t></si><si><t>abr/26</t></si></sst>'),
 'xl/worksheets/planilha.xml':strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>7</v></c><c r="E1"><v>46143</v></c><c r="F1" t="s"><v>7</v></c></row><row r="2"/><row r="3"><c r="A3"><v>37</v></c><c r="B3" t="s"><v>3</v></c><c r="C3" t="s"><v>4</v></c><c r="D3" t="s"><v>5</v></c><c r="E3" t="s"><v>6</v></c></row></sheetData></worksheet>'),
});
const doExcel=lerPlanilhaEquipe({nome:'Equipe.xlsx',bytes:excel});
assert.deepEqual(doExcel.meses,['2026-04','2026-05'],'cabeçalho virado data serial');
assert.deepEqual(doExcel.colunasIgnoradas,['abr/26'],'coluna repetida do mesmo mês é ignorada');
assert.deepEqual(doExcel.linhas,[{linha:3,matricula:'37',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'DRENAGEM'}}],'sharedStrings, número e linha vazia');
assert.deepEqual(doExcel.recusadas,[]);

const ansi=lerPlanilhaEquipe({nome:'equipe.csv',bytes:new Uint8Array(Buffer.from('MATRÍCULA;NOME;FUNÇÃO;ABR/2026\r\n5;"josé ""zé"" conceição";ARMADOR;CONTENÇÃO\r\n;;;\r\n\r\n','latin1'))});
assert.deepEqual(ansi.linhas,[{linha:2,matricula:'5',nome:'JOSÉ "ZÉ" CONCEIÇÃO',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO'}}],'CSV ANSI com aspas');
assert.deepEqual(ansi.recusadas,[],'linhas em branco não são recusadas');
const utf8=lerPlanilhaEquipe({nome:'equipe.csv',bytes:new Uint8Array(Buffer.concat([Buffer.from([0xEF,0xBB,0xBF]),Buffer.from('MATRICULA,NOME,FUNCAO,04/2026\n9,ANA,APONTADOR,ADMINISTRAÇÃO\n09,ANA B,APONTADOR,\n','utf8')]))});
assert.equal(utf8.linhas.length,0);assert.deepEqual(utf8.recusadas.map(r=>r.linha),[2,3],'matrícula repetida recusa todas as ocorrências');
assert.throws(()=>lerPlanilhaEquipe({nome:'x.csv',bytes:new Uint8Array(Buffer.from('A;B\n1;2'))}),/MATRÍCULA e NOME/);
assert.throws(()=>lerPlanilhaEquipe({nome:'x.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;OBS\n1;A;B;C'))}),/Nenhuma coluna de mês/);
assert.throws(()=>lerPlanilhaEquipe({nome:'x.xlsx',bytes:new Uint8Array([1,2,3])}),/xlsx válida/);
console.log('test-equipe: planilha ok');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-equipe.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `src/services/equipePlanilha.ts`.

- [ ] **Step 3: Criar `src/services/xlsxLeitor.ts`**

```ts
import {unzipSync,strFromU8} from 'fflate';

export type Celula=string|number|null;
const INVALIDO='O arquivo não é uma planilha .xlsx válida.';

function atributos(tag:string){const r:Record<string,string>={};for(const m of tag.matchAll(/([\w:]+)="([^"]*)"/g))r[m[1]]=m[2];return r;}
function decodificar(s:string){
 return s.replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-fA-F]+));/g,(_t,nome,dec,hex)=>dec?String.fromCodePoint(Number(dec)):hex?String.fromCodePoint(parseInt(hex,16)):({lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'} as Record<string,string>)[nome]);
}
// Rich text keeps one <t> per run; phonetic hints (<rPh>) are not part of the value.
function texto(xml:string){
 return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g,'').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decodificar(m[1])).join('');
}
function indiceColuna(ref:string){let n=0;for(const ch of ref.replace(/\d+$/,''))n=n*26+(ch.charCodeAt(0)-64);return n-1;}

export function lerPrimeiraAba(bytes:Uint8Array):Celula[][]{
 let arquivos:Record<string,Uint8Array>;
 try{arquivos=unzipSync(bytes);}catch{throw new Error(INVALIDO);}
 const ler=(nome:string)=>arquivos[nome]?strFromU8(arquivos[nome]):'';
 const workbook=ler('xl/workbook.xml');if(!workbook)throw new Error(INVALIDO);
 const primeira=workbook.match(/<sheet\b[^>]*>/);if(!primeira)throw new Error('A planilha não tem abas.');
 const rid=atributos(primeira[0])['r:id'];
 let alvo='worksheets/sheet1.xml';
 for(const m of ler('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)){const a=atributos(m[0]);if(a.Id===rid&&a.Target)alvo=a.Target;}
 const caminho=alvo.startsWith('/')?alvo.slice(1):'xl/'+alvo.replace(/^\.\//,'');
 const folha=ler(caminho).replace(/<row\b[^>]*\/>/g,'');
 if(!folha)throw new Error('Não foi possível ler a primeira aba da planilha.');
 const compartilhadas=[...ler('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>texto(m[1]));
 const linhas:Celula[][]=[];
 for(const lm of folha.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
  const numero=Number(atributos(lm[1]).r)||linhas.length+1;
  const linha:Celula[]=[];
  for(const cm of lm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const a=atributos(cm[1]);const corpo=cm[2]||'';const i=a.r?indiceColuna(a.r):linha.length;
   const v=corpo.match(/<v>([\s\S]*?)<\/v>/);
   let valor:Celula=null;
   if(a.t==='s'&&v)valor=compartilhadas[Number(v[1])]??'';
   else if(a.t==='inlineStr')valor=texto(corpo);
   else if(a.t==='str'&&v)valor=decodificar(v[1]);
   else if(a.t==='b'&&v)valor=v[1]==='1'?'VERDADEIRO':'FALSO';
   else if(v){const n=Number(v[1]);valor=Number.isFinite(n)?n:decodificar(v[1]);}
   linha[i]=valor;
  }
  linhas[numero-1]=Array.from(linha,x=>x===undefined?null:x);
 }
 return Array.from(linhas,l=>l||[]);
}
```

- [ ] **Step 4: Criar `src/services/equipePlanilha.ts` (parte de leitura e geração)**

```ts
import {createXlsx} from '../../xlsxWriter';
import type {EquipeConfig} from '../types';
import {lerPrimeiraAba,Celula} from './xlsxLeitor';
import {normalizarTexto,chaveMatricula} from './equipe';

const MESES=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
export const rotuloMes=(mes:string)=>`${MESES[Number(mes.slice(5,7))-1]}/${mes.slice(0,4)}`;

export function interpretarMes(c:Celula):string|null{
 if(typeof c==='number'){
  if(c<36526||c>73050)return null;
  return new Date(Date.UTC(1899,11,30)+Math.round(c)*86400000).toISOString().slice(0,7);
 }
 const t=String(c??'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace('.','');
 let m=t.match(/^([A-Z]{3})[A-Z]*[\/\- ](\d{2}|\d{4})$/);
 if(m){const i=MESES.indexOf(m[1]);if(i>=0){const ano=m[2].length===2?2000+Number(m[2]):Number(m[2]);return `${ano}-${String(i+1).padStart(2,'0')}`;}}
 m=t.match(/^(\d{1,2})\/(\d{4})$/);
 if(m&&Number(m[1])>=1&&Number(m[1])<=12)return `${m[2]}-${m[1].padStart(2,'0')}`;
 m=t.match(/^(\d{4})-(\d{2})$/);
 if(m&&Number(m[2])>=1&&Number(m[2])<=12)return t;
 return null;
}

export type LinhaPlanilha={linha:number;matricula:string;nome:string;funcao:string;meses:Record<string,string>};
export type Recusa={linha:number;motivo:string};
export type PlanilhaEquipe={meses:string[];linhas:LinhaPlanilha[];recusadas:Recusa[];colunasIgnoradas:string[]};

// Excel in Portuguese saves CSV as Windows-1252; UTF-8 decoding then yields U+FFFD.
function decodificarCsv(bytes:Uint8Array){
 const utf8=new TextDecoder('utf-8').decode(bytes);
 return utf8.includes('�')?new TextDecoder('windows-1252').decode(bytes):utf8;
}
function lerCsv(texto:string):Celula[][]{
 const primeira=texto.split(/\r?\n/,1)[0]||'';
 const sep=primeira.split(';').length>primeira.split(',').length?';':',';
 const linhas:Celula[][]=[];let linha:string[]=[];let campo='';let aspas=false;
 for(let i=0;i<texto.length;i++){
  const ch=texto[i];
  if(aspas){if(ch==='"'){if(texto[i+1]==='"'){campo+='"';i++;}else aspas=false;}else campo+=ch;continue;}
  if(ch==='"')aspas=true;
  else if(ch===sep){linha.push(campo);campo='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&texto[i+1]==='\n')i++;linha.push(campo);linhas.push(linha);linha=[];campo='';}
  else campo+=ch;
 }
 if(campo||linha.length){linha.push(campo);linhas.push(linha);}
 return linhas.map(l=>l.map(c=>c===''?null:c));
}
const chaveCabecalho=(c:Celula)=>String(c??'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

export function lerPlanilhaEquipe(arq:{nome:string;bytes:Uint8Array}):PlanilhaEquipe{
 const ehXlsx=/\.xlsx$/i.test(arq.nome)||(arq.bytes[0]===0x50&&arq.bytes[1]===0x4b);
 const celulas=ehXlsx?lerPrimeiraAba(arq.bytes):lerCsv(decodificarCsv(arq.bytes));
 const iCab=celulas.findIndex(l=>l.some(c=>chaveCabecalho(c)==='MATRICULA')&&l.some(c=>chaveCabecalho(c)==='NOME'));
 if(iCab<0)throw new Error('Não encontrei o cabeçalho com MATRÍCULA e NOME. Use a planilha exportada pelo app como modelo.');
 const cab=celulas[iCab];
 const cMat=cab.findIndex(c=>chaveCabecalho(c)==='MATRICULA');
 const cNome=cab.findIndex(c=>chaveCabecalho(c)==='NOME');
 const cFunc=cab.findIndex(c=>chaveCabecalho(c)==='FUNCAO');
 if(cFunc<0)throw new Error('A planilha não tem a coluna FUNÇÃO.');
 const colMeses:{col:number;mes:string}[]=[];const colunasIgnoradas:string[]=[];
 cab.forEach((c,i)=>{
  if(i===cMat||i===cNome||i===cFunc||c===null||c==='')return;
  const mes=interpretarMes(c);
  if(mes&&!colMeses.some(x=>x.mes===mes))colMeses.push({col:i,mes});else colunasIgnoradas.push(String(c));
 });
 if(!colMeses.length)throw new Error('Nenhuma coluna de mês foi reconhecida. Use cabeçalhos como ABR/2026.');
 const lidas:LinhaPlanilha[]=[];const recusadas:Recusa[]=[];
 for(let i=iCab+1;i<celulas.length;i++){
  const l=celulas[i]||[];
  const matricula=String(l[cMat]??'').trim();const nome=normalizarTexto(l[cNome]);const funcao=normalizarTexto(l[cFunc]);
  const meses:Record<string,string>={};for(const {col,mes} of colMeses)meses[mes]=normalizarTexto(l[col]);
  if(!matricula&&!nome&&!funcao&&Object.values(meses).every(v=>!v))continue;
  if(!matricula){recusadas.push({linha:i+1,motivo:'sem matrícula'});continue;}
  if(!nome){recusadas.push({linha:i+1,motivo:'sem nome'});continue;}
  lidas.push({linha:i+1,matricula,nome,funcao,meses});
 }
 const contagem=new Map<string,number>();
 for(const l of lidas)contagem.set(chaveMatricula(l.matricula),(contagem.get(chaveMatricula(l.matricula))||0)+1);
 const linhas=lidas.filter(l=>contagem.get(chaveMatricula(l.matricula))===1);
 for(const l of lidas)if(contagem.get(chaveMatricula(l.matricula))!==1)recusadas.push({linha:l.linha,motivo:`matrícula ${l.matricula} repetida no arquivo`});
 return {meses:colMeses.map(x=>x.mes).sort(),linhas,recusadas:recusadas.sort((a,b)=>a.linha-b.linha),colunasIgnoradas};
}

const LEIA_ME=[
 'Não altere a MATRÍCULA de quem já existe: ela liga a pessoa ao histórico de presença.',
 'Preencha a MATRÍCULA de quem estiver sem ela; linhas sem matrícula não são importadas.',
 'Em cada coluna de mês, escreva a EQUIPE da pessoa naquele mês. Célula vazia = não esteve na obra no mês.',
 'Nova pessoa: acrescente uma linha com matrícula, nome, função e as equipes dos meses.',
 'Novo mês: acrescente uma coluna com o cabeçalho no formato MMM/AAAA (ex.: JUL/2026).',
 'Para mudar a função, edite a coluna FUNÇÃO; o app pergunta a partir de qual mês ela vale.',
 'Se o cadastro foi alterado no app, exporte de novo antes de editar esta planilha.',
];

function mesesDaPlanilha(cfg:EquipeConfig,mesAtual:string){
 const todos=[...cfg.members.flatMap(m=>Object.keys(m.meses||{})),mesAtual].sort();
 const fim=todos[todos.length-1];const meses:string[]=[];
 let ano=Number(todos[0].slice(0,4)),mes=Number(todos[0].slice(5,7));
 for(;;){const k=`${ano}-${String(mes).padStart(2,'0')}`;meses.push(k);if(k>=fim)break;mes++;if(mes>12){mes=1;ano++;}}
 return meses;
}

export function gerarPlanilhaEquipe(cfg:EquipeConfig,mesAtual:string){
 const meses=mesesDaPlanilha(cfg,mesAtual);
 const rows=[...cfg.members].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(m=>[m.matricula||'',m.nome,m.funcao,...meses.map(k=>m.meses?.[k]||'')]);
 return createXlsx([
  {name:'Equipe',headers:['MATRÍCULA','NOME','FUNÇÃO',...meses.map(rotuloMes)],rows},
  {name:'Leia-me',headers:['Como usar esta planilha'],rows:LEIA_ME.map(t=>[t])},
 ]);
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-equipe.mjs`
Expected: `test-equipe: modelo ok` e `test-equipe: planilha ok`.

---

### Task 4: Prévia e aplicação da importação

**Files:**
- Modify: `codigo-fonte/src/services/equipePlanilha.ts` (acrescentar ao fim)
- Modify: `codigo-fonte/test-equipe.mjs` (acrescentar ao fim)

**Interfaces:**
- Consumes: `PlanilhaEquipe`, `LinhaPlanilha`, `Recusa` (Tarefa 3); `normalizarTexto`, `chaveMatricula`, `contarPresencas`, `contarPresencasNoMes`, `registrarFuncao`, `equipeMaisRecente`, `removerMembros` (Tarefa 2).
- Produces:
  - `type Par = {linha: LinhaPlanilha; membro: EquipeMember; porNome: boolean}`
  - `type Alteracao = {tipo: 'nome'|'funcao'|'entrada'|'transferencia'|'saida'|'saidaRecusada'; matricula: string; nome: string; mes?: string; de?: string; para?: string; porNome: boolean; presencas?: number}`
  - `type Previa = {meses: string[]; pares: Par[]; novas: LinhaPlanilha[]; alteracoes: Alteracao[]; equipesNovas: string[]; foraDaPlanilha: {membro: EquipeMember; presencas: number}[]; recusadas: Recusa[]; colunasIgnoradas: string[]; mesFuncaoPadrao: string}`
  - `type EscolhasImportacao = {mesFuncao: string; desvincular: Set<string>; remover: Set<string>}` (`desvincular` por `chaveMatricula`, `remover` por `id`)
  - `montarPrevia(cfg: EquipeConfig, planilha: PlanilhaEquipe): Previa`
  - `aplicarPrevia(cfg: EquipeConfig, previa: Previa, escolhas: EscolhasImportacao): EquipeConfig`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `test-equipe.mjs`:

```js
import {montarPrevia,aplicarPrevia} from './src/services/equipePlanilha.ts';

const cadastro={members:[
 {id:'e',matricula:'037',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'PAVIMENTAÇÃO'}},
 {id:'r',matricula:'28',nome:'EMERSON RYAN RODRUIGUES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO'}},
 {id:'s',nome:'SEBASTIAO DE SOUZA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'DRENAGEM'}},
 {id:'h1',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO'}},
 {id:'h2',nome:'JOSE SILVA',funcao:'CARPINTEIRO',meses:{'2026-04':'CONTENÇÃO'}},
 {id:'v',matricula:'41',nome:'VALDINEI',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO','2026-05':'CONTENÇÃO'}},
 {id:'z',matricula:'99',nome:'FORA DA LISTA',funcao:'APONTADOR',meses:{'2026-03':'ADMINISTRAÇÃO'}}],
 efetivo:{'2026-05-04':{e:1,v:1},'2026-03-02':{z:1}}};
const planilha={meses:['2026-04','2026-05'],colunasIgnoradas:[],recusadas:[{linha:9,motivo:'sem matrícula'}],linhas:[
 {linha:2,matricula:'37',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'DRENAGEM'}},
 {linha:3,matricula:'28',nome:'EMERSON RYAN RODRIGUES',funcao:'OFICIAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'PAVIMENTAÇÃO'}},
 {linha:4,matricula:'33',nome:'SEBASTIAO DE SOUZA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'DRENAGEM','2026-05':''}},
 {linha:5,matricula:'50',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO','2026-05':''}},
 {linha:6,matricula:'41',nome:'VALDINEI',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO','2026-05':''}},
 {linha:7,matricula:'60',nome:'NOVO FUNCIONARIO',funcao:'CALDEIRISTA',meses:{'2026-04':'','2026-05':'TERRAPLENAGEM'}}]};
const p=montarPrevia(cadastro,planilha);
const tipos=t=>p.alteracoes.filter(a=>a.tipo===t).map(a=>[a.nome,a.mes||'',a.de||'',a.para||'']);
assert.deepEqual(p.pares.map(x=>[x.membro.id,x.porNome]),[['e',false],['r',false],['s',true],['v',false]],'matrícula com zeros e vínculo por nome único');
assert.deepEqual(p.novas.map(l=>l.matricula),['50','60'],'homônimos sem matrícula não são vinculados por nome');
assert.deepEqual(tipos('nome'),[['EMERSON RYAN RODRIGUES','','EMERSON RYAN RODRUIGUES','EMERSON RYAN RODRIGUES']]);
assert.deepEqual(tipos('funcao'),[['EMERSON RYAN RODRIGUES','','AJUDANTE GERAL','OFICIAL']]);
assert.deepEqual(tipos('transferencia'),[['EDMAR ALVES','2026-05','PAVIMENTAÇÃO','DRENAGEM']]);
assert.deepEqual(tipos('entrada'),[['EMERSON RYAN RODRIGUES','2026-05','','PAVIMENTAÇÃO']]);
assert.deepEqual(tipos('saidaRecusada').map(x=>x[0]),['VALDINEI'],'célula vazia em mês com presença é recusada');
assert.deepEqual(tipos('saida'),[]);
assert.deepEqual(p.equipesNovas,['TERRAPLENAGEM']);
assert.deepEqual(p.foraDaPlanilha.map(f=>[f.membro.id,f.presencas]),[['h1',0],['h2',0],['z',1]]);
assert.equal(p.mesFuncaoPadrao,'2026-05');

const depois=aplicarPrevia(cadastro,p,{mesFuncao:'2026-05',desvincular:new Set(),remover:new Set(['z'])});
const por=id=>depois.members.find(m=>m.id===id);
assert.equal(por('r').nome,'EMERSON RYAN RODRIGUES','nome corrigido mantém o código interno');
assert.equal(por('e').meses['2026-05'],'DRENAGEM');assert.equal(por('e').equipe,'DRENAGEM');
assert.equal(por('e').matricula,'37','matrícula gravada como veio na planilha');
assert.equal(funcaoNoMes(por('r'),'2026-04'),'AJUDANTE GERAL');assert.equal(funcaoNoMes(por('r'),'2026-05'),'OFICIAL');
assert.equal(por('s').matricula,'33','vínculo por nome grava a matrícula');
assert.equal(por('v').meses['2026-05'],'CONTENÇÃO','saída recusada mantém o mês');
assert.ok(!por('z'),'removida quando escolhido');assert.equal(depois.efetivo['2026-03-02'].z,undefined,'presenças da removida apagadas');
assert.ok(por('h1')&&por('h2'),'fora da planilha mantidas por padrão');
const novos=depois.members.filter(m=>['50','60'].includes(m.matricula));
assert.equal(novos.length,2);assert.deepEqual(novos.find(m=>m.matricula==='60').meses,{'2026-05':'TERRAPLENAGEM'});
assert.equal(depois.efetivo['2026-05-04'].e,1,'presenças preservadas');
assert.equal(aplicarPrevia(cadastro,p,{mesFuncao:'2026-05',desvincular:new Set(),remover:new Set()}).members.find(m=>m.id==='z').meses['2026-03'],'ADMINISTRAÇÃO','mês fora da planilha intacto');
const d2=aplicarPrevia(cadastro,p,{mesFuncao:'2026-05',desvincular:new Set(['33']),remover:new Set()});
assert.equal(d2.members.find(m=>m.id==='s').matricula,undefined,'desvinculada continua sem matrícula');
assert.ok(d2.members.some(m=>m.matricula==='33'&&m.id!=='s'),'linha desvinculada vira pessoa nova');
const p2=montarPrevia(depois,planilha);
assert.deepEqual(p2.alteracoes.filter(a=>a.tipo!=='saidaRecusada'),[],'reimportar a mesma planilha não propõe alterações');
assert.equal(p2.novas.length,0);
console.log('test-equipe: prévia ok');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-equipe.mjs`
Expected: FAIL com `SyntaxError` — `montarPrevia` não é exportado por `equipePlanilha.ts`.

- [ ] **Step 3: Implementar (acrescentar ao fim de `equipePlanilha.ts`)**

Trocar o import de `./equipe` do topo do arquivo por:

```ts
import {normalizarTexto,chaveMatricula,contarPresencas,contarPresencasNoMes,registrarFuncao,equipeMaisRecente,removerMembros} from './equipe';
```

e o import de tipos por `import type {EquipeConfig,EquipeMember} from '../types';`. Acrescentar ao fim:

```ts
export type Par={linha:LinhaPlanilha;membro:EquipeMember;porNome:boolean};
export type Alteracao={tipo:'nome'|'funcao'|'entrada'|'transferencia'|'saida'|'saidaRecusada';matricula:string;nome:string;mes?:string;de?:string;para?:string;porNome:boolean;presencas?:number};
export type Previa={meses:string[];pares:Par[];novas:LinhaPlanilha[];alteracoes:Alteracao[];equipesNovas:string[];foraDaPlanilha:{membro:EquipeMember;presencas:number}[];recusadas:Recusa[];colunasIgnoradas:string[];mesFuncaoPadrao:string};
export type EscolhasImportacao={mesFuncao:string;desvincular:Set<string>;remover:Set<string>};

export function montarPrevia(cfg:EquipeConfig,planilha:PlanilhaEquipe):Previa{
 const porMatricula=new Map<string,EquipeMember>();const semMatricula=new Map<string,EquipeMember[]>();
 for(const m of cfg.members){
  if(m.matricula)porMatricula.set(chaveMatricula(m.matricula),m);
  else{const k=normalizarTexto(m.nome);semMatricula.set(k,[...(semMatricula.get(k)||[]),m]);}
 }
 const usados=new Set<string>();const pares:Par[]=[];const novas:LinhaPlanilha[]=[];const alteracoes:Alteracao[]=[];
 for(const linha of planilha.linhas){
  let membro=porMatricula.get(chaveMatricula(linha.matricula));let porNome=false;
  if(!membro){const homonimos=semMatricula.get(linha.nome)||[];if(homonimos.length===1){membro=homonimos[0];porNome=true;}}
  if(!membro||usados.has(membro.id)){novas.push(linha);continue;}
  usados.add(membro.id);pares.push({linha,membro,porNome});
  const base={matricula:linha.matricula,nome:linha.nome,porNome};
  if(linha.nome!==normalizarTexto(membro.nome))alteracoes.push({...base,tipo:'nome',de:membro.nome,para:linha.nome});
  if(linha.funcao&&linha.funcao!==normalizarTexto(membro.funcao))alteracoes.push({...base,tipo:'funcao',de:membro.funcao,para:linha.funcao});
  for(const mes of planilha.meses){
   const antes=membro.meses?.[mes]||'';const depois=linha.meses[mes]||'';
   if(antes===depois)continue;
   if(!antes)alteracoes.push({...base,tipo:'entrada',mes,para:depois});
   else if(depois)alteracoes.push({...base,tipo:'transferencia',mes,de:antes,para:depois});
   else{const presencas=contarPresencasNoMes(cfg,membro.id,mes);alteracoes.push({...base,tipo:presencas?'saidaRecusada':'saida',mes,de:antes,presencas});}
  }
 }
 const existentes=new Set(cfg.members.flatMap(m=>Object.values(m.meses||{})));
 const equipesNovas=[...new Set(planilha.linhas.flatMap(l=>Object.values(l.meses).filter(Boolean)))].filter(e=>!existentes.has(e)).sort();
 const foraDaPlanilha=cfg.members.filter(m=>!usados.has(m.id)).map(m=>({membro:m,presencas:contarPresencas(cfg,m.id)}));
 return {meses:planilha.meses,pares,novas,alteracoes,equipesNovas,foraDaPlanilha,recusadas:planilha.recusadas,colunasIgnoradas:planilha.colunasIgnoradas,mesFuncaoPadrao:planilha.meses[planilha.meses.length-1]};
}

function novoMembro(l:LinhaPlanilha):EquipeMember{
 const meses:Record<string,string>={};for(const [mes,eq] of Object.entries(l.meses))if(eq)meses[mes]=eq;
 return {id:crypto.randomUUID(),matricula:l.matricula,nome:l.nome,funcao:l.funcao,meses,equipe:equipeMaisRecente(meses)};
}

export function aplicarPrevia(cfg:EquipeConfig,previa:Previa,escolhas:EscolhasImportacao):EquipeConfig{
 const atualizados=new Map<string,EquipeMember>();const adicionados:EquipeMember[]=[];
 for(const par of previa.pares){
  if(par.porNome&&escolhas.desvincular.has(chaveMatricula(par.linha.matricula))){adicionados.push(novoMembro(par.linha));continue;}
  const m=par.membro;
  let r:EquipeMember={...m,matricula:par.linha.matricula,nome:par.linha.nome};
  if(par.linha.funcao)r=registrarFuncao(r,par.linha.funcao,escolhas.mesFuncao);
  const meses={...(m.meses||{})};
  for(const mes of previa.meses){
   const depois=par.linha.meses[mes]||'';
   if(depois)meses[mes]=depois;
   else if(meses[mes]&&contarPresencasNoMes(cfg,m.id,mes)===0)delete meses[mes];
  }
  atualizados.set(m.id,{...r,meses,equipe:equipeMaisRecente(meses)});
 }
 for(const l of previa.novas)adicionados.push(novoMembro(l));
 const resultado={...cfg,members:[...cfg.members.map(m=>atualizados.get(m.id)||m),...adicionados]};
 return escolhas.remover.size?removerMembros(resultado,escolhas.remover):resultado;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-equipe.mjs`
Expected: `test-equipe: modelo ok`, `test-equipe: planilha ok`, `test-equipe: prévia ok`.

---

### Task 5: Tela da equipe e prévia de importação

**Files:**
- Create: `codigo-fonte/src/components/PreviaImportacaoEquipe.tsx`
- Modify (reescrever): `codigo-fonte/src/components/EquipePanel.tsx`
- Modify: `codigo-fonte/src/App.tsx` (linha do `EquipePanel`)

**Interfaces:**
- Consumes: tudo de `equipe.ts` (Tarefa 2) e `equipePlanilha.ts` (Tarefas 3 e 4); `POST /api/backups` com motivo (Tarefa 1).
- Produces: `EquipePanel({config, onChange, flush, headers})`; `PreviaImportacaoEquipe({previa, onCancelar, onAplicar})`.

A interface não tem testes automatizados; a verificação é `tsc`, `vite build`, suíte completa e a conferência manual da Tarefa 6.

- [ ] **Step 1: Criar `src/components/PreviaImportacaoEquipe.tsx`**

```tsx
import React,{useState} from 'react';
import {Previa,EscolhasImportacao,Alteracao,rotuloMes} from '../services/equipePlanilha';
import {chaveMatricula} from '../services/equipe';

const button='border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';
function descrever(a:Alteracao){
 const mes=a.mes?rotuloMes(a.mes):'';
 if(a.tipo==='nome')return `Matrícula ${a.matricula}: ${a.de} → ${a.para}`;
 if(a.tipo==='funcao')return `${a.nome}: ${a.de} → ${a.para}`;
 if(a.tipo==='entrada')return `${a.nome}: entra em ${mes} (${a.para})`;
 if(a.tipo==='transferencia')return `${a.nome}: ${mes} ${a.de} → ${a.para}`;
 if(a.tipo==='saida')return `${a.nome}: sai de ${mes} (${a.de})`;
 return `${a.nome}: ${mes} mantido em ${a.de} — há ${a.presencas} presença(s) marcada(s) nesse mês`;
}

export function PreviaImportacaoEquipe({previa,onCancelar,onAplicar}:{previa:Previa;onCancelar:()=>void;onAplicar:(e:EscolhasImportacao)=>Promise<void>}){
 const [mesFuncao,setMesFuncao]=useState(previa.mesFuncaoPadrao);
 const [desvincular,setDesvincular]=useState<Set<string>>(new Set());
 const [remover,setRemover]=useState<Set<string>>(new Set());
 const [ocupado,setOcupado]=useState(false);const [erro,setErro]=useState('');
 const alternar=(atual:Set<string>,definir:(s:Set<string>)=>void,chave:string)=>{const n=new Set(atual);if(n.has(chave))n.delete(chave);else n.add(chave);definir(n);};
 const de=(tipo:Alteracao['tipo'])=>previa.alteracoes.filter(a=>a.tipo===tipo).map(descrever);
 const vinculadas=previa.pares.filter(p=>p.porNome);
 const aplicar=async()=>{setOcupado(true);setErro('');try{await onAplicar({mesFuncao,desvincular,remover});}catch(e:any){setErro(e?.message||'Erro desconhecido.');}finally{setOcupado(false);}};
 const secao=(titulo:string,itens:string[],cor='border-slate-200')=>itens.length?<section className={`border rounded-lg p-3 ${cor}`}>
  <h4 className="font-semibold text-sm mb-1">{titulo} ({itens.length})</h4>
  <ul className="text-sm list-disc pl-5 max-h-40 overflow-y-auto">{itens.map((t,i)=><li key={i}>{t}</li>)}</ul>
 </section>:null;
 const semMudanca=!previa.novas.length&&!previa.alteracoes.some(a=>a.tipo!=='saidaRecusada')&&!remover.size;
 return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Prévia da importação da equipe">
  <div className="bg-white rounded-2xl p-5 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-3">
   <h3 className="text-lg font-bold">Prévia da importação da equipe</h3>
   <p className="text-sm text-slate-600">Meses da planilha: {previa.meses.map(rotuloMes).join(', ')}. Meses que não estão na planilha não são alterados. Nada muda até você clicar em Aplicar.</p>
   {secao('Pessoas novas',previa.novas.map(l=>`${l.matricula} — ${l.nome} (${l.funcao||'sem função'})`),'border-emerald-200')}
   {vinculadas.length>0&&<section className="border rounded-lg p-3 border-sky-200">
    <h4 className="font-semibold text-sm mb-1">Reconhecidas pelo nome — cadastradas sem matrícula ({vinculadas.length})</h4>
    {vinculadas.map(p=><label key={p.membro.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!desvincular.has(chaveMatricula(p.linha.matricula))} onChange={()=>alternar(desvincular,setDesvincular,chaveMatricula(p.linha.matricula))}/> {p.linha.nome} recebe a matrícula {p.linha.matricula} (desmarque se não for a mesma pessoa)</label>)}
   </section>}
   {secao('Nome alterado',de('nome'))}
   {de('funcao').length>0&&<section className="border rounded-lg p-3 border-slate-200 space-y-1">
    {secao('Função alterada',de('funcao'))}
    <label className="text-sm flex items-center gap-2">As mudanças de função valem a partir de
     <select className="border rounded p-1" value={mesFuncao} onChange={e=>setMesFuncao(e.target.value)}>{previa.meses.map(m=><option key={m} value={m}>{rotuloMes(m)}</option>)}</select>
    </label>
   </section>}
   {secao('Transferências de equipe',de('transferencia'))}
   {secao('Entradas no mês',de('entrada'))}
   {secao('Saídas do mês',de('saida'))}
   {secao('Saídas recusadas (há presença marcada)',de('saidaRecusada'),'border-amber-300')}
   {secao('Equipes novas — confira se não é erro de digitação',previa.equipesNovas,'border-amber-300')}
   {previa.foraDaPlanilha.length>0&&<section className="border rounded-lg p-3 border-slate-200">
    <h4 className="font-semibold text-sm mb-1">Cadastradas, mas fora da planilha ({previa.foraDaPlanilha.length}) — mantidas, a menos que você marque</h4>
    {previa.foraDaPlanilha.map(f=><label key={f.membro.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remover.has(f.membro.id)} onChange={()=>alternar(remover,setRemover,f.membro.id)}/> remover {f.membro.nome}{f.membro.matricula?` (${f.membro.matricula})`:''}{f.presencas?<span className="text-red-700"> — apaga {f.presencas} presença(s)</span>:null}</label>)}
   </section>}
   {secao('Linhas não importadas',previa.recusadas.map(r=>`Linha ${r.linha}: ${r.motivo}`),'border-red-200')}
   {secao('Colunas ignoradas',previa.colunasIgnoradas,'border-slate-200')}
   {semMudanca&&<p className="text-sm bg-slate-50 border rounded-lg p-3">A planilha não traz alterações para o cadastro.</p>}
   {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
   <div className="flex justify-end gap-2">
    <button className={button} disabled={ocupado} onClick={onCancelar}>Cancelar</button>
    <button className={button+' !bg-emerald-700 text-white'} disabled={ocupado||semMudanca} onClick={aplicar}>{ocupado?'Aplicando…':'Aplicar importação'}</button>
   </div>
  </div>
 </div>;
}
```

- [ ] **Step 2: Reescrever `src/components/EquipePanel.tsx`**

Substituir o conteúdo inteiro por:

```tsx
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ReportConfig,EquipeConfig,EquipeMember} from '../types';
import {Plus,Trash2,Download,Printer,Pencil,Check,X,Upload,FileSpreadsheet,AlertTriangle} from 'lucide-react';
import {createXlsx} from '../../xlsxWriter';
import {migrarEquipe,membrosDoMes,histogramaPorEquipe,definirEquipeNoMes,registrarFuncao,removerMembros,contarPresencas,normalizarTexto,chaveMatricula,funcaoNoMes} from '../services/equipe';
import {lerPlanilhaEquipe,gerarPlanilhaEquipe,montarPrevia,aplicarPrevia,rotuloMes,Previa,EscolhasImportacao} from '../services/equipePlanilha';
import {PreviaImportacaoEquipe} from './PreviaImportacaoEquipe';

const button='border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';
const mesCorrente=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
function baixar(bytes:Uint8Array,nome:string){
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const diaSemana=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase().slice(0,3);

export function EquipePanel({config,onChange,flush,headers}:{config:ReportConfig;onChange:(c:Partial<ReportConfig>)=>void;flush:()=>Promise<unknown>;headers:()=>Record<string,string>}){
 const base=useMemo<EquipeConfig>(()=>({members:Array.isArray(config.equipe?.members)?config.equipe!.members:[],efetivo:config.equipe?.efetivo||{}}),[config.equipe]);
 const cfg=useMemo(()=>migrarEquipe(base,mesCorrente()),[base]);
 useEffect(()=>{if(cfg!==base)onChange({equipe:cfg});},[cfg,base]);
 const salvar=(next:EquipeConfig)=>onChange({equipe:next});
 const rdoDays=config.rdo?.days||[];

 const allDates=useMemo(()=>{const s=new Set(rdoDays.map(d=>d.date));Object.keys(cfg.efetivo).forEach(d=>s.add(d));return [...s].sort();},[rdoDays,cfg.efetivo]);
 const [monthFilter,setMonthFilter]=useState(()=>allDates.length?allDates[allDates.length-1].slice(0,7):mesCorrente());
 const monthDates=allDates.filter(d=>d.startsWith(monthFilter));
 const rotulo=rotuloMes(monthFilter);
 const doMes=useMemo(()=>membrosDoMes(cfg,monthFilter),[cfg,monthFilter]);
 const histograma=useMemo(()=>histogramaPorEquipe(cfg,monthDates),[cfg,monthDates.join()]);
 const cadastro=useMemo(()=>[...cfg.members].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),[cfg.members]);
 const equipesConhecidas=useMemo(()=>[...new Set(cfg.members.flatMap(m=>Object.values(m.meses||{})))].sort(),[cfg.members]);
 const funcoes=useMemo(()=>[...new Set(cfg.members.map(m=>m.funcao).filter(Boolean))].sort(),[cfg.members]);

 const [novo,setNovo]=useState({matricula:'',nome:'',funcao:'',equipe:''});
 const [editando,setEditando]=useState<{id:string;matricula:string;nome:string;funcao:string}|null>(null);
 const [erro,setErro]=useState('');const [aviso,setAviso]=useState('');
 const [previa,setPrevia]=useState<Previa|null>(null);
 const arquivoRef=useRef<HTMLInputElement>(null);
 const matriculaEmUso=(mat:string,exceto?:string)=>!!mat.trim()&&cfg.members.some(m=>m.id!==exceto&&!!m.matricula&&chaveMatricula(m.matricula)===chaveMatricula(mat));

 const adicionar=()=>{
  setErro('');
  const nome=normalizarTexto(novo.nome),funcao=normalizarTexto(novo.funcao),equipe=normalizarTexto(novo.equipe);
  if(!nome||!funcao||!equipe){setErro('Informe nome, função e equipe.');return;}
  if(matriculaEmUso(novo.matricula)){setErro(`A matrícula ${novo.matricula.trim()} já está cadastrada.`);return;}
  const m:EquipeMember={id:crypto.randomUUID(),matricula:novo.matricula.trim()||undefined,nome,funcao,meses:{[monthFilter]:equipe},equipe};
  salvar({...cfg,members:[...cfg.members,m]});
  setNovo({matricula:'',nome:'',funcao:'',equipe:novo.equipe});
 };
 const salvarEdicao=()=>{
  if(!editando)return;setErro('');
  const nome=normalizarTexto(editando.nome),funcao=normalizarTexto(editando.funcao);
  if(!nome||!funcao){setErro('Informe nome e função.');return;}
  if(matriculaEmUso(editando.matricula,editando.id)){setErro(`A matrícula ${editando.matricula.trim()} já está cadastrada.`);return;}
  salvar({...cfg,members:cfg.members.map(m=>m.id!==editando.id?m:registrarFuncao({...m,nome,matricula:editando.matricula.trim()||undefined},funcao,monthFilter))});
  setEditando(null);
 };
 const remover=(m:EquipeMember)=>{
  const n=contarPresencas(cfg,m.id);
  if(!confirm(n?`Remover ${m.nome}? ${n} presença(s) marcada(s) também serão apagadas.`:`Remover ${m.nome}?`))return;
  salvar(removerMembros(cfg,new Set([m.id])));
 };
 const trocarEquipe=(m:EquipeMember,valor:string)=>{
  const eq=normalizarTexto(valor);if((m.meses?.[monthFilter]||'')===eq)return;
  salvar(definirEquipeNoMes(cfg,m.id,monthFilter,eq||null));
 };
 const togglePresence=(date:string,id:string)=>{
  const dia={...(cfg.efetivo[date]||{})};dia[id]=dia[id]?0:1;
  salvar({...cfg,efetivo:{...cfg.efetivo,[date]:dia}});
 };
 const syncWithRdo=()=>{
  if(!confirm('Preencher presenças automaticamente com base no número de profissionais informados no RDO? (Isso sobrescreverá os dados do mês atual)'))return;
  const efetivo={...cfg.efetivo};
  rdoDays.forEach(day=>{
   if(!day.date.startsWith(monthFilter))return;
   const dia:Record<string,number>={};let count=0;
   for(const m of cfg.members){if(count<(day.professionals||0)){dia[m.id]=1;count++;}}
   efetivo[day.date]=dia;
  });
  salvar({...cfg,efetivo});
 };

 const linhasHistograma=()=>{
  const out:(string|number|null)[][]=[];
  for(const eq of [...new Set(histograma.map(l=>l.equipe))]){
   const ls=histograma.filter(l=>l.equipe===eq);
   ls.forEach(l=>out.push([eq,l.funcao,...monthDates.map(d=>l.porData[d]||null)]));
   out.push([`SUBTOTAL ${eq}`,'',...monthDates.map(d=>ls.reduce((a,l)=>a+(l.porData[d]||0),0))]);
  }
  out.push(['TOTAL GERAL','',...monthDates.map(d=>histograma.reduce((a,l)=>a+(l.porData[d]||0),0))]);
  return out;
 };
 const exportarEfetivo=async()=>{
  if(!doMes.length||!monthDates.length)return;
  try{await flush();}catch(e:any){alert('Não foi possível concluir o salvamento antes da exportação: '+(e?.message||'erro desconhecido'));return;}
  const dias=monthDates.map(d=>String(new Date(d+'T12:00:00').getDate()));
  const rows:(string|number|null)[][]=doMes.map(({membro,equipe})=>[membro.matricula||'',equipe,membro.nome,funcaoNoMes(membro,monthFilter),...monthDates.map(d=>cfg.efetivo[d]?.[membro.id]?1:null)]);
  rows.push(['','TOTAL PRESENTES','','',...monthDates.map(d=>doMes.reduce((a,x)=>a+(cfg.efetivo[d]?.[x.membro.id]?1:0),0))]);
  rows.push(['','TOTAL NO RDO','','',...monthDates.map(d=>rdoDays.find(r=>r.date===d)?.professionals||0)]);
  baixar(createXlsx([{name:'Efetivo',headers:['Matrícula','Equipe','Nome','Função',...dias],rows},{name:'Histograma por Equipe',headers:['Equipe','Função',...dias],rows:linhasHistograma()}]),`Efetivo-${monthFilter}.xlsx`);
 };
 const exportarPlanilha=async()=>{
  setErro('');
  try{await flush();}catch(e:any){setErro('Não foi possível concluir o salvamento antes da exportação: '+(e?.message||'erro desconhecido'));return;}
  const obra=String(config.contrato||'obra').replace(/[<>:"/\\|?*\s]+/g,'-').slice(0,40);
  baixar(gerarPlanilhaEquipe(cfg,mesCorrente()),`Equipe-${obra}-${new Date().toISOString().slice(0,10)}.xlsx`);
 };
 const importar=async(file?:File)=>{
  setErro('');setAviso('');if(!file)return;
  try{setPrevia(montarPrevia(cfg,lerPlanilhaEquipe({nome:file.name,bytes:new Uint8Array(await file.arrayBuffer())})));}
  catch(e:any){setErro(e?.message||'Não foi possível ler a planilha.');}
  finally{if(arquivoRef.current)arquivoRef.current.value='';}
 };
 const aplicar=async(escolhas:EscolhasImportacao)=>{
  if(!previa)return;
  await flush();
  const r=await fetch('/api/backups',{method:'POST',headers:{'Content-Type':'application/json',...headers()},body:JSON.stringify({reason:'antes-de-importar-equipe'})});
  if(!r.ok){const d:any=await r.json().catch(()=>({}));throw new Error('O backup antes da importação falhou; nada foi alterado. '+(d.error||`HTTP ${r.status}`));}
  salvar(aplicarPrevia(cfg,previa,escolhas));
  setPrevia(null);setAviso('Planilha importada. Um backup foi criado antes da alteração.');
 };

 const totalHistograma=(d:string)=>histograma.reduce((a,l)=>a+(l.porData[d]||0),0);
 return <div className="space-y-6 print:space-y-2">
  <datalist id="equipe-suggestions">{equipesConhecidas.map(t=><option key={t} value={t}/>)}</datalist>
  <datalist id="funcao-suggestions">{funcoes.map(t=><option key={t} value={t}/>)}</datalist>

  <div className="bg-white border rounded-xl p-4 space-y-4">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <h2 className="text-xl font-bold">Equipe Técnica</h2>
     <p className="text-sm text-slate-600">A equipe de cada pessoa é registrada mês a mês. O mês selecionado define quem aparece na grade de presença e em qual equipe.</p>
    </div>
    <div className="flex flex-wrap gap-2">
     <button className={button+' flex items-center gap-1'} onClick={exportarPlanilha}><FileSpreadsheet className="w-4 h-4"/> Exportar planilha da equipe</button>
     <button className={button+' flex items-center gap-1'} onClick={()=>arquivoRef.current?.click()}><Upload className="w-4 h-4"/> Importar planilha</button>
     <input ref={arquivoRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={e=>importar(e.target.files?.[0])}/>
    </div>
   </div>
   <label className="flex items-center gap-2 text-sm font-semibold">Mês
    <input type="month" className="border p-2 rounded font-normal" value={monthFilter} onChange={e=>{if(e.target.value)setMonthFilter(e.target.value);}}/>
   </label>
   {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
   {aviso&&<p role="status" className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">{aviso}</p>}
   <div className="flex flex-wrap gap-2 items-end">
    <label className="w-32"><span className="block text-xs font-semibold uppercase mb-1">Matrícula</span>
     <input className="w-full border p-2 rounded" value={novo.matricula} onChange={e=>setNovo({...novo,matricula:e.target.value})} placeholder="Ex: 1234"/></label>
    <label className="w-48"><span className="block text-xs font-semibold uppercase mb-1">Equipe em {rotulo}</span>
     <input className="w-full border p-2 rounded uppercase" list="equipe-suggestions" value={novo.equipe} onChange={e=>setNovo({...novo,equipe:e.target.value})} placeholder="Ex: DRENAGEM"/></label>
    <label className="flex-1 min-w-[200px]"><span className="block text-xs font-semibold uppercase mb-1">Nome</span>
     <input className="w-full border p-2 rounded uppercase" value={novo.nome} onChange={e=>setNovo({...novo,nome:e.target.value})}/></label>
    <label className="flex-1 min-w-[200px]"><span className="block text-xs font-semibold uppercase mb-1">Função</span>
     <input className="w-full border p-2 rounded uppercase" list="funcao-suggestions" value={novo.funcao} onChange={e=>setNovo({...novo,funcao:e.target.value})}/></label>
    <button className={button+' !bg-emerald-700 text-white'} onClick={adicionar}><Plus className="w-5 h-5 inline mr-1 -mt-1"/> Adicionar</button>
   </div>
   {cadastro.length>0&&<div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm text-left">
     <thead className="bg-slate-50 border-b"><tr>
      <th className="p-3">Matrícula</th><th className="p-3">Nome</th><th className="p-3">Função em {rotulo}</th><th className="p-3">Equipe em {rotulo}</th><th className="p-3 w-24">Ação</th>
     </tr></thead>
     <tbody className="divide-y">
      {cadastro.map(m=>editando?.id===m.id
       ?<tr key={m.id}>
         <td className="p-2"><input className="w-full border p-1 rounded text-xs" value={editando.matricula} onChange={e=>setEditando({...editando,matricula:e.target.value})} aria-label="Matrícula"/></td>
         <td className="p-2"><input className="w-full border p-1 rounded text-xs uppercase" value={editando.nome} onChange={e=>setEditando({...editando,nome:e.target.value})} aria-label="Nome"/></td>
         <td className="p-2"><input className="w-full border p-1 rounded text-xs uppercase" list="funcao-suggestions" value={editando.funcao} onChange={e=>setEditando({...editando,funcao:e.target.value})} aria-label="Função"/><span className="block text-[10px] text-slate-500">mudança vale a partir de {rotulo}</span></td>
         <td className="p-2 text-xs">{m.meses?.[monthFilter]||'—'}</td>
         <td className="p-2"><div className="flex items-center gap-1">
          <button onClick={salvarEdicao} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded" title="Salvar"><Check className="w-4 h-4"/></button>
          <button onClick={()=>setEditando(null)} className="text-slate-500 hover:bg-slate-100 p-1 rounded" title="Cancelar"><X className="w-4 h-4"/></button>
         </div></td>
        </tr>
       :<tr key={m.id} className="hover:bg-slate-50">
         <td className="p-3 text-xs">{m.matricula||<span className="text-amber-700">sem matrícula</span>}</td>
         <td className="p-3 font-medium">{m.nome}</td>
         <td className="p-3">{funcaoNoMes(m,monthFilter)}</td>
         <td className="p-2"><input key={m.id+monthFilter+(m.meses?.[monthFilter]||'')} list="equipe-suggestions" className="w-full border p-1 rounded text-xs uppercase" defaultValue={m.meses?.[monthFilter]||''} placeholder="fora deste mês" onBlur={e=>trocarEquipe(m,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}} aria-label={`Equipe de ${m.nome} em ${rotulo}`}/></td>
         <td className="p-3"><div className="flex items-center gap-1">
          <button onClick={()=>setEditando({id:m.id,matricula:m.matricula||'',nome:m.nome,funcao:m.funcao})} className="text-slate-500 hover:bg-slate-100 p-1 rounded" title="Editar"><Pencil className="w-4 h-4"/></button>
          <button onClick={()=>remover(m)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Remover"><Trash2 className="w-4 h-4"/></button>
         </div></td>
        </tr>)}
     </tbody>
    </table>
   </div>}
  </div>

  <div className="bg-white border rounded-xl p-4 space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-bold">Efetivo (Histograma) — {rotulo}</h2>
    <div className="flex items-center gap-2 flex-wrap">
     <button className={button} onClick={syncWithRdo}>Auto-preencher com RDO</button>
     <button className={button+' flex items-center gap-1'} onClick={exportarEfetivo} disabled={!doMes.length||!monthDates.length}><Download className="w-4 h-4"/> XLSX</button>
     <button className={button+' flex items-center gap-1'} onClick={()=>window.print()} disabled={!doMes.length||!monthDates.length}><Printer className="w-4 h-4"/> Imprimir (PDF)</button>
    </div>
   </div>
   {!doMes.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Ninguém está na lista de {rotulo}. Informe a equipe das pessoas neste mês no cadastro acima ou importe a planilha.</p>
    :!monthDates.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Não há datas de RDO ou registros para este mês.</p>
    :<div className="overflow-x-auto border rounded-lg">
     <table className="w-full text-xs text-center border-collapse">
      <thead className="bg-slate-50 border-b"><tr>
       <th className="p-2 border-r text-left sticky left-0 bg-slate-50 z-10 min-w-[220px]">Nome / Equipe</th>
       {monthDates.map(date=><th key={date} className="p-2 border-r min-w-[36px]" title={date}>{new Date(date+'T12:00:00').getDate()}<br/><span className="text-[10px] text-slate-500 font-normal">{diaSemana(date)}</span></th>)}
      </tr></thead>
      <tbody className="divide-y">
       {doMes.map(({membro:m,equipe,semEquipeNoMes})=><tr key={m.id} className="hover:bg-slate-50">
        <td className="p-2 border-r text-left sticky left-0 bg-white font-medium truncate z-10" title={semEquipeNoMes?'Tem presença marcada neste mês, mas não está na lista do mês':undefined}>
         {semEquipeNoMes&&<AlertTriangle className="w-3 h-3 inline text-amber-600 mr-1 -mt-0.5"/>}{m.nome} <span className="text-slate-400 font-normal">· {equipe}</span>
        </td>
        {monthDates.map(date=>{const present=!!cfg.efetivo[date]?.[m.id];return <td key={date} className="p-0 border-r relative">
         <button className={`w-full h-full min-h-[32px] hover:bg-slate-100 ${present?'text-emerald-700 font-bold bg-emerald-50':'text-slate-200'}`} onClick={()=>togglePresence(date,m.id)}>{present?'1':'•'}</button>
        </td>;})}
       </tr>)}
       <tr className="bg-slate-100 font-bold border-t">
        <td className="p-2 border-r text-left sticky left-0 z-10 bg-slate-100">Total Presentes</td>
        {monthDates.map(date=>{const total=doMes.reduce((a,x)=>a+(cfg.efetivo[date]?.[x.membro.id]?1:0),0);const rdo=rdoDays.find(d=>d.date===date)?.professionals||0;
         return <td key={date} className="p-2 border-r" title={`RDO: ${rdo}`}><span className={total!==rdo?(rdo>0?'text-amber-600':'text-slate-800'):'text-emerald-700'}>{total}</span></td>;})}
       </tr>
      </tbody>
     </table>
    </div>}
  </div>

  <div className="bg-white border rounded-xl p-4 space-y-4">
   <h2 className="text-xl font-bold">Histograma por Equipe — {rotulo}</h2>
   <p className="text-sm text-slate-600">Profissionais presentes por equipe e função em cada dia, pela equipe de cada pessoa neste mês.</p>
   {!histograma.length||!monthDates.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Não há dados para este mês.</p>
    :<div className="overflow-x-auto border rounded-lg">
     <table className="w-full text-xs text-center border-collapse">
      <thead className="bg-slate-50 border-b"><tr>
       <th className="p-2 border-r text-left bg-slate-50 min-w-[120px]">Equipe</th>
       <th className="p-2 border-r text-left bg-slate-50 min-w-[150px]">Função</th>
       {monthDates.map(date=><th key={date} className="p-2 border-r min-w-[36px]">{new Date(date+'T12:00:00').getDate()}</th>)}
      </tr></thead>
      <tbody className="divide-y">
       {[...new Set(histograma.map(l=>l.equipe))].map(eq=>{const ls=histograma.filter(l=>l.equipe===eq);return <React.Fragment key={eq}>
        {ls.map((l,idx)=><tr key={eq+l.funcao} className="hover:bg-slate-50">
         {idx===0&&<td className="p-2 border-r text-left bg-white font-bold align-top" rowSpan={ls.length}>{eq}</td>}
         <td className="p-2 border-r text-left font-medium truncate">{l.funcao}</td>
         {monthDates.map(d=><td key={d} className="p-0 border-r"><span className={`inline-block w-full min-h-[32px] pt-2 ${l.porData[d]?'text-emerald-700 font-bold bg-emerald-50':'text-slate-300'}`}>{l.porData[d]||'•'}</span></td>)}
        </tr>)}
        <tr className="bg-slate-50 font-semibold border-t">
         <td colSpan={2} className="p-2 border-r text-right text-slate-600 uppercase text-[10px]">Subtotal {eq}</td>
         {monthDates.map(d=><td key={d} className="p-2 border-r">{ls.reduce((a,l)=>a+(l.porData[d]||0),0)}</td>)}
        </tr>
       </React.Fragment>;})}
       <tr className="bg-slate-100 font-bold border-t">
        <td colSpan={2} className="p-2 border-r text-left">TOTAL GERAL</td>
        {monthDates.map(d=><td key={d} className="p-2 border-r">{totalHistograma(d)}</td>)}
       </tr>
      </tbody>
     </table>
    </div>}
  </div>

  {previa&&<PreviaImportacaoEquipe previa={previa} onCancelar={()=>setPrevia(null)} onAplicar={aplicar}/>}
 </div>;
}
```

- [ ] **Step 3: Passar `headers` no `App.tsx`**

Trocar `{tab==='equipe'&&<EquipePanel config={config} onChange={update} flush={flush} />}` por:

```tsx
      {tab==='equipe'&&<EquipePanel config={config} onChange={update} flush={flush} headers={()=>({'X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current})} />}
```

- [ ] **Step 4: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 6: Versão, documentação, distribuição e conferência

**Files:**
- Modify: `codigo-fonte/version.ts`, `desktop-launcher.cjs`, `codigo-fonte/package.json`
- Create: `RDO-V1.11.0-ALTERAÇÕES.md` (raiz)
- Modify: `LEIA-ME.txt` (raiz) — nova seção "EQUIPE TECNICA PELO EXCEL - VERSAO 1.11.0" logo após a seção "OBRAS - VERSAO 1.10.0"
- Modify: `dist/` (raiz)

- [ ] **Step 1: Versão**

- `codigo-fonte/version.ts`: `export const VERSION='1.11.0-equipe';`
- `desktop-launcher.cjs`: `VERSAO 1.11.0 - FOTOGRAFICO, RDO, OBRAS E PLUVIOMETRIA` e `const EXPECTED_VERSION = '1.11.0-equipe';`
- `codigo-fonte/package.json`: `"version": "1.11.0",`

- [ ] **Step 2: Documentação**

`RDO-V1.11.0-ALTERAÇÕES.md` no formato de `RDO-V1.10.0-ALTERAÇÕES.md`, com: equipe por mês e conversão automática dos dados antigos; matrícula; histórico de função; exportar/importar planilha com prévia (itens da prévia e o que nunca é apagado); backup "antes-de-importar-equipe"; remover pessoa apaga as presenças com aviso; Uso (exportar → editar no Excel → importar → conferir prévia → aplicar); Arquivos alterados; Verificação.

No `LEIA-ME.txt`, seção curta sem acentos (padrão do arquivo): formato da planilha (MATRICULA, NOME, FUNCAO, colunas MMM/AAAA com a equipe; vazio = fora da obra no mes), regras (nao alterar matricula; exportar antes de editar), o que a previa mostra, que nada e apagado sem marcar, e o teste `node --import tsx test-equipe.mjs`.

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
 && grep -c "1.11.0-equipe" dist/server.cjs
```

Expected: nenhuma linha `FALHOU`; `dist sincronizado`; `1`.

- [ ] **Step 4: Conferência manual no Windows (com o usuário)**

1. Abrir a aba Equipe Técnica: cadastro antigo aparece com a equipe nos meses em que havia presença.
2. Exportar planilha; abrir no Excel; conferir acentos, matrícula e colunas de mês.
3. No Excel: preencher matrículas, transferir uma pessoa de equipe num mês, corrigir um nome, mudar uma função, acrescentar uma pessoa e um mês; salvar como `.xlsx`.
4. Importar: conferir a prévia (vínculos por nome, transferência, função com mês, pessoa nova, equipe nova); aplicar; conferir backup em Backup e Info ("antes-de-importar-equipe").
5. Grade diária e histograma do mês mostram a pessoa na equipe nova; o mês anterior continua com a equipe antiga.
6. Importar a mesma planilha de novo: a prévia diz que não há alterações.
