import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
// Saves reuse the verification of photo copies already on disk; a copy changed
// outside the app must still be detected on the next save.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'der-gravacao-'));const port='3161',base='http://127.0.0.1:'+port;
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
fs.writeFileSync(path.join(dir,'projeto.json'),JSON.stringify({version:1,config:{contrato:'T'},photos:[],drafts:[]}));
const proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:port,DER_DATA_DIR:dir},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const w=await (await fetch(base+'/api/workspace')).json();let rev=w.contentRevision;
const put=async v=>{const r=await fetch(base+'/api/project',{method:'PUT',headers:{'Content-Type':'application/json','X-Workspace-Revision':w.revision,'X-Project-Revision':rev},body:JSON.stringify(v)});const d=await r.json();if(r.ok)rev=d.contentRevision;return {status:r.status,d};};
const withContract=(v,c)=>({...v,config:{...v.config,contrato:c}});
try{
 const v={version:1,config:{contrato:'T',availableFolders:[{id:'f1',name:'PASTA'}]},photos:[{id:'p1',imageUrl:pixel,timestamp:1,data:'01/09/2026',folderId:'f1'}],drafts:[]};
 assert.equal((await put(v)).status,200);
 assert.equal((await put(withContract(v,'T2'))).status,200);
 assert.equal((await (await fetch(base+'/api/project')).json()).config.contrato,'T2');
 const file=fs.readdirSync(path.join(dir,'fotos'),{recursive:true}).map(f=>path.join(dir,'fotos',f)).find(f=>f.endsWith('.png'));
 const original=fs.readFileSync(file);const tampered=Buffer.from(original);tampered[tampered.length-1]^=0xff;fs.writeFileSync(file,tampered);
 const x=await put(withContract(v,'T3'));
 assert.equal(x.status,500);assert.match(x.d.error,/modificada fora do app/);
 assert.equal((await (await fetch(base+'/api/project')).json()).config.contrato,'T2');
 fs.writeFileSync(file,original);
 assert.equal((await put(withContract(v,'T4'))).status,200);
 // catálogo inválido gravado por outra versão não impede abrir o projeto
 const arquivo=path.join(dir,'projeto.json');
 const atual=JSON.parse(fs.readFileSync(arquivo,'utf8'));
 fs.writeFileSync(arquivo,JSON.stringify({...atual,config:{...atual.config,catalogos:{funcoes:'lixo'}}}));
 const aberto=await (await fetch(base+'/api/project')).json();
 assert.equal(aberto.config.contrato,'T4','projeto com catálogo inválido continua abrindo');
 assert.equal(aberto.config.catalogos,undefined,'o catálogo inválido é descartado');
 console.log('test-gravacao: ok');
}finally{proc.kill();await new Promise(r=>setTimeout(r,300));fs.rmSync(dir,{recursive:true,force:true});}
