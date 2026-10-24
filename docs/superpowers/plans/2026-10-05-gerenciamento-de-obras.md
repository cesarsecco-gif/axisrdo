# Gerenciamento de obras — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar Obras em uma tela própria com ações claras, pasta-raiz única, remoção de qualquer obra (inclusive a aberta, com opção de apagar arquivos) e o estado "nenhuma obra aberta" com tela inicial.

**Architecture:** O servidor Express (`server.ts`, `obras.ts`, `reliability.ts`) passa a aceitar pasta ativa nula e ganha rotas de raiz, duplicar, backup por obra e remoção com limpeza restrita aos arquivos gerenciados. A interface React troca a janela `ObrasModal.tsx` por `src/components/obras/` (página, cartão, painéis e tela inicial) e uma camada `src/services/obrasApi.ts`.

**Tech Stack:** Node 22+ / Express 4 / TypeScript 5.8 / React 19 / Tailwind 4 / Vite 6 / esbuild; testes de integração `node --import tsx test-*.mjs` contra `dist/server.cjs`.

**Spec:** `docs/superpowers/specs/2026-10-05-gerenciamento-de-obras-design.md`

## Global Constraints

- Diretório de trabalho de todos os comandos: `codigo-fonte` (dentro de `Relatorio-DER-PR 1.9.1`).
- A pasta **não é um repositório git**: não há passos de commit; ao fim de cada tarefa, marcar as caixas deste plano.
- Os testes executam `dist/server.cjs`: depois de alterar o servidor, rodar `node build-tmp.mjs` antes dos testes; depois de alterar a interface, rodar `npx vite build` e `node build-tmp.mjs`.
- Operação offline; nenhuma dependência nova.
- Uma obra = uma pasta com `projeto.json`, `fotos\`, `backups\`, `backup-config.json`.
- Nunca sobrescrever `projeto.json` existente; nunca criar projeto automaticamente.
- Itens gerenciados apagáveis: `projeto.json`, `projeto.json.bak`, `projeto.json.tmp`, `fotos`, `backups`, `backup-config.json` — nada além disso.
- Mensagem sem obra aberta (texto exato): `Nenhuma obra aberta. Crie ou abra uma obra.` com status 409 e código `NO_WORKSPACE`.
- Mensagem de conflito de revisão (texto exato): `A pasta mudou. Reabra o aplicativo.`
- Comparação do nome na confirmação: `trim`, espaços repetidos viram um, `toLocaleLowerCase('pt-BR')`.
- Interface em português; comentários de código em inglês, só quando registram uma restrição que o código não mostra (padrão do repositório).
- Versão desta entrega: `1.10.0-obras` em `codigo-fonte/version.ts` e `desktop-launcher.cjs`; `1.10.0` em `package.json`.

## Review Focus

1. Nome de obra com acento ou cedilha (ex.: "Gama Cópia Acentuação") no download do backup — o cabeçalho `Content-Disposition` não pode quebrar o servidor; o download deve funcionar. Teste na Tarefa 2.
2. Remover com "apagar arquivos" uma obra cuja pasta sumiu — deve sair da lista sem erro e sem tentar apagar nada. Teste na Tarefa 4.
3. Reiniciar o aplicativo depois de remover a obra aberta — deve continuar sem obra aberta, sem recriar projeto. Teste na Tarefa 4.
4. Duplicar com um nome que já existe na pasta-raiz — deve recusar sem tocar na pasta existente. Teste na Tarefa 2.
5. Remover com a tela desatualizada (outra janela trocou de obra) — deve recusar com 409 e não apagar nada. Teste na Tarefa 4.

---

### Task 1: Servidor aceita "nenhuma obra aberta"

**Files:**
- Modify: `codigo-fonte/server.ts` (linhas 19-48 e rotas `/api/project`, `/api/photos/delete-copies`, `/api/workspace/switch`, `start()`)
- Modify: `codigo-fonte/reliability.ts` (helpers do topo, `hash`, `GET /api/backups`, `GET /api/diagnostics`)
- Modify: `codigo-fonte/obras.ts` (tipo `Ctx`, `registerActive`, `noteWorkspace`)
- Create: `codigo-fonte/test-sem-obra.mjs`
- Modify: `codigo-fonte/test-obras.mjs:2,18`, `codigo-fonte/test-pastas-backups.mjs:2`, `codigo-fonte/test-rdo-lote.mjs:11`, `codigo-fonte/test-rdo.mjs:35`

**Interfaces:**
- Produces: `requireWorkspace(): string` (server.ts); `ctx.workspace(): string | null` e `ctx.activate(next: string | null)` para `obras.ts` e `reliability.ts`; `GET /api/workspace` → `{path: string|null, revision: string, contentRevision: string}`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `codigo-fonte/test-sem-obra.mjs`:

```js
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const port='3163',base='http://127.0.0.1:'+port;let proc;
async function start(home){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:port,DER_DATA_DIR:home},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Start failed');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
async function request(url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
const vazio={version:1,config:{contrato:'Legada'},photos:[],drafts:[]};

const nova=fs.mkdtempSync(path.join(os.tmpdir(),'der-sem-obra-'));
await start(nova);
try{
 let w=(await request('/api/workspace')).data;
 assert.equal(w.path,null,'instalação nova começa sem obra aberta');
 assert.equal(w.contentRevision,'empty');
 let x=await request('/api/project');
 assert.equal(x.status,409);assert.match(x.data.error,/Nenhuma obra aberta/);
 x=await request('/api/project','PUT',vazio,{'X-Workspace-Revision':w.revision,'X-Project-Revision':'empty'});
 assert.equal(x.status,409,'salvar sem obra aberta é recusado');
 assert.equal(fs.existsSync(path.join(nova,'projeto.json')),false,'nenhum projeto é criado sozinho');
 x=await request('/api/obras');
 assert.equal(x.status,200);assert.equal(x.data.activeId,null);assert.equal(x.data.items.length,0);
 x=await request('/api/diagnostics');
 assert.equal(x.status,200);assert.equal(x.data.workspace,null);assert.equal(x.data.freeBytes,null);
 assert.equal((await request('/api/backups')).status,409);
 const destino=path.join(nova,'base');
 x=await request('/api/obras','POST',{nome:'Primeira',path:destino,mode:'new',open:true});
 assert.equal(x.status,201,x.data&&x.data.error);
 w=(await request('/api/workspace')).data;
 assert.equal(w.path,path.join(destino,'Obras','Primeira'),'criar obra sai do estado sem obra');
 x=await request('/api/project','PUT',vazio,{'X-Workspace-Revision':w.revision,'X-Project-Revision':w.contentRevision});
 assert.equal(x.status,200,x.data&&x.data.error);
}finally{await stop();}

const antiga=fs.mkdtempSync(path.join(os.tmpdir(),'der-legada-'));
fs.writeFileSync(path.join(antiga,'projeto.json'),JSON.stringify(vazio));
await start(antiga);
try{
 assert.equal((await request('/api/workspace')).data.path,antiga,'instalação antiga com projeto na pasta de dados continua aberta');
 const x=await request('/api/obras');
 assert.equal(x.data.items.length,1);assert.equal(x.data.items[0].path,antiga);assert.equal(x.data.activeId,x.data.items[0].id);
}finally{await stop();}

fs.writeFileSync(path.join(antiga,'pasta-trabalho.json'),JSON.stringify({path:null}));
await start(antiga);
try{
 assert.equal((await request('/api/workspace')).data.path,null,'preferência "sem obra" vence o projeto legado');
 assert.equal((await request('/api/obras')).data.activeId,null);
}finally{await stop();}
for(const d of [nova,antiga])fs.rmSync(d,{recursive:true,force:true});
console.log('test-sem-obra: ok');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node build-tmp.mjs && node --import tsx test-sem-obra.mjs`
Expected: FAIL em `instalação nova começa sem obra aberta` (hoje `path` é a pasta de dados).

- [ ] **Step 3: Implementar no `server.ts`**

Substituir o bloco das linhas 21-25 (de `const preference = ...` até `const statePath = ...`) por:

```ts
const preference = path.join(home, 'pasta-trabalho.json');
// null means no obra is open. Without a saved preference, only an old install
// that kept projeto.json in the data folder keeps using it.
function initialWorkspace():string|null{
  if(!fs.existsSync(preference))return fs.existsSync(path.join(home,'projeto.json'))?home:null;
  const saved=JSON.parse(fs.readFileSync(preference,'utf8')).path;
  if(saved===null)return null;
  if(typeof saved!=='string'||!path.isAbsolute(saved))throw new Error('Pasta de trabalho inválida. Confira pasta-trabalho.json.');
  return saved;
}
let workspace:string|null = initialWorkspace();
let revision = crypto.randomUUID();
function requireWorkspace():string{
  if(!workspace)throw Object.assign(new Error('Nenhuma obra aberta. Crie ou abra uma obra.'),{status:409,code:'NO_WORKSPACE'});
  return workspace;
}
const statePath = () => path.join(requireWorkspace(),'projeto.json');
```

Substituir o início de `readProject`:

```ts
function readProject(dir?:string) {
  const d=dir??requireWorkspace();
  const f=path.join(d,'projeto.json');
  if (!fs.existsSync(d)) throw new Error('Pasta de trabalho indisponível. Reconecte o disco ou escolha outra pasta.');
```

(o restante da função continua igual).

Na rota `GET /api/project`, trocar `res.status(500)` por `res.status(e.status||500)`.

Na rota `PUT /api/project`, trocar o trecho do `try`:

```ts
  try{reliability.guard(req);const dir=requireWorkspace();if(!fs.existsSync(dir))throw new Error('Pasta indisponível.');reliability.beforeWrite(req.body);const finish=mirror(dir,req.body,readProject());atom(statePath(),req.body);const warning=finish();obras.noteProject(req.body);res.json({success:true,warning,contentRevision:reliability.hash(),savedAt:new Date().toISOString()});}
```

Em `POST /api/photos/delete-copies`, trocar `const root=path.resolve(workspace,'fotos');` por `const root=path.resolve(requireWorkspace(),'fotos');`.

Em `POST /api/workspace/switch`, trocar `if(next===path.resolve(workspace))return res.json({path:workspace,revision});` por:

```ts
    if(workspace&&next===path.resolve(workspace))return res.json({path:workspace,revision});
```

No `setupObras(...)`, trocar o `activate` por:

```ts
activate:(next:string|null)=>{atom(preference,{path:next});workspace=next;revision=crypto.randomUUID();}
```

Em `start()`, trocar as duas ocorrências de `Pasta: ${workspace}` por `Pasta: ${workspace??'nenhuma obra aberta'}`.

- [ ] **Step 4: Implementar no `reliability.ts`**

Trocar a linha `const projectFile=()=>path.join(ctx.workspace(),'projeto.json');` por:

```ts
 const current=():string=>{const w=ctx.workspace();if(!w)throw Object.assign(new Error('Nenhuma obra aberta. Crie ou abra uma obra.'),{status:409,code:'NO_WORKSPACE'});return w;};
 const projectFile=()=>path.join(current(),'projeto.json');
```

No `hash`, inserir como primeira linha do corpo: `  if(!ctx.workspace())return 'empty';`

Trocar `const directory=()=>path.join(ctx.workspace(),'backups');` por `const directory=()=>path.join(current(),'backups');` e `const configFile=()=>path.join(ctx.workspace(),'backup-config.json');` por `const configFile=()=>path.join(current(),'backup-config.json');`.

Em `GET /api/backups`, trocar `catch(e){r.status(500)` por `catch(e:any){r.status(e.status||500)`.

Substituir a rota `GET /api/diagnostics` por:

```ts
 app.get('/api/diagnostics',(_q,r)=>{
  let freeBytes=null,lastSaved=null,lastBackup=null;
  if(ctx.workspace()){
   try{const s=fs.statfsSync(ctx.workspace());freeBytes=s.bavail*s.bsize;lastSaved=fs.existsSync(projectFile())?fs.statSync(projectFile()).mtime.toISOString():null;}catch(e){error(e,'diagnostico');}
   try{lastBackup=inventory().find(x=>x.valid)?.date||null;}catch{}
  }
  r.json({version:VERSION,platform:process.platform,workspace:ctx.workspace(),freeBytes,lastSaved,lastBackup,lastError,warning,offline:true});
 });
```

- [ ] **Step 5: Implementar no `obras.ts`**

No tipo `Ctx`, trocar `workspace:()=>string;` por `workspace:()=>string|null;` e `activate:(next:string)=>void;` por `activate:(next:string|null)=>void;`.

Substituir `registerActive` por:

```ts
 function registerActive(reg:Registry):Obra|null{
  const w=ctx.workspace();
  if(!w){reg.activeId=null;return null;}
  const at=reg.items.find(i=>key(i.path)===key(w));
  if(at){reg.activeId=at.id;at.lastAccessAt=now();return at;}
  const o={id:crypto.randomUUID(),nome:path.basename(w)||'Obra',path:w,createdAt:now(),lastAccessAt:now(),ficha:emptyFicha(),photos:0,drafts:0,lastSaved:''};
  reg.items.push(o);reg.activeId=o.id;return o;
 }
```

Em `noteWorkspace`, trocar `if(project&&typeof project==='object'&&Array.isArray(project.photos)){` por `if(o&&project&&typeof project==='object'&&Array.isArray(project.photos)){`.

- [ ] **Step 6: Ajustar os testes que dependiam da pasta de dados como obra**

`test-obras.mjs`, logo após a linha 2, inserir:

```js
fs.writeFileSync(path.join(home,'projeto.json'),JSON.stringify({version:1,config:{},photos:[],drafts:[]}));
```

e trocar a linha `assert.equal(ativa.hasProject,false);` por `assert.equal(ativa.hasProject,true);`.

Em `test-pastas-backups.mjs` (após a linha 2), `test-rdo-lote.mjs` (após a linha 11) e `test-rdo.mjs` (após a linha 35), inserir:

```js
fs.writeFileSync(path.join(dir,'pasta-trabalho.json'),JSON.stringify({path:dir}));
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: `test-sem-obra: ok` e nenhuma linha `FALHOU`.

---

### Task 2: Pasta-raiz, nova obra só com nome, duplicar e backup por obra

**Files:**
- Modify: `codigo-fonte/obras.ts` (imports, `Registry`, `load`, helpers novos, `GET /api/obras`, `POST /api/obras`, `POST /api/obras/import`, rotas novas)
- Modify: `codigo-fonte/test-obras.mjs` (linha 38 e bloco novo no fim do `try`)

**Interfaces:**
- Consumes: `ctx.workspace(): string|null` (Tarefa 1).
- Produces:
  - `GET /api/obras` → `{activeId: string|null, raiz: string|null, items: ObraRow[]}`
  - `GET /api/obras/raiz` → `{raiz: string|null, sugestao: string}`; `PUT /api/obras/raiz` `{raiz}` → `{raiz}`
  - `POST /api/obras` `{nome, mode:'new'|'open', path?, open?}` → `201 {obra, path?, revision?}`
  - `POST /api/obras/:id/duplicate` `{revision, nome, path?}` → `201 {obra}`
  - `POST /api/obras/import` `{revision, nome, project, backupHash?, path?}` → `201 {obra, path, revision}`
  - `GET /api/obras/:id/backup` → arquivo JSON `{kind:'der-backup', version:1, createdAt, reason, sha256, project}`

- [ ] **Step 1: Escrever os testes que falham**

Em `test-obras.mjs`, substituir as linhas 38-39:

```js
 x=await request('/api/obras','POST',{nome:'Obra Gama',path:gamaDir,mode:'copy',open:false});
 assert.equal(x.status,201);
```

por:

```js
 x=await request(`/api/obras/${alfa.id}/duplicate`,'POST',{revision:(await workspace()).revision,nome:'Obra Gama',path:gamaDir});
 assert.equal(x.status,201,x.data&&x.data.error);
```

No fim do bloco `try` (antes de `}finally{await stop();}`), inserir:

```js
 // pasta-raiz das obras
 x=await request('/api/obras/raiz');
 assert.equal(x.status,200);assert.equal(x.data.raiz,null,'raiz começa indefinida');
 assert.equal(x.data.sugestao,managedBase,'sugere a pasta acima de Obras da obra aberta');
 x=await request('/api/obras','POST',{nome:'Sem Raiz',mode:'new',open:false});
 assert.equal(x.status,400,'sem raiz e sem local a criação é recusada');assert.match(x.data.error,/pasta das obras/);
 assert.equal((await request('/api/obras/raiz','PUT',{raiz:'relativa\\pasta'})).status,400);
 const raiz=path.join(home,'raiz-obras');
 x=await request('/api/obras/raiz','PUT',{raiz});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.raiz,raiz);
 assert.equal((await request('/api/obras')).data.raiz,raiz);
 x=await request('/api/obras','POST',{nome:'Só Nome',mode:'new',open:false});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal(x.data.obra.path,path.join(raiz,'Obras','Só Nome'),'nova obra só com nome vai para a raiz');
 x=await request('/api/obras','POST',{nome:'Cópia',path:home,mode:'copy',open:false});
 assert.equal(x.status,400,'modo copy saiu da criação');
 // duplicar obra que não está aberta
 x=await request(`/api/obras/${gama.id}/duplicate`,'POST',{revision:(await workspace()).revision,nome:'Gama Cópia Acentuação'});
 assert.equal(x.status,201,x.data&&x.data.error);
 const gamaCopia=x.data.obra;
 assert.equal(gamaCopia.path,path.join(raiz,'Obras','Gama Cópia Acentuação'));
 assert.equal(gamaCopia.ficha.contrato,'Obra Alfa','a cópia leva o projeto da obra de origem');
 assert.ok(fs.existsSync(path.join(gamaPath,'projeto.json')),'origem intacta');
 assert.notEqual((await workspace()).path,gamaCopia.path,'duplicar não troca a obra aberta');
 const antes=fs.readFileSync(path.join(gamaCopia.path,'projeto.json'),'utf8');
 x=await request(`/api/obras/${gama.id}/duplicate`,'POST',{revision:(await workspace()).revision,nome:'Gama Cópia Acentuação'});
 assert.equal(x.status,409,'nome repetido na mesma raiz é recusado');
 assert.equal(fs.readFileSync(path.join(gamaCopia.path,'projeto.json'),'utf8'),antes,'a pasta existente não é tocada');
 x=await request(`/api/obras/${gama.id}/duplicate`,'POST',{revision:'velha',nome:'Outra'});
 assert.equal(x.status,409);
 // backup de obra não aberta, com nome acentuado, aceito pela importação
 const resp=await fetch(`${base}/api/obras/${gamaCopia.id}/backup`);
 assert.equal(resp.status,200);
 assert.match(resp.headers.get('content-disposition'),/attachment/);
 const envelope=await resp.json();
 assert.equal(envelope.kind,'der-backup');assert.equal(envelope.project.config.contrato,'Obra Alfa');
 x=await request('/api/obras/import','POST',{revision:(await workspace()).revision,nome:'Gama Restaurada',project:envelope.project,backupHash:envelope.sha256});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal(x.data.obra.path,path.join(raiz,'Obras','Gama Restaurada'),'importação sem local usa a raiz');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node build-tmp.mjs && node --import tsx test-obras.mjs`
Expected: FAIL na chamada de `/duplicate` (rota inexistente → 404 "Recurso indisponível na versão offline.").

- [ ] **Step 3: Implementar no `obras.ts`**

Acrescentar `import os from 'node:os';` após `import path from 'node:path';`.

Trocar o tipo `Registry` por:

```ts
type Registry={version:1;activeId:string|null;raiz:string|null;items:Obra[]};
```

Em `load()`, no objeto devolvido, acrescentar `raiz:typeof r.raiz==='string'&&path.isAbsolute(r.raiz)?r.raiz:null,` logo após `activeId:...,`; e trocar o retorno padrão por `return {version:1,activeId:null,raiz:null,items:[]};`.

Acrescentar, depois de `function nestPath(...)`:

```ts
function sugestaoRaiz(workspace:string|null){
 if(workspace){const pai=path.dirname(workspace);if(path.basename(pai).toLowerCase()==='obras')return path.dirname(pai);}
 return path.join(os.homedir(),'Documents','SIS RDO');
}
function baseDe(reg:{raiz:string|null},informado:any){
 if(informado!==undefined&&informado!==null&&informado!=='')return cleanPath(informado);
 if(!reg.raiz)throw fail(400,'Defina a pasta das obras ou escolha outro local.');
 return reg.raiz;
}
```

Substituir a rota `GET /api/obras` por (e acrescentar as rotas de raiz logo depois dela — antes de qualquer `/api/obras/:id`):

```ts
 app.get('/api/obras',(_q,r)=>{
  try{const cur=load();if(cur.items.length===0)registerActive(cur);
   r.json({activeId:cur.activeId,raiz:cur.raiz,items:cur.items.map(o=>row(cur,o))});
  }catch(e:any){r.status(500).json({error:ctx.report(e,'listar-obras')});}
 });

 app.get('/api/obras/raiz',(_q,r)=>{
  try{r.json({raiz:load().raiz,sugestao:sugestaoRaiz(ctx.workspace())});}
  catch(e:any){r.status(500).json({error:ctx.report(e,'consultar-pasta-das-obras')});}
 });

 app.put('/api/obras/raiz',(q:Request,r)=>{
  try{
   const raiz=cleanPath(q.body&&q.body.raiz);
   fs.mkdirSync(raiz,{recursive:true});
   if(!fs.statSync(raiz).isDirectory())throw fail(400,'O caminho escolhido não é uma pasta.');
   fs.accessSync(raiz,fs.constants.W_OK);
   const cur=load();cur.raiz=raiz;save(cur);
   r.json({raiz});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'definir-pasta-das-obras')});}
 });
```

Substituir a rota `POST /api/obras` inteira por:

```ts
 app.post('/api/obras',(q:Request,r)=>{
  try{
   const nome=cleanNome(q.body&&q.body.nome);
   const mode=q.body&&q.body.mode;
   if(!['new','open'].includes(mode))throw fail(400,'Escolha criar uma nova obra ou abrir um projeto existente.');
   const cur=load();
   let destino:string;
   if(mode==='open'){
    const pasta=cleanPath(q.body&&q.body.path);
    destino=pasta;
    if(!dirState(pasta).hasProject){
     const candidata=nestPath(pasta,nome);
     if(!dirState(candidata).hasProject)throw fail(400,'A pasta escolhida não contém projeto.json (nem em Obras\\'+nome+'). Escolha a pasta do projeto ou crie uma nova obra.');
     destino=candidata;
    }
   }else destino=nestPath(baseDe(cur,q.body&&q.body.path),nome);
   if(cur.items.some(i=>key(i.path)===key(destino)))throw fail(409,'Esta pasta já consta na lista de obras. Abra a obra existente.');
   let project:any;
   if(mode==='open'){
    project=ctx.readProject(destino);
    if(!project)throw fail(400,'A pasta escolhida não contém projeto.json. Escolha outra pasta ou crie uma nova obra.');
   }else{
    if(fs.existsSync(path.join(destino,'projeto.json')))throw fail(409,'Esta pasta já possui um projeto. Use "Abrir obra de outra pasta" ou escolha outro nome.');
    project=freshProject();
    fs.mkdirSync(destino,{recursive:true});
    fs.writeFileSync(path.join(destino,'projeto.json'),JSON.stringify(project),{flag:'wx'});
   }
   fs.accessSync(destino,fs.constants.W_OK);
   const obra:Obra={id:crypto.randomUUID(),nome,path:destino,createdAt:now(),lastAccessAt:now(),ficha:fichaOf(project.config),photos:project.photos.length,drafts:Array.isArray(project.drafts)?project.drafts.length:0,lastSaved:now()};
   cur.items.push(obra);
   const open=Boolean(q.body&&q.body.open);
   if(open){ctx.activate(destino);cur.activeId=obra.id;}
   save(cur);
   r.status(201).json({obra:row(cur,obra),path:open?ctx.workspace():undefined,revision:open?ctx.revision():undefined});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'criar-obra')});}
 });
```

Na rota `POST /api/obras/import`, trocar a linha `const base=cleanPath(q.body&&q.body.path);` por `const base=baseDe(load(),q.body&&q.body.path);`.

Acrescentar, depois da rota `POST /api/obras/import`:

```ts
 app.post('/api/obras/:id/duplicate',(q:Request,r)=>{
  let destino='';let criado=false;
  try{
   if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
   const nome=cleanNome(q.body&&q.body.nome);
   const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(!dirState(o.path).hasProject)throw fail(400,'A obra de origem não tem projeto disponível para duplicar.');
   destino=nestPath(baseDe(cur,q.body&&q.body.path),nome);
   if(cur.items.some(i=>key(i.path)===key(destino)))throw fail(409,'Esta pasta já consta na lista de obras. Escolha outro nome.');
   if(fs.existsSync(destino))throw fail(409,'A pasta '+destino+' já existe. Escolha outro nome para a cópia.');
   const project=ctx.readProject(o.path);
   fs.mkdirSync(destino,{recursive:true});criado=true;
   const finish=ctx.mirror(destino,project);
   fs.writeFileSync(path.join(destino,'projeto.json'),JSON.stringify(project),{flag:'wx'});
   finish();
   const obra:Obra={id:crypto.randomUUID(),nome,path:destino,createdAt:now(),lastAccessAt:now(),ficha:fichaOf(project.config),photos:project.photos.length,drafts:Array.isArray(project.drafts)?project.drafts.length:0,lastSaved:now()};
   cur.items.push(obra);save(cur);
   r.status(201).json({obra:row(cur,obra)});
  }catch(e:any){
   if(criado){try{fs.rmSync(destino,{recursive:true,force:true});}catch{}}
   r.status(e.status||400).json({error:ctx.report(e,'duplicar-obra')});
  }
 });

 app.get('/api/obras/:id/backup',(q:Request,r)=>{
  try{
   const o=load().items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(!dirState(o.path).hasProject)throw fail(400,'A obra não tem projeto disponível para gerar o backup.');
   const project=ctx.readProject(o.path);
   const sha256=crypto.createHash('sha256').update(JSON.stringify(project)).digest('hex');
   const envelope={kind:'der-backup',version:1,createdAt:now(),reason:'antes-de-remover-obra',sha256,project};
   const nomeArquivo=`DER-backup-${o.nome}-${now().slice(0,10)}.json`;
   // HTTP headers only accept Latin-1: keep an ASCII name and send the original in filename*.
   const ascii=nomeArquivo.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-');
   r.setHeader('Content-Type','application/json; charset=utf-8');
   r.setHeader('Content-Disposition',`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`);
   r.send(JSON.stringify(envelope));
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'baixar-backup-da-obra')});}
 });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node build-tmp.mjs && node --import tsx test-obras.mjs && node --import tsx test-sem-obra.mjs`
Expected: `PASS: ...` de test-obras e `test-sem-obra: ok`.

---

### Task 3: Mover qualquer obra e retirar o modo "repositório vazio"

**Files:**
- Modify: `codigo-fonte/obras.ts` (rota `POST /api/obras/:id/move`)
- Modify: `codigo-fonte/test-obras.mjs` (bloco "validações da troca de local" e bloco "repositório vazio")

**Interfaces:**
- Produces: `POST /api/obras/:id/move` `{revision, path, mode?: 'move'}` → `{path: string|null, revision, obra: ObraRow, warning: string, ativa: boolean}`.

- [ ] **Step 1: Ajustar os testes (passam a falhar)**

Em `test-obras.mjs`, no bloco "validações da troca de local":
- nas chamadas com `path:dup` e `path:cheia`, trocar `mode:'fresh'` por `mode:'move'`;
- na chamada com `revision:'revisao-errada'`, trocar `mode:'fresh'` por `mode:'move'`;
- substituir as duas linhas da chamada com `beta.id` (`... path:path.join(home,'obra-y'),mode:'fresh'` e `assert.equal(x.status,400,'só a obra em uso pode trocar de local');`) por:

```js
 const betaNovaBase=path.join(home,'beta-novo');const betaFinal=path.join(betaNovaBase,'Obras','Obra Beta');
 const ativaAntes=(await workspace()).path;
 x=await request(`/api/obras/${beta.id}/move`,'POST',{revision:(await workspace()).revision,path:betaNovaBase});
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.equal(x.data.ativa,false);
 assert.equal((await workspace()).path,ativaAntes,'mover obra fechada não troca a obra aberta');
 assert.ok(fs.existsSync(path.join(betaFinal,'projeto.json')),'obra fechada movida');
 assert.equal(fs.existsSync(path.join(betaPath,'projeto.json')),false,'conteúdo antigo removido');
 assert.equal((await request('/api/obras')).data.items.find(o=>o.id===beta.id).path,betaFinal);
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:path.join(home,'obra-w'),mode:'fresh'});
 assert.equal(x.status,400,'modo repositório vazio foi removido');
```

- apagar o bloco inteiro "repositório vazio na nova pasta" (do comentário `// repositório vazio na nova pasta` até a linha `assert.equal(x.data.items.find(o=>o.id===leg.id).path,final2);`);
- no bloco de importação, trocar `assert.equal(fs.existsSync(path.join(final2,'projeto.json')),true,'obra anterior permanece no disco');` por `assert.equal(fs.existsSync(path.join(final1,'projeto.json')),true,'obra anterior permanece no disco');`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-obras.mjs`
Expected: FAIL em `mover obra fechada` (hoje responde 400 "Abra esta obra antes de alterar o local dela.").

- [ ] **Step 3: Implementar no `obras.ts`**

Na rota `POST /api/obras/:id/move`:
- trocar as duas linhas de validação do modo (`const mode=...` e `if(!['move','fresh'].includes(mode))...`) por:

```ts
    const mode=q.body&&q.body.mode;
    if(mode!==undefined&&mode!=='move')throw fail(400,'A obra só pode ser movida com todo o conteúdo. Para recomeçar do zero, remova a obra e crie uma nova.');
```

- apagar a linha `if(o.id!==cur.activeId)throw fail(400,'Abra esta obra antes de alterar o local dela.');` e, no lugar, inserir `const ativa=o.id===cur.activeId;`;
- trocar `if(mode==='move'&&!dirState(origem).hasProject)throw ...` por `if(!dirState(origem).hasProject)throw fail(400,'A pasta atual não contém projeto.json.');`;
- substituir o bloco `if(mode==='fresh'){ ... }else{ ... }` pelo conteúdo do antigo `else`, trocando dentro dele `ctx.activate(destino);` por `if(ativa)ctx.activate(destino);`;
- trocar a resposta por `r.json({path:ctx.workspace(),revision:ctx.revision(),obra:row(cur,o),warning,ativa});`.

Remover a função `freshProject` só se nenhum outro ponto a usar (ela continua usada em `POST /api/obras` — manter).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node build-tmp.mjs && node --import tsx test-obras.mjs`
Expected: `PASS: ...`.

---

### Task 4: Remover qualquer obra, com opção de apagar arquivos gerenciados

**Files:**
- Modify: `codigo-fonte/obras.ts` (constante e função nova; rota `DELETE /api/obras/:id`)
- Create: `codigo-fonte/test-remover-obra.mjs`
- Modify: `codigo-fonte/test-obras.mjs` (linhas da remoção do histórico)

**Interfaces:**
- Produces: `export function apagarConteudoGerenciado(pasta: string): {apagados: string[]; preservados: string[]; falhas: string[]; pastaRemovida: boolean}`; `DELETE /api/obras/:id` `{revision, apagarArquivos?: boolean, confirmacao?: string}` → `{success: true, semObra: boolean, path: string, apagados, preservados, falhas, pastaRemovida}`; erro com falha parcial → 500 com os mesmos campos e `error`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `codigo-fonte/test-remover-obra.mjs`:

```js
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'der-remover-'));const port='3164',base='http://127.0.0.1:'+port;let proc;
async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:port,DER_DATA_DIR:home},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Start failed');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
async function request(url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
const rev=async()=>(await request('/api/workspace')).data.revision;
await start();
try{
 const raiz=path.join(home,'raiz');
 assert.equal((await request('/api/obras/raiz','PUT',{raiz})).status,200);
 const criar=async(nome,open=false)=>{const x=await request('/api/obras','POST',{nome,mode:'new',open});assert.equal(x.status,201,x.data&&x.data.error);return x.data.obra;};
 const a=await criar('Obra A',true);
 const b=await criar('Obra B');
 const c=await criar('Obra Ç Acentuada');
 const d=await criar('Obra D');

 let x=await request(`/api/obras/${b.id}`,'DELETE',{revision:await rev()});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,false);
 assert.ok(fs.existsSync(path.join(b.path,'projeto.json')),'sem apagar, os arquivos ficam');
 assert.ok(!(await request('/api/obras')).data.items.some(o=>o.id===b.id),'sai da lista');

 x=await request(`/api/obras/${c.id}`,'DELETE',{revision:'velha',apagarArquivos:true,confirmacao:'Obra Ç Acentuada'});
 assert.equal(x.status,409,'tela desatualizada é recusada');
 assert.ok(fs.existsSync(path.join(c.path,'projeto.json')),'revisão velha não apaga nada');

 x=await request(`/api/obras/${c.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra C'});
 assert.equal(x.status,400);assert.match(x.data.error,/nome da obra/);
 assert.ok(fs.existsSync(path.join(c.path,'projeto.json')),'confirmação errada não apaga nada');

 fs.mkdirSync(path.join(c.path,'fotos','PASTA'),{recursive:true});fs.writeFileSync(path.join(c.path,'fotos','PASTA','f.png'),'x');
 fs.mkdirSync(path.join(c.path,'backups'));fs.writeFileSync(path.join(c.path,'backups','backup-1.json'),'{}');
 fs.writeFileSync(path.join(c.path,'projeto.json.bak'),'{}');fs.writeFileSync(path.join(c.path,'backup-config.json'),'{}');
 fs.writeFileSync(path.join(c.path,'planilha-do-usuario.xlsx'),'x');
 fs.mkdirSync(path.join(c.path,'Imagens da Câmera'));fs.writeFileSync(path.join(c.path,'Imagens da Câmera','foto.jpg'),'x');
 x=await request(`/api/obras/${c.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'  obra ç   ACENTUADA '});
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.deepEqual([...x.data.apagados].sort(),['backup-config.json','backups','fotos','projeto.json','projeto.json.bak'].sort());
 assert.deepEqual([...x.data.preservados].sort(),['Imagens da Câmera','planilha-do-usuario.xlsx'].sort());
 assert.equal(x.data.pastaRemovida,false);
 assert.ok(fs.existsSync(path.join(c.path,'Imagens da Câmera','foto.jpg')),'arquivos alheios preservados');
 assert.equal(fs.existsSync(path.join(c.path,'projeto.json')),false);

 x=await request(`/api/obras/${d.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra D'});
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.equal(x.data.pastaRemovida,true);assert.equal(fs.existsSync(d.path),false);
 assert.ok(fs.existsSync(path.join(raiz,'Obras')),'a pasta Obras não é apagada');

 const e=await criar('Obra E');fs.rmSync(e.path,{recursive:true,force:true});
 x=await request(`/api/obras/${e.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra E'});
 assert.equal(x.status,200,x.data&&x.data.error);assert.deepEqual(x.data.apagados,[]);
 assert.ok(!(await request('/api/obras')).data.items.some(o=>o.id===e.id),'pasta indisponível também sai da lista');

 x=await request(`/api/obras/${a.id}`,'DELETE',{revision:await rev()});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,true);
 let w=(await request('/api/workspace')).data;assert.equal(w.path,null,'remover a obra aberta deixa sem obra');
 assert.equal((await request('/api/project','PUT',{version:1,config:{},photos:[],drafts:[]},{'X-Workspace-Revision':w.revision,'X-Project-Revision':'empty'})).status,409);
 assert.ok(fs.existsSync(path.join(a.path,'projeto.json')),'obra aberta removida sem apagar mantém os arquivos');
 assert.equal((await request('/api/obras')).data.activeId,null);

 await stop();await start();
 assert.equal((await request('/api/workspace')).data.path,null,'após reiniciar, continua sem obra aberta');

 x=await request('/api/obras','POST',{nome:'Obra A',mode:'open',path:a.path,open:true});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal((await request('/api/workspace')).data.path,a.path,'obra removida sem apagar pode ser aberta de novo');
 x=await request(`/api/obras/${x.data.obra.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra A'});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,true);assert.equal(fs.existsSync(a.path),false);
}finally{await stop();fs.rmSync(home,{recursive:true,force:true});}
console.log('test-remover-obra: ok');
```

Em `test-obras.mjs`, substituir as linhas:

```js
 x=await request('/api/obras');
 assert.equal((await request(`/api/obras/${x.data.activeId}`,'DELETE')).status,400,'não remove a obra em uso');
 x=await request(`/api/obras/${temp.id}`,'DELETE');
```

por:

```js
 x=await request(`/api/obras/${temp.id}`,'DELETE',{revision:(await workspace()).revision});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node build-tmp.mjs && node --import tsx test-remover-obra.mjs`
Expected: FAIL na remoção de B (`semObra` indefinido) ou na remoção da obra aberta (hoje 400).

- [ ] **Step 3: Implementar no `obras.ts`**

Depois de `const MANAGED=[...]`, acrescentar:

```ts
export const GERENCIADOS=['projeto.json','projeto.json.bak','projeto.json.tmp','fotos','backups','backup-config.json'];
export function apagarConteudoGerenciado(pasta:string){
 const apagados:string[]=[],falhas:string[]=[];
 if(!fs.existsSync(pasta))return {apagados,preservados:[] as string[],falhas,pastaRemovida:false};
 for(const nome of GERENCIADOS){
  const alvo=path.join(pasta,nome);
  let st:fs.Stats;try{st=fs.lstatSync(alvo);}catch{continue;}
  try{
   if(st.isSymbolicLink())throw new Error('atalho não é permitido');
   if(st.isDirectory())treeInfo(alvo);
   fs.rmSync(alvo,{recursive:true});
   apagados.push(nome);
  }catch(e:any){falhas.push(nome+' ('+(e.message||'erro')+')');}
 }
 const preservados=fs.readdirSync(pasta);
 let pastaRemovida=false;
 if(!preservados.length&&!falhas.length){
  try{fs.rmdirSync(pasta);pastaRemovida=true;}catch(e:any){falhas.push('pasta da obra ('+(e.message||'erro')+')');}
 }
 return {apagados,preservados,falhas,pastaRemovida};
}
const normalizarNome=(v:any)=>String(v??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
```

(`treeInfo` já existe e lança erro ao encontrar atalho dentro de `fotos`/`backups`.)

Substituir a rota `DELETE /api/obras/:id` inteira por:

```ts
 app.delete('/api/obras/:id',(q:Request,r)=>{
  try{
   if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
   const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   let resultado={apagados:[] as string[],preservados:[] as string[],falhas:[] as string[],pastaRemovida:false};
   if(q.body&&q.body.apagarArquivos===true){
    if(normalizarNome(q.body.confirmacao)!==normalizarNome(o.nome))throw fail(400,'Digite o nome da obra para confirmar.');
    resultado=apagarConteudoGerenciado(o.path);
    if(resultado.falhas.length)throw Object.assign(fail(500,'Alguns arquivos não puderam ser apagados: '+resultado.falhas.join('; ')+'. Apagados: '+(resultado.apagados.join(', ')||'nenhum')+'. A obra continua na lista.'),{detalhe:resultado});
   }
   const ativa=o.id===cur.activeId;
   cur.items=cur.items.filter(i=>i.id!==o.id);
   if(ativa){cur.activeId=null;ctx.activate(null);}
   save(cur);
   r.json({success:true,semObra:ativa,path:o.path,...resultado});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'remover-obra'),...(e.detalhe||{})});}
 });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: `test-remover-obra: ok`, demais testes ok, nenhuma linha `FALHOU`.

---

### Task 5: Camada de API e tela Obras (sem o painel Remover)

**Files:**
- Create: `codigo-fonte/src/services/obrasApi.ts`
- Create: `codigo-fonte/src/components/obras/paineis/Painel.tsx`
- Create: `codigo-fonte/src/components/obras/paineis/DefinirRaiz.tsx`
- Create: `codigo-fonte/src/components/obras/paineis/NovaObra.tsx`
- Create: `codigo-fonte/src/components/obras/paineis/AbrirOutraPasta.tsx`
- Create: `codigo-fonte/src/components/obras/paineis/ImportarBackup.tsx`
- Create: `codigo-fonte/src/components/obras/paineis/Duplicar.tsx`
- Create: `codigo-fonte/src/components/obras/paineis/Mover.tsx`
- Create: `codigo-fonte/src/components/obras/ObraCard.tsx`
- Create: `codigo-fonte/src/components/obras/ObrasPage.tsx`

**Interfaces:**
- Consumes: rotas das Tarefas 1-4.
- Produces:
  - `obrasApi` com `listar, raiz, definirRaiz, escolherPasta, criar, registrar, abrir, importar, duplicar, mover, renomear, remover, baixarBackup`;
  - tipos `Workspace = {path: string|null; revision: string}`, `ObraRow`, `ResultadoRemocao`;
  - helpers `caminhoFinal(base, nome)`, `normalizarNome(v)`, `sugerirNome(v)`;
  - `PainelBase` (props comuns dos painéis);
  - `ObrasPage({workspace, flush, importing, boasVindas?})`.

A interface não tem testes automatizados no repositório; a verificação é `tsc --noEmit`, `vite build` e a conferência manual da Tarefa 7.

- [ ] **Step 1: Criar `src/services/obrasApi.ts`**

```ts
export type Workspace={path:string|null;revision:string};
export type ObraFicha={contrato:string;rodovia:string;trecho:string;empresa:string;fiscal:string;responsavel:string};
export type ObraRow={id:string;nome:string;path:string;createdAt:string;lastAccessAt:string;ficha:ObraFicha;photos:number;drafts:number;lastSaved:string;available:boolean;hasProject:boolean;active:boolean};
export type ObrasLista={activeId:string|null;raiz:string|null;items:ObraRow[]};
export type ResultadoRemocao={success:boolean;semObra:boolean;path:string;apagados:string[];preservados:string[];falhas:string[];pastaRemovida:boolean};

async function api<T>(url:string,options?:RequestInit):Promise<T>{
 const r=await fetch(url,options);const data:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||`Não foi possível concluir a operação (HTTP ${r.status}).`);
 return data as T;
}
const json=(method:string,body:unknown):RequestInit=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

export function caminhoFinal(base:string,nome:string){
 const b=base.trim().replace(/[\\/]+$/,'');const n=nome.trim().replace(/\s+/g,' ');
 return b&&n?`${b}\\Obras\\${n}`:'';
}
export const normalizarNome=(v:string)=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
// Folder names cannot contain these characters on Windows (e.g. contract "CO141/2025").
export const sugerirNome=(v:string)=>v.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/\s+/g,' ').trim().replace(/\.+$/,'').slice(0,80);

export const obrasApi={
 listar:()=>api<ObrasLista>('/api/obras'),
 raiz:()=>api<{raiz:string|null;sugestao:string}>('/api/obras/raiz'),
 definirRaiz:(raiz:string)=>api<{raiz:string}>('/api/obras/raiz',json('PUT',{raiz})),
 escolherPasta:async()=>{const d=await api<{path:string;cancelled:boolean}>('/api/workspace/pick',json('POST',{}));return d.cancelled?'':d.path;},
 criar:(nome:string,path:string|undefined,open:boolean)=>api<{obra:ObraRow;path?:string}>('/api/obras',json('POST',{nome,mode:'new',open,...(path?{path}:{})})),
 registrar:(nome:string,path:string)=>api<{obra:ObraRow;path?:string}>('/api/obras',json('POST',{nome,mode:'open',path,open:true})),
 abrir:(id:string,revision:string)=>api<{path:string}>(`/api/obras/${id}/open`,json('POST',{revision})),
 importar:(dados:{revision:string;nome:string;project:unknown;backupHash?:string;path?:string})=>api<{obra:ObraRow;path:string}>('/api/obras/import',json('POST',dados)),
 duplicar:(id:string,dados:{revision:string;nome:string;path?:string})=>api<{obra:ObraRow}>(`/api/obras/${id}/duplicate`,json('POST',dados)),
 mover:(id:string,revision:string,path:string)=>api<{path:string|null;obra:ObraRow;warning:string;ativa:boolean}>(`/api/obras/${id}/move`,json('POST',{revision,path})),
 renomear:(id:string,nome:string)=>api<{obra:ObraRow}>(`/api/obras/${id}`,json('PUT',{nome})),
 remover:(id:string,dados:{revision:string;apagarArquivos:boolean;confirmacao?:string})=>api<ResultadoRemocao>(`/api/obras/${id}`,json('DELETE',dados)),
 baixarBackup:async(obra:ObraRow)=>{
  const r=await fetch(`/api/obras/${obra.id}/backup`);
  if(!r.ok){const d:any=await r.json().catch(()=>({}));throw new Error(d.error||'Não foi possível gerar o backup. Nada foi apagado.');}
  const blob=await r.blob();const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`DER-backup-${sugerirNome(obra.nome)}-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),30000);
 },
};
```

- [ ] **Step 2: Criar `src/components/obras/paineis/Painel.tsx`**

```tsx
import React,{useState} from 'react';
import {X} from 'lucide-react';
import {Workspace,caminhoFinal,obrasApi} from '../../../services/obrasApi';

export type PainelBase={workspace:Workspace;flush:()=>Promise<unknown>;importing:boolean;raiz:string|null;sugestao:string;onClose:()=>void;onDone:(mensagem?:string)=>void};
export const botao='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold bg-white hover:bg-slate-100 disabled:opacity-50 inline-flex items-center gap-1';
export const botaoPrimario=botao+' !bg-emerald-700 !text-white !border-emerald-700 hover:!bg-emerald-800';
export const campo='block w-full border border-slate-300 rounded-lg p-2.5 font-normal bg-white focus:ring-1 focus:ring-emerald-500';
export const destaque='text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2 break-all';

export function Painel({titulo,onClose,ocupado,children}:{titulo:string;onClose:()=>void;ocupado?:boolean;children:React.ReactNode}){
 return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titulo}>
  <div className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
   <div className="flex items-start justify-between gap-3">
    <h3 className="text-lg font-bold">{titulo}</h3>
    <button className="text-slate-400 hover:text-slate-700 p-1 disabled:opacity-40" onClick={onClose} disabled={ocupado} aria-label="Fechar"><X className="w-5 h-5"/></button>
   </div>
   {children}
  </div>
 </div>;
}

export function Erro({texto}:{texto:string}){
 return texto?<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg whitespace-pre-wrap">{texto}</p>:null;
}

export function useAcao(){
 const [ocupado,setOcupado]=useState(false);const [erro,setErro]=useState('');
 const executar=async(fn:()=>Promise<void>)=>{setOcupado(true);setErro('');try{await fn();}catch(e:any){setErro(e?.message||'Erro desconhecido.');}finally{setOcupado(false);}};
 return {ocupado,erro,executar};
}

export function CampoPasta({valor,onChange,ocupado,placeholder='C:\\SIS RDO'}:{valor:string;onChange:(v:string)=>void;ocupado:boolean;placeholder?:string}){
 const [procurando,setProcurando]=useState(false);const [erro,setErro]=useState('');
 const procurar=async()=>{setProcurando(true);setErro('');try{const p=await obrasApi.escolherPasta();if(p)onChange(p);}catch(e:any){setErro(e.message);}finally{setProcurando(false);}};
 return <div className="space-y-1">
  <div className="flex gap-2">
   <input className={campo+' text-sm'} value={valor} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={ocupado} aria-label="Caminho da pasta"/>
   <button type="button" className={botao+' shrink-0'} disabled={ocupado||procurando} onClick={procurar}>{procurando?'Aguarde…':'Procurar'}</button>
  </div>
  {erro&&<p className="text-xs text-red-700">{erro}</p>}
 </div>;
}

// Shared "where will this obra live" fields for Nova obra, Importar backup and Duplicar.
export function useLocalDaObra(raiz:string|null,sugestao:string){
 const [outroLocal,setOutroLocal]=useState(false);const [local,setLocal]=useState('');const [raizNova,setRaizNova]=useState(sugestao);
 const base=outroLocal?local.trim():(raiz||raizNova.trim());
 const confirmarRaiz=async()=>{if(!raiz&&!outroLocal)await obrasApi.definirRaiz(raizNova.trim());};
 const pathInformado=outroLocal?base:undefined;
 const campos=(nome:string,ocupado:boolean)=><div className="space-y-2">
  {!raiz&&!outroLocal&&<div className="space-y-1"><p className="text-sm">Defina a pasta onde todas as obras serão guardadas (pode ser alterada depois):</p><CampoPasta valor={raizNova} onChange={setRaizNova} ocupado={ocupado}/></div>}
  {outroLocal&&<div className="space-y-1"><p className="text-sm font-semibold">Outro local para esta obra</p><CampoPasta valor={local} onChange={setLocal} ocupado={ocupado}/></div>}
  {base&&nome.trim()&&<p className={destaque}>Será criada em: <strong>{caminhoFinal(base,nome)}</strong></p>}
  <button type="button" className="text-sm text-emerald-700 underline disabled:opacity-50" disabled={ocupado} onClick={()=>setOutroLocal(v=>!v)}>{outroLocal?'Usar a pasta das obras':'Escolher outro local'}</button>
 </div>;
 return {base,pathInformado,confirmarRaiz,campos};
}
```

- [ ] **Step 3: Criar os painéis simples**

`src/components/obras/paineis/DefinirRaiz.tsx`:

```tsx
import React,{useState} from 'react';
import {obrasApi} from '../../../services/obrasApi';
import {Painel,CampoPasta,Erro,botao,botaoPrimario,useAcao} from './Painel';

export function DefinirRaiz({raiz,sugestao,onClose,onDone}:{raiz:string|null;sugestao:string;onClose:()=>void;onDone:(m?:string)=>void}){
 const [valor,setValor]=useState(raiz||sugestao);const {ocupado,erro,executar}=useAcao();
 const salvar=()=>executar(async()=>{
  if(!valor.trim())throw new Error('Informe a pasta das obras.');
  const d=await obrasApi.definirRaiz(valor.trim());
  onDone(`Pasta das obras definida: ${d.raiz}. As próximas obras serão criadas em ${d.raiz}\\Obras.`);
 });
 return <Painel titulo="Pasta das obras" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Novas obras, cópias e backups importados são criados em <strong>pasta\Obras\nome da obra</strong>. Alterar esta pasta não move as obras que já existem; para isso, use <strong>Mover</strong> em cada obra.</p>
  <CampoPasta valor={valor} onChange={setValor} ocupado={ocupado}/>
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!valor.trim()} onClick={salvar}>{ocupado?'Aguarde…':'Salvar'}</button></div>
 </Painel>;
}
```

`src/components/obras/paineis/NovaObra.tsx`:

```tsx
import React,{useState} from 'react';
import {obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao,useLocalDaObra} from './Painel';

export function NovaObra({flush,importing,raiz,sugestao,onClose,onDone}:PainelBase){
 const [nome,setNome]=useState('');const [abrirDepois,setAbrirDepois]=useState(true);
 const local=useLocalDaObra(raiz,sugestao);const {ocupado,erro,executar}=useAcao();
 const criar=()=>executar(async()=>{
  if(!nome.trim())throw new Error('Informe o nome da obra.');
  if(!local.base)throw new Error('Informe onde guardar a obra.');
  if(abrirDepois&&importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');
  await local.confirmarRaiz();
  await flush();
  const d=await obrasApi.criar(nome.trim(),local.pathInformado,abrirDepois);
  if(abrirDepois&&d.path){location.reload();return;}
  onDone(`Obra "${d.obra.nome}" criada em ${d.obra.path}.`);
 });
 return <Painel titulo="Nova obra" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Cria uma obra vazia (sem fotos), com pasta própria para projeto, fotos e backups.</p>
  <label className="block text-sm font-semibold">Nome da obra
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} autoFocus placeholder="Ex.: PR-317 Iguaraçu–Maringá" disabled={ocupado}/>
  </label>
  {local.campos(nome,ocupado)}
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={abrirDepois} disabled={ocupado} onChange={e=>setAbrirDepois(e.target.checked)}/> Abrir esta obra em seguida</label>
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!nome.trim()||!local.base} onClick={criar}>{ocupado?'Aguarde…':'Criar obra'}</button></div>
 </Painel>;
}
```

`src/components/obras/paineis/AbrirOutraPasta.tsx`:

```tsx
import React,{useState} from 'react';
import {obrasApi,sugerirNome} from '../../../services/obrasApi';
import {Painel,PainelBase,CampoPasta,Erro,botao,botaoPrimario,campo,useAcao} from './Painel';

export function AbrirOutraPasta({flush,importing,onClose}:PainelBase){
 const [pasta,setPasta]=useState('');const [nome,setNome]=useState('');const {ocupado,erro,executar}=useAcao();
 const definirPasta=(p:string)=>{setPasta(p);if(!nome.trim())setNome(sugerirNome(p.trim().replace(/[\\/]+$/,'').split(/[\\/]/).pop()||''));};
 const abrir=()=>executar(async()=>{
  if(importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');
  if(!pasta.trim())throw new Error('Informe a pasta da obra.');
  if(!nome.trim())throw new Error('Informe o nome da obra para a lista.');
  await flush();
  await obrasApi.registrar(nome.trim(),pasta.trim());
  location.reload();
 });
 return <Painel titulo="Abrir obra de outra pasta" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Use para uma obra que já existe no computador (a pasta contém <strong>projeto.json</strong>), por exemplo vinda de outro computador ou removida da lista antes. Nada é copiado: a obra passa a ser usada direto dessa pasta.</p>
  <div className="space-y-1"><span className="block text-sm font-semibold">Pasta da obra</span><CampoPasta valor={pasta} onChange={definirPasta} ocupado={ocupado}/></div>
  <label className="block text-sm font-semibold">Nome na lista de obras
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} disabled={ocupado}/>
  </label>
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!pasta.trim()||!nome.trim()} onClick={abrir}>{ocupado?'Aguarde…':'Abrir obra'}</button></div>
 </Painel>;
}
```

`src/components/obras/paineis/ImportarBackup.tsx`:

```tsx
import React,{useState} from 'react';
import {obrasApi,sugerirNome} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao,useLocalDaObra} from './Painel';

