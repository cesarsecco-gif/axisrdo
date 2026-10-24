import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {VERSION} from './reliability.ts';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'der-etapa-a-'));const base='http://127.0.0.1:3151';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const original={version:1,config:{contrato:'Teste'},photos:[],drafts:[]};fs.writeFileSync(path.join(dir,'projeto.json'),JSON.stringify(original));
let proc;async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3151',DER_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Start failed');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
let w,rev;async function request(url,method='GET',body,overrides={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json','X-Workspace-Revision':w?.revision||'','X-Project-Revision':rev||'',...overrides},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
await start();
try{
 w=(await request('/api/workspace')).data;rev=w.contentRevision;
 const draft={...original,drafts:[{id:'draft-1',previewUrl:pixel,fileName:'foto.png',servico:'Descrição em andamento'}]};
 let x=await request('/api/project','PUT',draft);assert.equal(x.status,200);const stale=rev;rev=x.data.contentRevision;
 assert.equal((await request('/api/project','PUT',original,{'X-Project-Revision':stale})).status,409);
 assert.equal((await request('/api/project')).data.drafts[0].servico,'Descrição em andamento');
 await stop();await start();w=(await request('/api/workspace')).data;rev=w.contentRevision;
 assert.equal((await request('/api/project')).data.drafts[0].previewUrl,pixel);
 x=await request('/api/backups','POST',{});assert.equal(x.status,200);const id=x.data.id;
 const list=(await request('/api/backups')).data;assert.ok(list.items.some(b=>b.id===id&&b.valid&&b.drafts===1));
 const saved={...original,photos:[{id:'draft-1',imageUrl:pixel,timestamp:1}]};
 x=await request('/api/project','PUT',saved);assert.equal(x.status,200);rev=x.data.contentRevision;
 x=await request('/api/project/restore','POST',{id});assert.equal(x.status,200);rev=x.data.contentRevision;
 assert.equal((await request('/api/project')).data.drafts.length,1);
 assert.ok((await request('/api/backups')).data.items.some(b=>b.reason==='antes-de-restaurar'));
 const raw=fs.readFileSync(path.join(dir,'backups',id),'utf8');const bad=JSON.parse(raw);bad.project.config.contrato='Tampered';fs.writeFileSync(path.join(dir,'backups',id),JSON.stringify(bad));
 assert.equal((await request('/api/project/restore','POST',{id})).status,400);
 assert.equal((await request('/api/project')).data.config.contrato,'Teste');
 fs.writeFileSync(path.join(dir,'backups',id),raw);
 const secondary=path.join(dir,'secondary');assert.equal((await request('/api/backups/settings','PUT',{daily:7,weekly:4,secondary})).status,200);
 x=await request('/api/backups','POST',{});assert.ok(fs.existsSync(path.join(secondary,x.data.id)));
 const diag=(await request('/api/diagnostics')).data;assert.equal(diag.version,VERSION);assert.equal(diag.photos,undefined);assert.ok(diag.freeBytes>0);
 assert.equal((await request('/api/backups/settings','PUT',{daily:-1,weekly:4,secondary:''})).status,400);
 x=await request('/api/project','PUT',original);assert.equal(x.status,200);rev=x.data.contentRevision;
 assert.ok((await request('/api/backups')).data.items.some(b=>b.reason==='antes-de-remover'));
 fs.mkdirSync(path.join(dir,'projeto.json.tmp'));
 const beforeFailure=fs.readFileSync(path.join(dir,'projeto.json'),'utf8');
 assert.equal((await request('/api/project','PUT',saved)).status,500);
 assert.equal(fs.readFileSync(path.join(dir,'projeto.json'),'utf8'),beforeFailure);
 fs.rmdirSync(path.join(dir,'projeto.json.tmp'));
 fs.writeFileSync(path.join(dir,'projeto.json'),'invalid JSON test');
 w=(await request('/api/workspace')).data;rev=w.contentRevision;
 assert.equal((await request('/api/project')).status,500);
 assert.equal((await request('/api/project/restore','POST',{id})).status,200);
 assert.equal((await request('/api/project')).data.drafts.length,1);
 assert.ok(fs.readdirSync(path.join(dir,'backups')).some(n=>n.startsWith('projeto-danificado-')));
 console.log('PASS: drafts and image bytes survive restart; stale writes rejected; verified backups; protected restore; tampering rejected; secondary destination; retention validation; diagnostic without photographs; backup before deletion; failed write preserves project; corrupt project restored with damaged bytes preserved.');
}finally{await stop();}
