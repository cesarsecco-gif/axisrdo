import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import {setupReliability,VERSION} from './reliability';
import {setupObras} from './obras';
import {mirror,relativePhotoPath} from './photoStorage';
import {validRdo,syncRdo,folderRdos,repairRdoFolderIds,rdoServices,rdoPhotos} from './src/services/rdo';
import {semearCatalogos} from './src/services/catalogos';
import {zipSync} from 'fflate';
import {generateRdoPdf,generateRdoPagePdf,generateRdoCollectionPdf} from './rdoPdf';
import {createXlsx} from './xlsxWriter';
import cookieParser from 'cookie-parser';
import { authRouter } from './src/backend/authRoutes';
import { billingRouter } from './src/backend/billingRoutes';
import { adminRouter } from './src/backend/adminRoutes';
import { initDatabase, prisma } from './src/backend/prisma';
import { getUserFromRequest, AuthRequest, AuthUser } from './src/backend/auth';

const app = express();
app.use((_req,res,next)=>{res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; font-src 'self' data:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'self' blob:; base-uri 'self'");next();});
const PORT = Number(process.env.PORT || 3000);
const home = process.env.AXIS_DATA_DIR || process.env.DER_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'AXIS-RDO');
fs.mkdirSync(home, {recursive:true});
type TenantSession={tenantId:string;userId:string;home:string;workspace:string|null;revision:string};
const tenantSessions=new AsyncLocalStorage<TenantSession>();
const revisions=new Map<string,string>();
const commercialMode=process.env.ALLOW_NETWORK==='true';
const session=()=>tenantSessions.getStore();
const dataHome=()=>session()?.home||home;
const activeWorkspace=()=>{const ctx=session();return ctx?ctx.workspace:workspace;};
const activeRevision=()=>session()?.revision||revision;
function activateWorkspace(next:string|null){
 const ctx=session();
 if(ctx){ctx.workspace=next;ctx.revision=crypto.randomUUID();revisions.set(`${ctx.tenantId}:${next||'empty'}`,ctx.revision);return;}
 atom(preference,{path:next});workspace=next;revision=crypto.randomUUID();
}
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
  const current=activeWorkspace();
  if(!current)throw Object.assign(new Error('Nenhuma obra aberta. Crie ou abra uma obra.'),{status:409,code:'NO_WORKSPACE'});
  return current;
}
const statePath = () => path.join(requireWorkspace(),'projeto.json');
const CATALOGOS_IDS=['equipes','funcoes','equipamentos','placas','rodovias','trechos','estacas','lados','categorias','servicos','acoes'];
function validCatalogos(v:any){
 if(v===undefined)return true;
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return Object.entries(v).every(([k,itens]:any)=>CATALOGOS_IDS.includes(k)&&Array.isArray(itens)&&itens.length<=5000
  &&itens.every((t:any)=>typeof t==='string'&&t.trim().length>0&&t.length<=500));
}
// A catalog written by another version is dropped instead of blocking the project: it is rebuilt from the records.
function descartarCatalogosInvalidos(v:any){
 if(v&&v.config&&v.config.catalogos!==undefined&&!validCatalogos(v.config.catalogos))delete v.config.catalogos;
}
function valid(v:any) {
  return v && v.version===1 && v.config && typeof v.config==='object' && !Array.isArray(v.config) && Array.isArray(v.photos) &&
    validRdo(v.config.rdo) &&
    v.photos.every((p:any)=>p && typeof p.id==='string' && typeof p.imageUrl==='string' && Number.isFinite(p.timestamp) && (p.manualOrder===undefined||(Number.isInteger(p.manualOrder)&&p.manualOrder>=0&&p.manualOrder<10000000)) && (p.tags===undefined||(Array.isArray(p.tags)&&p.tags.length<=32&&p.tags.every((t:any)=>typeof t==='string'&&t.trim().length>0&&t.length<=64)))) &&
    (v.config.tagCatalog===undefined||(Array.isArray(v.config.tagCatalog)&&v.config.tagCatalog.every((t:any)=>typeof t==='string'&&t.trim().length>0&&t.length<=64))) &&
    validCatalogos(v.config.catalogos) &&
    (v.drafts===undefined || (Array.isArray(v.drafts)&&v.drafts.every((d:any)=>d&&typeof d.id==='string'&&typeof d.previewUrl==='string'&&d.previewUrl.startsWith('data:image/')&&typeof d.servico==='string')));
}
// Callers only read the returned project; it is reused while the file is unchanged.
let projectCache:{file:string;stamp:string;value:any}|null=null;
function fileStamp(f:string){const s=fs.statSync(f);return `${s.mtimeMs}|${s.size}|${s.ino}`;}
function readProject(dir?:string) {
  const d=dir??requireWorkspace();
  const ctx=session();
  if(commercialMode&&ctx){
    const root=path.resolve(ctx.home)+path.sep;
    if(!path.resolve(d).startsWith(root))throw Object.assign(new Error('A obra não pertence à organização autenticada.'),{status:403});
  }
  const f=path.join(d,'projeto.json');
  if (!fs.existsSync(d)) throw new Error('Pasta de trabalho indisponível. Reconecte o disco ou escolha outra pasta.');
  if (!fs.existsSync(f)) return null;
  const file=path.resolve(f),stamp=fileStamp(f);
  if(projectCache&&projectCache.file===file&&projectCache.stamp===stamp)return projectCache.value;
  const v=JSON.parse(fs.readFileSync(f,'utf8'));
  descartarCatalogosInvalidos(v);
  if (!valid(v)) throw new Error('Projeto inválido. Preserve os arquivos e restaure um backup.');
  projectCache={file,stamp,value:v};
  return v;
}
function rdoOf(project:any){const state=project?.config?.rdo;if(!state)return state;return repairRdoFolderIds(state,project.photos||[],project.config?.availableFolders);}
function atom(file:string, value:any) {
  const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),'utf8');
  if(fs.existsSync(file)) fs.copyFileSync(file,file+'.bak');
  fs.renameSync(tmp,file);
}
// Local image organization is implemented in photoStorage.ts.
app.use('/api',(req,res,next)=>{
  if (process.env.ALLOW_NETWORK !== 'true') {
    if(![`127.0.0.1:${PORT}`,`localhost:${PORT}`].includes(req.headers.host||''))return res.sendStatus(403);
    if(req.headers.origin && ![`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`].includes(req.headers.origin))return res.sendStatus(403);
  }
  if(!['GET','HEAD','DELETE'].includes(req.method) && !req.is('application/json'))return res.sendStatus(415);
  res.setHeader('Cache-Control','no-store');next();
});
app.use(express.json({limit:'500mb'}));
app.use(cookieParser());
app.use('/api',async (req,res,next)=>{
 if(!commercialMode)return next();
 const publicPaths=['/health','/auth/login','/auth/register','/auth/logout','/billing/plans'];
 if(publicPaths.includes(req.path))return next();
 const tokenUser=getUserFromRequest(req);
 if(!tokenUser)return res.status(401).json({error:'Acesso não autorizado. Faça login para continuar.'});
 try{
  const dbUser=await prisma.user.findUnique({where:{id:tokenUser.id},include:{tenant:true}});
  if(!dbUser||!dbUser.ativo||!dbUser.tenant.ativo||dbUser.tenantId!==tokenUser.tenantId)
    return res.status(403).json({error:'Esta conta ou organização está inativa. Contate o suporte.'});
  const user:AuthUser={id:dbUser.id,tenantId:dbUser.tenantId,email:dbUser.email,nome:dbUser.nome,role:dbUser.role as AuthUser['role'],isSuperAdmin:dbUser.isSuperAdmin||dbUser.role==='SUPERADMIN',tenantNome:dbUser.tenant.nome,plano:dbUser.tenant.plano};
  (req as AuthRequest).user=user;
  if(user.role==='LEITOR'&&!['GET','HEAD','OPTIONS'].includes(req.method))return res.status(403).json({error:'Seu perfil tem acesso somente para leitura.'});
  const managementPath=req.path.startsWith('/backups')||req.path==='/project/restore'||/^\/obras\/[^/]+\/(backup|duplicate|move)$/.test(req.path)||(/^\/obras\/[^/]+$/.test(req.path)&&req.method==='PUT');
  if(user.role==='CAMPO'&&managementPath)return res.status(403).json({error:'Esta operação requer o perfil de Gestor ou Administrador da conta.'});
  if(user.role==='CAMPO'&&req.path.endsWith('/backup'))return res.status(403).json({error:'A exportação do backup completo requer o perfil de Gestor ou Administrador.'});
  const tenantHome=path.join(home,'tenants',crypto.createHash('sha256').update(dbUser.tenantId).digest('hex'));
  fs.mkdirSync(tenantHome,{recursive:true});
  let selected:string|null=null;
  try{
   const registry=JSON.parse(fs.readFileSync(path.join(tenantHome,'obras.json'),'utf8'));
   const item=Array.isArray(registry.items)?registry.items.find((o:any)=>o.id===registry.activeId):null;
   if(item&&typeof item.path==='string'){
    const resolved=path.resolve(item.path),root=path.resolve(tenantHome)+path.sep;
    if(resolved.startsWith(root)&&fs.existsSync(path.join(resolved,'projeto.json')))selected=resolved;
   }
  }catch{}
  const revisionKey=`${dbUser.tenantId}:${selected||'empty'}`;
  if(!revisions.has(revisionKey))revisions.set(revisionKey,crypto.randomUUID());
  tenantSessions.run({tenantId:dbUser.tenantId,userId:dbUser.id,home:tenantHome,workspace:selected,revision:revisions.get(revisionKey)!},next);
 }catch(error){
  console.error('[Auth] Falha ao validar sessão:',error);
  res.status(500).json({error:'Não foi possível validar a sessão.'});
 }
});
app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);
app.use('/api/admin', adminRouter);
let obras:{noteProject:(v:any)=>void;noteWorkspace:(v?:any)=>void}={noteProject:()=>{},noteWorkspace:()=>{}};
const reliability=setupReliability(app,{workspace:activeWorkspace,revision:activeRevision,commercial:()=>commercialMode,read:readProject,valid,atom,mirror,afterWrite:(v:any)=>obras.noteProject(v)});
obras=setupObras(app,{home:dataHome,commercial:()=>commercialMode,workspace:activeWorkspace,revision:activeRevision,activate:activateWorkspace,readProject,validProject:valid,mirror,atom,report:(e:any,action:string)=>reliability.error(e,action),catalogosDe:(d:any)=>semearCatalogos(d).config.catalogos||{}});
app.get('/api/health',(_req,res)=>res.json({status:'ok',app:'axis-rdo',offline:!commercialMode,commercial:commercialMode,selfSignup:!commercialMode,version:VERSION}));
app.get('/api/workspace',(_req,res)=>res.json({path:activeWorkspace(),revision:activeRevision(),contentRevision:reliability.hash()}));
app.get('/api/project',(_req,res)=>{try{const data=readProject();res.json(data?{...data,contentRevision:reliability.hash()}:null);}catch(e:any){res.status(e.status||500).json({error:reliability.error(e,'abrir-projeto')});}});
app.put('/api/project',(req,res)=>{
  if(!valid(req.body))return res.status(400).json({error:'Projeto inválido.'});
  if(req.body.config.rdo)req.body.config.rdo=syncRdo(repairRdoFolderIds(req.body.config.rdo,req.body.photos,req.body.config.availableFolders),req.body.photos,req.body.config.pluviometria?.dias||[]);
  try{reliability.guard(req);const dir=requireWorkspace();if(!fs.existsSync(dir))throw new Error('Pasta indisponível.');reliability.beforeWrite(req.body);const finish=mirror(dir,req.body,readProject());atom(statePath(),req.body);const warning=finish();obras.noteProject(req.body);res.json({success:true,warning,contentRevision:reliability.hash(),savedAt:new Date().toISOString()});}
  catch(e:any){res.status(e.status||500).json({error:reliability.error(e,'salvar-projeto')});}
});
let picking=false;
app.post('/api/photos/delete-copies',(req,res)=>{
  try{
   reliability.guard(req);
   const ids=req.body&&req.body.ids;
   if(!Array.isArray(ids)||!ids.length||ids.length>20000||ids.some((i:any)=>typeof i!=='string'||!i))throw Object.assign(new Error('Informe as fotos cujas cópias devem ser apagadas.'),{status:400});
   const project=readProject();if(!project)throw Object.assign(new Error('Projeto indisponível.'),{status:400});
   const byId=new Map(project.photos.map((p:any)=>[p.id,p]));
   const root=path.resolve(requireWorkspace(),'fotos');
   let removed=0,missing=0;const failed:string[]=[];
   for(const id of ids){
    const p=byId.get(id);const rel=p?relativePhotoPath(project,p):null;
    if(!p||!rel){missing++;continue;}
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)){failed.push(id);continue;}
    try{
     if(!fs.existsSync(file)){missing++;continue;}
     if(fs.lstatSync(file).isSymbolicLink())throw new Error('atalho não é permitido');
     fs.unlinkSync(file);removed++;
     let parent=path.dirname(file);
     while(parent!==root&&fs.existsSync(parent)&&fs.readdirSync(parent).length===0){fs.rmdirSync(parent);parent=path.dirname(parent);}
    }catch(e:any){failed.push(id+' ('+(e.message||'erro')+')');}
   }
   res.json({removed,missing,failed});
  }catch(e:any){res.status(e.status||400).json({error:reliability.error(e,'apagar-copias-de-fotos')});}
});
app.get('/api/rdo/batch',(req,res)=>{try{
 reliability.guard(req);const project=readProject(),state=rdoOf(project),folderId=req.query.folderId;
 if(typeof folderId!=='string'||!project?.config.availableFolders?.some((f:any)=>f.id===folderId))throw new Error('Selecione uma pasta válida.');
 const days=state?folderRdos(state,project.photos,folderId):[];if(!days.length)throw new Error('Não há RDOs nesta pasta. Gere os rascunhos primeiro.');
 if(days.length>366)throw new Error('Use um lote de até 366 RDOs.');
 const files:Record<string,Uint8Array>={};let bytes=0;
 for(const day of days){const pdf=generateRdoPdf(day,state.settings,project.photos,undefined,project.config?.headerBannerBase64);bytes+=pdf.bytes.length;if(bytes>120*1024*1024)throw new Error('Lote acima de 120 MB. Baixe os PDFs individualmente.');files[`RDO-${String(day.number).padStart(4,'0')}-${day.date}${day.status==='final'?'':'-RASCUNHO'}.pdf`]=pdf.bytes;}
 res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="RDOs-da-pasta.zip"');res.send(Buffer.from(zipSync(files,{level:1})));
 }catch(e:any){res.status(e.status||400).json({error:reliability.error(e,'gerar-rdo-lote')});}});
