import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {build} from 'esbuild';
const code=await build({entryPoints:['src/services/organization.ts'],bundle:true,format:'esm',write:false});const {photoDate,photoTags,uniqueTags,serviceSuggestions,orderPhotos}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
assert.equal(photoDate('31/02/2026'),null);assert.equal(photoDate('29/02/2024').day,'29');assert.equal(photoDate('29/02/2026'),null);assert.deepEqual(photoTags({categoria:'Pavimentação'}),['Pavimentação']);assert.deepEqual(photoTags({categoria:'Pavimentação',tags:[]}),[]);assert.deepEqual(uniqueTags([' Drenagem ','drenagem','Concreto']),['Drenagem','Concreto']);
const servicos=['COLOCAÇÃO DE TELA ELETSOLDADA PARA MURO PROJETADO','Lançamento de CBUQ faixa B, Est:1002, Pista 1, marginal direita','Concretagem de sarjeta STC 10, estaca 4144 a 4149'];
assert.deepEqual(serviceSuggestions('',servicos,3),servicos,'campo vazio mostra as 3 últimas descrições');
assert.deepEqual(serviceSuggestions('colocacao',servicos,3),[servicos[0]],'busca ignora acento e maiúsculas');
assert.deepEqual(serviceSuggestions('EST',servicos,3),[servicos[1],servicos[2]],'busca por palavra também sugere');
assert.deepEqual(serviceSuggestions('sarjeta',servicos,3),[servicos[2]],'busca no meio da frase');
assert.deepEqual(serviceSuggestions('muro projetado',servicos,3),[servicos[0]],'busca por trecho do texto');
assert.deepEqual(serviceSuggestions(servicos[0],servicos,3),[],'texto igual ao atual não é repetido');
assert.deepEqual(serviceSuggestions('xyz',servicos,3),[],'sem correspondência não sugere');
const cron=[{id:'a',timestamp:3},{id:'b',timestamp:1},{id:'c',timestamp:2}];
assert.deepEqual(orderPhotos(cron).map(p=>p.id),['b','c','a'],'sem ordem manual a ordem continua cronológica');
const man=[{id:'a',timestamp:3,manualOrder:2},{id:'b',timestamp:1,manualOrder:0},{id:'c',timestamp:2,manualOrder:1}];
assert.deepEqual(orderPhotos(man).map(p=>p.id),['b','c','a'],'ordem manual prevalece sobre a data');
const mix=[{id:'a',timestamp:1,manualOrder:1},{id:'b',timestamp:2,manualOrder:0},{id:'new',timestamp:4}];
assert.deepEqual(orderPhotos(mix).map(p=>p.id),['b','a','new'],'foto nova entra após a última posição manual');
const gap=[{id:'a',timestamp:1,manualOrder:0},{id:'c',timestamp:3,manualOrder:2},{id:'b',timestamp:2}];
assert.deepEqual(orderPhotos(gap).map(p=>p.id),['a','b','c'],'lacuna de posição é preenchida em cronologia');
assert.deepEqual(orderPhotos(man.filter(p=>p.id!=='b')).map(p=>p.id),['c','a'],'subconjunto com índices fora do intervalo continua consistente');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'der-organizacao-')),base='http://127.0.0.1:3152';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
let project={version:1,config:{availableFolders:[{id:'set',name:'09_SETEMBRO_2026'}]},photos:[{id:'p1',data:'11/09/2026',imageUrl:pixel,timestamp:1,folderId:'set',categoria:'Pavimentação'},{id:'p2',data:'12/09/2026',imageUrl:pixel,timestamp:2,folderId:'set'}]};
fs.writeFileSync(path.join(dir,'projeto.json'),JSON.stringify(project));
const bytes=Buffer.from(pixel.split(',')[1],'base64'),name=crypto.createHash('sha256').update('p1').update(bytes).digest('hex')+'.png';
const legacy=path.join(dir,'fotos','09_SETEMBRO_2026_'+crypto.createHash('sha256').update('set').digest('hex').slice(0,8),name);fs.mkdirSync(path.dirname(legacy),{recursive:true});fs.writeFileSync(legacy,bytes);
let proc,w,revision;async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3152',DER_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok){w=await (await fetch(base+'/api/workspace')).json();revision=w.contentRevision;return;}}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Servidor não iniciou');}
async function stop(){await new Promise(resolve=>{proc.once('exit',resolve);proc.kill();});}
async function save(p=project){const r=await fetch(base+'/api/project',{method:'PUT',headers:{'Content-Type':'application/json','X-Workspace-Revision':w.revision,'X-Project-Revision':revision},body:JSON.stringify(p)});const data=await r.json();if(r.ok)revision=data.contentRevision;return {status:r.status,...data};}
const location=day=>path.join(dir,'fotos','09_SETEMBRO_2026',day,name);
await start();try{
 project.config.tagCatalog=['Pavimentação','Concretagem'];project.photos[0].tags=['Concretagem','Muro C7'];assert.equal((await save()).status,200);
 assert.ok(fs.readFileSync(location('11')).equals(bytes));assert.ok(!fs.existsSync(legacy));
 project.photos[0].data='13/09/2026';assert.equal((await save()).status,200);assert.ok(fs.existsSync(location('13')));assert.ok(!fs.existsSync(location('11')));assert.equal(fs.readdirSync(path.dirname(location('12'))).length,1);
 await stop();await start();let loaded=await (await fetch(base+'/api/project')).json();assert.deepEqual(loaded.photos[0].tags,['Concretagem','Muro C7']);assert.deepEqual(loaded.config.tagCatalog,['Pavimentação','Concretagem']);
 fs.mkdirSync(path.join(dir,'projeto.json.tmp'));project.photos[0].data='14/09/2026';assert.equal((await save()).status,500);assert.ok(fs.existsSync(location('13')));assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'projeto.json'))).photos[0].data,'13/09/2026');fs.rmdirSync(path.join(dir,'projeto.json.tmp'));assert.equal((await save()).status,200);assert.ok(!fs.existsSync(location('13')));
 fs.writeFileSync(location('14'),'alteracao externa');project.photos[0].data='15/09/2026';const result=await save();assert.equal(result.status,200);assert.match(result.warning,/preservada/);assert.equal(fs.readFileSync(location('14'),'utf8'),'alteracao externa');assert.ok(fs.readFileSync(location('15')).equals(bytes));
 const bad=structuredClone(project);bad.photos[0].tags=[3];assert.equal((await save(bad)).status,400);
 project.photos[0].tags=[];assert.equal((await save()).status,200);loaded=await (await fetch(base+'/api/project')).json();assert.deepEqual(loaded.photos[0].tags,[]);assert.ok(loaded.config.tagCatalog.includes('Concretagem'));
 const badOrder=structuredClone(project);badOrder.photos[0].manualOrder=-1;assert.equal((await save(badOrder)).status,400);badOrder.photos[0].manualOrder=1.5;assert.equal((await save(badOrder)).status,400);
 project.photos[0].manualOrder=0;project.photos[1].manualOrder=1;assert.equal((await save()).status,200);await stop();await start();loaded=await (await fetch(base+'/api/project')).json();assert.equal(loaded.photos[0].manualOrder,0);assert.equal(loaded.photos[1].manualOrder,1);
 const withRdo=structuredClone(project);
 withRdo.config.rdo={settings:{company:'C',contract:'CT',supervisor:'S',preposto:'P',manager:'M',supervisorEngineer:'E',inspector:'I',supervisorNotes:'',inspectorNotes:''},days:[{date:'2026-09-15',folderId:'folder-set-2026',number:1,weather:'',professionals:null,sufficient:'',present:'',contractorNotes:'',status:'draft'}]};
 assert.equal((await save(withRdo)).status,200);
 loaded=await (await fetch(base+'/api/project')).json();assert.equal(loaded.config.rdo.days[0].folderId,'set','RDO com pasta removida e revinculado à pasta das fotos');
 project=withRdo;
 console.log('PASS: tags e catálogo após reinício; compatibilidade legada; datas válidas; migração das cópias; remanejamento entre dias; outra foto preservada; falha de gravação sem remoção antecipada; arquivo externo preservado; tags inválidas rejeitadas; ordem manual unitária e persistida; índice manual inválido rejeitado; RDO com pasta removida revinculado.');
}finally{await stop();fs.rmSync(dir,{recursive:true});}
