import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {definirProfissionais,emptyRdo,newRdoDay,rdoServices,rdoPhotos,repairRdoFolderIds,rdoSignature,syncRdo,rdoIssues,validRdo} from './src/services/rdo.ts';
import {generateRdoPdf} from './rdoPdf.ts';
const state=emptyRdo(),date='2026-09-12';const day={...newRdoDay(date,[]),weather:'BOM',professionals:137,sufficient:'SIM',present:'SIM',contractorNotes:'Equipe administrativa em atividade.'};
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const photo=(id,servico,timestamp=1)=>({id,servico,timestamp,data:'12/09/2026',includedInReport:true,imageUrl:pixel});
const photos=[photo('late','segunda atividade',3),photo('early','  concretagem  da VIGA  ',1),photo('same','CONCRETAGEM DA VIGA',2),{...photo('excluded','não incluir'),includedInReport:false},{...photo('other','outro dia'),data:'13/09/2026'}];
assert.deepEqual(rdoServices(photos,date),[{text:'CONCRETAGEM DA VIGA',photoIds:['early','same']},{text:'SEGUNDA ATIVIDADE',photoIds:['late']}]);
const manual=photos.map(p=>p.id==='late'?{...p,manualOrder:0}:p.id==='early'?{...p,manualOrder:1}:p.id==='same'?{...p,manualOrder:2}:p);
assert.deepEqual(rdoPhotos(manual,date).map(p=>p.id),['late','early','same'],'RDO segue a ordem manual');
assert.deepEqual(rdoServices(manual,date),[{text:'SEGUNDA ATIVIDADE',photoIds:['late']},{text:'CONCRETAGEM DA VIGA',photoIds:['early','same']}],'serviços do RDO na ordem manual');
const stale={settings:state.settings,days:[{...day,folderId:'folder-set-2026'}]};
const novaPasta=[{id:'nova',name:'SETEMBRO_2026'}];
const fotosNova=photos.map(p=>({...p,folderId:'nova'}));
assert.equal(repairRdoFolderIds(stale,fotosNova,novaPasta).days[0].folderId,'nova','dia revinculado à pasta atual quando a antiga foi removida');
assert.equal(rdoPhotos(fotosNova,stale.days[0].date,repairRdoFolderIds(stale,fotosNova,novaPasta).days[0].folderId).length,3,'RDO volta a enxergar as fotos depois da reparação');
assert.equal(repairRdoFolderIds(stale,fotosNova,[]).days[0].folderId,'folder-set-2026','sem lista de pastas não altera nada');
const duas=photos.map((p,i)=>({...p,folderId:i<2?'a':'b'}));
assert.equal(repairRdoFolderIds(stale,duas,novaPasta).days[0].folderId,undefined,'data com fotos em duas pastas fica sem vínculo');
assert.equal(repairRdoFolderIds({settings:state.settings,days:[{...day,folderId:'nova'}]},fotosNova,novaPasta).days[0].folderId,'nova','pasta existente é mantida');
assert.throws(()=>newRdoDay(date,[day]),/Já existe/);assert.equal(newRdoDay('2026-09-13',[day]).number,2);assert.throws(()=>newRdoDay('2026-02-31',[]),/inválida/);
const final={...day,status:'final',finalSignature:rdoSignature(day,state.settings,photos)};const withFinal={...state,days:[final]};assert.equal(syncRdo(withFinal,photos),withFinal);
assert.equal(syncRdo(withFinal,photos.map(p=>p.id==='early'?{...p,servico:'alterado'}:p)).days[0].status,'draft');
assert.equal(syncRdo(withFinal,photos.map(p=>p.id==='early'?{...p,data:'13/09/2026'}:p)).days[0].status,'draft');
assert.equal(syncRdo(withFinal,photos.filter(p=>p.id!=='early')).days[0].status,'draft');
assert.equal(syncRdo({...withFinal,settings:{...state.settings,manager:'Outro gerente'}},photos).days[0].status,'draft');
assert.equal(syncRdo(withFinal,photos.map(p=>({...p,tags:['Teste']}))),withFinal);
assert.ok(rdoIssues({...day,contractorNotes:''},state.settings,[]).some(s=>s.includes('motivo')));assert.equal(rdoIssues(day,state.settings,[]).length,0);
assert.ok(validRdo(withFinal));assert.equal(validRdo({...withFinal,days:[day,day]}),false);
for(const [count,expected] of [[0,1],[1,1],[19,1],[20,2],[68,2],[69,3]]){const p=Array.from({length:count},(_,i)=>photo(String(i),'SERVIÇO TESTE '+i,i));const r=generateRdoPdf(day,state.settings,p);assert.equal(r.pageCount,expected);assert.equal(r.serviceCount,count);assert.equal(r.bytes.subarray(0,4).toString(),'%PDF');}
const qa=process.env.RDO_QA_DIR;if(qa)fs.mkdirSync(qa,{recursive:true});
const long=generateRdoPdf({...day,contractorNotes:Array.from({length:63},(_,i)=>'OBSERVAÇÃO '+i).join('\n')},state.settings,[photo('long','DESCRIÇÃO COM ACENTUAÇÃO: EXECUÇÃO, PROTEÇÃO E CONTENÇÃO. '.repeat(70)+'FIM DO SERVIÇO.')]);assert.ok(long.pageCount>=4);if(qa)fs.writeFileSync(path.join(qa,'rdo-longo.pdf'),long.bytes);
if(qa){fs.writeFileSync(path.join(qa,'rdo-sem-fotos.pdf'),generateRdoPdf({...day,professionals:0,weather:'CHUVOSO',present:'NÃO',contractorNotes:'SEM ATIVIDADE DE CAMPO EM RAZÃO DE CHUVA. DIA SEM FOTOS.'},state.settings,[]).bytes);fs.writeFileSync(path.join(qa,'rdo-final.pdf'),generateRdoPdf(final,state.settings,photos).bytes);}
assert.throws(()=>generateRdoPdf(day,{...state.settings,company:'A'.repeat(150)},photos),/não cabe/);
// 1.14.0: o numero do RDO acompanha o efetivo marcado
const dpBase={...emptyRdo(),days:[
 {...newRdoDay('2026-10-01',[]),professionals:null,status:'draft'},
 {...newRdoDay('2026-10-02',[]),professionals:9,status:'final'}]};