export function ImportarBackup({workspace,flush,importing,raiz,sugestao,onClose}:PainelBase){
 const [arquivo,setArquivo]=useState<File|null>(null);const [nome,setNome]=useState('');
 const local=useLocalDaObra(raiz,sugestao);const {ocupado,erro,executar}=useAcao();
 const nomeDoArquivo=(f:File)=>sugerirNome(f.name.replace(/\.json$/i,'').replace(/^DER-backup-/i,''));
 const escolher=async(file:File|null)=>{
  setArquivo(file);if(!file)return;
  try{const data=JSON.parse(await file.text());const project=data?.kind==='der-backup'?data.project:data;const contrato=project?.config?.contrato;setNome(typeof contrato==='string'&&contrato.trim()?sugerirNome(contrato):nomeDoArquivo(file));}
  catch{setNome(nomeDoArquivo(file));}
 };
 const importar=()=>executar(async()=>{
  if(importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');
  if(!arquivo)throw new Error('Selecione o arquivo de backup.');
  if(!nome.trim())throw new Error('Informe o nome da obra.');
  if(!local.base)throw new Error('Informe onde guardar a obra.');
  let data:any;try{data=JSON.parse(await arquivo.text());}catch{throw new Error('O arquivo não é um backup válido (conteúdo ilegível).');}
  const managed=data?.kind==='der-backup';
  if(managed&&(data.version!==1||typeof data.sha256!=='string'))throw new Error('Arquivo de backup interno inválido.');
  await local.confirmarRaiz();
  await flush();
  await obrasApi.importar({revision:workspace.revision,nome:nome.trim(),project:managed?data.project:data,backupHash:managed?data.sha256:undefined,path:local.pathInformado});
  location.reload();
 });
 return <Painel titulo="Importar obra de backup" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Cria uma <strong>obra nova</strong> a partir do arquivo de backup e a abre em seguida. A obra aberta agora não é alterada. Para voltar a obra aberta a um backup anterior, use <strong>Backup e Info</strong>.</p>
  <label className="block text-sm font-semibold">Arquivo de backup (.json)
   <input className={campo+' mt-1 text-sm'} type="file" accept=".json,application/json" disabled={ocupado} onChange={e=>escolher(e.target.files?.[0]||null)}/>
  </label>
  <label className="block text-sm font-semibold">Nome da obra
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} disabled={ocupado}/>
  </label>
  {local.campos(nome,ocupado)}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!arquivo||!nome.trim()||!local.base} onClick={importar}>{ocupado?'Importando…':'Importar e abrir'}</button></div>
 </Painel>;
}
```

`src/components/obras/paineis/Duplicar.tsx`:

```tsx
import React,{useState} from 'react';
import {ObraRow,obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao,useLocalDaObra} from './Painel';

