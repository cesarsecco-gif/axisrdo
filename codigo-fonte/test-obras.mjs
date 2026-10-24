import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'der-obras-'));const base='http://127.0.0.1:3157';
fs.writeFileSync(path.join(home,'projeto.json'),JSON.stringify({version:1,config:{},photos:[],drafts:[]}));
let proc;
async function start(){proc=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',PORT:'3157',DER_DATA_DIR:home},stdio:'pipe'});for(let i=0;i<60;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Start failed');}
async function stop(){await new Promise(r=>{proc.once('exit',r);proc.kill();});}
async function request(url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
async function workspace(){return (await request('/api/workspace')).data;}
async function headers(){const w=await workspace();return {'X-Workspace-Revision':w.revision,'X-Project-Revision':w.contentRevision};}
await start();
try{
 let x=await request('/api/obras');
 assert.equal(x.status,200);
 assert.equal(x.data.items.length,1);
 const ativa=x.data.items.find(o=>o.id===x.data.activeId);
 assert.ok(ativa,'há uma obra ativa registrada no início');
 assert.equal(ativa.path,home);
 assert.equal(ativa.available,true);
 assert.equal(ativa.hasProject,true);

 x=await request('/api/project','PUT',{version:1,config:{contrato:'Obra Alfa',rodoviaPadrao:'PR-999',trechoPadrao:'Trecho A',empresaExecutora:'Empresa Alfa'},photos:[],drafts:[]},await headers());
 assert.equal(x.status,200);
 x=await request('/api/obras');
 const alfa=x.data.items.find(o=>o.id===x.data.activeId);
 assert.equal(alfa.ficha.contrato,'Obra Alfa');
 assert.equal(alfa.ficha.rodovia,'PR-999');
 assert.equal(alfa.ficha.empresa,'Empresa Alfa');
 assert.equal(alfa.hasProject,true);

 const betaDir=path.join(home,'obra-beta');const gamaDir=path.join(home,'obra-gama');
 x=await request('/api/obras','POST',{nome:'Obra Beta',path:betaDir,mode:'new',open:false});
 assert.equal(x.status,201);
 const betaPath=path.join(betaDir,'Obras','Obra Beta');
 assert.ok(fs.existsSync(path.join(betaPath,'projeto.json')),'cria Obras\\<nome>\\projeto.json dentro da base escolhida');
 assert.equal(x.data.obra.path,betaPath,'obra nova fica na estrutura Obras\\<nome>');
 const beta=x.data.obra;
 assert.equal(beta.photos,0);

 x=await request(`/api/obras/${alfa.id}/duplicate`,'POST',{revision:(await workspace()).revision,nome:'Obra Gama',path:gamaDir});
 assert.equal(x.status,201,x.data&&x.data.error);
 const gamaPath=path.join(gamaDir,'Obras','Obra Gama');
 assert.ok(fs.existsSync(path.join(gamaPath,'projeto.json')));
 assert.equal(x.data.obra.ficha.contrato,'Obra Alfa','cópia herda a ficha da obra atual');
 const gama=x.data.obra;
 assert.equal(gama.path,gamaPath);

 x=await request('/api/obras');
 assert.equal(x.data.items.length,3);
 assert.equal(x.data.items.filter(o=>o.active).length,1);
 assert.equal(x.data.activeId,alfa.id);

 x=await request(`/api/obras/${beta.id}/open`,'POST',{revision:(await workspace()).revision});
 assert.equal(x.status,200);
 assert.equal(x.data.path,betaPath);
 let w=await workspace();assert.equal(w.path,betaPath);
 x=await request('/api/project');
 assert.equal(x.data.photos.length,0,'obra nova não herda fotos da obra anterior');
 assert.equal(x.data.config.contrato,'','obra nova começa com ficha vazia');
 x=await request('/api/obras');
 assert.equal(x.data.activeId,beta.id);

 x=await request(`/api/obras/${alfa.id}/open`,'POST',{revision:(await workspace()).revision});
 assert.equal(x.status,200);
 w=await workspace();assert.equal(w.path,home);
 x=await request('/api/project');
 assert.equal(x.data.config.contrato,'Obra Alfa','volta sem misturar ficha');
 assert.equal(x.data.photos.length,0);

 const sumiu=path.join(home,'obra-sumiu');
 x=await request('/api/obras','POST',{nome:'Obra Temporária',path:sumiu,mode:'new',open:false});
 assert.equal(x.status,201);
 const temp=x.data.obra;
 fs.rmSync(sumiu,{recursive:true,force:true});
 x=await request('/api/obras');
 const row=x.data.items.find(o=>o.id===temp.id);
 assert.equal(row.available,false,'pasta removida é sinalizada como indisponível');
 assert.equal(row.hasProject,false);
 x=await request(`/api/obras/${temp.id}/open`,'POST',{revision:(await workspace()).revision});
 assert.equal(x.status,400);
 assert.match(x.data.error,/indisponível/i);
 assert.equal(fs.existsSync(sumiu),false,'nenhum projeto vazio é criado no lugar da pasta ausente');

 x=await request(`/api/obras/${temp.id}`,'DELETE',{revision:(await workspace()).revision});
 assert.equal(x.status,200);
 x=await request('/api/obras');
 assert.ok(!x.data.items.some(o=>o.id===temp.id),'removida da lista');
 assert.equal(fs.existsSync(betaDir),true,'remover do histórico não apaga arquivos');

 x=await request('/api/obras','POST',{nome:'Obra Beta',path:betaDir,mode:'open',open:false});
 assert.equal(x.status,409,'abrir pela base resolve Obras\\<nome> e não duplica a obra');
 x=await request('/api/obras','POST',{nome:'  ',path:betaDir,mode:'new',open:false});
 assert.equal(x.status,400);
 x=await request('/api/obras','POST',{nome:'Sem pasta',path:'relativa\\obra',mode:'new',open:false});
 assert.equal(x.status,400);
 x=await request('/api/obras','POST',{nome:'',path:betaDir,mode:'novo',open:false});
 assert.equal(x.status,400);
 x=await request('/api/obras','POST',{nome:'Obra/Invalida',path:home,mode:'new',open:false});
 assert.equal(x.status,400,'nome com caractere inválido para pasta é recusado');
 x=await request('/api/obras','POST',{nome:'CON',path:home,mode:'new',open:false});
 assert.equal(x.status,400,'nome reservado do Windows é recusado');

 x=await request(`/api/obras/${gama.id}`,'PUT',{nome:'Gama - Rebatizada'});
 assert.equal(x.status,200);
 assert.equal(x.data.obra.nome,'Gama - Rebatizada');

 const copia=path.join(home,'obra-legacy');
 x=await request('/api/workspace/switch','POST',{path:copia,mode:'copy',revision:(await workspace()).revision});
 assert.equal(x.status,200);
 x=await request('/api/obras');
 const leg=x.data.items.find(o=>o.path===copia);
 assert.ok(leg,'troca legada de pasta também registra a obra');
 assert.equal(leg.id,x.data.activeId);
 assert.equal(leg.ficha.contrato,'Obra Alfa');

 // troca de local da obra ativa (mover conteúdo) — destino vira <base>\Obras\<nome>
 const destino1=path.join(home,'obra-novo-local');
 const final1=path.join(destino1,'Obras',leg.nome);
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:destino1,mode:'move'});
 assert.equal(x.status,200,x.data&&x.data.error);
 w=await workspace();assert.equal(w.path,final1,'workspace passa a ser Obras\\<nome> da nova base');
 assert.ok(fs.existsSync(path.join(final1,'projeto.json')),'projeto copiado para a estrutura Obras\\<nome>');
 assert.equal(fs.existsSync(path.join(copia,'projeto.json')),false,'conteúdo antigo removido da origem');
 assert.equal(fs.existsSync(copia),false,'pasta origem vazia é removida');
 x=await request('/api/project');
 assert.equal(x.data.config.contrato,'Obra Alfa','conteúdo preservado após mover');
 x=await request('/api/obras');
 const movida=x.data.items.find(o=>o.id===leg.id);
 assert.equal(movida.path,final1,'registro da obra atualizado');
 assert.equal(movida.hasProject,true);

 // validações da troca de local
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:destino1,mode:'move'});
 assert.equal(x.status,409,'mesma pasta é recusada');
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:path.join(final1,'interna'),mode:'move'});
 assert.equal(x.status,400,'pasta dentro da atual é recusada');
 const dup=path.join(home,'obra-dup');fs.mkdirSync(path.join(dup,'Obras',leg.nome),{recursive:true});fs.writeFileSync(path.join(dup,'Obras',leg.nome,'projeto.json'),'{}');
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:dup,mode:'move'});
 assert.equal(x.status,409,'destino com projeto.json é recusado');
 const cheia=path.join(home,'obra-cheia');fs.mkdirSync(path.join(cheia,'Obras',leg.nome),{recursive:true});fs.writeFileSync(path.join(cheia,'Obras',leg.nome,'avulso.txt'),'x');
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:cheia,mode:'move'});
 assert.equal(x.status,409,'destino não vazio é recusado');
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:'revisao-errada',path:path.join(home,'obra-x'),mode:'move'});
 assert.equal(x.status,409,'revisão desatualizada é recusada');
 const betaNovaBase=path.join(home,'beta-novo');const betaFinal=path.join(betaNovaBase,'Obras','Obra Beta');
 const ativaAntes=(await workspace()).path;
 x=await request(`/api/obras/${beta.id}/move`,'POST',{revision:(await workspace()).revision,path:betaNovaBase});
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.equal(x.data.ativa,false);
 assert.equal((await workspace()).path,ativaAntes,'mover obra fechada não troca a obra aberta');
 assert.ok(fs.existsSync(path.join(betaFinal,'projeto.json')),'obra fechada movida');
 assert.equal(fs.existsSync(path.join(betaPath,'projeto.json')),false,'conteúdo antigo removido');
 assert.equal((await request('/api/obras')).data.items.find(o=>o.id===beta.id).path,betaFinal);
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:path.join(home,'obra-w'),mode:'fresh'});
 assert.equal(x.status,400,'modo repositório vazio foi removido');
 x=await request(`/api/obras/${leg.id}/move`,'POST',{revision:(await workspace()).revision,path:path.join(home,'obra-z'),mode:'copiar'});
 assert.equal(x.status,400,'modo desconhecido é recusado');
 assert.equal(fs.existsSync(path.join(home,'obra-x')),false,'nenhum destino é criado quando a troca falha');

 // importação de backup cria uma obra independente, registra e abre
 const importedBase=path.join(home,'restauradas');
 const backupProject={version:1,config:{contrato:'Obra Importada',rodoviaPadrao:'PR-123'},photos:[{id:'importada-1',imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',timestamp:1}],drafts:[]};
 const previousWorkspace=await workspace();
 x=await request('/api/obras/import','POST',{revision:previousWorkspace.revision,nome:'Obra Importada',path:importedBase,project:backupProject});
 assert.equal(x.status,201,x.data&&x.data.error);
 const importedPath=path.join(importedBase,'Obras','Obra Importada');
 assert.equal(x.data.obra.path,importedPath);
 assert.equal((await workspace()).path,importedPath,'obra importada passa a ser a ativa');
 assert.equal((await request('/api/project')).data.config.contrato,'Obra Importada');
 assert.equal((await request('/api/project')).data.photos.length,1);
 assert.equal(fs.existsSync(path.join(importedPath,'fotos')),true,'cópia local da foto é criada');
 assert.equal(fs.existsSync(path.join(final1,'projeto.json')),true,'obra anterior permanece no disco');

 const rejectedBase=path.join(home,'backup-invalido');
 const importedWorkspace=await workspace();
 x=await request('/api/obras/import','POST',{revision:importedWorkspace.revision,nome:'Backup Corrompido',path:rejectedBase,project:backupProject,backupHash:'0'.repeat(64)});
 assert.equal(x.status,400,'integridade do backup interno é verificada');
 assert.equal(fs.existsSync(path.join(rejectedBase,'Obras','Backup Corrompido')),false,'destino não é criado para backup corrompido');
 const managedBase=path.join(home,'backup-interno');
 const backupHash=crypto.createHash('sha256').update(JSON.stringify(backupProject)).digest('hex');
 x=await request('/api/obras/import','POST',{revision:importedWorkspace.revision,nome:'Obra Backup Interno',path:managedBase,project:backupProject,backupHash});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal((await request('/api/project')).data.config.contrato,'Obra Importada','backup interno válido é importado');
 x=await request('/api/obras/import','POST',{revision:(await workspace()).revision,nome:'Obra Importada',path:importedBase,project:backupProject});
 assert.equal(x.status,409,'destino registrado não é sobrescrito');

 // pasta-raiz das obras
 x=await request('/api/obras/raiz');
 assert.equal(x.status,200);assert.equal(x.data.raiz,null,'raiz começa indefinida');
 assert.equal(x.data.sugestao,managedBase,'sugere a pasta acima de Obras da obra aberta');
 x=await request('/api/obras','POST',{nome:'Sem Raiz',mode:'new',open:false});
 assert.equal(x.status,400,'sem raiz e sem local a criação é recusada');assert.match(x.data.error,/pasta das obras/);
 assert.equal((await request('/api/obras/raiz','PUT',{raiz:'relativa\\pasta'})).status,400);
 const raiz=path.join(home,'raiz-obras');
 x=await request('/api/obras/raiz','PUT',{raiz});
 assert.equal(x.status,200,x.data&&x.data.error);assert.equal(x.data.raiz,raiz);
 assert.equal((await request('/api/obras')).data.raiz,raiz);
 x=await request('/api/obras','POST',{nome:'Só Nome',mode:'new',open:false});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal(x.data.obra.path,path.join(raiz,'Obras','Só Nome'),'nova obra só com nome vai para a raiz');
 x=await request('/api/obras','POST',{nome:'Cópia',path:home,mode:'copy',open:false});
 assert.equal(x.status,400,'modo copy saiu da criação');
 // duplicar obra que não está aberta
 x=await request(`/api/obras/${gama.id}/duplicate`,'POST',{revision:(await workspace()).revision,nome:'Gama Cópia Acentuação'});
 assert.equal(x.status,201,x.data&&x.data.error);
 const gamaCopia=x.data.obra;
 assert.equal(gamaCopia.path,path.join(raiz,'Obras','Gama Cópia Acentuação'));
 assert.equal(gamaCopia.ficha.contrato,'Obra Alfa','a cópia leva o projeto da obra de origem');
 assert.ok(fs.existsSync(path.join(gamaPath,'projeto.json')),'origem intacta');
 assert.notEqual((await workspace()).path,gamaCopia.path,'duplicar não troca a obra aberta');
 const antes=fs.readFileSync(path.join(gamaCopia.path,'projeto.json'),'utf8');
 x=await request(`/api/obras/${gama.id}/duplicate`,'POST',{revision:(await workspace()).revision,nome:'Gama Cópia Acentuação'});
 assert.equal(x.status,409,'nome repetido na mesma raiz é recusado');
 assert.equal(fs.readFileSync(path.join(gamaCopia.path,'projeto.json'),'utf8'),antes,'a pasta existente não é tocada');
 x=await request(`/api/obras/${gama.id}/duplicate`,'POST',{revision:'velha',nome:'Outra'});
 assert.equal(x.status,409);
 // backup de obra não aberta, com nome acentuado, aceito pela importação
 const resp=await fetch(`${base}/api/obras/${gamaCopia.id}/backup`);
 assert.equal(resp.status,200);
 assert.match(resp.headers.get('content-disposition'),/attachment/);
 const envelope=await resp.json();
 assert.equal(envelope.kind,'der-backup');assert.equal(envelope.project.config.contrato,'Obra Alfa');
 x=await request('/api/obras/import','POST',{revision:(await workspace()).revision,nome:'Gama Restaurada',project:envelope.project,backupHash:envelope.sha256});
 assert.equal(x.status,201,x.data&&x.data.error);
 assert.equal(x.data.obra.path,path.join(raiz,'Obras','Gama Restaurada'),'importação sem local usa a raiz');
 // catalogos de outra obra
 const comCat={version:1,config:{contrato:'Com catalogo',rodoviaPadrao:'PR-900',catalogos:{funcoes:['SOLDADOR ESPECIAL']}},photos:[],drafts:[]};
 const baseCat=path.join(home,'com-catalogo');
 x=await request('/api/obras/import','POST',{revision:(await workspace()).revision,nome:'Com Catalogo',path:baseCat,project:comCat});
 assert.equal(x.status,201,x.data&&x.data.error);
 const obraCat=x.data.obra;
 x=await request(`/api/obras/${obraCat.id}/catalogos`);
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.ok(x.data.catalogos.funcoes.includes('SOLDADOR ESPECIAL'),'catalogo salvo');
 assert.ok(x.data.catalogos.rodovias.includes('PR-900'),'valores em uso entram na leitura');
 assert.equal((await request('/api/obras/inexistente/catalogos')).status,404);

 const w2=await workspace();
 const ruim={version:1,config:{contrato:'x',catalogos:{funcoes:[123]}},photos:[],drafts:[]};
 assert.equal((await request('/api/project','PUT',ruim,{'X-Workspace-Revision':w2.revision,'X-Project-Revision':w2.contentRevision})).status,400,'catalogo com valor nao textual e recusado');
 const bom={version:1,config:{contrato:'x',catalogos:{funcoes:['ARMADOR']}},photos:[],drafts:[]};
 assert.equal((await request('/api/project','PUT',bom,{'X-Workspace-Revision':w2.revision,'X-Project-Revision':w2.contentRevision})).status,200,'catalogo valido e aceito');
}finally{await stop();}
console.log('PASS: registro inicial; ficha após salvar; nova/cópia na estrutura Obras\\<nome>; abertura isolada; volta sem misturar; pasta indisponível sem criação automática; remoção do histórico; validações de nome e caminho; renomear; troca legada; mover conteúdo para Obras\\<nome>; repositório vazio na nova base; validações da troca de local; importação de backup exportado e interno com registro, abertura, preservação e validação de integridade.');
