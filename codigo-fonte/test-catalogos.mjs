import assert from 'node:assert/strict';
import {chaveItem,CATALOGOS,catalogoPorId,catalogoDe,registrarValor,registrarValores,semearCatalogos} from './src/services/catalogos.ts';

// identidade
assert.equal(chaveItem('Iguaraçu – Maringá'),chaveItem('IGUARAÇU - MARINGÁ'),'acento e travessão');
assert.equal(chaveItem('  dois   espaços '),'DOIS ESPACOS');
assert.equal(chaveItem(null),'');
assert.notEqual(chaveItem('PR-317'),chaveItem('PR-318'));

assert.equal(CATALOGOS.length,11);
assert.deepEqual(CATALOGOS.map(c=>c.id).sort(),['acoes','categorias','equipamentos','equipes','estacas','funcoes','lados','placas','rodovias','servicos','trechos']);
assert.equal(catalogoPorId('funcoes').tela,'equipe');
assert.equal(catalogoPorId('servicos').tela,'fotos');

// projeto antigo: sem catalogos, sem equipe, sem equipamentos, sem acoes
const vazio={config:{},photos:[]};
for(const c of CATALOGOS){
 assert.deepEqual(c.valores(vazio),[],'valores sem dados: '+c.id);
 assert.deepEqual(c.usos(vazio,'X'),[],'usos sem dados: '+c.id);
 assert.deepEqual(c.renomear(vazio,'X','Y'),vazio,'renomear sem dados: '+c.id);
}
const semeado=semearCatalogos(vazio);
assert.deepEqual(semeado.photos,[]);
assert.deepEqual(catalogoDe(semeado.config,'lados'),['LD','LE','MD','ME','PISTA','AMBOS']);
assert.equal(catalogoDe(semeado.config,'rodovias').length,0,'rodovias não têm sementes');
assert.ok(catalogoDe(semeado.config,'funcoes').includes('ARMADOR'));

// valores vindos dos registros
const dados={
 config:{
  rodoviaPadrao:'PR-317',trechoPadrao:'IGUARAÇU - MARINGÁ',
  equipe:{members:[{id:'a',nome:'ANA',funcao:'ARMADORA',meses:{'2026-04':'DRENAGEM'},historicoFuncao:[{desde:'2026-04',funcao:'ARMADORA',anterior:'AJUDANTE'}]}],efetivo:{}},
  equipamentos:{items:[{id:'e1',nome:'ESCAVADEIRA',placa:'ABC-1234'}],efetivo:{}},
  acoes:[{id:'x',rnf:'01',acao:'REFAZER JUNTA',habilitacao:'',implementacao:''}],
  tagCatalog:['Pavimentação'],
 },
 photos:[{id:'p1',data:'01/04/2026',rodovia:'PR-317',trecho:'Iguaraçu – Maringá',estaca:'4537',lado:'LE',categoria:'Pavimentação',servico:'LANÇAMENTO DE BGS',imageUrl:'x',timestamp:1}],
};
assert.deepEqual(catalogoPorId('rodovias').valores(dados),['PR-317','PR-317'],'inclui o padrão do relatório');
assert.deepEqual(catalogoPorId('funcoes').valores(dados).sort(),['AJUDANTE','ARMADORA','ARMADORA'],'inclui o histórico');
assert.deepEqual(catalogoPorId('equipes').valores(dados),['DRENAGEM']);
assert.deepEqual(catalogoPorId('equipamentos').valores(dados),['ESCAVADEIRA']);
assert.deepEqual(catalogoPorId('placas').valores(dados),['ABC-1234']);
assert.deepEqual(catalogoPorId('acoes').valores(dados),['REFAZER JUNTA']);
assert.deepEqual(catalogoPorId('servicos').valores(dados),['LANÇAMENTO DE BGS']);

// semeadura: preenche a partir dos registros, não duplica e preserva a grafia salva
const s1=semearCatalogos(dados);
assert.deepEqual(catalogoDe(s1.config,'trechos'),['Iguaraçu – Maringá'],'a primeira grafia encontrada vence (fotos antes do padrão do relatório); a tela agrupa as demais');
assert.deepEqual(catalogoDe(s1.config,'rodovias'),['PR-317']);
assert.ok(catalogoDe(s1.config,'funcoes').includes('AJUDANTE'));
assert.equal(s1.photos,dados.photos,'semear não toca em registros');
const s2=semearCatalogos(s1);
assert.deepEqual(catalogoDe(s2.config,'trechos'),catalogoDe(s1.config,'trechos'),'idempotente');
assert.deepEqual(catalogoDe(s2.config,'funcoes'),catalogoDe(s1.config,'funcoes'));

