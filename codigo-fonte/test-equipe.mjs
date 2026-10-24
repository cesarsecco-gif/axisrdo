import assert from 'node:assert/strict';
import {migrarEquipe,funcaoNoMes,membrosDoMes,histogramaPorEquipe,definirEquipeNoMes,registrarFuncao,removerMembros,contarPresencas,normalizarTexto,chaveMatricula} from './src/services/equipe.ts';

const antigo={members:[{id:'a',equipe:'Pavimentação',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL'},{id:'b',equipe:'',nome:'SEM DIAS',funcao:'ARMADOR'}],efetivo:{'2026-04-10':{a:1},'2026-05-02':{a:1},'2026-05-03':{b:0}}};
const migrado=migrarEquipe(antigo,'2026-06');
assert.deepEqual(migrado.members[0].meses,{'2026-04':'PAVIMENTAÇÃO','2026-05':'PAVIMENTAÇÃO'},'equipe fixa vira equipe nos meses com presença');
assert.deepEqual(migrado.members[1].meses,{'2026-06':'SEM EQUIPE'},'sem presença recebe o mês atual');
assert.equal(migrarEquipe(migrado,'2026-06'),migrado,'segunda migração não muda nada');
assert.equal(migrado.efetivo,antigo.efetivo,'presenças intactas');

let m={id:'x',nome:'JOAO',funcao:'AJUDANTE GERAL',meses:{}};
m=registrarFuncao(m,'oficial armador','2026-06');
m=registrarFuncao(m,'encarregado','2026-09');
assert.equal(funcaoNoMes(m,'2026-05'),'AJUDANTE GERAL');
assert.equal(funcaoNoMes(m,'2026-06'),'OFICIAL ARMADOR');
assert.equal(funcaoNoMes(m,'2026-08'),'OFICIAL ARMADOR');
assert.equal(funcaoNoMes(m,'2026-10'),'ENCARREGADO');
assert.equal(registrarFuncao(m,' Encarregado ','2026-11'),m,'mesma função não gera histórico');
const m2=registrarFuncao(m,'MESTRE','2026-07');
assert.deepEqual(m2.historicoFuncao.map(h=>h.desde),['2026-06','2026-07'],'mudança anterior a outra reescreve o histórico a partir dela');
assert.equal(funcaoNoMes(m2,'2026-06'),'OFICIAL ARMADOR');assert.equal(funcaoNoMes(m2,'2026-12'),'MESTRE');

let cfg={members:[{id:'e',matricula:'37',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO'}},{id:'f',matricula:'41',nome:'VALDINEI',funcao:'ARMADOR',meses:{'2026-04':'DRENAGEM'}}],efetivo:{'2026-04-01':{e:1,f:1},'2026-05-04':{e:1,f:1}}};
cfg=definirEquipeNoMes(cfg,'e','2026-05','drenagem');
assert.equal(cfg.members[0].equipe,'DRENAGEM','equipe mais recente atualizada');
assert.deepEqual(membrosDoMes(cfg,'2026-05').map(x=>[x.membro.id,x.equipe,x.semEquipeNoMes]),[['e','DRENAGEM',false],['f','SEM EQUIPE',true]]);
const hist=histogramaPorEquipe(cfg,['2026-04-01','2026-05-04']);
const linha=(eq,fn)=>hist.find(l=>l.equipe===eq&&l.funcao===fn);
assert.equal(linha('PAVIMENTAÇÃO','AJUDANTE GERAL').porData['2026-04-01'],1);
assert.equal(linha('DRENAGEM','AJUDANTE GERAL').porData['2026-05-04'],1,'transferido conta na equipe do mês');
assert.equal(linha('DRENAGEM','ARMADOR').porData['2026-04-01'],1);
assert.equal(linha('SEM EQUIPE','ARMADOR').porData['2026-05-04'],1);
assert.equal(definirEquipeNoMes(cfg,'e','2026-05',null).members[0].meses['2026-05'],undefined,'retirar do mês');

assert.equal(contarPresencas(cfg,'f'),2);
const sem=removerMembros(cfg,new Set(['f']));
assert.equal(sem.members.length,1);assert.equal(contarPresencas(sem,'f'),0);assert.equal(sem.efetivo['2026-04-01'].e,1);
assert.equal(normalizarTexto('  conceição   de lima '),'CONCEIÇÃO DE LIMA');
assert.equal(chaveMatricula('00123'),'123');assert.equal(chaveMatricula('0'),'0');
console.log('test-equipe: modelo ok');

import {lerPlanilhaEquipe,gerarPlanilhaEquipe,interpretarMes,rotuloMes} from './src/services/equipePlanilha.ts';
import {zipSync,strToU8} from 'fflate';

assert.equal(rotuloMes('2026-04'),'ABR/2026');
for(const [c,esperado] of [['ABR/2026','2026-04'],['abr/26','2026-04'],['Abril/2026','2026-04'],['04/2026','2026-04'],['2026-04','2026-04'],[46113,'2026-04'],['MARÇO/2026','2026-03'],['TOTAL',null],[12,null]])
 assert.equal(interpretarMes(c),esperado,'mês: '+c);

const cad={members:[
 {id:'1',matricula:'00123',nome:'HIDICLEVIO CONCEIÇÃO DE LIMA',funcao:'AJUDANTE GERAL',ativo:true,meses:{'2026-04':'PAVIMENTAÇÃO','2026-06':'DRENAGEM'}},
 {id:'2',nome:'SEM MATRÍCULA',funcao:'APONTADOR',ativo:true,meses:{'2026-05':'ADMINISTRAÇÃO'}}],efetivo:{}};
const lida=lerPlanilhaEquipe({nome:'equipe.xlsx',bytes:gerarPlanilhaEquipe(cad,'2026-06')});
assert.deepEqual(lida.meses,['2026-04','2026-05','2026-06']);
assert.deepEqual(lida.linhas,[{linha:2,matricula:'00123',nome:'HIDICLEVIO CONCEIÇÃO DE LIMA',funcao:'AJUDANTE GERAL',ativo:true,meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'','2026-06':'DRENAGEM'}}],'ida e volta preserva acentos e zeros');
assert.deepEqual(lida.recusadas,[{linha:3,motivo:'sem matrícula'}]);

const excel=zipSync({
 'xl/workbook.xml':strToU8('<workbook xmlns:r="r"><sheets><sheet name="Equipe" sheetId="1" r:id="rId7"/></sheets></workbook>'),
 'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="rId7" Target="worksheets/planilha.xml"/></Relationships>'),
 'xl/sharedStrings.xml':strToU8('<sst><si><t>MATRÍCULA</t></si><si><t>NOME</t></si><si><t>FUNÇÃO</t></si><si><r><t xml:space="preserve">EDMAR </t></r><r><t>ALVES</t></r></si><si><t>AJUDANTE GERAL</t></si><si><t>PAVIMENTAÇÃO</t></si><si><t>DRENAGEM</t></si><si><t>abr/26</t></si></sst>'),
 'xl/worksheets/planilha.xml':strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>7</v></c><c r="E1"><v>46143</v></c><c r="F1" t="s"><v>7</v></c></row><row r="2"/><row r="3"><c r="A3"><v>37</v></c><c r="B3" t="s"><v>3</v></c><c r="C3" t="s"><v>4</v></c><c r="D3" t="s"><v>5</v></c><c r="E3" t="s"><v>6</v></c></row></sheetData></worksheet>'),
});
const doExcel=lerPlanilhaEquipe({nome:'Equipe.xlsx',bytes:excel});
assert.deepEqual(doExcel.meses,['2026-04','2026-05'],'cabeçalho virado data serial');
assert.deepEqual(doExcel.colunasIgnoradas,['abr/26'],'coluna repetida do mesmo mês é ignorada');
assert.deepEqual(doExcel.linhas,[{linha:3,matricula:'37',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'DRENAGEM'}}],'sharedStrings, número e linha vazia');
assert.deepEqual(doExcel.recusadas,[]);

const ansi=lerPlanilhaEquipe({nome:'equipe.csv',bytes:new Uint8Array(Buffer.from('MATRÍCULA;NOME;FUNÇÃO;ABR/2026\r\n5;"josé ""zé"" conceição";ARMADOR;CONTENÇÃO\r\n;;;\r\n\r\n','latin1'))});
assert.deepEqual(ansi.linhas,[{linha:2,matricula:'5',nome:'JOSÉ "ZÉ" CONCEIÇÃO',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO'}}],'CSV ANSI com aspas');
assert.deepEqual(ansi.recusadas,[],'linhas em branco não são recusadas');
const utf8=lerPlanilhaEquipe({nome:'equipe.csv',bytes:new Uint8Array(Buffer.concat([Buffer.from([0xEF,0xBB,0xBF]),Buffer.from('MATRICULA,NOME,FUNCAO,04/2026\n9,ANA,APONTADOR,ADMINISTRAÇÃO\n09,ANA B,APONTADOR,\n','utf8')]))});
assert.equal(utf8.linhas.length,0);assert.deepEqual(utf8.recusadas.map(r=>r.linha),[2,3],'matrícula repetida recusa todas as ocorrências');
assert.throws(()=>lerPlanilhaEquipe({nome:'x.csv',bytes:new Uint8Array(Buffer.from('A;B\n1;2'))}),/MATRÍCULA e NOME/);
assert.throws(()=>lerPlanilhaEquipe({nome:'x.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;OBS\n1;A;B;C'))}),/Nenhuma coluna de mês/);
assert.throws(()=>lerPlanilhaEquipe({nome:'x.xlsx',bytes:new Uint8Array([1,2,3])}),/xlsx válida/);
console.log('test-equipe: planilha ok');

import {montarPrevia,aplicarPrevia} from './src/services/equipePlanilha.ts';

const cadastro={members:[
 {id:'e',matricula:'037',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'PAVIMENTAÇÃO'}},
 {id:'r',matricula:'28',nome:'EMERSON RYAN RODRUIGUES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO'}},
 {id:'s',nome:'SEBASTIAO DE SOUZA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'DRENAGEM'}},
 {id:'h1',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO'}},
 {id:'h2',nome:'JOSE SILVA',funcao:'CARPINTEIRO',meses:{'2026-04':'CONTENÇÃO'}},
 {id:'v',matricula:'41',nome:'VALDINEI',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO','2026-05':'CONTENÇÃO'}},
 {id:'z',matricula:'99',nome:'FORA DA LISTA',funcao:'APONTADOR',meses:{'2026-03':'ADMINISTRAÇÃO'}}],
 efetivo:{'2026-05-04':{e:1,v:1},'2026-03-02':{z:1}}};
const planilha={meses:['2026-04','2026-05'],colunasIgnoradas:[],recusadas:[{linha:9,motivo:'sem matrícula'}],linhas:[
 {linha:2,matricula:'37',nome:'EDMAR ALVES',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'DRENAGEM'}},
 {linha:3,matricula:'28',nome:'EMERSON RYAN RODRIGUES',funcao:'OFICIAL',meses:{'2026-04':'PAVIMENTAÇÃO','2026-05':'PAVIMENTAÇÃO'}},
 {linha:4,matricula:'33',nome:'SEBASTIAO DE SOUZA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'DRENAGEM','2026-05':''}},
 {linha:5,matricula:'50',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO','2026-05':''}},
 {linha:6,matricula:'41',nome:'VALDINEI',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO','2026-05':''}},
 {linha:7,matricula:'60',nome:'NOVO FUNCIONARIO',funcao:'CALDEIRISTA',meses:{'2026-04':'','2026-05':'TERRAPLENAGEM'}}]};
const p=montarPrevia(cadastro,planilha);
const tipos=t=>p.alteracoes.filter(a=>a.tipo===t).map(a=>[a.nome,a.mes||'',a.de||'',a.para||'']);
assert.deepEqual(p.pares.map(x=>[x.membro.id,x.porNome]),[['e',false],['r',false],['s',true],['v',false]],'matrícula com zeros e vínculo por nome único');
assert.deepEqual(p.novas.map(l=>l.matricula),['50','60'],'homônimos sem matrícula não são vinculados por nome');
assert.deepEqual(tipos('nome'),[['EMERSON RYAN RODRIGUES','','EMERSON RYAN RODRUIGUES','EMERSON RYAN RODRIGUES']]);
assert.deepEqual(tipos('funcao'),[['EMERSON RYAN RODRIGUES','','AJUDANTE GERAL','OFICIAL']]);
assert.deepEqual(tipos('transferencia'),[['EDMAR ALVES','2026-05','PAVIMENTAÇÃO','DRENAGEM']]);
assert.deepEqual(tipos('entrada'),[['EMERSON RYAN RODRIGUES','2026-05','','PAVIMENTAÇÃO']]);
assert.deepEqual(tipos('saidaRecusada').map(x=>x[0]),['VALDINEI'],'célula vazia em mês com presença é recusada');
assert.deepEqual(tipos('saida'),[]);
assert.deepEqual(p.equipesNovas,['TERRAPLENAGEM']);
assert.deepEqual(p.foraDaPlanilha.map(f=>[f.membro.id,f.presencas]),[['h1',0],['h2',0],['z',1]]);
assert.equal(p.mesFuncaoPadrao,'2026-05');

const depois=aplicarPrevia(cadastro,p,{mesFuncao:'2026-05',desvincular:new Set(),remover:new Set(['z'])});
const por=id=>depois.members.find(m=>m.id===id);
assert.equal(por('r').nome,'EMERSON RYAN RODRIGUES','nome corrigido mantém o código interno');
assert.equal(por('e').meses['2026-05'],'DRENAGEM');assert.equal(por('e').equipe,'DRENAGEM');
assert.equal(por('e').matricula,'37','matrícula gravada como veio na planilha');
assert.equal(funcaoNoMes(por('r'),'2026-04'),'AJUDANTE GERAL');assert.equal(funcaoNoMes(por('r'),'2026-05'),'OFICIAL');
assert.equal(por('s').matricula,'33','vínculo por nome grava a matrícula');
assert.equal(por('v').meses['2026-05'],'CONTENÇÃO','saída recusada mantém o mês');
assert.ok(!por('z'),'removida quando escolhido');assert.equal(depois.efetivo['2026-03-02'].z,undefined,'presenças da removida apagadas');
assert.ok(por('h1')&&por('h2'),'fora da planilha mantidas por padrão');
const novos=depois.members.filter(m=>['50','60'].includes(m.matricula));
assert.equal(novos.length,2);assert.deepEqual(novos.find(m=>m.matricula==='60').meses,{'2026-05':'TERRAPLENAGEM'});
assert.equal(depois.efetivo['2026-05-04'].e,1,'presenças preservadas');
assert.equal(aplicarPrevia(cadastro,p,{mesFuncao:'2026-05',desvincular:new Set(),remover:new Set()}).members.find(m=>m.id==='z').meses['2026-03'],'ADMINISTRAÇÃO','mês fora da planilha intacto');
const d2=aplicarPrevia(cadastro,p,{mesFuncao:'2026-05',desvincular:new Set(['33']),remover:new Set()});
assert.equal(d2.members.find(m=>m.id==='s').matricula,undefined,'desvinculada continua sem matrícula');
assert.ok(d2.members.some(m=>m.matricula==='33'&&m.id!=='s'),'linha desvinculada vira pessoa nova');
const p2=montarPrevia(depois,planilha);
assert.deepEqual(p2.alteracoes.filter(a=>a.tipo!=='saidaRecusada'),[],'reimportar a mesma planilha não propõe alterações');
assert.equal(p2.novas.length,0);
console.log('test-equipe: prévia ok');

import {preencherEfetivoComRdo} from './src/services/equipe.ts';

const equipeRdo={members:[
 {id:'a',nome:'ANA',funcao:'AJUDANTE',meses:{'2026-09':'ADMINISTRAÇÃO'},ativo:true},
 {id:'b',nome:'BIA',funcao:'ARMADOR',meses:{'2026-09':'DRENAGEM'},ativo:true},
 {id:'c',nome:'CAIO',funcao:'MOTORISTA',meses:{'2026-10':'DRENAGEM'},ativo:true}],efetivo:{}};
const diasRdo=[{date:'2026-09-01',professionals:2},{date:'2026-09-02',professionals:null},{date:'2026-09-03',professionals:0},{date:'2026-10-03',professionals:1}];
const um=preencherEfetivoComRdo(equipeRdo,diasRdo,'2026-09',false);
assert.deepEqual(um.res,{preenchidos:1,zerados:1,marcacoes:2,semNumero:['2026-09-02'],mantidos:0,substituidos:0,semMembros:false,inativos:0,semAtivos:false});
assert.deepEqual(um.efetivo['2026-09-01'],{a:1,b:1},'marca na ordem da grade e só quem é do mês');
assert.equal(um.efetivo['2026-09-02'],undefined,'dia sem número no RDO não nasce no efetivo');
assert.deepEqual(um.efetivo['2026-09-03'],{},'RDO com zero grava o dia vazio');
assert.equal(um.efetivo['2026-10-03'],undefined,'dia de outro mês fica intacto');
assert.equal(equipeRdo.efetivo['2026-09-01'],undefined,'a função não altera a configuração de entrada');

const comManual={...equipeRdo,efetivo:{'2026-09-01':{b:1}}};
const mantido=preencherEfetivoComRdo(comManual,diasRdo,'2026-09',false);
assert.deepEqual(mantido.efetivo['2026-09-01'],{b:1},'marcação manual preservada quando não se sobrescreve');
assert.equal(mantido.res.mantidos,1);assert.equal(mantido.res.preenchidos,0);
const trocado=preencherEfetivoComRdo(comManual,diasRdo,'2026-09',true);
assert.deepEqual(trocado.efetivo['2026-09-01'],{a:1,b:1},'sobrescrever regrava o dia inteiro');
assert.equal(trocado.res.substituidos,1);

const estreito=preencherEfetivoComRdo({...equipeRdo,members:[equipeRdo.members[0]]},[{date:'2026-09-01',professionals:50}],'2026-09',false);
assert.deepEqual(estreito.efetivo['2026-09-01'],{a:1},'não marca mais gente do que há na lista');

const semNinguem=preencherEfetivoComRdo(equipeRdo,[{date:'2026-11-02',professionals:3}],'2026-11',false);
assert.equal(semNinguem.res.semMembros,true,'mês sem ninguém na lista');
assert.equal(semNinguem.efetivo['2026-11-02'],undefined,'nada é gravado sem ninguém para marcar');

const reexec=preencherEfetivoComRdo({...equipeRdo,efetivo:um.efetivo},diasRdo,'2026-09',true);
assert.deepEqual(reexec.efetivo,um.efetivo,'rodar de novo no mesmo estado é estável');
console.log('test-equipe: auto-preenchimento ok');

// Correções da revisão final
const soMatricula=montarPrevia({members:[{id:'j',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO'}}],efetivo:{}},
 {meses:['2026-04'],colunasIgnoradas:[],recusadas:[],linhas:[{linha:2,matricula:'123',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'CONTENÇÃO'}}]});
assert.ok(soMatricula.alteracoes.some(a=>a.tipo==='matricula'&&a.para==='123'),'preencher só a matrícula conta como alteração');

let f=registrarFuncao({id:'q',nome:'Q',funcao:'A',meses:{}},'B','2026-05');
f=registrarFuncao(f,'C','2026-05');
assert.equal(funcaoNoMes(f,'2026-04'),'A','corrigir a função no mesmo mês mantém a anterior original');
assert.equal(funcaoNoMes(f,'2026-05'),'C');
assert.deepEqual(registrarFuncao(f,'A','2026-05').historicoFuncao,[],'voltar à função original no mesmo mês desfaz a mudança');

const homonimosNoArquivo=montarPrevia({members:[{id:'j',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{}}],efetivo:{}},
 {meses:['2026-04'],colunasIgnoradas:[],recusadas:[],linhas:[
  {linha:2,matricula:'1',nome:'JOSE SILVA',funcao:'ARMADOR',meses:{'2026-04':'A'}},
  {linha:3,matricula:'2',nome:'JOSE SILVA',funcao:'CARPINTEIRO',meses:{'2026-04':'B'}}]});
assert.deepEqual(homonimosNoArquivo.pares,[],'nome repetido na planilha não é ligado automaticamente');
assert.deepEqual(homonimosNoArquivo.novas.map(l=>l.matricula),['1','2']);
console.log('test-equipe: correções da revisão ok');

import {estaAtivo,membrosAtivosDoMes} from './src/services/equipe.ts';

// a regra é literal: sem o campo, a pessoa é inativa
assert.equal(estaAtivo({id:'x',nome:'X',funcao:'F'}),false,'sem o campo = inativa');
assert.equal(estaAtivo({id:'x',nome:'X',funcao:'F',ativo:true}),true);
assert.equal(estaAtivo({id:'x',nome:'X',funcao:'F',ativo:false}),false);

// a conversão marca como ativas as pessoas que já existiam
const antigas={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-09':'DRENAGEM'}},
 {id:'b',nome:'BIA',funcao:'APONTADOR',meses:{'2026-09':'OBRA'},ativo:false}],efetivo:{}};
const conv=migrarEquipe(antigas,'2026-10');
assert.equal(conv.members[0].ativo,true,'quem não tinha o campo vira ativa');
assert.equal(conv.members[1].ativo,false,'quem já estava inativa continua inativa');
assert.equal(migrarEquipe(conv,'2026-10'),conv,'conversão idempotente');

// a conversão continua convertendo os meses, e grava ativo no mesmo passo
const semMeses={members:[{id:'c',nome:'CARLOS',funcao:'PEDREIRO',equipe:'Pavimentação'}],efetivo:{'2026-08-03':{c:1}}};
const conv2=migrarEquipe(semMeses,'2026-10');
assert.deepEqual(conv2.members[0].meses,{'2026-08':'PAVIMENTAÇÃO'},'mês deduzido da presença');
assert.equal(conv2.members[0].ativo,true);

// lista de ativos do mês: mesma ordem de membrosDoMes, só com os ativos
const comInativo={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true},
 {id:'b',nome:'BIA',funcao:'APONTADOR',meses:{'2026-10':'DRENAGEM'},ativo:false},
 {id:'c',nome:'CLARA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true}],efetivo:{}};
assert.deepEqual(membrosDoMes(comInativo,'2026-10').map(x=>x.membro.id),['a','b','c']);
assert.deepEqual(membrosAtivosDoMes(comInativo,'2026-10').map(x=>x.membro.id),['a','c'],'só os ativos, na mesma ordem');
console.log('test-equipe: marca de ativo ok');

const tresPessoas={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true},
 {id:'b',nome:'BIA',funcao:'APONTADOR',meses:{'2026-10':'DRENAGEM'},ativo:false},
 {id:'c',nome:'CLARA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true}],efetivo:{}};
const diasUm=[{date:'2026-10-01',professionals:2}];

// marca só os ativos, na ordem da grade
let rr=preencherEfetivoComRdo(tresPessoas,diasUm,'2026-10',false);
assert.deepEqual(rr.efetivo['2026-10-01'],{a:1,c:1},'a inativa não é marcada');
assert.equal(rr.res.inativos,1,'conta quantas foram puladas');
assert.equal(rr.res.semMembros,false);assert.equal(rr.res.semAtivos,false);
assert.equal(rr.res.marcacoes,2);

// o total pedido é limitado ao número de ativos, não ao de pessoas do mês
rr=preencherEfetivoComRdo(tresPessoas,[{date:'2026-10-01',professionals:3}],'2026-10',false);
assert.deepEqual(rr.efetivo['2026-10-01'],{a:1,c:1},'não inventa uma terceira presença');
assert.equal(rr.res.marcacoes,2);

// mês com gente, nenhuma ativa: nada é gravado e a situação é distinguível
const todasInativas={members:tresPessoas.members.map(m=>({...m,ativo:false})),efetivo:{}};
rr=preencherEfetivoComRdo(todasInativas,diasUm,'2026-10',false);
assert.deepEqual(rr.efetivo,{},'nada é gravado');
assert.equal(rr.res.semAtivos,true,'o mês tem gente, mas nenhuma ativa');
assert.equal(rr.res.semMembros,false,'não é o caso de mês vazio');
assert.equal(rr.res.inativos,3);

// mês sem ninguém continua sendo semMembros
rr=preencherEfetivoComRdo({members:[],efetivo:{}},diasUm,'2026-10',false);
assert.equal(rr.res.semMembros,true);assert.equal(rr.res.semAtivos,false);assert.equal(rr.res.inativos,0);

// marcação manual de pessoa inativa é preservada quando não se autoriza sobrescrever
const comMarcaManual={...tresPessoas,efetivo:{'2026-10-01':{b:1}}};
rr=preencherEfetivoComRdo(comMarcaManual,diasUm,'2026-10',false);
assert.deepEqual(rr.efetivo['2026-10-01'],{b:1},'o dia já marcado fica intacto');
assert.equal(rr.res.mantidos,1);

// com autorização para sobrescrever, o dia é regravado só com ativos
rr=preencherEfetivoComRdo(comMarcaManual,diasUm,'2026-10',true);
assert.deepEqual(rr.efetivo['2026-10-01'],{a:1,c:1},'a marcação da inativa sai porque o usuário autorizou');
assert.equal(rr.res.substituidos,1);

// dia sem número continua intocado
rr=preencherEfetivoComRdo(tresPessoas,[{date:'2026-10-02',professionals:null}],'2026-10',false);
assert.deepEqual(rr.efetivo,{});assert.deepEqual(rr.res.semNumero,['2026-10-02']);
console.log('test-equipe: auto-preenchimento com ativos ok');

// ---- coluna ATIVO na planilha ----
const comAtivo={members:[
 {id:'1',matricula:'10',nome:'ANA',funcao:'ARMADOR',meses:{'2026-10':'DRENAGEM'},ativo:true},
 {id:'2',matricula:'20',nome:'BIA',funcao:'APONTADOR',meses:{'2026-10':'DRENAGEM'},ativo:false}],efetivo:{}};
const idaVolta=lerPlanilhaEquipe({nome:'equipe.xlsx',bytes:gerarPlanilhaEquipe(comAtivo,'2026-10')});
assert.deepEqual(idaVolta.linhas.map(l=>[l.matricula,l.ativo]),[['10',true],['20',false]],'ida e volta preserva a marca');
assert.deepEqual(idaVolta.colunasIgnoradas,[],'ATIVO não entra em colunas ignoradas');
assert.deepEqual(idaVolta.meses,['2026-10'],'ATIVO não é lido como mês');

// grafias aceitas e recusadas
const csvAtivo=(corpo)=>lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;ATIVO;OUT/2026\n'+corpo,'utf8'))});
assert.equal(csvAtivo('1;ANA;ARMADOR;SIM;DRENAGEM\n').linhas[0].ativo,true);
assert.equal(csvAtivo('1;ANA;ARMADOR;s;DRENAGEM\n').linhas[0].ativo,true);
assert.equal(csvAtivo('1;ANA;ARMADOR;NÃO;DRENAGEM\n').linhas[0].ativo,false,'com acento');
assert.equal(csvAtivo('1;ANA;ARMADOR;nao;DRENAGEM\n').linhas[0].ativo,false);
assert.equal(csvAtivo('1;ANA;ARMADOR;0;DRENAGEM\n').linhas[0].ativo,false);
assert.equal(csvAtivo('1;ANA;ARMADOR;;DRENAGEM\n').linhas[0].ativo,undefined,'vazio não diz nada');
const naoEntendido=csvAtivo('1;ANA;ARMADOR;FÉRIAS;DRENAGEM\n');
assert.equal(naoEntendido.linhas[0].ativo,undefined,'texto não reconhecido não diz nada');
assert.deepEqual(naoEntendido.situacoesIgnoradas,[{linha:2,texto:'FÉRIAS'}],'e fica listado');

// coluna ausente: ninguém muda
const semColuna=lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;OUT/2026\n10;ANA;ARMADOR;DRENAGEM\n20;BIA;APONTADOR;DRENAGEM\n','utf8'))});
assert.deepEqual(semColuna.linhas.map(l=>l.ativo),[undefined,undefined]);
const pSem=montarPrevia(comAtivo,semColuna);
assert.deepEqual(pSem.alteracoes.filter(a=>a.tipo==='ativa'||a.tipo==='inativa'),[],'planilha antiga não propõe mudança de situação');
const aplicadoSem=aplicarPrevia(comAtivo,pSem,{mesFuncao:'2026-10',desvincular:new Set(),remover:new Set()});
assert.deepEqual(aplicadoSem.members.map(m=>m.ativo),[true,false],'a marca de ninguém muda');

// mudança de situação proposta e aplicada
const comColuna=lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;ATIVO;OUT/2026\n10;ANA;ARMADOR;NAO;DRENAGEM\n20;BIA;APONTADOR;SIM;DRENAGEM\n','utf8'))});
const pCom=montarPrevia(comAtivo,comColuna);
assert.deepEqual(pCom.alteracoes.filter(a=>a.tipo==='inativa').map(a=>a.nome),['ANA']);
assert.deepEqual(pCom.alteracoes.filter(a=>a.tipo==='ativa').map(a=>a.nome),['BIA']);
const aplicadoCom=aplicarPrevia(comAtivo,pCom,{mesFuncao:'2026-10',desvincular:new Set(),remover:new Set()});
assert.deepEqual(aplicadoCom.members.map(m=>[m.nome,m.ativo]),[['ANA',false],['BIA',true]]);

// pessoa nova sem informação nasce inativa, com o campo gravado, e a conversão não a reativa
const novaPessoa=lerPlanilhaEquipe({nome:'e.csv',bytes:new Uint8Array(Buffer.from('MATRICULA;NOME;FUNCAO;ATIVO;OUT/2026\n99;NOVA PESSOA;SERVENTE;;DRENAGEM\n','utf8'))});
const pNova=montarPrevia({members:[],efetivo:{}},novaPessoa);
const comNova=aplicarPrevia({members:[],efetivo:{}},pNova,{mesFuncao:'2026-10',desvincular:new Set(),remover:new Set()});
assert.equal(comNova.members[0].ativo,false,'nasce inativa');
assert.equal(migrarEquipe(comNova,'2026-10').members[0].ativo,false,'a conversão não a reativa');
console.log('test-equipe: coluna ATIVO ok');

// ---- correções da revisão final da 1.13.0 ----
import {perguntasSyncRdo} from './src/services/equipe.ts';
import {chaveCorrecao} from './src/components/equipe/comum.ts';
import {rotuloPessoaNova} from './src/services/equipePlanilha.ts';

const resumo=(extra)=>({preenchidos:0,zerados:0,marcacoes:0,semNumero:[],mantidos:0,substituidos:0,semMembros:false,inativos:0,semAtivos:false,...extra});
const juntar=ds=>ds.join(', ');

// Todos os dias do mês já marcados: a primeira pergunta não aparece, então é a
// pergunta de sobrescrever que precisa avisar quem está inativo — senão o usuário
// autoriza apagar presenças sem saber de quem.
const soMantidos=perguntasSyncRdo(resumo({mantidos:30,inativos:3}),'SET/2026','ANA, BIA, CLARA',juntar);
assert.equal(soMantidos.confirmar,null,'não há nada a preencher: a primeira pergunta não aparece');
assert.ok(soMantidos.sobrescrever.includes('ANA, BIA, CLARA'),'a pergunta de sobrescrever nomeia quem está inativo');
assert.ok(/apaga/i.test(soMantidos.sobrescrever),'e diz que sobrescrever apaga as presenças delas');

// Sem inativos, a pergunta de sobrescrever continua como era
const semInativos=perguntasSyncRdo(resumo({mantidos:5}),'SET/2026','',juntar);
assert.ok(!/inativ/i.test(semInativos.sobrescrever),'nada sobre inativos quando não há nenhum');
assert.ok(semInativos.sobrescrever.includes('5 dia(s)'));

// Quando há o que preencher, a primeira pergunta aparece e também avisa
const comPreencher=perguntasSyncRdo(resumo({preenchidos:4,marcacoes:8,inativos:2}),'SET/2026','ANA, BIA',juntar);
assert.ok(comPreencher.confirmar.includes('ANA, BIA'),'a primeira pergunta avisa dos inativos');
assert.equal(comPreencher.sobrescrever,null,'sem dias manuais, não há segunda pergunta');

// Dias sem número continuam listados
const semNumero=perguntasSyncRdo(resumo({preenchidos:1,marcacoes:2,semNumero:['03/09','04/09']}),'SET/2026','',juntar);
assert.ok(semNumero.confirmar.includes('03/09, 04/09'));

// A chave da faixa de correção não pode mudar quando o objeto é recriado igual,
// senão a aba salta de volta para o Cadastro a cada salvamento do app.
const c1={ids:['a','b'],item:'DRENAGEM'},c2={ids:['a','b'],item:'DRENAGEM'};
assert.notEqual(c1,c2,'são objetos distintos, como App.tsx os recria');
assert.equal(chaveCorrecao(c1),chaveCorrecao(c2),'mesma correção, mesma chave');
assert.notEqual(chaveCorrecao(c1),chaveCorrecao({ids:['a'],item:'DRENAGEM'}),'conjunto diferente, chave diferente');
assert.notEqual(chaveCorrecao(c1),chaveCorrecao({ids:['a','b'],item:'PAVIMENTAÇÃO'}),'item diferente, chave diferente');
assert.equal(chaveCorrecao(undefined),'','sem correção, chave vazia');

// Pessoa nova que entra inativa precisa ser anunciada na prévia da importação
assert.equal(rotuloPessoaNova({linha:2,matricula:'99',nome:'NOVA',funcao:'SERVENTE',ativo:true,meses:{}}),'99 — NOVA (SERVENTE)');
assert.equal(rotuloPessoaNova({linha:2,matricula:'99',nome:'NOVA',funcao:'',meses:{}}),'99 — NOVA (sem função) — entra INATIVA','planilha sem a coluna ATIVO: a prévia precisa dizer');
assert.equal(rotuloPessoaNova({linha:2,matricula:'99',nome:'NOVA',funcao:'SERVENTE',ativo:false,meses:{}}),'99 — NOVA (SERVENTE) — entra INATIVA');

// O mês sem ninguém ativo não pode apagar o que já estava marcado à mão
const inativasComPresenca={members:tresPessoas.members.map(m=>({...m,ativo:false})),efetivo:{'2026-10-01':{b:1},'2026-10-02':{a:1,c:1}}};
const nadaAFazer=preencherEfetivoComRdo(inativasComPresenca,[{date:'2026-10-01',professionals:2},{date:'2026-10-02',professionals:3}],'2026-10',true);
assert.deepEqual(nadaAFazer.efetivo,inativasComPresenca.efetivo,'nenhuma presença existente é tocada, nem com sobrescrever ligado');
assert.equal(nadaAFazer.res.semAtivos,true);
assert.equal(nadaAFazer.res.preenchidos,0);assert.equal(nadaAFazer.res.substituidos,0);
console.log('test-equipe: correções da revisão 1.13.0 ok');

// ---- 1.14.0: marcar os ativos de um dia (botão do RDO) ----
import {marcarAtivosNoDia} from './src/services/equipe.ts';

const maTime={members:[
 {id:'a',nome:'ANA',funcao:'ARMADOR',ativo:true,meses:{'2026-10':'DRENAGEM'}},
 {id:'b',nome:'BIA',funcao:'ARMADOR',ativo:true,meses:{'2026-10':'DRENAGEM'}},
 {id:'c',nome:'CLARA',funcao:'ARMADOR',ativo:false,meses:{'2026-10':'DRENAGEM'}}],efetivo:{}};

const ma1=marcarAtivosNoDia(maTime,'2026-10-05');
assert.deepEqual(ma1.cfg.efetivo['2026-10-05'],{a:1,b:1},'marca todos os ativos do mês naquele dia');
assert.equal(ma1.marcados,2);
assert.deepEqual(ma1.inativos,['CLARA'],'devolve o nome de quem foi pulado por estar inativo');
assert.equal(ma1.tinhaMarca,false);

const ma2=marcarAtivosNoDia({...maTime,efetivo:{'2026-10-05':{c:1}}},'2026-10-05');
assert.equal(ma2.tinhaMarca,true,'avisa que o dia já tinha marcação');
assert.deepEqual(ma2.cfg.efetivo['2026-10-05'],{a:1,b:1},'a marcação anterior do dia é substituída');

const ma3=marcarAtivosNoDia({...maTime,efetivo:{'2026-10-04':{a:1}}},'2026-10-05');
assert.deepEqual(ma3.cfg.efetivo['2026-10-04'],{a:1},'os outros dias ficam intactos');

const ma4=marcarAtivosNoDia({members:maTime.members.map(m=>({...m,ativo:false})),efetivo:{}},'2026-10-05');
assert.equal(ma4.marcados,0);
assert.equal(ma4.cfg.efetivo['2026-10-05'],undefined,'mês sem ninguém ativo não grava o dia');
assert.equal(ma4.inativos.length,3);

const ma5=marcarAtivosNoDia({members:[],efetivo:{}},'2026-11-01');
assert.equal(ma5.marcados,0);assert.deepEqual(ma5.inativos,[]);

const ma6=marcarAtivosNoDia(maTime,'2026-09-30');
assert.equal(ma6.marcados,0,'mês sem equipe cadastrada não marca ninguém');
console.log('test-equipe: marcar ativos no dia ok');

// ---- 1.14.0: a pergunta antes de marcar (revisão final) ----
import {perguntaUsarEfetivo} from './src/services/equipe.ts';

const pq1=perguntaUsarEfetivo({ativos:3,inativos:[],tinhaMarca:false},'05/10/2026');
assert.match(pq1,/Marcar 3 pessoa/,'diz quantas pessoas vai marcar');
assert.match(pq1,/05\/10\/2026/,'diz em que dia');
assert.match(pq1,/entrou ou saiu no meio do m/i,'avisa que a lista é do mês, não do dia');
assert.ok(!/substitu/i.test(pq1),'sem marcação anterior, não fala em substituir');

const pq2=perguntaUsarEfetivo({ativos:2,inativos:['ANA','BIA'],tinhaMarca:true},'05/10/2026');
assert.match(pq2,/substitu/i,'avisa que vai substituir o que já estava marcado');
assert.match(pq2,/ANA, BIA/,'nomeia quem fica de fora por estar inativo');
assert.match(pq2,/2 pessoa\(s\) inativa/,'diz quantas ficam de fora');
console.log('test-equipe: pergunta de usar o efetivo ok');
