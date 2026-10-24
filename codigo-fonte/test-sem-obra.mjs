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
const sumida=fs.mkdtempSync(path.join(os.tmpdir(),'der-sumida-'));const pastaSumida=path.join(sumida,'obra-desconectada');
fs.writeFileSync(path.join(sumida,'pasta-trabalho.json'),JSON.stringify({path:pastaSumida}));
await start(sumida);
try{
 const w=(await request('/api/workspace')).data;
 assert.equal(w.path,pastaSumida,'a pasta aberta indisponível continua identificada');
 assert.equal((await request('/api/project')).status,500,'o projeto não pode ser lido');
 const lista=(await request('/api/obras')).data;
 const obra=lista.items.find(o=>o.id===lista.activeId);
 assert.equal(obra.available,false,'a tela Obras recebe a obra como indisponível');
 const x=await request(`/api/obras/${obra.id}`,'DELETE',{revision:w.revision});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,true,'a obra indisponível pode ser removida pela tela Obras');
 assert.equal(fs.existsSync(pastaSumida),false,'nada é criado no lugar da pasta ausente');
}finally{await stop();}
for(const d of [nova,antiga,sumida])fs.rmSync(d,{recursive:true,force:true});
console.log('test-sem-obra: ok');