const dpA=definirProfissionais(dpBase,'2026-10-01',7);
assert.equal(dpA.days[0].professionals,7,'dia em rascunho recebe o total marcado');
assert.equal(dpBase.days[0].professionals,null,'o estado anterior nao e alterado');
assert.equal(definirProfissionais(dpBase,'2026-10-02',5),dpBase,'RDO finalizado nao e alterado');
assert.equal(definirProfissionais(dpBase,'2026-10-09',4),dpBase,'data sem RDO nao cria dia');
assert.equal(definirProfissionais(dpA,'2026-10-01',7),dpA,'mesmo numero nao gera novo estado');
console.log('test-rdo: numero do RDO segue o efetivo ok');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'der-rdo-')),base='http://127.0.0.1:3153';let proc,w,revision;
fs.writeFileSync(path.join(dir,'pasta-trabalho.json'),JSON.stringify({path:dir}));
async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3153',DER_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){w=await (await fetch(base+'/api/workspace')).json();revision=w.contentRevision;return;}}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Falha ao abrir servidor');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
const headers=()=>({'Content-Type':'application/json','X-Workspace-Revision':w.revision,'X-Project-Revision':revision});
async function save(project){const r=await fetch(base+'/api/project',{method:'PUT',headers:headers(),body:JSON.stringify(project)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));revision=d.contentRevision;}
await start();try{
 let project={version:1,config:{rdo:withFinal},photos,drafts:[]};await save(project);
 let r=await fetch(base+'/api/rdo/pdf?date='+date,{headers:headers()});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/pdf/);assert.ok((await r.arrayBuffer()).byteLength>10000);
 const bk=await (await fetch(base+'/api/backups',{method:'POST',headers:headers(),body:'{}'})).json();assert.ok(bk.id);
 project.photos=photos.map(p=>p.id==='early'?{...p,servico:'Descrição corrigida'}:p);await save(project);
 let loaded=await (await fetch(base+'/api/project')).json();assert.equal(loaded.config.rdo.days[0].status,'draft');assert.equal(loaded.config.rdo.days[0].contractorNotes,day.contractorNotes);
 await stop();await start();loaded=await (await fetch(base+'/api/project')).json();assert.equal(loaded.config.rdo.days[0].status,'draft');assert.equal(loaded.config.rdo.settings.manager,state.settings.manager);
 r=await fetch(base+'/api/project/restore',{method:'POST',headers:headers(),body:JSON.stringify({id:bk.id})});const result=await r.json();assert.equal(r.status,200);revision=result.contentRevision;loaded=await (await fetch(base+'/api/project')).json();assert.equal(loaded.config.rdo.days[0].status,'final');assert.deepEqual(loaded.photos,photos);
 r=await fetch(base+'/api/rdo/pdf?date='+date,{headers:{...headers(),'X-Project-Revision':'stale'}});assert.equal(r.status,409);
 console.log('PASS: ordem e deduplicação; datas/numeração; vínculo automático e reabertura; validação sem fotos; PDF 0/1/19/20/68/69 serviços e texto longo; dados persistidos após reinício; geração via servidor; RDO e fotos restaurados pelo backup; conflito rejeitado.');
}finally{await stop();fs.rmSync(dir,{recursive:true});}
