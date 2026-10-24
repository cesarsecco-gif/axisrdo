import assert from 'node:assert/strict';import {emptyRdo,createRdoBatch,rdoServices,folderRdos} from './src/services/rdo.ts';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {unzipSync} from 'fflate';
const defaults={weather:'BOM',professionals:137,sufficient:'SIM',present:'SIM',contractorNotes:'Conferir o dia.'};
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const photo=(id,date,folderId='A',includedInReport=true)=>({id,data:date,folderId,includedInReport,servico:'SERVIÇO '+id,timestamp:1,imageUrl:pixel});
const photos=[photo('1','14/09/2026'),photo('2','12/09/2026'),photo('3','12/09/2026'),photo('b','13/09/2026','B'),photo('b2','12/09/2026','B'),photo('off','15/09/2026','A',false),photo('bad','99/99/2026')];
const first=createRdoBatch(emptyRdo(),photos,'A',defaults);assert.deepEqual(first.created,['2026-09-12','2026-09-14']);assert.deepEqual(first.state.days.map(d=>d.number),[1,2]);assert.equal(rdoServices(photos,'2026-09-12','A').length,2);assert.equal(first.state.days[0].status,'draft');
first.state.days[0].contractorNotes='CORREÇÃO MANUAL';const again=createRdoBatch(first.state,photos,'A',{...defaults,professionals:1});assert.equal(again.created.length,0);assert.equal(again.state.days[0].contractorNotes,'CORREÇÃO MANUAL');assert.equal(again.state.days[0].professionals,137);
const full=createRdoBatch(emptyRdo(),photos,'A',defaults,true);assert.equal(full.state.days.length,3);assert.equal(rdoServices(photos,'2026-09-13','A').length,0);assert.equal(folderRdos(full.state,photos,'B').length,0);
assert.throws(()=>createRdoBatch(emptyRdo(),photos,'C',defaults),/não tem/);assert.throws(()=>createRdoBatch(emptyRdo(),photos,'A',{...defaults,professionals:-1}),/valores/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'der-lote-')),base='http://127.0.0.1:3154';let proc;
fs.writeFileSync(path.join(dir,'pasta-trabalho.json'),JSON.stringify({path:dir}));
try{proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3154',DER_DATA_DIR:dir},stdio:'pipe'});let w;
for(let i=0;i<100;i++){try{w=await (await fetch(base+'/api/workspace')).json();break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(w);
const headers={'Content-Type':'application/json','X-Workspace-Revision':w.revision,'X-Project-Revision':w.contentRevision};const project={version:1,config:{rdo:full.state,availableFolders:[{id:'A',name:'SETEMBRO'},{id:'B',name:'OUTRA'}]},photos};let r=await fetch(base+'/api/project',{method:'PUT',headers,body:JSON.stringify(project)});assert.equal(r.status,200);headers['X-Project-Revision']=(await r.json()).contentRevision;
r=await fetch(base+'/api/rdo/batch?folderId=A',{headers});assert.equal(r.status,200);const zip=unzipSync(new Uint8Array(await r.arrayBuffer()));assert.equal(Object.keys(zip).length,3);for(const [name,bytes] of Object.entries(zip)){assert.match(name,/RASCUNHO\.pdf$/);assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'%PDF');}
r=await fetch(base+'/api/rdo/batch?folderId=B',{headers});assert.equal(r.status,400);const saved=await (await fetch(base+'/api/project')).json();assert.deepEqual(saved.config.rdo,full.state);
console.log('PASS: pasta/datas/marcação; lote sem duplicação; correções preservadas; intervalo com dias sem fotos; escopo dos serviços; PDF ZIP com três RDOs; persistência.');
}finally{if(proc)await new Promise(resolve=>{proc.once('exit',resolve);proc.kill();});fs.rmSync(dir,{recursive:true});}