export function Duplicar({obra,workspace,flush,raiz,sugestao,onClose,onDone}:PainelBase&{obra:ObraRow}){
 const [nome,setNome]=useState(`${obra.nome} (cópia)`.slice(0,80));
 const local=useLocalDaObra(raiz,sugestao);const {ocupado,erro,executar}=useAcao();
 const duplicar=()=>executar(async()=>{
  if(!nome.trim())throw new Error('Informe o nome da cópia.');
  if(!local.base)throw new Error('Informe onde guardar a cópia.');
  await local.confirmarRaiz();
  if(obra.active)await flush();
  const d=await obrasApi.duplicar(obra.id,{revision:workspace.revision,nome:nome.trim(),path:local.pathInformado});
  onDone(`Cópia "${d.obra.nome}" criada em ${d.obra.path}. A obra aberta não mudou.`);
 });
 return <Painel titulo={`Duplicar "${obra.nome}"`} onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Copia projeto, fotos e configurações para uma obra nova e independente. A obra original continua como está.</p>
  <label className="block text-sm font-semibold">Nome da cópia
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} autoFocus disabled={ocupado}/>
  </label>
  {local.campos(nome,ocupado)}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!nome.trim()||!local.base} onClick={duplicar}>{ocupado?'Aguarde…':'Duplicar'}</button></div>
 </Painel>;
}
```

`src/components/obras/paineis/Mover.tsx`:

```tsx
import React,{useState} from 'react';
import {ObraRow,caminhoFinal,obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,CampoPasta,Erro,botao,botaoPrimario,destaque,useAcao} from './Painel';