// registrar
let cfg=registrarValor({},'equipes','  drenagem  ');
assert.deepEqual(catalogoDe(cfg,'equipes'),['DRENAGEM'],'equipe entra em maiúsculas, sem espaços nas pontas');
cfg=registrarValor(cfg,'equipes','DRENAGEM');
assert.deepEqual(catalogoDe(cfg,'equipes'),['DRENAGEM'],'não duplica por chaveItem');
cfg=registrarValor(cfg,'equipes','   ');
cfg=registrarValor(cfg,'equipes',null);
assert.deepEqual(catalogoDe(cfg,'equipes'),['DRENAGEM'],'vazio é ignorado');
assert.deepEqual(catalogoDe({catalogos:{funcoes:'texto solto'}},'funcoes'),[],'catálogo corrompido é tratado como ausente');
assert.deepEqual(catalogoDe({catalogos:{funcoes:['OK',' ',7]}},'funcoes'),['OK'],'entradas inválidas são descartadas');
cfg=registrarValores(cfg,[['funcoes','ARMADOR'],['equipes','PAVIMENTAÇÃO']]);
assert.deepEqual(catalogoDe(cfg,'funcoes'),['ARMADOR']);
assert.deepEqual(catalogoDe(cfg,'equipes'),['DRENAGEM','PAVIMENTAÇÃO']);
console.log('test-catalogos: base ok');

import {renomearItem,itensDoCatalogo,excluirItem} from './src/services/catalogos.ts';

const base={
 config:{
  rodoviaPadrao:'PR-317',trechoPadrao:'IGUARAÇU - MARINGÁ',tagCatalog:['Pavimentação','Drenagem e Obras de Arte'],
  equipe:{members:[
   {id:'a',nome:'ANA',funcao:'ARMADOR',meses:{'2026-04':'DRENAGEM','2026-05':'DRENAGEM'},historicoFuncao:[{desde:'2026-05',funcao:'ARMADOR',anterior:'AJUDANTE GERAL'}]},
   {id:'b',nome:'BIA',funcao:'AJUDANTE GERAL',meses:{'2026-04':'PAVIMENTAÇÃO'}}],
   efetivo:{'2026-04-01':{a:1,b:1}}},
  equipamentos:{items:[{id:'e1',nome:'ESCAVADEIRA',placa:'ABC-1234'},{id:'e2',nome:'ESCAVADEIRA HIDRÁULICA',placa:'DEF-5678'}],
   efetivo:{'2026-04-01':{'ESCAVADEIRA':2,'ESCAVADEIRA HIDRÁULICA':3},'2026-04-02':{'ESCAVADEIRA':1}}},
  acoes:[{id:'x',rnf:'01',acao:'REFAZER JUNTA (A.1)',habilitacao:'',implementacao:''}],
 },
 photos:[
  {id:'p1',data:'01/04/2026',rodovia:'PR-317',trecho:'IGUARAÇU - MARINGÁ',lado:'LE',categoria:'Pavimentação',servico:'BGS',imageUrl:'x',timestamp:1},
  {id:'p2',data:'02/04/2026',rodovia:'PR-317',trecho:'Iguaraçu – Maringá',lado:'LD',categoria:'Pavimentação',servico:'BGS',imageUrl:'x',timestamp:2,tags:['Pavimentação','Muro']},
 ],
};

// contagem de usos
assert.equal(catalogoPorId('funcoes').usos(base,'AJUDANTE GERAL').length,2,'função atual e histórico contam');
assert.deepEqual(catalogoPorId('funcoes').usos(base,'ARMADOR').map(u=>u.id),['a']);
assert.deepEqual(catalogoPorId('equipes').usos(base,'drenagem').map(u=>u.id),['a'],'comparação tolerante');
assert.deepEqual(catalogoPorId('equipamentos').usos(base,'ESCAVADEIRA').map(u=>u.id),['e1']);
assert.deepEqual(catalogoPorId('placas').usos(base,'abc-1234').map(u=>u.id),['e1']);
assert.deepEqual(catalogoPorId('acoes').usos(base,'REFAZER JUNTA (A.1)').map(u=>u.id),['x'],'texto com parênteses e ponto');
assert.equal(catalogoPorId('trechos').usos(base,'IGUARAÇU - MARINGÁ').length,2,'as duas grafias');
assert.equal(catalogoPorId('rodovias').usos(base,'PR-318').length,0,'item inexistente não tem uso');
const semP2={...base,photos:[base.photos[0]]};
assert.equal(catalogoPorId('trechos').usos(semP2,'IGUARAÇU - MARINGÁ').length,1,'usos acompanha os dados atuais');