function rangeDays(state:any,from?:string,to?:string){
 const days=Array.isArray(state?.days)?state.days:[ ];
 return days.filter((d:any)=>(!from||d.date>=from)&&(!to||d.date<=to)).sort((a:any,b:any)=>a.date.localeCompare(b.date));
}
function exportRows(days:any[],project:any,pageFilter?:{date:string,page:number}){
 const rows:any[]=[];const serviceRows:any[]=[];const photoRows:any[]=[];
 for(const d of days){
  if(pageFilter&&d.date!==pageFilter.date)continue;
  const services=rdoServices(project.photos,d.date,d.folderId);
  const pageInfo=pageFilter?{page:pageFilter.page}:{};
  rows.push([d.number,d.date,d.status==='final'?'Finalizado':'Rascunho',d.weather,d.professionals,d.sufficient,d.present,d.contractorNotes,services.map(s=>s.text).join(' | '),pageInfo.page??'']);
  services.forEach((s,i)=>s.photoIds.forEach(id=>{const p=project.photos.find((x:any)=>x.id===id);if(p)serviceRows.push([d.number,d.date,i+1,s.text,id]);}));
  rdoPhotos(project.photos,d.date,d.folderId).forEach((p:any,i:number)=>photoRows.push([d.number,d.date,i+1,p.servico||'',p.id,p.timestamp]));
 }
 return {rows,serviceRows,photoRows};
}
app.get('/api/rdo/pages',(req,res)=>{try{
 reliability.guard(req);const project=readProject(),state=rdoOf(project);
 if(!state)return res.json({days:[]});
 const from=typeof req.query.from==='string'?req.query.from:undefined,to=typeof req.query.to==='string'?req.query.to:undefined;
 const days=rangeDays(state,from,to);const result=days.map((d:any)=>{const r=generateRdoPdf(d,state.settings,project.photos,undefined,project.config?.headerBannerBase64);return {date:d.date,number:d.number,status:d.status,pageCount:r.pageCount};});
 res.json({days:result});
 }catch(e:any){res.status(e.status||400).json({error:reliability.error(e,'consultar-paginas-rdo')});}});