export function Mover({obra,workspace,flush,importing,onClose,onDone}:PainelBase&{obra:ObraRow}){
 const [destino,setDestino]=useState('');const [avisoFinal,setAvisoFinal]=useState('');const {ocupado,erro,executar}=useAcao();
 const mover=()=>executar(async()=>{
  if(obra.active&&importing)throw new Error('Aguarde a importação das fotos terminar.');
  if(!destino.trim())throw new Error('Informe a nova pasta da obra.');
  if(obra.active)await flush();
  const d=await obrasApi.mover(obra.id,workspace.revision,destino.trim());
  if(d.ativa){if(d.warning){setAvisoFinal(d.warning);return;}location.reload();return;}
  onDone(d.warning||`Obra "${obra.nome}" movida para ${d.obra.path}.`);
 });
 if(avisoFinal)return <Painel titulo="Obra movida" onClose={()=>location.reload()}>
  <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">{avisoFinal}</p>
  <div className="flex justify-end"><button className={botaoPrimario} onClick={()=>location.reload()}>Continuar</button></div>
 </Painel>;
 return <Painel titulo={`Mover "${obra.nome}"`} onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Projeto, fotos e backups são copiados para o novo local, conferidos arquivo por arquivo e só então apagados de <span className="break-all">{obra.path}</span>. Outros arquivos da pasta atual não são tocados.</p>
  <div className="space-y-1"><span className="block text-sm font-semibold">Nova pasta-base</span><CampoPasta valor={destino} onChange={setDestino} ocupado={ocupado}/></div>
  {destino.trim()&&<p className={destaque}>A obra ficará em: <strong>{caminhoFinal(destino,obra.nome)}</strong></p>}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!destino.trim()} onClick={mover}>{ocupado?'Movendo…':'Mover obra'}</button></div>
 </Painel>;
}
```

- [ ] **Step 4: Criar `src/components/obras/ObraCard.tsx`**

```tsx
import React,{useState} from 'react';
import {Check,Copy,FolderInput,FolderOpen,MapPin,Pencil,Trash2} from 'lucide-react';
import {ObraRow} from '../../services/obrasApi';
import {botao,campo} from './paineis/Painel';