// renomear função: atual e histórico
let r=renomearItem(base,'funcoes','AJUDANTE GERAL','AUXILIAR GERAL');
assert.equal(r.alterados,2);
let m=id=>r.dados.config.equipe.members.find(x=>x.id===id);
assert.equal(m('b').funcao,'AUXILIAR GERAL');
assert.equal(m('a').historicoFuncao[0].anterior,'AUXILIAR GERAL','a função antiga do histórico também muda');
assert.equal(m('a').funcao,'ARMADOR','quem não usa fica intacto');
assert.deepEqual(r.dados.config.equipe.efetivo,base.config.equipe.efetivo,'presenças intactas');

// renomear equipamento: itens e as chaves do efetivo, somando no destino existente
r=renomearItem(base,'equipamentos','ESCAVADEIRA','ESCAVADEIRA HIDRÁULICA');
assert.equal(r.dados.config.equipamentos.items.filter(i=>i.nome==='ESCAVADEIRA HIDRÁULICA').length,2,'os dois itens coexistem com o mesmo nome');
assert.deepEqual(r.dados.config.equipamentos.efetivo['2026-04-01'],{'ESCAVADEIRA HIDRÁULICA':5},'2+3 somados');
assert.deepEqual(r.dados.config.equipamentos.efetivo['2026-04-02'],{'ESCAVADEIRA HIDRÁULICA':1});

// renomear rodovia/trecho: fotos e o padrão do relatório
r=renomearItem(base,'rodovias','PR-317','PR-317/PR-444');
assert.equal(r.dados.config.rodoviaPadrao,'PR-317/PR-444');
assert.ok(r.dados.photos.every(p=>p.rodovia==='PR-317/PR-444'));
r=renomearItem(base,'trechos','Iguaraçu – Maringá','IGUARAÇU — MARINGÁ');
assert.equal(r.alterados,2,'as duas grafias viram uma só');
assert.ok(r.dados.photos.every(p=>p.trecho==='IGUARAÇU — MARINGÁ'));
assert.equal(r.dados.config.trechoPadrao,'IGUARAÇU — MARINGÁ');

// renomear categoria: fotos, tag derivada e tagCatalog; foto com tags próprias intacta
r=renomearItem(base,'categorias','Pavimentação','Pavimentação Asfáltica');
assert.equal(r.dados.photos[0].categoria,'Pavimentação Asfáltica');
assert.deepEqual(r.dados.photos[1].tags,['Pavimentação','Muro'],'tags próprias não são tocadas');
assert.ok(r.dados.config.tagCatalog.includes('Pavimentação Asfáltica'));
assert.ok(!r.dados.config.tagCatalog.includes('Pavimentação'));

// renomear equipe e ação
r=renomearItem(base,'equipes','DRENAGEM','DRENAGEM E OAC');
assert.deepEqual(r.dados.config.equipe.members[0].meses,{'2026-04':'DRENAGEM E OAC','2026-05':'DRENAGEM E OAC'});
assert.equal(r.dados.config.equipe.members[0].equipe,'DRENAGEM E OAC','equipe mais recente acompanha');
r=renomearItem(base,'acoes','REFAZER JUNTA (A.1)','REFAZER JUNTA');
assert.equal(r.dados.config.acoes[0].acao,'REFAZER JUNTA');

// renomear só a grafia (acento/travessão): sem duplicar, sem perder registros
r=renomearItem(base,'trechos','IGUARAÇU - MARINGÁ','Iguaraçu – Maringá');
assert.equal(r.dados.photos.length,2);
assert.ok(r.dados.photos.every(p=>p.trecho==='Iguaraçu – Maringá'));

// sem efeito
assert.equal(renomearItem(base,'funcoes','ARMADOR','  ').dados,base);
assert.equal(renomearItem(base,'trechos','IGUARAÇU - MARINGÁ','iguaraçu - maringá').alterados,2,'muda só a grafia');
assert.equal(renomearItem(base,'funcoes','INEXISTENTE','OUTRA').alterados,0);

