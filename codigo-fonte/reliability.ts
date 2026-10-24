import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {Express,Request} from 'express';

import {VERSION} from './version';
export {VERSION};
export function setupReliability(app:Express,ctx:any){
 let lastError:any=null;let warning='';const sessions=new Set<string>();
 const digest=(v:string)=>crypto.createHash('sha256').update(v).digest('hex');
 const current=():string=>{const w=ctx.workspace();if(!w)throw Object.assign(new Error('Nenhuma obra aberta. Crie ou abra uma obra.'),{status:409,code:'NO_WORKSPACE'});return w;};
 const projectFile=()=>path.join(current(),'projeto.json');
 let hashCache:{key:string;value:string}|null=null;
 const hash=()=>{
  if(!ctx.workspace())return 'empty';
  const f=projectFile();if(!fs.existsSync(f))return 'empty';
  const s=fs.statSync(f);const key=`${path.resolve(f)}|${s.mtimeMs}|${s.size}|${s.ino}`;
  if(hashCache?.key!==key)hashCache={key,value:digest(fs.readFileSync(f,'utf8'))};
  return hashCache.value;
 };
 const directory=()=>path.join(current(),'backups');
 const configFile=()=>path.join(current(),'backup-config.json');
 const settings=()=>{const raw=fs.existsSync(configFile())?JSON.parse(fs.readFileSync(configFile(),'utf8')):{};return {daily:7,weekly:4,secondary:'',max:0,...raw};};
 function message(e:any){return ({ENOSPC:'Sem espaço em disco. Libere espaço e tente salvar novamente.',EACCES:'Sem permissão de gravação na pasta.',EPERM:'O Windows bloqueou o arquivo ou a pasta. Feche outros programas que o estejam usando.',ENOENT:'Pasta ou arquivo indisponível. Confira o local de trabalho.'} as any)[e.code]||e.message||'Erro desconhecido.';}
 function error(e:any,action:string){lastError={at:new Date().toISOString(),action,code:e.code||'APP_ERROR',message:message(e)};return message(e);}
 function readBackup(id:string){
  if(!/^backup-[a-zA-Z0-9-]+\.json$/.test(id))throw new Error('Identificação de backup inválida.');
  const b=JSON.parse(fs.readFileSync(path.join(directory(),id),'utf8'));
  if(b.kind!=='der-backup'||!ctx.valid(b.project)||b.sha256!==digest(JSON.stringify(b.project)))throw new Error('Backup corrompido ou incompleto.');
  return b;
 }
 function inventory(){
  if(!fs.existsSync(directory()))return [];
  return fs.readdirSync(directory()).filter(n=>/^backup-.*\.json$/.test(n)).map(id=>{
   try{const b=readBackup(id);return {id,valid:true,date:b.createdAt,reason:b.reason,photos:b.project.photos.length,drafts:(b.project.drafts||[]).length,contract:b.project.config.contrato||'',bytes:fs.statSync(path.join(directory(),id)).size};}
   catch{return {id,valid:false,date:'',reason:'Integridade inválida',photos:0,drafts:0,contract:'',bytes:fs.statSync(path.join(directory(),id)).size};}
  }).sort((a,b)=>b.date.localeCompare(a.date));
 }
 function prune(){
  const cfg=settings();const rows=inventory().filter(x=>x.valid);
  const auto=rows.filter(x=>x.reason==='automatico');
  const daily=new Set<string>(),weekly=new Set<string>(),keep=new Set<string>();
  for(const r of auto){const day=r.date.slice(0,10);if(daily.size<cfg.daily&&!daily.has(day)){daily.add(day);keep.add(r.id);}}
  for(const r of auto){const week=String(Math.floor(Date.parse(r.date)/(7*86400000)));if(weekly.size<cfg.weekly&&!weekly.has(week)){weekly.add(week);keep.add(r.id);}}
  const cap=Number(cfg.max)||0;
  const overflow=new Set<string>();
  if(cap>0)rows.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(cap).forEach(r=>overflow.add(r.id));
  for(const r of rows){
   if((r.reason==='automatico'&&!keep.has(r.id))||overflow.has(r.id))fs.unlinkSync(path.join(directory(),r.id));
  }
 }
 function backup(reason='manual'){
  const project=ctx.read();if(!project)throw new Error('Ainda não há projeto salvo para copiar.');
  fs.mkdirSync(directory(),{recursive:true});
  const id=`backup-${Date.now()}-${crypto.randomUUID()}.json`;
  const envelope={kind:'der-backup',version:1,createdAt:new Date().toISOString(),reason,sha256:digest(JSON.stringify(project)),project};
  const text=JSON.stringify(envelope);const file=path.join(directory(),id);
  fs.writeFileSync(file+'.tmp',text,{flag:'wx'});fs.renameSync(file+'.tmp',file);
  readBackup(id);
  warning='';const cfg=settings();
  if(cfg.secondary){try{fs.mkdirSync(cfg.secondary,{recursive:true});const destination=path.join(cfg.secondary,id);fs.copyFileSync(file,destination,fs.constants.COPYFILE_EXCL);if(digest(fs.readFileSync(destination,'utf8'))!==digest(text))throw new Error('Verificação da cópia secundária falhou.');}catch(e:any){warning='Backup local criado; falha no segundo destino: '+message(e);}}
  try{prune();}catch(e:any){warning+=' Não foi possível aplicar a retenção: '+message(e);}
  return {id,warning};
 }
 function guard(req:Request){
  if(req.headers['x-workspace-revision']!==ctx.revision())throw Object.assign(new Error('A pasta foi alterada. Exporte um backup e reabra o aplicativo.'),{status:409});
  if(req.headers['x-project-revision']!==hash())throw Object.assign(new Error('Outro salvamento alterou este projeto. Exporte suas alterações como backup e reabra o app; o conteúdo do disco foi preservado.'),{status:409});
 }
 function beforeWrite(next:any){
  const previous=ctx.read();if(!previous)return;
  const key=ctx.workspace()+'|'+new Date().toISOString().slice(0,10);
  const removal=previous.photos.some((p:any)=>!next.photos.some((n:any)=>n.id===p.id)) || (previous.drafts||[]).some((d:any)=>!(next.drafts||[]).some((n:any)=>n.id===d.id)&&!next.photos.some((n:any)=>n.id===d.id));
  if(removal)backup('antes-de-remover');
  else if(!sessions.has(key)){backup('automatico');sessions.add(key);}
 }
 app.get('/api/backups',(_q,r)=>{try{r.json({items:inventory(),settings:settings(),warning});}catch(e:any){r.status(e.status||500).json({error:error(e,'listar-backups')});}});
 app.post('/api/backups',(q,r)=>{try{
  const MOTIVOS=['antes-de-importar-equipe','antes-de-editar-catalogo'];
  guard(q);const reason=q.body&&q.body.reason;
  if(reason!==undefined&&!MOTIVOS.includes(reason))throw Object.assign(new Error('Motivo de backup inválido.'),{status:400});
  r.json(backup(reason||'manual'));
 }catch(e:any){r.status(e.status||500).json({error:error(e,'criar-backup')});}});
 app.put('/api/backups/settings',(q,r)=>{try{
  guard(q);const {daily,weekly,secondary}=q.body;const current=settings();
  const max=q.body.max===undefined?current.max:q.body.max;
  if(!Number.isInteger(daily)||daily<1||daily>90||!Number.isInteger(weekly)||weekly<0||weekly>52||typeof secondary!=='string'||(secondary&&!path.isAbsolute(secondary))||!Number.isInteger(max)||max<0||max>1000)throw new Error('Retenção inválida ou destino sem caminho completo.');
  if(secondary&&[ctx.workspace(),directory()].some(p=>path.resolve(p).toLowerCase()===path.resolve(secondary).toLowerCase()))throw new Error('Escolha uma pasta diferente para a segunda cópia.');
  ctx.atom(configFile(),{daily,weekly,secondary,max});let applied=0;let outcome='';try{prune();applied=inventory().length;}catch(e:any){outcome='A retenção não pôde ser aplicada: '+message(e);}
  r.json({success:true,remaining:applied,warning:outcome});
 }catch(e:any){r.status(e.status||400).json({error:error(e,'configurar-backup')});}});
 app.delete('/api/backups/:id',(q,r)=>{try{
  guard(q);
  const id=String(q.params.id||'');
  if(!/^backup-[a-zA-Z0-9-]+\.json$/.test(id))throw new Error('Identificação de backup inválida.');
  const file=path.join(directory(),id);
  if(fs.existsSync(file))fs.unlinkSync(file);
  const secondary=settings().secondary;
  if(secondary){try{const dest=path.join(secondary,id);if(fs.existsSync(dest))fs.unlinkSync(dest);}catch{}}
  r.json({success:true,remaining:inventory().length});
 }catch(e:any){r.status(e.status||400).json({error:error(e,'excluir-backup')});}});
 app.post('/api/project/restore',(q,r)=>{try{
  guard(q);const next=q.body.id?readBackup(q.body.id).project:q.body.project;
  if(!ctx.valid(next))throw new Error('Projeto de backup inválido.');
  if(fs.existsSync(projectFile())){
   const raw=fs.readFileSync(projectFile(),'utf8');let old;try{old=JSON.parse(raw);}catch{}
   if(ctx.valid(old))backup('antes-de-restaurar');
   else{fs.mkdirSync(directory(),{recursive:true});fs.writeFileSync(path.join(directory(),`projeto-danificado-${Date.now()}.txt`),raw,{flag:'wx'});}
  }
   const finish=ctx.mirror(ctx.workspace(),next);ctx.atom(projectFile(),next);warning=finish();try{ctx.afterWrite?.(next);}catch{}r.json({success:true,warning,contentRevision:hash()});
 }catch(e:any){r.status(e.status||400).json({error:error(e,'restaurar-backup')});}});
 app.get('/api/diagnostics',(_q,r)=>{
  let freeBytes=null,lastSaved=null,lastBackup=null;
  if(ctx.workspace()){
   try{const s=fs.statfsSync(ctx.workspace());freeBytes=s.bavail*s.bsize;lastSaved=fs.existsSync(projectFile())?fs.statSync(projectFile()).mtime.toISOString():null;}catch(e){error(e,'diagnostico');}
   try{lastBackup=inventory().find(x=>x.valid)?.date||null;}catch{}
  }
  r.json({version:VERSION,platform:process.platform,workspace:ctx.workspace(),freeBytes,lastSaved,lastBackup,lastError,warning,offline:true});
 });
 app.post('/api/diagnostics/error',(q,r)=>{error(new Error(String(q.body.message||'Falha na interface').slice(0,500)),String(q.body.action||'interface').slice(0,60));r.json({success:true});});
 return {hash,guard,beforeWrite,error};
}
