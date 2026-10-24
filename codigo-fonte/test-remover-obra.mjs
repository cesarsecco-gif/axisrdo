import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'der-remover-'));const port='3164',base='http://127.0.0.1:'+port;let proc;
async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:port,DER_DATA_DIR:home},stdio:'ignore'});for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Start failed');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
async function request(url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
const rev=async()=>(await request('/api/workspace')).data.revision;
await start();
try{
 const raiz=path.join(home,'raiz');
 assert.equal((await request('/api/obras/raiz','PUT',{raiz})).status,200);
 const criar=async(nome,open=false)=>{const x=await request('/api/obras','POST',{nome,mode:'new',open});assert.equal(x.status,201,x.data&&x.data.error);return x.data.obra;};
 const a=await criar('Obra A',true);
 const b=await criar('Obra B');
 const c=await criar('Obra Ç Acentuada');
 const d=await criar('Obra D');

 let x=await request(`/api/obras/${b.id}`,'DELETE',{revision:await rev()});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,false);
 assert.ok(fs.existsSync(path.join(b.path,'projeto.json')),'sem apagar, os arquivos ficam');
 assert.ok(!(await request('/api/obras')).data.items.some(o=>o.id===b.id),'sai da lista');

 x=await request(`/api/obras/${c.id}`,'DELETE',{revision:'velha',apagarArquivos:true,confirmacao:'Obra Ç Acentuada'});
 assert.equal(x.status,409,'tela desatualizada é recusada');
 assert.ok(fs.existsSync(path.join(c.path,'projeto.json')),'revisão velha não apaga nada');

 x=await request(`/api/obras/${c.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra C'});
 assert.equal(x.status,400);assert.match(x.data.error,/nome da obra/);
 assert.ok(fs.existsSync(path.join(c.path,'projeto.json')),'confirmação errada não apaga nada');

 fs.mkdirSync(path.join(c.path,'fotos','PASTA'),{recursive:true});fs.writeFileSync(path.join(c.path,'fotos','PASTA','f.png'),'x');
 fs.mkdirSync(path.join(c.path,'backups'));fs.writeFileSync(path.join(c.path,'backups','backup-1.json'),'{}');
 fs.writeFileSync(path.join(c.path,'projeto.json.bak'),'{}');fs.writeFileSync(path.join(c.path,'backup-config.json'),'{}');
 fs.writeFileSync(path.join(c.path,'planilha-do-usuario.xlsx'),'x');
 fs.mkdirSync(path.join(c.path,'Imagens da Câmera'));fs.writeFileSync(path.join(c.path,'Imagens da Câmera','foto.jpg'),'x');
 x=await request(`/api/obras/${c.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'  obra ç   ACENTUADA '});
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.deepEqual([...x.data.apagados].sort(),['backup-config.json','backups','fotos','projeto.json','projeto.json.bak'].sort());
 assert.deepEqual([...x.data.preservados].sort(),['Imagens da Câmera','planilha-do-usuario.xlsx'].sort());
 assert.equal(x.data.pastaRemovida,false);
 assert.ok(fs.existsSync(path.join(c.path,'Imagens da Câmera','foto.jpg')),'arquivos alheios preservados');
 assert.equal(fs.existsSync(path.join(c.path,'projeto.json')),false);

 x=await request(`/api/obras/${d.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra D'});
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.equal(x.data.pastaRemovida,true);assert.equal(fs.existsSync(d.path),false);
 assert.ok(fs.existsSync(path.join(raiz,'Obras')),'a pasta Obras não é apagada');

 const f=await criar('Obra F');
 const alvoExterno=path.join(home,'externo');fs.mkdirSync(alvoExterno);fs.writeFileSync(path.join(alvoExterno,'nao-apagar.txt'),'x');
 fs.mkdirSync(path.join(f.path,'fotos'));fs.symlinkSync(alvoExterno,path.join(f.path,'fotos','atalho'),'junction');
 x=await request(`/api/obras/${f.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra F'});
 assert.equal(x.status,500,'atalho dentro de fotos impede a remoção');
 assert.ok(fs.existsSync(path.join(f.path,'projeto.json')),'nada é apagado quando a conferência prévia falha');
 assert.ok(fs.existsSync(path.join(alvoExterno,'nao-apagar.txt')),'destino do atalho intacto');
 assert.ok((await request('/api/obras')).data.items.some(o=>o.id===f.id),'obra continua na lista');

 const e=await criar('Obra E');fs.rmSync(e.path,{recursive:true,force:true});
 x=await request(`/api/obras/${e.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra E'});
 assert.equal(x.status,200,x.data&&x.data.error);assert.deepEqual(x.data.apagados,[]);
 assert.ok(!(await request('/api/obras')).data.items.some(o=>o.id===e.id),'pasta indisponível também sai da lista');

 x=await request(`/api/obras/${a.id}`,'DELETE',{revision:await rev()});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,true);
 let w=(await request('/api/workspace')).data;assert.equal(w.path,null,'remover a obra aberta deixa sem obra');
 assert.equal((await request('/api/project','PUT',{version:1,config:{},photos:[],drafts:[]},{'X-Workspace-Revision':w.revision,'X-Project-Revision':'empty'})).status,409);
 assert.ok(fs.existsSync(path.join(a.path,'projeto.json')),'obra aberta removida sem apagar mantém os arquivos');
 assert.equal((await request('/api/obras')).data.activeId,null);

 await stop();await start();
 assert.equal((await request('/api/workspace')).data.path,null,'após reiniciar, continua sem obra aberta');

 x=await request('/api/obras','POST',{nome:'Obra A',mode:'open',path:a.path,open:true});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal((await request('/api/workspace')).data.path,a.path,'obra removida sem apagar pode ser aberta de novo');
 x=await request(`/api/obras/${x.data.obra.id}`,'DELETE',{revision:await rev(),apagarArquivos:true,confirmacao:'Obra A'});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.semObra,true);assert.equal(fs.existsSync(a.path),false);
}finally{await stop();fs.rmSync(home,{recursive:true,force:true});}
console.log('test-remover-obra: ok');