function quando(iso:string){if(!iso)return '—';const d=new Date(iso);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});}
const etiqueta='text-[10px] font-bold uppercase text-white rounded px-1.5 py-0.5';

export function ObraCard({obra:o,importing,onAbrir,onRenomear,onDuplicar,onMover,onRemover}:{obra:ObraRow;importing:boolean;onAbrir:()=>void;onRenomear:(nome:string)=>Promise<void>;onDuplicar:()=>void;onMover:()=>void;onRemover:()=>void}){
 const [editando,setEditando]=useState(false);const [nome,setNome]=useState(o.nome);const [erro,setErro]=useState('');const [ocupado,setOcupado]=useState(false);
 const salvar=async()=>{setOcupado(true);setErro('');try{await onRenomear(nome.trim());setEditando(false);}catch(e:any){setErro(e.message);}finally{setOcupado(false);}};
 const ficha=[o.ficha.contrato,o.ficha.rodovia&&o.ficha.trecho?`${o.ficha.rodovia} • ${o.ficha.trecho}`:o.ficha.rodovia||o.ficha.trecho].filter(Boolean).join(' | ');
 const bloqueadaPorImportacao=o.active&&importing;
 return <article className={`bg-white border rounded-xl p-4 space-y-2 ${o.active?'border-emerald-500 ring-1 ring-emerald-500':'border-slate-200'}`}>
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0 space-y-1">
    {editando
     ?<div className="flex gap-2">
       <input className={campo+' text-sm'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} autoFocus aria-label="Novo nome da obra"/>
       <button className={botao} disabled={ocupado||!nome.trim()} onClick={salvar} aria-label="Salvar nome"><Check className="w-4 h-4"/></button>
       <button className={botao} disabled={ocupado} onClick={()=>{setEditando(false);setNome(o.nome);setErro('');}}>Cancelar</button>
      </div>
     :<p className="font-semibold flex items-center gap-2 flex-wrap">
       <span className="truncate">{o.nome}</span>
       {o.active&&<span className={etiqueta+' bg-emerald-700'}>Em uso</span>}
       {!o.available&&<span className={etiqueta+' bg-amber-500'}>Pasta indisponível</span>}
       {o.available&&!o.hasProject&&<span className={etiqueta+' bg-slate-400'}>Sem projeto</span>}
      </p>}
    {erro&&<p className="text-xs text-red-700">{erro}</p>}
    <p className="text-xs text-slate-600">{ficha||'Ficha ainda não preenchida (contrato, rodovia e trecho aparecem após o primeiro salvamento).'}</p>
    <p className="text-xs text-slate-400 break-all" title={o.path}><MapPin className="w-3 h-3 inline -mt-0.5"/> {o.path}</p>
    <p className="text-xs text-slate-500">Último acesso: {quando(o.lastAccessAt)} • Fotos: {o.photos} • Salvo: {quando(o.lastSaved)}</p>
    {!o.available&&<p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">A pasta não foi encontrada. Reconecte o disco ou remova a obra da lista. Nada foi criado no lugar dela.</p>}
    {o.available&&!o.hasProject&&<p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">Esta pasta não tem projeto.json. Remova a obra da lista ou use "Abrir obra de outra pasta" com a pasta correta.</p>}
   </div>
   {!o.active&&<button className={botao+' !border-emerald-600 text-emerald-700 shrink-0'} disabled={!o.available||!o.hasProject||importing} onClick={onAbrir}><FolderOpen className="w-4 h-4"/> Abrir</button>}
  </div>
  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
   <button className={botao} disabled={editando} onClick={()=>{setEditando(true);setNome(o.nome);setErro('');}}><Pencil className="w-4 h-4"/> Renomear</button>
   <button className={botao} disabled={!o.hasProject} onClick={onDuplicar}><Copy className="w-4 h-4"/> Duplicar</button>
   <button className={botao} disabled={!o.hasProject||bloqueadaPorImportacao} onClick={onMover}><FolderInput className="w-4 h-4"/> Mover</button>
   <button className={botao+' !border-red-300 text-red-600'} disabled={bloqueadaPorImportacao} onClick={onRemover}><Trash2 className="w-4 h-4"/> Remover</button>
  </div>
 </article>;
}
```

- [ ] **Step 5: Criar `src/components/obras/ObrasPage.tsx`**

O painel Remover é ligado na Tarefa 6; nesta tarefa o botão Remover abre o painel `{tipo:'remover'}` que ainda não renderiza nada.

```tsx
import React,{useEffect,useMemo,useState} from 'react';
import {Building2,FolderSearch,Plus,Search,Upload} from 'lucide-react';
import {ObraRow,Workspace,obrasApi} from '../../services/obrasApi';
import {VERSION} from '../../../version';
import {ObraCard} from './ObraCard';
import {botao,botaoPrimario} from './paineis/Painel';
import {DefinirRaiz} from './paineis/DefinirRaiz';
import {NovaObra} from './paineis/NovaObra';
import {AbrirOutraPasta} from './paineis/AbrirOutraPasta';
import {ImportarBackup} from './paineis/ImportarBackup';
import {Duplicar} from './paineis/Duplicar';
import {Mover} from './paineis/Mover';

type PainelAberto={tipo:'raiz'}|{tipo:'nova'}|{tipo:'outra'}|{tipo:'importar'}|{tipo:'duplicar';obra:ObraRow}|{tipo:'mover';obra:ObraRow}|{tipo:'remover';obra:ObraRow}|null;

export function ObrasPage({workspace,flush,importing,boasVindas=false}:{workspace:Workspace;flush:()=>Promise<unknown>;importing:boolean;boasVindas?:boolean}){
 const [items,setItems]=useState<ObraRow[]>([]);const [raiz,setRaiz]=useState<string|null>(null);const [sugestao,setSugestao]=useState('');
 const [painel,setPainel]=useState<PainelAberto>(null);const [busca,setBusca]=useState('');const [ordem,setOrdem]=useState<'acesso'|'nome'>('acesso');
 const [erro,setErro]=useState('');const [aviso,setAviso]=useState('');const [versaoServidor,setVersaoServidor]=useState('');
 const carregar=async()=>{try{const [l,r]=await Promise.all([obrasApi.listar(),obrasApi.raiz()]);setItems(l.items);setRaiz(l.raiz);setSugestao(r.sugestao);}catch(e:any){setErro(e.message);}};
 useEffect(()=>{carregar();fetch('/api/health').then(r=>r.json()).then(h=>{if(h.version&&h.version!==VERSION)setVersaoServidor(h.version);}).catch(()=>{});},[]);
 const visiveis=useMemo(()=>{
  const termo=busca.trim().toLocaleLowerCase('pt-BR');
  return items
   .filter(o=>!termo||[o.nome,o.path,o.ficha.contrato,o.ficha.rodovia,o.ficha.trecho].some(v=>v.toLocaleLowerCase('pt-BR').includes(termo)))
   .sort((a,b)=>(Number(b.active)-Number(a.active))||(ordem==='nome'?a.nome.localeCompare(b.nome,'pt-BR'):b.lastAccessAt.localeCompare(a.lastAccessAt)));
 },[items,busca,ordem]);
 const abrir=async(o:ObraRow)=>{setErro('');try{if(importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');await flush();await obrasApi.abrir(o.id,workspace.revision);location.reload();}catch(e:any){setErro(e.message);}};
 const renomear=async(o:ObraRow,nome:string)=>{const d=await obrasApi.renomear(o.id,nome);setItems(old=>old.map(x=>x.id===o.id?{...x,...d.obra}:x));};
 const fechar=()=>setPainel(null);
 const concluido=async(mensagem?:string)=>{setPainel(null);setAviso(mensagem||'');await carregar();};
 const base={workspace,flush,importing,raiz,sugestao,onClose:fechar,onDone:concluido};
 const acoes=[
  {tipo:'nova' as const,titulo:'Nova obra',texto:'Começar uma obra vazia.',icone:Plus},
  {tipo:'outra' as const,titulo:'Abrir obra de outra pasta',texto:'Usar uma obra que já existe no computador.',icone:FolderSearch},
  {tipo:'importar' as const,titulo:'Importar backup',texto:'Criar uma obra a partir de um arquivo de backup.',icone:Upload},
 ];
 return <div className="max-w-4xl mx-auto space-y-4">
  {boasVindas&&<section className="bg-white border rounded-xl p-6 text-center space-y-2">
   <Building2 className="w-10 h-10 mx-auto text-emerald-700"/>
   <h2 className="text-2xl font-bold">Nenhuma obra aberta</h2>
   <p className="text-sm text-slate-600">Crie uma obra nova, abra uma obra que já existe no computador ou importe um backup. As demais abas ficam disponíveis assim que uma obra estiver aberta.</p>
  </section>}
  {versaoServidor&&<p role="alert" className="text-sm bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg">O servidor está na versão <strong>{versaoServidor}</strong> e a interface é a <strong>{VERSION}</strong>. Feche a janela do aplicativo e a janela de comandos e abra novamente pelo INICIAR.cmd.</p>}
  <section className="bg-white border rounded-xl p-4 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm"><span className="font-semibold">Pasta das obras:</span> <span className="break-all">{raiz||<em className="text-slate-500">não definida (sugestão: {sugestao})</em>}</span></p>
    <button className={botao} onClick={()=>setPainel({tipo:'raiz'})}>{raiz?'Alterar':'Definir'}</button>
   </div>
   {boasVindas
    ?<div className="grid sm:grid-cols-3 gap-3">{acoes.map(a=><button key={a.tipo} className="border-2 border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-left space-y-1" onClick={()=>setPainel({tipo:a.tipo})}><a.icone className="w-6 h-6 text-emerald-700"/><p className="font-semibold">{a.titulo}</p><p className="text-xs text-slate-600">{a.texto}</p></button>)}</div>
    :<div className="flex flex-wrap gap-2">{acoes.map(a=><button key={a.tipo} className={a.tipo==='nova'?botaoPrimario:botao} onClick={()=>setPainel({tipo:a.tipo})}><a.icone className="w-4 h-4"/> {a.titulo}</button>)}</div>}
  </section>
  {aviso&&<p role="status" className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-lg whitespace-pre-wrap">{aviso}</p>}
  {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
  <section className="space-y-3">
   {items.length>0&&<div className="flex flex-wrap gap-2 items-center">
    <label className="flex-1 min-w-[200px] relative"><Search className="w-4 h-4 absolute left-2 top-3 text-slate-400"/><input className="w-full border border-slate-300 rounded-lg p-2 pl-8 text-sm bg-white" placeholder="Buscar por nome, contrato, rodovia ou pasta" value={busca} onChange={e=>setBusca(e.target.value)} aria-label="Buscar obra"/></label>
    <select className="border border-slate-300 rounded-lg p-2 text-sm bg-white" value={ordem} onChange={e=>setOrdem(e.target.value as 'acesso'|'nome')} aria-label="Ordenar obras"><option value="acesso">Último acesso</option><option value="nome">Nome</option></select>
   </div>}
   {visiveis.length===0&&<p className="text-sm text-slate-500 bg-white border rounded-xl p-4">{items.length?'Nenhuma obra corresponde à busca.':'Nenhuma obra registrada.'}</p>}
   {visiveis.map(o=><ObraCard key={o.id} obra={o} importing={importing} onAbrir={()=>abrir(o)} onRenomear={nome=>renomear(o,nome)} onDuplicar={()=>setPainel({tipo:'duplicar',obra:o})} onMover={()=>setPainel({tipo:'mover',obra:o})} onRemover={()=>setPainel({tipo:'remover',obra:o})}/>)}
  </section>
  {painel?.tipo==='raiz'&&<DefinirRaiz raiz={raiz} sugestao={sugestao} onClose={fechar} onDone={concluido}/>}
  {painel?.tipo==='nova'&&<NovaObra {...base}/>}
  {painel?.tipo==='outra'&&<AbrirOutraPasta {...base}/>}
  {painel?.tipo==='importar'&&<ImportarBackup {...base}/>}
  {painel?.tipo==='duplicar'&&<Duplicar {...base} obra={painel.obra}/>}
  {painel?.tipo==='mover'&&<Mover {...base} obra={painel.obra}/>}
 </div>;
}
```

- [ ] **Step 6: Verificar compilação**

Run: `npx tsc --noEmit && npx vite build`
Expected: sem erros de TypeScript; `✓ built`.

---

### Task 6: Painel Remover, tela inicial e integração no App

**Files:**
- Create: `codigo-fonte/src/components/obras/paineis/Remover.tsx`
- Create: `codigo-fonte/src/components/obras/BoasVindas.tsx`
- Modify: `codigo-fonte/src/components/obras/ObrasPage.tsx` (ligar o painel Remover)
- Modify: `codigo-fonte/src/App.tsx`
- Modify: `codigo-fonte/src/components/ReliabilityPanel.tsx`
- Delete: `codigo-fonte/src/components/ObrasModal.tsx`

**Interfaces:**
- Consumes: `obrasApi.remover`, `obrasApi.baixarBackup`, `normalizarNome`, `ResultadoRemocao`, `PainelBase`, `ObrasPage` (Tarefa 5).
- Produces: `BoasVindas({workspace, flush, importing})`; App sem obra aberta mostra `BoasVindas` e não salva.

- [ ] **Step 1: Criar `src/components/obras/paineis/Remover.tsx`**

```tsx
import React,{useState} from 'react';
import {ObraRow,ResultadoRemocao,normalizarNome,obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao} from './Painel';

export function Remover({obra,workspace,flush,importing,onClose,onDone}:PainelBase&{obra:ObraRow}){
 const [apagar,setApagar]=useState(false);const [backupAntes,setBackupAntes]=useState(true);const [confirmacao,setConfirmacao]=useState('');
 const [resultado,setResultado]=useState<ResultadoRemocao|null>(null);const {ocupado,erro,executar}=useAcao();
 const podeBaixar=obra.available&&obra.hasProject;
 const confere=normalizarNome(confirmacao)===normalizarNome(obra.nome);
 const remover=()=>executar(async()=>{
  if(obra.active&&importing)throw new Error('Aguarde a importação das fotos terminar antes de remover a obra em uso.');
  if(obra.active)await flush();
  if(apagar&&backupAntes&&podeBaixar)await obrasApi.baixarBackup(obra);
  const r=await obrasApi.remover(obra.id,{revision:workspace.revision,apagarArquivos:apagar,confirmacao:apagar?confirmacao:undefined});
  if(r.semObra&&!r.preservados.length){location.reload();return;}
  setResultado(r);
 });
 const continuar=()=>{
  if(resultado?.semObra){location.reload();return;}
  onDone(apagar?`Obra "${obra.nome}" removida e arquivos apagados.`:`Obra "${obra.nome}" removida da lista. Os arquivos continuam em ${obra.path}.`);
 };
 if(resultado)return <Painel titulo="Obra removida" onClose={continuar}>
  <p className="text-sm">"{obra.nome}" saiu da lista.</p>
  {resultado.apagados.length>0&&<p className="text-sm">Apagados: {resultado.apagados.join(', ')}.</p>}
  {resultado.preservados.length>0&&<div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
   <p className="font-semibold">Estes itens não pertencem ao app e foram mantidos em <span className="break-all">{obra.path}</span>:</p>
   <ul className="list-disc pl-5">{resultado.preservados.map(n=><li key={n}>{n}</li>)}</ul>
  </div>}
  {!apagar&&<p className="text-sm">Os arquivos continuam em <span className="break-all">{obra.path}</span>.</p>}
  <div className="flex justify-end"><button className={botaoPrimario} onClick={continuar}>Continuar</button></div>
 </Painel>;
 return <Painel titulo={`Remover "${obra.nome}"`} onClose={onClose} ocupado={ocupado}>
  <p className="text-sm">A obra sai da lista.{!apagar&&<> Os arquivos continuam em <span className="break-all">{obra.path}</span>.</>}</p>
  {obra.active&&<p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">Esta é a obra em uso. Depois disso nenhuma obra ficará aberta e você escolherá ou criará outra.</p>}
  <label className="flex items-start gap-2 text-sm">
   <input type="checkbox" className="mt-0.5" checked={apagar} disabled={ocupado||!obra.available} onChange={e=>setApagar(e.target.checked)}/>
   <span><strong>Apagar também os arquivos do disco</strong>{!obra.available&&<span className="block text-xs text-slate-500">Indisponível: a pasta da obra não foi encontrada.</span>}</span>
  </label>
  {apagar&&<div className="space-y-2 border border-red-200 bg-red-50/50 rounded-lg p-3 text-sm">
   <p>Serão apagados de <span className="break-all">{obra.path}</span>: o projeto (projeto.json e cópias de segurança), as fotos copiadas pelo app (pasta fotos) e os backups da obra (pasta backups).</p>
   <p>Outros arquivos e pastas que estiverem ali serão preservados.</p>
   {podeBaixar&&<label className="flex items-center gap-2"><input type="checkbox" checked={backupAntes} disabled={ocupado} onChange={e=>setBackupAntes(e.target.checked)}/> Baixar um backup completo antes de apagar</label>}
   {(!backupAntes||!podeBaixar)&&<p className="text-red-800">Sem o backup, não será possível recuperar esta obra.</p>}
   <label className="block font-semibold">Digite o nome da obra para confirmar: <span className="font-normal">{obra.nome}</span>
    <input className={campo+' mt-1'} value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} disabled={ocupado} aria-label="Nome da obra para confirmar"/>
   </label>
  </div>}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2">
   <button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button>
   <button className={botao+' !bg-red-600 !text-white !border-red-600 hover:!bg-red-700'} disabled={ocupado||(apagar&&!confere)} onClick={remover}>{ocupado?'Aguarde…':apagar?'Remover e apagar arquivos':'Remover da lista'}</button>
  </div>
 </Painel>;
}
```

- [ ] **Step 2: Ligar o painel no `ObrasPage.tsx`**

Acrescentar o import `import {Remover} from './paineis/Remover';` e, após a linha `{painel?.tipo==='mover'&&<Mover {...base} obra={painel.obra}/>}`, acrescentar:

```tsx
  {painel?.tipo==='remover'&&<Remover {...base} obra={painel.obra}/>}
```

- [ ] **Step 3: Criar `src/components/obras/BoasVindas.tsx`**

```tsx
import React from 'react';
import {Workspace} from '../../services/obrasApi';
import {ObrasPage} from './ObrasPage';

export function BoasVindas(props:{workspace:Workspace;flush:()=>Promise<unknown>;importing:boolean}){
 return <ObrasPage {...props} boasVindas/>;
}
```

- [ ] **Step 4: Integrar no `App.tsx`**

1. Trocar `import {ObrasModal} from './components/ObrasModal';` por:

```tsx
import {ObrasPage} from './components/obras/ObrasPage';
import {BoasVindas} from './components/obras/BoasVindas';
```

2. Trocar `const [workspace,setWorkspace]=useState({path:'',revision:''});` por `const [workspace,setWorkspace]=useState<{path:string|null;revision:string}>({path:'',revision:''});`.
3. Apagar a linha `const [obrasDialog,setObrasDialog]=useState(false);`.
4. Na mesma linha de `const queue=useRef(...)`, apagar `const backupInput=useRef<HTMLInputElement>(null);`.
5. No efeito de carga, logo após `const w=await api('/api/workspace');setWorkspace(w);contentRevision.current=w.contentRevision;`, inserir:

```tsx
   if(!w.path){setReady(true);setTab('obras');return;}
```

6. No efeito de salvamento, trocar a primeira linha `  if(!ready)return;` (a que vem antes de `const seq=++sequence.current;`) por `  if(!ready||!workspace.path)return;`.
7. Apagar as funções `const backup=()=>{...};` e `const restore=async(file?:File)=>{...};` inteiras (não são usadas por nenhum botão).
8. Antes de `const TABS = [`, inserir `const semObra=ready&&!workspace.path;` e, como primeiro item de `TABS`, inserir `  { id: 'obras', label: 'Obras', icon: Building2 },`.
9. No botão do menu, trocar `disabled={!ready || importing}` por `disabled={!ready || importing || (semObra && t.id !== 'obras')}`.
10. Substituir o bloco do rodapé da barra lateral (`<div className="p-4 border-t border-slate-800 text-xs">` … `</div>`) por:

```tsx
    <button className="p-4 border-t border-slate-800 text-xs text-left w-full hover:bg-slate-800 disabled:hover:bg-transparent" disabled={!ready} onClick={() => { setTab('obras'); setMobileMenuOpen(false); }} title="Ver obras">
      {semObra ? <p className="text-white font-semibold">Nenhuma obra aberta</p> : obraAtiva && <p className="text-white font-semibold truncate" title={obraAtiva.nome}>{obraAtiva.nome}</p>}
      <p className="text-slate-500 truncate" title={workspace.path || ''}>{workspace.path || (ready ? '' : 'Carregando…')}</p>
      <p className="text-emerald-500 mt-1">{semObra ? 'Escolha ou crie uma obra' : importing ? 'Lendo fotos...' : status}</p>
    </button>
```

11a. Na barra superior, trocar `<p className="font-semibold">{TABS.find(t => t.id === tab)?.label}</p>` por `<p className="font-semibold">{semObra ? 'Nenhuma obra aberta' : TABS.find(t => t.id === tab)?.label}</p>`.
11. No botão "Pacote Consolidado (XLSX)", trocar `disabled={!ready || importing}` por `disabled={!ready || importing || semObra}`.
12. Apagar o botão `<button disabled={importing} className={button} onClick={()=>{setObrasDialog(true);setError('');}}>...Obras</button>`.
13. Trocar `{error&&!obrasDialog&&<p role="alert"` por `{error&&<p role="alert"`.
14. Trocar `{ready&&<>` (início do conteúdo das abas) por:

```tsx
     {semObra&&<BoasVindas workspace={workspace} flush={flush} importing={importing}/>}
     {ready&&!semObra&&<>
      {tab==='obras'&&<ObrasPage workspace={workspace} flush={flush} importing={importing}/>}
```

15. Apagar a linha `{obrasDialog&&<ObrasModal onClose={()=>setObrasDialog(false)} workspace={workspace} flush={flush} importing={importing}/>}`.

- [ ] **Step 5: Ajustar `ReliabilityPanel.tsx`**

Trocar a função `reload` por:

```tsx
 async function reload(){const [b,d]=await Promise.all([workspace.path?read('/api/backups'):Promise.resolve(null),read('/api/diagnostics')]);setData(b);setSettings({daily:7,weekly:4,secondary:'',max:0,...(b?.settings||{})});setDiag(d);}
```

Envolver tudo o que vem depois de `</section>}` do diagnóstico (da `<section className="border rounded-lg p-3 space-y-3">` do backup automático até o fim da lista de cópias, `</div>)}</div>`) em `{workspace.path?<>` … `</>:<p className="text-sm bg-slate-50 border rounded-lg p-3">Nenhuma obra aberta. Os backups ficam disponíveis depois de abrir ou criar uma obra.</p>}`.

Trocar `<h3 className="font-bold">Cópias disponíveis</h3>` por:

```tsx
   <h3 className="font-bold">Restaurar esta obra para um backup anterior</h3>
   <p className="text-sm text-slate-600">Substitui o conteúdo da obra aberta pelo da cópia escolhida. Um backup do estado atual é criado antes. Para trazer um backup como obra nova, use <strong>Obras → Importar backup</strong>.</p>
```

- [ ] **Step 6: Remover a janela antiga**

Run: `rm src/components/ObrasModal.tsx && grep -rn "ObrasModal" src || echo "sem referências"`
Expected: `sem referências`.

- [ ] **Step 7: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: build sem erros; nenhuma linha `FALHOU`.

---

### Task 7: Versão, documentação, distribuição e conferência manual

**Files:**
- Modify: `codigo-fonte/version.ts`, `desktop-launcher.cjs` (raiz), `codigo-fonte/package.json`
- Create: `RDO-V1.10.0-ALTERAÇÕES.md` (raiz)
- Modify: `LEIA-ME.txt` (raiz) — seção sobre obras
- Modify: `dist/` (raiz) — sincronizado com `codigo-fonte/dist`

**Interfaces:**
- Consumes: todas as tarefas anteriores.

- [ ] **Step 1: Atualizar a versão**

- `codigo-fonte/version.ts`: `export const VERSION='1.10.0-obras';`
- `desktop-launcher.cjs`: `console.log('DER/PR OFFLINE - VERSAO 1.10.0 - FOTOGRAFICO, RDO, OBRAS E PLUVIOMETRIA');` e `const EXPECTED_VERSION = '1.10.0-obras';`
- `codigo-fonte/package.json`: `"version": "1.10.0",`

- [ ] **Step 2: Documentar**

Criar `RDO-V1.10.0-ALTERAÇÕES.md` no formato de `RDO-V1.9.8-ALTERAÇÕES.md`, com as seções Alterações (tela Obras, pasta das obras, painéis, remover com apagar arquivos, nenhuma obra aberta, Backup e Info renomeado, "Iniciar repositório vazio" removido), Uso (como zerar o sistema: Obras → Remover na obra em uso → marcar "Apagar também os arquivos" → digitar o nome → Nova obra), Arquivos alterados e Verificação (lista de testes, incluindo `test-sem-obra.mjs` e `test-remover-obra.mjs`).

No `LEIA-ME.txt`, substituir a seção "ESTRUTURA DE PASTAS DAS OBRAS" por um texto que explique a pasta das obras (`<pasta>\Obras\<nome>`), as ações da tela Obras e que remover só apaga arquivos quando a opção for marcada (e apenas os arquivos do app).

- [ ] **Step 3: Reconstruir e sincronizar a distribuição**

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
 && grep -c "1.10.0-obras" dist/server.cjs
```

Expected: nenhuma linha `FALHOU`, `dist sincronizado` e contagem `1`.

- [ ] **Step 4: Conferência manual no Windows (com o usuário)**

Fechar o app e o terminal, abrir pelo `INICIAR.cmd` e conferir:
1. Menu lateral mostra **Obras** primeiro; a obra atual aparece com "EM USO".
2. Definir a pasta das obras; **Nova obra** só com nome mostra "Será criada em" e abre a obra nova.
3. **Duplicar** uma obra fechada, **Mover** uma obra fechada, **Renomear**.
4. **Importar backup** com o arquivo baixado em Remover; nome sugerido não contém `/`.
5. **Remover** a obra em uso marcando "Apagar também os arquivos": baixa o backup, pede o nome, mostra itens preservados e cai na tela "Nenhuma obra aberta" com as abas bloqueadas.
6. A partir da tela inicial, criar uma obra e confirmar que as abas voltam.
7. Backup e Info sem obra mostra só o diagnóstico; com obra mostra "Restaurar esta obra para um backup anterior".
