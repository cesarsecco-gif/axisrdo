import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'der-pastas-'));const base='http://127.0.0.1:3158';
fs.writeFileSync(path.join(dir,'pasta-trabalho.json'),JSON.stringify({path:dir}));
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
let proc;
async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3158',DER_DATA_DIR:dir},stdio:'pipe'});for(let i=0;i<60;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Start failed');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
async function request(url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
async function headers(){const w=(await request('/api/workspace')).data;return {'X-Workspace-Revision':w.revision,'X-Project-Revision':w.contentRevision};}
function walk(p){const out=[];if(!fs.existsSync(p))return out;for(const e of fs.readdirSync(p,{withFileTypes:true})){const full=path.join(p,e.name);if(e.isDirectory())out.push(...walk(full));else out.push(full);}return out;}
await start();
try{
 // --- exclusão das cópias em disco de uma pasta de fotos ---
 let x=await request('/api/project','PUT',{version:1,config:{contrato:'Pastas'},photos:[{id:'foto-1',imageUrl:pixel,timestamp:1}],drafts:[]},await headers());
 assert.equal(x.status,200);
 let copias=walk(path.join(dir,'fotos'));
 assert.equal(copias.length,1,'a foto salva gera uma cópia em fotos/');

 x=await request('/api/photos/delete-copies','POST',{ids:['foto-1']},await headers());
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.equal(x.data.removed,1);
 assert.equal(copias.length&&fs.existsSync(copias[0]),false,'cópia apagada do disco');
 assert.equal(walk(path.join(dir,'fotos')).length,0,'pastas vazias são removidas');

 x=await request('/api/photos/delete-copies','POST',{ids:['foto-1']},await headers());
 assert.equal(x.status,200);
 assert.equal(x.data.removed,0);
 assert.equal(x.data.missing,1,'segunda chamada não falha quando não há arquivo');

 x=await request('/api/photos/delete-copies','POST',{ids:[]},await headers());
 assert.equal(x.status,400,'lista vazia é recusada');
 x=await request('/api/photos/delete-copies','POST',{ids:'foto-1'},await headers());
 assert.equal(x.status,400,'formato inválido é recusado');
 x=await request('/api/photos/delete-copies','POST',{ids:['inexistente']},await headers());
 assert.equal(x.status,200,'foto sem registro é contabilizada como ausente');
 x=await request('/api/photos/delete-copies','POST',{ids:['foto-1']},{'X-Project-Revision':'stale'});
 assert.equal(x.status,409,'escrita concorrente é recusada');

 // cópia permanece até o registro sair do projeto; remoção do registro gera backup
 x=await request('/api/project','PUT',{version:1,config:{contrato:'Pastas'},photos:[],drafts:[]},await headers());
 assert.equal(x.status,200);
 x=await request('/api/backups');
 assert.ok(x.data.items.some(b=>b.reason==='antes-de-remover'),'backup antes-de-remover');

 // --- backups: exclusão individual ---
 x=await request('/api/obras');
 const ativa=x.data.items.find(o=>o.id===x.data.activeId);
 assert.ok(ativa);
 const secondary=path.join(dir,'segundo-disco');
 x=await request('/api/backups/settings','PUT',{daily:7,weekly:4,secondary,max:0},await headers());
 assert.equal(x.status,200);
 x=await request('/api/backups','POST',{},await headers());
 assert.equal(x.status,200);
 const id1=x.data.id;
 assert.ok(fs.existsSync(path.join(dir,'backups',id1)),'backup local criado');
 assert.ok(fs.existsSync(path.join(secondary,id1)),'cópia no destino secundário');

 x=await request(`/api/backups/${id1}`,'DELETE',null,await headers());
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.equal(fs.existsSync(path.join(dir,'backups',id1)),false,'backup local apagado');
 assert.equal(fs.existsSync(path.join(secondary,id1)),false,'cópia secundária também apagada');
 x=await request('/api/backups');
 assert.ok(!x.data.items.some(b=>b.id===id1),'sai da lista');

 x=await request('/api/backups/backup_invalido.json','DELETE',null,await headers());
 assert.equal(x.status,400,'identificação inválida é recusada');
 x=await request('/api/backups/backup-inexistente.json','DELETE',null,await headers());
 assert.equal(x.status,200,'exclusão idempotente de backup já ausente');
 x=await request('/api/backups/%2e%2e%2fprojeto.json','DELETE',null,await headers());
 assert.equal(x.status,400,'caminho fora do diretório de backups é recusado');

 // --- backups: limite máximo ---
 x=await request('/api/backups/settings','PUT',{daily:7,weekly:4,secondary:'',max:2},await headers());
 assert.equal(x.status,200,x.data&&x.data.error);
 x=await request('/api/backups/settings','PUT',{daily:7,weekly:4,secondary:'',max:-1},await headers());
 assert.equal(x.status,400,'máximo negativo é recusado');
 x=await request('/api/backups/settings','PUT',{daily:7,weekly:4,secondary:'',max:1.5},await headers());
 assert.equal(x.status,400,'máximo fracionário é recusado');
 const antes=(await request('/api/backups')).data;
 assert.ok(antes.items.length>0);
 for(let i=0;i<5;i++){x=await request('/api/backups','POST',{},await headers());assert.equal(x.status,200);}
 const depois=(await request('/api/backups')).data;
 assert.ok(depois.items.length<=2,`limite máximo aplicado (restaram ${depois.items.length})`);
 assert.equal(depois.settings.max,2);
 const ids=new Set(depois.items.map(b=>b.id));
 const arquivos=fs.readdirSync(path.join(dir,'backups')).filter(n=>n.startsWith('backup-'));
 assert.equal(arquivos.length,depois.items.length,'arquivos no disco batem com a lista');
 assert.ok(arquivos.every(n=>ids.has(n)),'os mais antigos foram apagados');

 // limite zero = sem limite
 x=await request('/api/backups/settings','PUT',{daily:7,weekly:4,secondary:'',max:0},await headers());
 assert.equal(x.status,200);
 for(let i=0;i<3;i++){x=await request('/api/backups','POST',{},await headers());assert.equal(x.status,200);}
 assert.ok((await request('/api/backups')).data.items.length>2,'com máximo zero nada é apagado pelo limite');
 const bk=await request('/api/backups','POST',{reason:'antes-de-importar-equipe'},await headers());
 assert.equal(bk.status,200,bk.data&&bk.data.error);
 assert.ok((await request('/api/backups')).data.items.some(b=>b.id===bk.data.id&&b.reason==='antes-de-importar-equipe'),'backup antes de importar equipe');
 assert.equal((await request('/api/backups','POST',{reason:'qualquer'},await headers())).status,400,'motivo desconhecido recusado');
 const bc=await request('/api/backups','POST',{reason:'antes-de-editar-catalogo'},await headers());
 assert.equal(bc.status,200,bc.data&&bc.data.error);
 assert.ok((await request('/api/backups')).data.items.some(b=>b.id===bc.data.id&&b.reason==='antes-de-editar-catalogo'),'backup antes de editar catalogo');
}finally{await stop();}
console.log('PASS: cópias apagadas com remoção de pastas vazias; segunda chamada sem falha; entradas inválidas recusadas; conflito 409; backup antes-de-remover; exclusão individual no local e no destino secundário; identificação fora do diretório recusada; limite máximo aplicado e validado; máximo zero sem limite.');