// lista da tela: grafias agrupadas e contagem de usos
const semeado2=semearCatalogos(base);
const trechos=itensDoCatalogo(semeado2,'trechos');
assert.equal(trechos.length,1,'uma entrada para as duas grafias');
assert.equal(trechos[0].grafias.length,2);
assert.equal(trechos[0].usos,2);
const lados=itensDoCatalogo(semeado2,'lados');
assert.equal(lados.find(i=>i.texto==='LE').usos,1);
assert.equal(lados.find(i=>i.texto==='MD').usos,0,'semente sem uso');

// excluir mexe só no catálogo
const semLado=excluirItem(semeado2,'lados','MD');
assert.ok(!catalogoDe(semLado.config,'lados').includes('MD'));
assert.equal(semLado.photos.length,2,'nenhum registro é apagado');
assert.deepEqual(semLado.config.equipe,semeado2.config.equipe);
console.log('test-catalogos: usos e renomeação ok');

// ---- correções da revisão final ----
// textos acima do limite não entram no catálogo (o servidor os recusaria e travaria o salvamento)
const longo='X'.repeat(600);
assert.deepEqual(catalogoDe(registrarValor({},'servicos',longo),'servicos'),[],'texto acima do limite não entra');
assert.deepEqual(catalogoDe(semearCatalogos({config:{},photos:[{id:'pl',servico:longo,imageUrl:'x',timestamp:1}]}).config,'servicos'),[],'semeadura ignora texto longo');
const catGrande=renomearItem({config:{tagCatalog:['Pavimentação']},photos:[{id:'pc',categoria:'Pavimentação',imageUrl:'x',timestamp:1}]},'categorias','Pavimentação','Y'.repeat(100));
assert.ok(catGrande.dados.config.tagCatalog.every(t=>t.length<=64),'tag não passa do limite de 64 caracteres');

// renomear equipamento move a chave do efetivo mesmo com grafia diferente
const acento={config:{equipamentos:{items:[{id:'e1',nome:'ESCAVADEIRA HIDRAULICA',placa:''}],efetivo:{'2026-04-01':{'ESCAVADEIRA HIDRAULICA':2}}}},photos:[]};
const rAc=renomearItem(acento,'equipamentos','ESCAVADEIRA HIDRÁULICA','ESCAVADEIRA 20T');
assert.deepEqual(rAc.dados.config.equipamentos.efetivo['2026-04-01'],{'ESCAVADEIRA 20T':2},'chave do efetivo com grafia diferente acompanha');

// equipes, funções, equipamentos, placas e lados ficam em maiúsculas
assert.equal(renomearItem(base,'equipes','DRENAGEM','Drenagem e OAC').dados.config.equipe.members[0].meses['2026-04'],'DRENAGEM E OAC','equipe gravada em maiúsculas');
assert.equal(renomearItem(base,'funcoes','ARMADOR','Oficial armador').dados.config.equipe.members.find(m=>m.id==='a').funcao,'OFICIAL ARMADOR');
assert.deepEqual(catalogoDe(registrarValor({},'funcoes','pedreiro'),'funcoes'),['PEDREIRO'],'item novo em maiúsculas');
assert.deepEqual(catalogoDe(registrarValor({},'trechos','Iguaraçu – Maringá'),'trechos'),['Iguaraçu – Maringá'],'trecho mantém a grafia digitada');

// semente excluída não volta na próxima semeadura
const comSementes=semearCatalogos({config:{},photos:[]});
const semAmbos=excluirItem(comSementes,'lados','AMBOS');
assert.ok(!catalogoDe(semearCatalogos(semAmbos).config,'lados').includes('AMBOS'),'semente excluída não volta');
assert.ok(catalogoDe(semearCatalogos(semAmbos).config,'lados').includes('LD'),'as demais sementes continuam');

// renomear para o mesmo texto não altera nada
const igual=renomearItem(base,'funcoes','ARMADOR','ARMADOR');
assert.equal(igual.dados,base,'texto igual não altera nada');
assert.equal(igual.alterados,0);
assert.equal(renomearItem(base,'funcoes','ARMADOR',' armador ').dados,base,'mesmo texto após normalizar também não altera');
console.log('test-catalogos: correções da revisão ok');
