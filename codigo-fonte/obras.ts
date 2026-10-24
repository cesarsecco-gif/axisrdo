import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type {Express, Request} from 'express';
import { getUserFromRequest } from './src/backend/auth';
import { prisma } from './src/backend/prisma';

export type ObraFicha={contrato:string;rodovia:string;trecho:string;empresa:string;fiscal:string;responsavel:string};
export type Obra={id:string;nome:string;path:string;createdAt:string;lastAccessAt:string;ficha:ObraFicha;photos:number;drafts:number;lastSaved:string;tenantId?:string};
export type ObraRow=Obra&{available:boolean;hasProject:boolean;active:boolean};
type Registry={version:1;activeId:string|null;raiz:string|null;items:Obra[]};

type Ctx={
 home:string;
 workspace:()=>string|null;
 revision:()=>string;
 activate:(next:string|null)=>void;
 readProject:(dir?:string)=>any;
 validProject:(project:any)=>boolean;
 mirror:(dir:string,v:any)=>()=>string;
 atom:(file:string,value:any)=>void;
 report:(e:any,action:string)=>string;
 catalogosDe:(d:any)=>any;
};

const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
const key=(p:string)=>{const r=path.resolve(p);return process.platform==='win32'?r.toLowerCase():r;};
const now=()=>new Date().toISOString();
const emptyFicha=():ObraFicha=>({contrato:'',rodovia:'',trecho:'',empresa:'',fiscal:'',responsavel:''});
function fichaOf(config:any):ObraFicha{
 const c=config&&typeof config==='object'?config:{};const s=c.rdo&&c.rdo.settings&&typeof c.rdo.settings==='object'?c.rdo.settings:{};
 const text=(v:any)=>typeof v==='string'?v.trim():'';
 return {contrato:text(c.contrato),rodovia:text(c.rodoviaPadrao),trecho:text(c.trechoPadrao),empresa:text(c.empresaExecutora)||text(s.company),fiscal:text(s.supervisorEngineer)||text(s.supervisor),responsavel:text(s.manager)};
}
function dirState(p:string){
 let available=false;try{available=fs.statSync(p).isDirectory();}catch{}
 return {available,hasProject:available&&fs.existsSync(path.join(p,'projeto.json'))};
}
function freshProject(){
 return {version:1,config:{contrato:'',rodoviaPadrao:'',trechoPadrao:'',empresaExecutora:'',subtitulo:'',mesAno:'',orgaoPrincipal:'',secretaria:'',departamento:'',superintendencia:'',titulo:'',availableFolders:[],activeReportFolder:'',driveFolderId:'',driveFolderUrl:'',spreadsheetId:'',spreadsheetUrl:''},photos:[],drafts:[]};
}
const RESERVED=/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
function cleanNome(v:any){
 if(typeof v!=='string'||!v.trim())throw fail(400,'Informe o nome da obra.');
 const nome=v.trim().replace(/\s+/g,' ');
 if(nome.length>80)throw fail(400,'O nome da obra pode ter no máximo 80 caracteres.');
 if(/[<>:"/\\|?*]/.test(nome)||/[\x00-\x1f]/.test(nome))throw fail(400,'O nome não pode conter caracteres inválidos para pasta ( < > : " / \\ | ? * ).');
 if(nome.endsWith('.'))throw fail(400,'O nome da obra não pode terminar com ponto.');
 if(RESERVED.test(nome))throw fail(400,'Escolha outro nome para a obra: "'+nome+'" é reservado pelo Windows.');
 return nome;
}
function cleanPath(v:any){
 if(typeof v!=='string'||!v.trim())throw fail(400,'Informe o caminho completo da pasta da obra.');
 if(!path.isAbsolute(v.trim()))throw fail(400,'Informe um caminho completo, iniciando por uma letra de unidade.');
 return path.resolve(v.trim());
}
function nestPath(base:string,nome:string){return path.join(base,'Obras',nome);}
function sugestaoRaiz(workspace:string|null){
 if(workspace){const pai=path.dirname(workspace);if(path.basename(pai).toLowerCase()==='obras')return path.dirname(pai);}
 return path.join(os.homedir(),'Documents','AXIS RDO');
}
function baseDe(reg:{raiz:string|null},informado:any){
 if(informado!==undefined&&informado!==null&&informado!=='')return cleanPath(informado);
 if(!reg.raiz)throw fail(400,'Defina a pasta das obras ou escolha outro local.');
 return reg.raiz;
}
const MANAGED=['projeto.json','fotos','backups','backup-config.json'];
// The project file goes last: if anything before it fails, the obra still opens.
export const GERENCIADOS=['fotos','backups','backup-config.json','projeto.json.tmp','projeto.json.bak','projeto.json'];
export function apagarConteudoGerenciado(pasta:string){
 const apagados:string[]=[],falhas:string[]=[];
 if(!fs.existsSync(pasta))return {apagados,preservados:[] as string[],falhas,pastaRemovida:false};
 const presentes:string[]=[];
 for(const nome of GERENCIADOS){
  const alvo=path.join(pasta,nome);
  let st:fs.Stats;try{st=fs.lstatSync(alvo);}catch{continue;}
  try{
   if(st.isSymbolicLink())throw new Error('atalho não é permitido');
   if(st.isDirectory())treeInfo(alvo);
   presentes.push(nome);
  }catch(e:any){falhas.push(nome+' ('+(e.message||'erro')+')');}
 }
 if(falhas.length)return {apagados,preservados:fs.readdirSync(pasta),falhas,pastaRemovida:false};
 for(const nome of presentes){
  try{fs.rmSync(path.join(pasta,nome),{recursive:true});apagados.push(nome);}
  catch(e:any){falhas.push(nome+' ('+(e.message||'erro')+')');break;}
 }
 const preservados=fs.readdirSync(pasta);
 let pastaRemovida=false;
 if(!preservados.length&&!falhas.length){
  try{fs.rmdirSync(pasta);pastaRemovida=true;}catch(e:any){falhas.push('pasta da obra ('+(e.message||'erro')+')');}
 }
 return {apagados,preservados,falhas,pastaRemovida};
}
const normalizarNome=(v:any)=>String(v??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
function treeInfo(p:string){
 let files=0,bytes=0;
 const walk=(dir:string)=>{
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,e.name);
   if(e.isSymbolicLink())throw new Error('atalho não é permitido: '+full);
   if(e.isDirectory())walk(full);else{files++;bytes+=fs.statSync(full).size;}
  }
 };
 if(fs.existsSync(p))walk(p);
 return {files,bytes};
}
function nested(a:string,b:string){
 const A=path.resolve(a),B=path.resolve(b);
 return process.platform==='win32'?(B.toLowerCase().startsWith(A.toLowerCase()+path.sep)||A.toLowerCase().startsWith(B.toLowerCase()+path.sep)):(B.startsWith(A+path.sep)||A.startsWith(B+path.sep));
}