app.get('/api/rdo/export',(req,res)=>{try{
 reliability.guard(req);const project=readProject(),state=rdoOf(project);if(!state)throw new Error('Nenhum RDO cadastrado.');
 const format=String(req.query.format||'pdf'),scope=String(req.query.scope||'period');const from=typeof req.query.from==='string'?req.query.from:undefined,to=typeof req.query.to==='string'?req.query.to:undefined;
 let days=rangeDays(state,from,to);let pageDate=typeof req.query.pageDate==='string'?req.query.pageDate:'';const page=Number(req.query.page||0);
 if(scope==='month'&&from){const m=from.slice(0,7);days=rangeDays(state,m+'-01',m+'-31');}
 if(scope==='page'){const d=days.find((x:any)=>x.date===pageDate);if(!d||!Number.isInteger(page)||page<1)throw new Error('Selecione uma página válida.');
  if(format==='pdf'){const r=generateRdoPagePdf(d,state.settings,project.photos,page,undefined,project.config?.headerBannerBase64);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="RDO-${d.number}-${d.date}-PAGINA-${page}.pdf"`);return res.send(r.bytes);}
  days=[d];
 }
 if(!days.length)throw new Error('Não há RDOs para a seleção.');
 if(format==='pdf'){const r=generateRdoCollectionPdf(days,state.settings,project.photos,undefined,project.config?.headerBannerBase64);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="RDOs-SELECAO.pdf"');return res.send(r.bytes);}
 if(format==='xlsx'){const data=exportRows(days,project,scope==='page'?{date:pageDate,page}:undefined);const x=createXlsx([{name:'RDO',headers:['Nº RDO','Data','Status','Clima','Profissionais','Equipe suficiente','Preposto presente','Observações da contratada','Serviços do dia','Página selecionada'],rows:data.rows},{name:'Serviços',headers:['Nº RDO','Data','Nº serviço','Descrição','ID foto'],rows:data.serviceRows},{name:'Fotos',headers:['Nº RDO','Data','Nº foto','Descrição','ID foto','Timestamp'],rows:data.photoRows}]);res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition','attachment; filename="RDOs-SELECAO.xlsx"');return res.send(Buffer.from(x));}
 throw new Error('Formato de exportação inválido.');
 }catch(e:any){res.status(e.status||400).json({error:reliability.error(e,'exportar-rdo')});}});
app.get('/api/rdo/pdf',(req,res)=>{try{
 reliability.guard(req);const project=readProject(),state=rdoOf(project);
 const day=state?.days.find((d:any)=>d.date===req.query.date);if(!day)return res.status(404).json({error:'Crie e salve o RDO desta data antes de gerar o PDF.'});
 const result=generateRdoPdf(day,state.settings,project.photos,undefined,project.config?.headerBannerBase64);
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`inline; filename="RDO-${day.number}-${day.date}.pdf"`);res.setHeader('X-RDO-Pages',String(result.pageCount));res.send(result.bytes);
 }catch(e:any){res.status(e.status||400).json({error:reliability.error(e,'gerar-rdo-pdf')});}});
app.post('/api/workspace/pick',(_req,res)=>{
  if(commercialMode)return res.status(403).json({error:'Na versão comercial, as obras ficam armazenadas no ambiente seguro da organização.'});
  if(process.platform!=='win32')return res.status(501).json({error:'Digite o caminho completo da pasta abaixo.'});
  if(picking)return res.status(409).json({error:'Já existe uma janela de escolha de pasta aberta.'});
  picking=true;
  const script="[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Escolha a pasta de trabalho do AXIS RDO'; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($d.SelectedPath) }; $d.Dispose()";
  execFile('powershell.exe',['-NoProfile','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:false,timeout:180000,encoding:'utf8'},(err,stdout)=>{
    picking=false;
    if(err)return res.status(500).json({error:'Não foi possível abrir o seletor. Digite o caminho completo da pasta.'});
    res.json({path:stdout.replace(/^\uFEFF/,'').trim(),cancelled:!stdout.trim()});
  });
});
app.post('/api/workspace/switch',(req,res)=>{
  if(commercialMode)return res.status(403).json({error:'Na versão comercial, não é possível abrir pastas do servidor.'});
  if(req.body.revision!==activeRevision())return res.status(409).json({error:'A pasta mudou. Reabra o aplicativo.'});
  const target=req.body.path;
  if(typeof target!=='string'||!path.isAbsolute(target)||!['copy','open'].includes(req.body.mode))return res.status(400).json({error:'Informe um caminho completo e escolha copiar ou abrir.'});
  try{
    const next=path.resolve(target);
    if(activeWorkspace()&&next===path.resolve(activeWorkspace()!))return res.json({path:activeWorkspace(),revision:activeRevision()});
    let activeProject:any=null;
    if(req.body.mode==='copy'){
      if(fs.existsSync(path.join(next,'projeto.json')))return res.status(409).json({error:'Esta pasta já possui um projeto. Use Abrir projeto existente ou escolha outra pasta.'});
      const current=readProject();if(!current)throw new Error('Salve o projeto atual antes de copiar.');
      fs.mkdirSync(next,{recursive:true});mirror(next,current);
      fs.writeFileSync(path.join(next,'projeto.json'),JSON.stringify(current),{flag:'wx'});
      activeProject=current;
    }else{
      const opened=readProject(next);
      if(!opened)throw new Error('A pasta escolhida não contém projeto.json.');
      activeProject=opened;
    }
    fs.accessSync(next,fs.constants.W_OK);
    activateWorkspace(next);
    obras.noteWorkspace(activeProject);
    res.json({path:activeWorkspace(),revision:activeRevision()});
  }catch(e:any){res.status(400).json({error:e.message});}
});
app.use('/api',(_req,res)=>res.status(404).json({error:'Recurso indisponível na versão offline.'}));
async function start(){
  await initDatabase();
  if(process.env.NODE_ENV!=='production'){
  const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
 }else{
  const dist=path.join(process.cwd(),'dist');app.use(express.static(dist));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
 }
  if (process.env.ALLOW_NETWORK === 'true') {
    app.listen(PORT,'0.0.0.0',()=>console.log(`AXIS RDO - Axis Consultoria e Planejamento disponível na rede na porta ${PORT}. Pasta: ${workspace??'nenhuma obra aberta'}`));
  } else {
    app.listen(PORT,'127.0.0.1',()=>console.log(`AXIS RDO - Axis Consultoria e Planejamento na porta ${PORT}. Pasta: ${workspace??'nenhuma obra aberta'}`));
  }
}
start();