export function setupObras(app:Express,ctx:Ctx){
 const file=()=>path.join(ctx.home,'obras.json');
 function load():Registry{
  try{
   const r=JSON.parse(fs.readFileSync(file(),'utf8'));
   if(r&&r.version===1&&Array.isArray(r.items)){
    const items=r.items.filter((o:any)=>o&&typeof o.id==='string'&&typeof o.path==='string'&&path.isAbsolute(o.path)&&typeof o.nome==='string'&&o.nome.trim());
    return {version:1,activeId:typeof r.activeId==='string'?r.activeId:null,raiz:typeof r.raiz==='string'&&path.isAbsolute(r.raiz)?r.raiz:null,items:items.map((o:any)=>({id:o.id,nome:o.nome.trim(),path:o.path,createdAt:o.createdAt||now(),lastAccessAt:o.lastAccessAt||o.createdAt||now(),ficha:{...emptyFicha(),...(o.ficha||{})},photos:Number.isFinite(o.photos)?o.photos:0,drafts:Number.isFinite(o.drafts)?o.drafts:0,lastSaved:o.lastSaved||'',tenantId:typeof o.tenantId==='string'?o.tenantId:undefined}))};
   }
  }catch{}
  return {version:1,activeId:null,raiz:null,items:[]};
 }
 function save(reg:Registry){
  try{reg.items.sort((a,b)=>(a.id===reg.activeId?-1:b.id===reg.activeId?1:0)||b.lastAccessAt.localeCompare(a.lastAccessAt));ctx.atom(file(),reg);}
  catch(e:any){ctx.report(e,'salvar-obras');}
 }
 function row(reg:Registry,o:Obra):ObraRow{
  const s=dirState(o.path);
  return {...o,...s,active:o.id===reg.activeId};
 }
 function registerActive(reg:Registry):Obra|null{
  const w=ctx.workspace();
  if(!w){reg.activeId=null;return null;}
  const at=reg.items.find(i=>key(i.path)===key(w));
  if(at){reg.activeId=at.id;at.lastAccessAt=now();return at;}
  const o={id:crypto.randomUUID(),nome:path.basename(w)||'Obra',path:w,createdAt:now(),lastAccessAt:now(),ficha:emptyFicha(),photos:0,drafts:0,lastSaved:''};
  reg.items.push(o);reg.activeId=o.id;return o;
 }
 let reg=load();registerActive(reg);save(reg);

 function noteProject(project:any){
  try{
   if(!project||!Array.isArray(project.photos))return;
   const r=load();const o=r.items.find(i=>i.id===r.activeId);if(!o)return;
   o.ficha=fichaOf(project.config);o.photos=project.photos.length;o.drafts=Array.isArray(project.drafts)?project.drafts.length:0;o.lastSaved=now();
   save(r);
  }catch(e:any){ctx.report(e,'atualizar-obra');}
 }
 function noteWorkspace(project?:any){
  try{
   const r=load();const o=registerActive(r);
   if(o&&project&&typeof project==='object'&&Array.isArray(project.photos)){
    o.ficha=fichaOf(project.config);o.photos=project.photos.length;o.drafts=Array.isArray(project.drafts)?project.drafts.length:0;o.lastSaved=now();
   }
   save(r);
  }catch(e:any){ctx.report(e,'registrar-obra-ativa');}
 }

 app.get('/api/obras',(q:Request,r)=>{
  try{
   const user=getUserFromRequest(q);
   const cur=load();if(cur.items.length===0)registerActive(cur);
   let items=cur.items;
   if(user && !user.isSuperAdmin && user.role !== 'SUPERADMIN'){
     items = cur.items.filter(o => o.tenantId === user.tenantId || (!o.tenantId && cur.items.length <= 1));
   }
   let activeId = cur.activeId;
   if (activeId && !items.some(o => o.id === activeId)) {
     activeId = items.length > 0 ? items[0].id : null;
   }
   r.json({activeId,raiz:cur.raiz,items:items.map(o=>row(cur,o))});
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

 app.post('/api/obras',async (q:Request,r)=>{
  try{
   const user=getUserFromRequest(q);
   if(user){
     if(user.role==='CAMPO'||user.role==='LEITOR'){
       throw fail(403,'Apenas Administradores ou Gestores de Obra possuem permissão para criar novas obras.');
     }
     const tenant=await prisma.tenant.findUnique({where:{id:user.tenantId}});
     if(tenant){
       const count=await prisma.obra.count({where:{tenantId:user.tenantId}});
       if(count>=tenant.limiteObras){
         throw fail(403,`Limite de obras atingido (${count}/${tenant.limiteObras}) para o seu ${tenant.plano==='INDIVIDUAL'?'Plano Individual':'plano'}. Faça upgrade para o Plano Corporativo para gerenciar obras ilimitadas.`);
       }
     }
   }
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
   const obra:Obra={id:crypto.randomUUID(),nome,path:destino,createdAt:now(),lastAccessAt:now(),ficha:fichaOf(project.config),photos:project.photos.length,drafts:Array.isArray(project.drafts)?project.drafts.length:0,lastSaved:now(),tenantId:user?.tenantId};
   cur.items.push(obra);
   if(user){
     try{
       await prisma.obra.upsert({
         where:{id:obra.id},
         create:{
           id:obra.id,
           tenantId:user.tenantId,
           nome:obra.nome,
           contrato:obra.ficha.contrato||'',
           rodoviaPadrao:obra.ficha.rodovia||'',
           trechoPadrao:obra.ficha.trecho||'',
           empresaExecutora:obra.ficha.empresa||'',
         },
         update:{
           nome:obra.nome,
           contrato:obra.ficha.contrato||'',
           rodoviaPadrao:obra.ficha.rodovia||'',
           trechoPadrao:obra.ficha.trecho||'',
           empresaExecutora:obra.ficha.empresa||'',
         }
       });
     }catch(dbErr){
       console.warn('[DB Obra Sync Warning]',dbErr);
     }
   }
   const open=Boolean(q.body&&q.body.open);
   if(open){ctx.activate(destino);cur.activeId=obra.id;}
   save(cur);
   r.status(201).json({obra:row(cur,obra),path:open?ctx.workspace():undefined,revision:open?ctx.revision():undefined});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'criar-obra')});}
 });

 app.post('/api/obras/import',(q:Request,r)=>{
  let destino='';
  try{
   if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
   const nome=cleanNome(q.body&&q.body.nome);
   const base=baseDe(load(),q.body&&q.body.path);
   const project=q.body&&q.body.project;
   if(!ctx.validProject(project))throw fail(400,'Arquivo de backup inválido ou incompatível com esta versão.');
   if(q.body.backupHash!==undefined){
    const hash=q.body.backupHash;
    if(typeof hash!=='string'||!/^[a-f0-9]{64}$/i.test(hash)||crypto.createHash('sha256').update(JSON.stringify(project)).digest('hex')!==hash)throw fail(400,'O backup está corrompido ou sua integridade não confere.');
   }
   if(!Array.isArray(project.drafts))project.drafts=[];
   destino=nestPath(base,nome);
   const cur=load();
   if(cur.items.some(i=>key(i.path)===key(destino)))throw fail(409,'Esta pasta já consta na lista de obras. Escolha outra pasta base.');
   if(fs.existsSync(destino))throw fail(409,'A pasta destino já existe. Escolha outra pasta base para preservar os arquivos existentes.');
   fs.mkdirSync(destino,{recursive:true});
   try{
    const finish=ctx.mirror(destino,project);
    fs.writeFileSync(path.join(destino,'projeto.json'),JSON.stringify(project),{flag:'wx'});
    finish();
   }catch(e:any){
    fs.rmSync(destino,{recursive:true,force:true});
    throw e;
   }
   fs.accessSync(destino,fs.constants.W_OK);
   const user=getUserFromRequest(q);
   const obra:Obra={id:crypto.randomUUID(),nome,path:destino,createdAt:now(),lastAccessAt:now(),ficha:fichaOf(project.config),photos:project.photos.length,drafts:project.drafts.length,lastSaved:now(),tenantId:user?.tenantId};
   cur.items.push(obra);
   ctx.activate(destino);cur.activeId=obra.id;
   save(cur);
   r.status(201).json({obra:row(cur,obra),path:ctx.workspace(),revision:ctx.revision()});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'importar-obra-backup')});}
 });

 app.post('/api/obras/:id/duplicate',(q:Request,r)=>{
  let destino='';let criado=false;
  try{
   if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
   const user=getUserFromRequest(q);
   const nome=cleanNome(q.body&&q.body.nome);
   const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(user && !user.isSuperAdmin && user.role !== 'SUPERADMIN' && o.tenantId && o.tenantId !== user.tenantId){
     throw fail(403,'Você não tem permissão para duplicar esta obra.');
   }
   if(!dirState(o.path).hasProject)throw fail(400,'A obra de origem não tem projeto disponível para duplicar.');
   destino=nestPath(baseDe(cur,q.body&&q.body.path),nome);
   if(cur.items.some(i=>key(i.path)===key(destino)))throw fail(409,'Esta pasta já consta na lista de obras. Escolha outro nome.');
   if(fs.existsSync(destino))throw fail(409,'A pasta '+destino+' já existe. Escolha outro nome para a cópia.');
   const project=ctx.readProject(o.path);
   fs.mkdirSync(destino,{recursive:true});criado=true;
   const finish=ctx.mirror(destino,project);
   fs.writeFileSync(path.join(destino,'projeto.json'),JSON.stringify(project),{flag:'wx'});
   finish();
   const obra:Obra={id:crypto.randomUUID(),nome,path:destino,createdAt:now(),lastAccessAt:now(),ficha:fichaOf(project.config),photos:project.photos.length,drafts:Array.isArray(project.drafts)?project.drafts.length:0,lastSaved:now(),tenantId:user?.tenantId};
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
   const ascii=nomeArquivo.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-');
   r.setHeader('Content-Type','application/json; charset=utf-8');
   r.setHeader('Content-Disposition',`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`);
   r.send(JSON.stringify(envelope));
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'baixar-backup-da-obra')});}
 });

 app.get('/api/obras/:id/catalogos',(q:Request,r)=>{
  try{
   const o=load().items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(!dirState(o.path).hasProject)throw fail(400,'A obra não tem projeto disponível para ler os catálogos.');
   const project=ctx.readProject(o.path);
   r.json({catalogos:ctx.catalogosDe({config:project.config||{},photos:project.photos||[]})});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'ler-catalogos-da-obra')});}
 });

 app.post('/api/obras/:id/open',(q:Request,r)=>{
  try{
   if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
   const user=getUserFromRequest(q);
   const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(user && !user.isSuperAdmin && user.role !== 'SUPERADMIN' && o.tenantId && o.tenantId !== user.tenantId){
     throw fail(403,'Você não tem permissão para acessar esta obra.');
   }
   if(o.id===cur.activeId)return r.json({path:ctx.workspace(),revision:ctx.revision(),unchanged:true});
   const state=dirState(o.path);
   if(!state.available)throw fail(400,'A pasta desta obra está indisponível. Reconecte o disco ou remova a obra do histórico.');
   if(!state.hasProject)throw fail(400,'Esta obra não possui projeto.json. Reconecte a pasta ou remova a obra do histórico.');
   ctx.readProject(o.path);
   fs.accessSync(o.path,fs.constants.W_OK);
   ctx.activate(o.path);
   cur.activeId=o.id;o.lastAccessAt=now();
   save(cur);
   r.json({path:ctx.workspace(),revision:ctx.revision()});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'abrir-obra')});}
 });

  app.post('/api/obras/:id/move',(q:Request,r)=>{
   try{
    if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
    const mode=q.body&&q.body.mode;
    if(mode!==undefined&&mode!=='move')throw fail(400,'A obra só pode ser movida com todo o conteúdo. Para recomeçar do zero, remova a obra e crie uma nova.');
    const base=cleanPath(q.body&&q.body.path);
    const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
    if(!o)throw fail(404,'Obra não encontrada na lista.');
    const ativa=o.id===cur.activeId;
    const destino=nestPath(base,o.nome);
    const origem=o.path;
    if(key(origem)===key(destino))throw fail(409,'A nova pasta é igual à atual.');
    if(nested(origem,destino))throw fail(400,'Escolha uma pasta fora da localização atual da obra.');
    const st=dirState(destino);
    if(st.hasProject)throw fail(409,'A pasta '+destino+' já contém um projeto.json. Escolha outra pasta.');
    if(st.available&&fs.readdirSync(destino).length)throw fail(409,'A pasta '+destino+' não está vazia. Escolha uma pasta vazia ou inexistente.');
    if(!dirState(origem).hasProject)throw fail(400,'A pasta atual não contém projeto.json.');

    let warning='';
     fs.mkdirSync(destino,{recursive:true});
     try{
      const src=path.join(origem,'projeto.json');
      fs.copyFileSync(src,path.join(destino,'projeto.json'));
      if(!fs.readFileSync(src).equals(fs.readFileSync(path.join(destino,'projeto.json'))))throw new Error('a cópia do projeto não confere');
      for(const name of ['fotos','backups']){
       const from=path.join(origem,name);
       if(!fs.existsSync(from))continue;
       fs.cpSync(from,path.join(destino,name),{recursive:true});
       const a=treeInfo(from),b=treeInfo(path.join(destino,name));
       if(a.files!==b.files||a.bytes!==b.bytes)throw new Error(`a cópia de "${name}" não confere (${a.files}x${b.files} arquivos)`);
      }
      const cfg=path.join(origem,'backup-config.json');
      if(fs.existsSync(cfg))fs.copyFileSync(cfg,path.join(destino,'backup-config.json'));
     }catch(e:any){
      try{fs.rmSync(destino,{recursive:true,force:true});}catch{}
      throw fail(400,'Não foi possível copiar o conteúdo: '+(e.message||'erro'));
     }
     if(ativa){ctx.activate(destino);o.lastAccessAt=now();}
     o.path=destino;
     try{
      for(const name of MANAGED){
       const from=path.join(origem,name);
       if(fs.existsSync(from))fs.rmSync(from,{recursive:true,force:true});
      }
      try{if(fs.readdirSync(origem).length===0)fs.rmdirSync(origem);}catch{}
     }catch(e:any){
      warning='O conteúdo antigo não pôde ser removido de '+origem+': '+(e.message||'erro')+'. Apague-o manualmente para evitar duplicidade.';
     }
    save(cur);
    r.json({path:ctx.workspace(),revision:ctx.revision(),obra:row(cur,o),warning,ativa});
   }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'trocar-local-da-obra')});}
  });

  app.put('/api/obras/:id',(q:Request,r)=>{
  try{
   const nome=cleanNome(q.body&&q.body.nome);
   const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   o.nome=nome;save(cur);
   r.json({obra:row(cur,o)});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'renomear-obra')});}
 });

 app.delete('/api/obras/:id',async (q:Request,r)=>{
  try{
   const user=getUserFromRequest(q);
   if(user&&user.role!=='ADMIN'&&!user.isSuperAdmin&&user.role!=='SUPERADMIN'){
     throw fail(403,'Apenas Administradores têm permissão para excluir uma obra.');
   }
   if((q.body&&q.body.revision)!==ctx.revision())throw fail(409,'A pasta mudou. Reabra o aplicativo.');
   const cur=load();const o=cur.items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(user && !user.isSuperAdmin && user.role !== 'SUPERADMIN' && o.tenantId && o.tenantId !== user.tenantId){
     throw fail(403,'Você não tem permissão para excluir esta obra.');
   }
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
   if(user){
     await prisma.obra.deleteMany({where:{id:o.id,tenantId:user.tenantId}}).catch(()=>{});
   }
   r.json({success:true,semObra:ativa,path:o.path,...resultado});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'remover-obra'),...(e.detalhe||{})});}
 });

 return {noteProject,noteWorkspace};
}
