# Catálogos de campos repetitivos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a todo campo repetitivo um catálogo guardado na obra, com cadastro pelo próprio campo, tela de administração, edição que corrige o texto em todos os registros e exclusão bloqueada enquanto houver uso.

**Architecture:** Um registro central (`src/services/catalogos.ts`) descreve os onze catálogos e sabe, para cada um, listar valores, listar quem usa e renomear em todos os registros — tudo em funções puras testadas por `test-catalogos.mjs`. A interface usa um componente de campo único (`CampoCatalogo`) e uma tela (`CatalogosPage`) montada a partir desse registro. No servidor entram a validação das listas, um motivo novo de backup e a leitura dos catálogos de outra obra.

**Tech Stack:** TypeScript 5.8, React 19, Tailwind 4, Express 4; testes `node --import tsx`.

**Spec:** `docs/superpowers/specs/2026-10-06-catalogos-design.md`

## Global Constraints

- Diretório dos comandos: `codigo-fonte`. A pasta **não é repositório git**: sem commits; marcar as caixas deste plano ao concluir cada tarefa.
- Testes de servidor rodam contra `dist/server.cjs`: após alterar o servidor, `node build-tmp.mjs` antes de testar.
- Nenhuma dependência nova.
- `chaveItem` é a identidade de um item: NFD sem acentos, travessões `‐-―` viram `-`, espaços repetidos viram um, `trim`, maiúsculas.
- O texto é gravado **como digitado**; só a comparação é tolerante.
- Nenhuma operação de catálogo apaga registro, foto ou arquivo em disco.
- Motivos de backup aceitos pelo servidor: `manual` (padrão), `antes-de-importar-equipe`, `antes-de-editar-catalogo`.
- Interface em português; comentários de código em inglês e só para restrições não óbvias.
- `@types/react` não está instalado: não passar `key` como prop de componente com props tipadas (usar `React.Fragment key`).
- Versão desta entrega: `1.12.0-catalogos` (`codigo-fonte/version.ts`, `desktop-launcher.cjs`), `1.12.0` (`package.json`).

## Review Focus

1. Item cujo texto contém caractere especial de busca (`.`, `*`, `(`) ao renomear ou filtrar — a comparação é por `chaveItem`, nunca por expressão regular montada com o texto do usuário. Teste na Tarefa 2.
2. Renomear um equipamento cujo nome novo já existe no efetivo diário — os valores dos dois precisam somar, não sobrescrever. Teste na Tarefa 2.
3. Projeto antigo sem `config.catalogos`, sem `equipe`, sem `equipamentos` e sem `acoes` — toda função pura deve funcionar sem lançar. Teste na Tarefa 1.
4. Renomear um item para uma grafia que difere só por acento ou travessão (fusão consigo mesmo) — não pode duplicar nem perder registros. Teste na Tarefa 2.
5. Excluir item em uso depois de os registros terem mudado — a contagem sai sempre dos dados do momento, nunca de uma lista guardada antes. Teste na Tarefa 2 (`usos` sobre dados alterados) e conferência manual na Tarefa 10.

---

### Task 1: Base dos catálogos — tipos, identidade, valores e semeadura

**Files:**
- Modify: `codigo-fonte/src/types.ts`
- Create: `codigo-fonte/src/services/catalogos.ts`
- Create: `codigo-fonte/test-catalogos.mjs`

**Interfaces:**
- Produces, em `src/services/catalogos.ts`:
  - `type CatalogoId='equipes'|'funcoes'|'equipamentos'|'placas'|'rodovias'|'trechos'|'estacas'|'lados'|'categorias'|'servicos'|'acoes'`
  - `type Tela='fotos'|'equipe'|'equipamentos'|'acoes'`
  - `type Dados={config:ReportConfig;photos:PhotoRecord[]}`
  - `type Uso={id:string;tela:Tela;descricao:string}`
  - `type DefinicaoCatalogo={id;rotulo;singular;tela;sementes;valores;usos;renomear}`
  - `chaveItem(v:unknown):string`
  - `CATALOGOS:DefinicaoCatalogo[]` e `catalogoPorId(id:CatalogoId):DefinicaoCatalogo`
  - `catalogoDe(config:ReportConfig,id:CatalogoId):string[]`
  - `registrarValor(config:ReportConfig,id:CatalogoId,texto:unknown):ReportConfig`
  - `registrarValores(config:ReportConfig,pares:[CatalogoId,unknown][]):ReportConfig`
  - `semearCatalogos(d:Dados):Dados`
- Nesta tarefa `usos` e `renomear` de cada catálogo existem como `()=>[]` e `d=>d` e são preenchidos na Tarefa 2.

- [ ] **Step 1: Escrever o teste que falha**

Criar `codigo-fonte/test-catalogos.mjs`:

```js
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
assert.deepEqual(catalogoDe(s1.config,'trechos'),['IGUARAÇU - MARINGÁ'],'primeira grafia encontrada vence');
assert.deepEqual(catalogoDe(s1.config,'rodovias'),['PR-317']);
assert.ok(catalogoDe(s1.config,'funcoes').includes('AJUDANTE'));
assert.equal(s1.photos,dados.photos,'semear não toca em registros');
const s2=semearCatalogos(s1);
assert.deepEqual(catalogoDe(s2.config,'trechos'),catalogoDe(s1.config,'trechos'),'idempotente');
assert.deepEqual(catalogoDe(s2.config,'funcoes'),catalogoDe(s1.config,'funcoes'));

// registrar
let cfg=registrarValor({},'equipes','  drenagem  ');
assert.deepEqual(catalogoDe(cfg,'equipes'),['drenagem'],'grava como digitado, sem espaços nas pontas');
cfg=registrarValor(cfg,'equipes','DRENAGEM');
assert.deepEqual(catalogoDe(cfg,'equipes'),['drenagem'],'não duplica por chaveItem');
cfg=registrarValor(cfg,'equipes','   ');
cfg=registrarValor(cfg,'equipes',null);
assert.deepEqual(catalogoDe(cfg,'equipes'),['drenagem'],'vazio é ignorado');
assert.deepEqual(catalogoDe({catalogos:{funcoes:'texto solto'}},'funcoes'),[],'catálogo corrompido é tratado como ausente');
assert.deepEqual(catalogoDe({catalogos:{funcoes:['OK',' ',7]}},'funcoes'),['OK'],'entradas inválidas são descartadas');
cfg=registrarValores(cfg,[['funcoes','ARMADOR'],['equipes','PAVIMENTAÇÃO']]);
assert.deepEqual(catalogoDe(cfg,'funcoes'),['ARMADOR']);
assert.deepEqual(catalogoDe(cfg,'equipes'),['drenagem','PAVIMENTAÇÃO']);
console.log('test-catalogos: base ok');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-catalogos.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `src/services/catalogos.ts`.

- [ ] **Step 3: Atualizar `src/types.ts`**

Acrescentar antes de `export interface ReportConfig`:

```ts
export type CatalogoId='equipes'|'funcoes'|'equipamentos'|'placas'|'rodovias'|'trechos'
 |'estacas'|'lados'|'categorias'|'servicos'|'acoes';
```

Dentro de `ReportConfig`, acrescentar após `tagCatalog?: string[];`:

```ts
  catalogos?: Partial<Record<CatalogoId, string[]>>;
```

Em `PhotoRecord`, trocar a linha da categoria por:

```ts
  categoria?: string; // padronizada pelo catálogo "categorias"
```

- [ ] **Step 4: Criar `src/services/catalogos.ts`**

```ts
import type {ReportConfig,PhotoRecord,EquipeMember,CatalogoId} from '../types';

export type {CatalogoId};
export type Tela='fotos'|'equipe'|'equipamentos'|'acoes';
export type Dados={config:ReportConfig;photos:PhotoRecord[]};
export type Uso={id:string;tela:Tela;descricao:string};
export type DefinicaoCatalogo={
 id:CatalogoId;rotulo:string;singular:string;tela:Tela;sementes:string[];
 valores:(d:Dados)=>string[];
 usos:(d:Dados,item:string)=>Uso[];
 renomear:(d:Dados,de:string,para:string)=>Dados;
};

export const chaveItem=(v:unknown)=>String(v??'')
 .normalize('NFD').replace(/[̀-ͯ]/g,'')
 .replace(/[‐-―]/g,'-')
 .replace(/\s+/g,' ').trim().toUpperCase();

const texto=(v:unknown)=>String(v??'').trim();
const CAMPOS_FOTO=['rodovia','trecho','estaca','lado','categoria','servico'] as const;
type CampoFoto=typeof CAMPOS_FOTO[number];

type PadraoRelatorio='rodoviaPadrao'|'trechoPadrao';
function catalogoDeFoto(id:CatalogoId,rotulo:string,singular:string,campo:CampoFoto,sementes:string[]=[],padrao?:PadraoRelatorio):DefinicaoCatalogo{
 return {
  id,rotulo,singular,tela:'fotos',sementes,
  valores:d=>[...(d.photos||[]).map(p=>texto(p[campo])),...(padrao?[texto(d.config[padrao])]:[])].filter(Boolean),
  usos:(d,item)=>(d.photos||[]).filter(p=>chaveItem(p[campo])===chaveItem(item))
   .map(p=>({id:p.id,tela:'fotos' as const,descricao:[p.data,p.servico].filter(Boolean).join(' · ')||p.id})),
  renomear:(d,de,para)=>{
   const photos=(d.photos||[]).map(p=>chaveItem(p[campo])===chaveItem(de)?{...p,[campo]:para}:p);
   const mudouFoto=photos.some((p,i)=>p!==(d.photos||[])[i]);
   // The report's default rodovia/trecho is the same text and follows the rename.
   const mudouPadrao=!!padrao&&chaveItem(d.config[padrao])===chaveItem(de);
   if(!mudouFoto&&!mudouPadrao)return d;
   return {...d,photos,config:mudouPadrao?{...d.config,[padrao!]:para}:d.config};
  },
 };
}

export const CATALOGOS:DefinicaoCatalogo[]=[
 catalogoDeFoto('rodovias','Rodovias','rodovia','rodovia',[],'rodoviaPadrao'),
 catalogoDeFoto('trechos','Trechos','trecho','trecho',[],'trechoPadrao'),
 catalogoDeFoto('estacas','Estacas','estaca','estaca'),
 catalogoDeFoto('lados','Lados','lado','lado',['LD','LE','MD','ME','PISTA','AMBOS']),
 catalogoDeFoto('categorias','Categorias','categoria','categoria',['Terraplenagem','Drenagem e Obras de Arte','Pavimentação','Contenção e Estruturas','Sinalização e Segurança','Geral']),
 catalogoDeFoto('servicos','Descrições de serviço','descrição','servico'),
 {id:'equipes',rotulo:'Equipes',singular:'equipe',tela:'equipe',
  sementes:['TERRAPLENAGEM','DRENAGEM','PAVIMENTAÇÃO','CONTENÇÃO E ESTRUTURAS','SINALIZAÇÃO E SEGURANÇA','ADMINISTRAÇÃO'],
  valores:d=>(d.config.equipe?.members||[]).flatMap(m=>Object.values(m.meses||{})).map(texto).filter(Boolean),
  usos:()=>[],renomear:d=>d},
 {id:'funcoes',rotulo:'Funções',singular:'função',tela:'equipe',
  sementes:['AJUDANTE GERAL','APONTADOR','ARMADOR','CARPINTEIRO','ENCARREGADO','MOTORISTA','OPERADOR','PEDREIRO','SERVENTE','TOPÓGRAFO','VIGIA','MECÂNICO','SOLDADOR','AUXILIAR DE LABORATÓRIO'],
  valores:d=>(d.config.equipe?.members||[]).flatMap(m=>[m.funcao,...(m.historicoFuncao||[]).flatMap(h=>[h.funcao,h.anterior])]).map(texto).filter(Boolean),
  usos:()=>[],renomear:d=>d},
 {id:'equipamentos',rotulo:'Equipamentos',singular:'equipamento',tela:'equipamentos',
  sementes:['ESCAVADEIRA HIDRÁULICA','RETROESCAVADEIRA','MOTONIVELADORA','ROLO COMPACTADOR','TRATOR DE ESTEIRA','CAMINHÃO BASCULANTE','CAMINHÃO PIPA','PÁ CARREGADEIRA'],
  valores:d=>(d.config.equipamentos?.items||[]).map(i=>texto(i.nome)).filter(Boolean),
  usos:()=>[],renomear:d=>d},
 {id:'placas',rotulo:'Placas e tags',singular:'placa',tela:'equipamentos',sementes:[],
  valores:d=>(d.config.equipamentos?.items||[]).map(i=>texto(i.placa)).filter(Boolean),
  usos:()=>[],renomear:d=>d},
 {id:'acoes',rotulo:'Ações corretivas',singular:'ação',tela:'acoes',sementes:[],
  valores:d=>(d.config.acoes||[]).map(a=>texto(a.acao)).filter(Boolean),
  usos:()=>[],renomear:d=>d},
];

export const catalogoPorId=(id:CatalogoId)=>{
 const c=CATALOGOS.find(x=>x.id===id);
 if(!c)throw new Error('Catálogo desconhecido: '+id);
 return c;
};
// A catalog hand-edited into an invalid shape is treated as absent and rebuilt by semearCatalogos.
export const catalogoDe=(config:ReportConfig,id:CatalogoId)=>{
 const v=config.catalogos?.[id];
 return Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()):[];
};

function comItens(config:ReportConfig,id:CatalogoId,itens:string[]):ReportConfig{
 return {...config,catalogos:{...(config.catalogos||{}),[id]:itens}};
}
export function registrarValor(config:ReportConfig,id:CatalogoId,valor:unknown):ReportConfig{
 const t=texto(valor);if(!t)return config;
 const atuais=catalogoDe(config,id);
 if(atuais.some(x=>chaveItem(x)===chaveItem(t)))return config;
 return comItens(config,id,[...atuais,t]);
}
export function registrarValores(config:ReportConfig,pares:[CatalogoId,unknown][]):ReportConfig{
 return pares.reduce((c,[id,v])=>registrarValor(c,id,v),config);
}

export function semearCatalogos(d:Dados):Dados{
 let config=d.config;
 for(const c of CATALOGOS){
  const atuais=catalogoDe(config,c.id);
  const vistos=new Set(atuais.map(chaveItem));
  const novos:string[]=[];
  for(const v of [...c.valores(d),...c.sementes]){
   const t=texto(v);const k=chaveItem(t);
   if(!t||vistos.has(k))continue;
   vistos.add(k);novos.push(t);
  }
  if(novos.length||!config.catalogos?.[c.id])config=comItens(config,c.id,[...atuais,...novos]);
 }
 return config===d.config?d:{...d,config};
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-catalogos.mjs`
Expected: `test-catalogos: base ok`. O `tsc` pode acusar o `categoria` das telas; se acusar, é porque algum ponto afirmava a união fechada — trocar por `string` no ponto indicado pelo erro.

---

### Task 2: Quem usa e renomear em todos os registros

**Files:**
- Modify: `codigo-fonte/src/services/catalogos.ts`
- Modify: `codigo-fonte/test-catalogos.mjs` (acrescentar ao fim)

**Interfaces:**
- Consumes: tudo da Tarefa 1.
- Produces:
  - `usos` e `renomear` preenchidos nos cinco catálogos de cadastro (equipes, funcoes, equipamentos, placas, acoes) e o `renomear` especial de `categorias`.
  - `renomearItem(d:Dados,id:CatalogoId,de:string,para:string):{dados:Dados;alterados:number}`
  - `itensDoCatalogo(d:Dados,id:CatalogoId):{texto:string;grafias:string[];usos:number}[]`
  - `excluirItem(d:Dados,id:CatalogoId,item:string):Dados` (só mexe no catálogo)

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `test-catalogos.mjs`:

```js
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
// a contagem sai sempre dos dados passados, nunca de uma lista anterior
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
assert.equal(renomearItem(base,'funcoes','ARMADOR','armador').alterados,1,'muda só a grafia');
assert.equal(renomearItem(base,'funcoes','INEXISTENTE','OUTRA').alterados,0);

// lista da tela: grafias agrupadas e contagem de usos
const semeado=semearCatalogos(base);
const trechos=itensDoCatalogo(semeado,'trechos');
assert.equal(trechos.length,1,'uma entrada para as duas grafias');
assert.equal(trechos[0].grafias.length,2);
assert.equal(trechos[0].usos,2);
const lados=itensDoCatalogo(semeado,'lados');
assert.equal(lados.find(i=>i.texto==='LE').usos,1);
assert.equal(lados.find(i=>i.texto==='MD').usos,0,'semente sem uso');

// excluir mexe só no catálogo
const semLado=excluirItem(semeado,'lados','MD');
assert.ok(!catalogoDe(semLado.config,'lados').includes('MD'));
assert.equal(semLado.photos.length,2,'nenhum registro é apagado');
assert.deepEqual(semLado.config.equipe,semeado.config.equipe);
console.log('test-catalogos: usos e renomeação ok');
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --import tsx test-catalogos.mjs`
Expected: FAIL com `SyntaxError: ... does not provide an export named 'renomearItem'`.

- [ ] **Step 3: Implementar em `src/services/catalogos.ts`**

Acrescentar os auxiliares antes de `export const CATALOGOS`:

```ts
function comEquipe(d:Dados,fn:(m:EquipeMember)=>EquipeMember):Dados{
 const equipe=d.config.equipe;if(!equipe)return d;
 const members=equipe.members.map(fn);
 return members.some((m,i)=>m!==equipe.members[i])?{...d,config:{...d.config,equipe:{...equipe,members}}}:d;
}
const ultimaEquipe=(meses:Record<string,string>)=>{
 const k=Object.keys(meses).sort();return k.length?meses[k[k.length-1]]:undefined;
};
```

Substituir os cinco catálogos de cadastro pelos definitivos:

```ts
 {id:'equipes',rotulo:'Equipes',singular:'equipe',tela:'equipe',
  sementes:['TERRAPLENAGEM','DRENAGEM','PAVIMENTAÇÃO','CONTENÇÃO E ESTRUTURAS','SINALIZAÇÃO E SEGURANÇA','ADMINISTRAÇÃO'],
  valores:d=>(d.config.equipe?.members||[]).flatMap(m=>Object.values(m.meses||{})).map(texto).filter(Boolean),
  usos:(d,item)=>(d.config.equipe?.members||[])
   .filter(m=>Object.values(m.meses||{}).some(e=>chaveItem(e)===chaveItem(item)))
   .map(m=>({id:m.id,tela:'equipe' as const,descricao:m.nome})),
  renomear:(d,de,para)=>comEquipe(d,m=>{
   const meses={...(m.meses||{})};let mudou=false;
   for(const [mes,eq] of Object.entries(meses))if(chaveItem(eq)===chaveItem(de)){meses[mes]=para;mudou=true;}
   return mudou?{...m,meses,equipe:ultimaEquipe(meses)}:m;
  })},
 {id:'funcoes',rotulo:'Funções',singular:'função',tela:'equipe',
  sementes:['AJUDANTE GERAL','APONTADOR','ARMADOR','CARPINTEIRO','ENCARREGADO','MOTORISTA','OPERADOR','PEDREIRO','SERVENTE','TOPÓGRAFO','VIGIA','MECÂNICO','SOLDADOR','AUXILIAR DE LABORATÓRIO'],
  valores:d=>(d.config.equipe?.members||[]).flatMap(m=>[m.funcao,...(m.historicoFuncao||[]).flatMap(h=>[h.funcao,h.anterior])]).map(texto).filter(Boolean),
  usos:(d,item)=>(d.config.equipe?.members||[])
   .filter(m=>chaveItem(m.funcao)===chaveItem(item)||(m.historicoFuncao||[]).some(h=>chaveItem(h.funcao)===chaveItem(item)||chaveItem(h.anterior)===chaveItem(item)))
   .map(m=>({id:m.id,tela:'equipe' as const,descricao:m.nome})),
  renomear:(d,de,para)=>comEquipe(d,m=>{
   const k=chaveItem(de);let mudou=chaveItem(m.funcao)===k;
   const historicoFuncao=(m.historicoFuncao||[]).map(h=>{
    const f=chaveItem(h.funcao)===k,a=chaveItem(h.anterior)===k;
    if(!f&&!a)return h;mudou=true;
    return {...h,funcao:f?para:h.funcao,anterior:a?para:h.anterior};
   });
   if(!mudou)return m;
   return {...m,funcao:chaveItem(m.funcao)===k?para:m.funcao,...(m.historicoFuncao?{historicoFuncao}:{})};
  })},
 {id:'equipamentos',rotulo:'Equipamentos',singular:'equipamento',tela:'equipamentos',
  sementes:['ESCAVADEIRA HIDRÁULICA','RETROESCAVADEIRA','MOTONIVELADORA','ROLO COMPACTADOR','TRATOR DE ESTEIRA','CAMINHÃO BASCULANTE','CAMINHÃO PIPA','PÁ CARREGADEIRA'],
  valores:d=>(d.config.equipamentos?.items||[]).map(i=>texto(i.nome)).filter(Boolean),
  usos:(d,item)=>(d.config.equipamentos?.items||[]).filter(i=>chaveItem(i.nome)===chaveItem(item))
   .map(i=>({id:i.id,tela:'equipamentos' as const,descricao:[i.nome,i.placa].filter(Boolean).join(' · ')})),
  renomear:(d,de,para)=>{
   const eq=d.config.equipamentos;if(!eq)return d;
   const k=chaveItem(de);
   const items=eq.items.map(i=>chaveItem(i.nome)===k?{...i,nome:para}:i);
   // efetivo is keyed by the equipment name: move the key and add up when the target already exists.
   const antigo=texto(de).toUpperCase(),novo=texto(para).toUpperCase();
   const efetivo:typeof eq.efetivo={};
   for(const [data,dia] of Object.entries(eq.efetivo||{})){
    const copia={...dia};
    if(copia[antigo]!==undefined&&antigo!==novo){copia[novo]=(copia[novo]||0)+copia[antigo];delete copia[antigo];}
    efetivo[data]=copia;
   }
   if(!items.some((i,n)=>i!==eq.items[n])&&antigo===novo)return d;
   return {...d,config:{...d.config,equipamentos:{items,efetivo}}};
  }},
 {id:'placas',rotulo:'Placas e tags',singular:'placa',tela:'equipamentos',sementes:[],
  valores:d=>(d.config.equipamentos?.items||[]).map(i=>texto(i.placa)).filter(Boolean),
  usos:(d,item)=>(d.config.equipamentos?.items||[]).filter(i=>chaveItem(i.placa)===chaveItem(item))
   .map(i=>({id:i.id,tela:'equipamentos' as const,descricao:[i.nome,i.placa].filter(Boolean).join(' · ')})),
  renomear:(d,de,para)=>{
   const eq=d.config.equipamentos;if(!eq)return d;
   const items=eq.items.map(i=>chaveItem(i.placa)===chaveItem(de)?{...i,placa:para}:i);
   return items.some((i,n)=>i!==eq.items[n])?{...d,config:{...d.config,equipamentos:{...eq,items}}}:d;
  }},
 {id:'acoes',rotulo:'Ações corretivas',singular:'ação',tela:'acoes',sementes:[],
  valores:d=>(d.config.acoes||[]).map(a=>texto(a.acao)).filter(Boolean),
  usos:(d,item)=>(d.config.acoes||[]).filter(a=>chaveItem(a.acao)===chaveItem(item))
   .map(a=>({id:a.id,tela:'acoes' as const,descricao:[a.rnf,a.acao].filter(Boolean).join(' · ')})),
  renomear:(d,de,para)=>{
   const acoes=(d.config.acoes||[]).map(a=>chaveItem(a.acao)===chaveItem(de)?{...a,acao:para}:a);
   return acoes.some((a,i)=>a!==(d.config.acoes||[])[i])?{...d,config:{...d.config,acoes}}:d;
  }},
```

Trocar a entrada de `categorias` na lista por uma versão que também cuida das tags:

```ts
 (()=>{const base=catalogoDeFoto('categorias','Categorias','categoria','categoria',['Terraplenagem','Drenagem e Obras de Arte','Pavimentação','Contenção e Estruturas','Sinalização e Segurança','Geral']);
  return {...base,renomear:(d:Dados,de:string,para:string)=>{
   const r=base.renomear(d,de,para);
   // The categoria is the photo's tag when it has none of its own, so the tag catalog follows it.
   const cat=r.config.tagCatalog;
   if(!cat||!cat.some(t=>chaveItem(t)===chaveItem(de)))return r;
   const tagCatalog=cat.map(t=>chaveItem(t)===chaveItem(de)?para:t)
    .filter((t,i,a)=>a.findIndex(x=>chaveItem(x)===chaveItem(t))===i);
   return {...r,config:{...r.config,tagCatalog}};
  }};})(),
```

Acrescentar ao fim do arquivo:

```ts
export function renomearItem(d:Dados,id:CatalogoId,de:string,para:string){
 const novo=texto(para);
 if(!novo||!texto(de))return {dados:d,alterados:0};
 const c=catalogoPorId(id);
 const alterados=c.usos(d,de).length;
 const comRegistros=c.renomear(d,de,novo);
 const atuais=catalogoDe(comRegistros.config,id);
 const itens=atuais.map(x=>chaveItem(x)===chaveItem(de)?novo:x)
  .filter((x,i,a)=>a.findIndex(y=>chaveItem(y)===chaveItem(x))===i);
 const comItem=atuais.some(x=>chaveItem(x)===chaveItem(novo))||atuais.some(x=>chaveItem(x)===chaveItem(de))
  ?itens:[...itens,novo];
 return {dados:{...comRegistros,config:{...comRegistros.config,catalogos:{...(comRegistros.config.catalogos||{}),[id]:comItem}}},alterados};
}

export function itensDoCatalogo(d:Dados,id:CatalogoId){
 const c=catalogoPorId(id);
 const grupos=new Map<string,{texto:string;grafias:string[];usos:number}>();
 const ver=(t:string)=>{
  const k=chaveItem(t);if(!k)return;
  const g=grupos.get(k)||{texto:t,grafias:[],usos:0};
  if(!g.grafias.some(x=>x===t))g.grafias.push(t);
  grupos.set(k,g);
 };
 catalogoDe(d.config,id).forEach(ver);
 c.valores(d).forEach(ver);
 for(const [k,g] of grupos)g.usos=c.usos(d,g.texto).length;
 return [...grupos.values()].sort((a,b)=>a.texto.localeCompare(b.texto,'pt-BR'));
}

export function excluirItem(d:Dados,id:CatalogoId,item:string):Dados{
 const itens=catalogoDe(d.config,id).filter(x=>chaveItem(x)!==chaveItem(item));
 return {...d,config:{...d.config,catalogos:{...(d.config.catalogos||{}),[id]:itens}}};
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx tsc --noEmit && node --import tsx test-catalogos.mjs`
Expected: `test-catalogos: base ok` e `test-catalogos: usos e renomeação ok`.

---

### Task 3: Servidor — validação, motivo de backup e catálogos de outra obra

**Files:**
- Modify: `codigo-fonte/server.ts` (função `valid`)
- Modify: `codigo-fonte/reliability.ts` (rota `POST /api/backups`)
- Modify: `codigo-fonte/obras.ts` (rota nova)
- Modify: `codigo-fonte/test-pastas-backups.mjs`, `codigo-fonte/test-obras.mjs`

**Interfaces:**
- Produces: `GET /api/obras/:id/catalogos` → `{catalogos}`; `POST /api/backups` aceita `antes-de-editar-catalogo`; `PUT /api/project` recusa catálogo inválido.

- [ ] **Step 1: Escrever os testes que falham**

Em `test-pastas-backups.mjs`, antes de `}finally{await stop();}`:

```js
 const bc=await request('/api/backups','POST',{reason:'antes-de-editar-catalogo'},await headers());
 assert.equal(bc.status,200,bc.data&&bc.data.error);
 assert.ok((await request('/api/backups')).data.items.some(b=>b.id===bc.data.id&&b.reason==='antes-de-editar-catalogo'),'backup antes de editar catálogo');
```

Em `test-obras.mjs`, antes de `}finally{await stop();}`:

```js
 // catálogos de outra obra
 const comCat={version:1,config:{contrato:'Com catálogo',rodoviaPadrao:'PR-900',catalogos:{funcoes:['SOLDADOR ESPECIAL']}},photos:[],drafts:[]};
 const baseCat=path.join(home,'com-catalogo');
 x=await request('/api/obras/import','POST',{revision:(await workspace()).revision,nome:'Com Catalogo',path:baseCat,project:comCat});
 assert.equal(x.status,201,x.data&&x.data.error);
 const obraCat=x.data.obra;
 x=await request(`/api/obras/${obraCat.id}/catalogos`);
 assert.equal(x.status,200,x.data&&x.data.error);
 assert.ok(x.data.catalogos.funcoes.includes('SOLDADOR ESPECIAL'),'catálogo salvo');
 assert.ok(x.data.catalogos.rodovias.includes('PR-900'),'valores em uso entram na leitura');
 assert.equal((await request('/api/obras/inexistente/catalogos')).status,404);

 // projeto com catálogo inválido é recusado
 const w2=await workspace();
 const ruim={version:1,config:{contrato:'x',catalogos:{funcoes:[123]}},photos:[],drafts:[]};
 assert.equal((await request('/api/project','PUT',ruim,{'X-Workspace-Revision':w2.revision,'X-Project-Revision':w2.contentRevision})).status,400,'catálogo com valor não textual é recusado');
 const bom={version:1,config:{contrato:'x',catalogos:{funcoes:['ARMADOR']}},photos:[],drafts:[]};
 assert.equal((await request('/api/project','PUT',bom,{'X-Workspace-Revision':w2.revision,'X-Project-Revision':w2.contentRevision})).status,200,'catálogo válido é aceito');
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `node build-tmp.mjs && node --import tsx test-pastas-backups.mjs; node --import tsx test-obras.mjs`
Expected: o primeiro falha em `backup antes de editar catálogo`; o segundo falha com status 404 na rota `/catalogos`.

- [ ] **Step 3: Implementar**

`reliability.ts`, na rota `POST /api/backups`, trocar a validação do motivo por:

```ts
  const MOTIVOS=['antes-de-importar-equipe','antes-de-editar-catalogo'];
  guard(q);const reason=q.body&&q.body.reason;
  if(reason!==undefined&&!MOTIVOS.includes(reason))throw Object.assign(new Error('Motivo de backup inválido.'),{status:400});
```

`server.ts`, acrescentar antes de `function valid`:

```ts
const CATALOGOS_IDS=['equipes','funcoes','equipamentos','placas','rodovias','trechos','estacas','lados','categorias','servicos','acoes'];
function validCatalogos(v:any){
 if(v===undefined)return true;
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return Object.entries(v).every(([k,itens]:any)=>CATALOGOS_IDS.includes(k)&&Array.isArray(itens)&&itens.length<=5000
  &&itens.every((t:any)=>typeof t==='string'&&t.trim().length>0&&t.length<=200));
}
```

e, dentro de `valid`, acrescentar à cadeia (depois da verificação de `tagCatalog`):

```ts
    && validCatalogos(v.config.catalogos)
```

`obras.ts`, acrescentar depois da rota `GET /api/obras/:id/backup`:

```ts
 app.get('/api/obras/:id/catalogos',(q:Request,r)=>{
  try{
   const o=load().items.find(i=>i.id===q.params.id);
   if(!o)throw fail(404,'Obra não encontrada na lista.');
   if(!dirState(o.path).hasProject)throw fail(400,'A obra não tem projeto disponível para ler os catálogos.');
   const project=ctx.readProject(o.path);
   r.json({catalogos:ctx.catalogosDe({config:project.config||{},photos:project.photos||[]})});
  }catch(e:any){r.status(e.status||400).json({error:ctx.report(e,'ler-catalogos-da-obra')});}
 });
```

No tipo `Ctx` de `obras.ts`, acrescentar `catalogosDe:(d:any)=>any;`.

`server.ts`, no `setupObras(...)`, acrescentar ao objeto de contexto:

```ts
catalogosDe:(d:any)=>semearCatalogos(d).config.catalogos||{},
```

e o import no topo: `import {semearCatalogos} from './src/services/catalogos';`

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx tsc --noEmit && node build-tmp.mjs && node --import tsx test-pastas-backups.mjs && node --import tsx test-obras.mjs`
Expected: as duas linhas `PASS:` ao fim de cada teste, sem AssertionError.

---

### Task 4: Componente de campo com catálogo

**Files:**
- Create: `codigo-fonte/src/components/CampoCatalogo.tsx`

**Interfaces:**
- Consumes: `CatalogoId`, `catalogoDe`, `chaveItem` (Tarefas 1 e 2).
- Produces: `CampoCatalogo(props)` com `{catalogo, config, valor, onChange, onAbrirCatalogo, rotulo?, placeholder?, className?, sugestoes?, onEscolherSugestao?, maiusculas?, disabled?, listaId?}`.

A interface não tem testes automatizados; a verificação é `tsc`, `vite build` e a conferência manual da Tarefa 10.

- [ ] **Step 1: Criar o componente**

```tsx
import React,{useId,useMemo} from 'react';
import {List} from 'lucide-react';
import type {ReportConfig} from '../types';
import {CatalogoId,catalogoDe,chaveItem} from '../services/catalogos';

export function CampoCatalogo({catalogo,config,valor,onChange,onAbrirCatalogo,rotulo,placeholder,className='',sugestoes,onEscolherSugestao,maiusculas,disabled,autoFocus}:{
 catalogo:CatalogoId;config:ReportConfig;valor:string;onChange:(v:string)=>void;onAbrirCatalogo?:(c:CatalogoId)=>void;
 rotulo?:string;placeholder?:string;className?:string;sugestoes?:string[];onEscolherSugestao?:(v:string)=>void;
 maiusculas?:boolean;disabled?:boolean;autoFocus?:boolean;
}){
 const listaId=useId();
 const itens=useMemo(()=>{
  const lista=catalogoDe(config,catalogo);
  const k=chaveItem(valor);
  // The typed text is not offered back to the user as a suggestion.
  return k?lista.filter(x=>chaveItem(x)!==k):lista;
 },[config.catalogos,catalogo,valor]);
 return <div className={className}>
  {rotulo&&<div className="flex items-center justify-between gap-1 mb-1">
   <span className="block text-xs font-semibold uppercase">{rotulo}</span>
   {onAbrirCatalogo&&<button type="button" className="text-slate-400 hover:text-emerald-700 p-0.5" title={`Administrar o catálogo de ${rotulo.toLowerCase()}`} onClick={()=>onAbrirCatalogo(catalogo)}><List className="w-3.5 h-3.5"/></button>}
  </div>}
  <input className={`w-full border p-2 rounded bg-white ${maiusculas?'uppercase':''}`} list={listaId} value={valor}
   onChange={e=>onChange(maiusculas?e.target.value.toLocaleUpperCase('pt-BR'):e.target.value)}
   placeholder={placeholder} disabled={disabled} autoFocus={autoFocus} aria-label={rotulo}/>
  <datalist id={listaId}>{itens.map(t=><option key={t} value={t}/>)}</datalist>
  {sugestoes&&sugestoes.length>0&&<div className="flex flex-wrap gap-1 mt-1">
   {sugestoes.map(s=><button type="button" key={s} className="text-[10px] bg-slate-100 hover:bg-emerald-100 border rounded px-1.5 py-0.5 text-left" onClick={()=>onEscolherSugestao?.(s)} title={s}>{s.length>48?s.slice(0,48)+'…':s}</button>)}
  </div>}
 </div>;
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit && npx vite build`
Expected: sem erros; `✓ built`.

---

### Task 5: Tela Catálogos e entrada no menu

**Files:**
- Create: `codigo-fonte/src/components/catalogos/CatalogosPage.tsx`
- Modify: `codigo-fonte/src/App.tsx`

**Interfaces:**
- Consumes: `CATALOGOS`, `itensDoCatalogo`, `renomearItem`, `excluirItem`, `registrarValor`, `semearCatalogos`, `catalogoPorId` (Tarefas 1-2); `POST /api/backups` (Tarefa 3).
- Produces: `CatalogosPage({config,photos,onAplicar,onCorrigir,flush,headers,inicial})`, onde `onAplicar(config,photos)` grava os dois e `onCorrigir({tela,ids,item})` dispara o "Corrigir agora" (ligado na Tarefa 8; aqui recebe uma função que apenas troca de aba).

- [ ] **Step 1: Criar a tela**

```tsx
import React,{useEffect,useMemo,useState} from 'react';
import {List,Plus,Pencil,Trash2,Check,X,Merge,AlertTriangle} from 'lucide-react';
import type {ReportConfig,PhotoRecord} from '../../types';
import {CATALOGOS,CatalogoId,Dados,Tela,catalogoPorId,itensDoCatalogo,renomearItem,excluirItem,registrarValor,semearCatalogos,catalogoDe} from '../../services/catalogos';

const botao='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold bg-white hover:bg-slate-100 disabled:opacity-50 inline-flex items-center gap-1';
const botaoPrimario=botao+' !bg-emerald-700 !text-white !border-emerald-700';
const semAcento=(v:string)=>v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('pt-BR');

export function CatalogosPage({config,photos,onAplicar,onCorrigir,flush,headers,inicial}:{
 config:ReportConfig;photos:PhotoRecord[];onAplicar:(c:ReportConfig,p:PhotoRecord[])=>void;
 onCorrigir:(c:{tela:Tela;ids:string[];item:string})=>void;flush:()=>Promise<unknown>;headers:()=>Record<string,string>;inicial?:CatalogoId;
}){
 const [atual,setAtual]=useState<CatalogoId>(inicial||'funcoes');
 const [busca,setBusca]=useState('');
 const [editando,setEditando]=useState<{de:string;texto:string}|null>(null);
 const [excluindo,setExcluindo]=useState<{item:string;usos:{id:string;descricao:string}[]}|null>(null);
 const [novo,setNovo]=useState('');
 const [erro,setErro]=useState('');const [aviso,setAviso]=useState('');const [ocupado,setOcupado]=useState(false);

 const dados=useMemo<Dados>(()=>({config,photos}),[config,photos]);
 // Fills every catalog from the records the first time the screen opens.
 useEffect(()=>{const s=semearCatalogos(dados);if(s!==dados)onAplicar(s.config,s.photos);},[]);

 const definicao=catalogoPorId(atual);
 const itens=useMemo(()=>itensDoCatalogo(dados,atual),[dados,atual]);
 const visiveis=useMemo(()=>{const t=semAcento(busca.trim());return t?itens.filter(i=>semAcento(i.texto).includes(t)):itens;},[itens,busca]);

 const comBackup=async(fn:()=>void,precisa:boolean)=>{
  setOcupado(true);setErro('');setAviso('');
  try{
   if(precisa){
    await flush();
    const r=await fetch('/api/backups',{method:'POST',headers:{'Content-Type':'application/json',...headers()},body:JSON.stringify({reason:'antes-de-editar-catalogo'})});
    if(!r.ok){const d:any=await r.json().catch(()=>({}));throw new Error('O backup antes da alteração falhou; nada foi alterado. '+(d.error||`HTTP ${r.status}`));}
   }
   fn();
  }catch(e:any){setErro(e?.message||'Erro desconhecido.');}finally{setOcupado(false);}
 };

 const salvarEdicao=async()=>{
  if(!editando)return;
  const usos=definicao.usos(dados,editando.de).length;
  await comBackup(()=>{
   const r=renomearItem(dados,atual,editando.de,editando.texto);
   onAplicar(r.dados.config,r.dados.photos);
   setEditando(null);
   setAviso(r.alterados?`${definicao.rotulo}: ${r.alterados} registro(s) atualizado(s).`:'Item renomeado no catálogo.');
  },usos>0);
 };
 const unificar=async(item:{texto:string;grafias:string[]})=>{
  const usos=definicao.usos(dados,item.texto).length;
  await comBackup(()=>{
   const r=renomearItem(dados,atual,item.grafias.find(g=>g!==item.texto)||item.texto,item.texto);
   onAplicar(r.dados.config,r.dados.photos);
   setAviso(`${definicao.rotulo}: grafias unificadas em "${item.texto}" (${r.alterados} registro(s)).`);
  },usos>0);
 };
 const pedirExclusao=(texto:string)=>{
  const usos=definicao.usos(dados,texto);
  if(!usos.length){
   if(!confirm(`Excluir "${texto}" do catálogo de ${definicao.rotulo.toLowerCase()}?`))return;
   const d=excluirItem(dados,atual,texto);onAplicar(d.config,d.photos);setAviso('Item excluído do catálogo.');return;
  }
  setExcluindo({item:texto,usos:usos.map(u=>({id:u.id,descricao:u.descricao}))});
 };
 const adicionar=()=>{
  const c=registrarValor(config,atual,novo);
  if(c===config){setErro('Informe um texto que ainda não esteja no catálogo.');return;}
  onAplicar(c,photos);setNovo('');setAviso('Item adicionado ao catálogo.');
 };

 return <div className="max-w-5xl mx-auto space-y-4">
  <div className="bg-white border rounded-xl p-4">
   <h2 className="text-xl font-bold flex items-center gap-2"><List className="w-5 h-5 text-emerald-700"/>Catálogos</h2>
   <p className="text-sm text-slate-600">Listas reaproveitadas nos campos do aplicativo. Editar um item corrige o texto em todos os registros que o usam. Excluir só tira da lista de sugestões: nenhum registro, foto ou arquivo é apagado.</p>
  </div>
  {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
  {aviso&&<p role="status" className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">{aviso}</p>}
  <div className="grid md:grid-cols-[220px_1fr] gap-4">
   <nav className="bg-white border rounded-xl p-2 h-fit" aria-label="Catálogos">
    {CATALOGOS.map(c=><button key={c.id} onClick={()=>{setAtual(c.id);setEditando(null);setBusca('');}}
     className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between gap-2 ${c.id===atual?'bg-emerald-700 text-white font-semibold':'hover:bg-slate-100'}`}>
     <span className="truncate">{c.rotulo}</span><span className="opacity-70">{catalogoDe(config,c.id).length}</span>
    </button>)}
   </nav>
   <section className="bg-white border rounded-xl p-4 space-y-3">
    <div className="flex flex-wrap gap-2">
     <input className="flex-1 min-w-[180px] border rounded-lg p-2 text-sm" placeholder={`Buscar em ${definicao.rotulo.toLowerCase()}`} value={busca} onChange={e=>setBusca(e.target.value)} aria-label="Buscar item"/>
     <input className="flex-1 min-w-[180px] border rounded-lg p-2 text-sm" placeholder={`Nova ${definicao.singular}`} value={novo} onChange={e=>setNovo(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')adicionar();}} aria-label="Novo item"/>
     <button className={botaoPrimario} disabled={!novo.trim()||ocupado} onClick={adicionar}><Plus className="w-4 h-4"/> Adicionar</button>
    </div>
    {!visiveis.length&&<p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">{itens.length?'Nenhum item corresponde à busca.':'Catálogo vazio.'}</p>}
    <ul className="divide-y">
     {visiveis.map(item=><li key={item.texto} className="py-2 flex flex-wrap items-center gap-2">
      {editando?.de===item.texto
       ?<>
         <input className="flex-1 min-w-[200px] border rounded-lg p-2 text-sm" value={editando.texto} autoFocus
          onChange={e=>setEditando({...editando,texto:e.target.value})}
          onKeyDown={e=>{if(e.key==='Enter')salvarEdicao();if(e.key==='Escape')setEditando(null);}} aria-label="Novo texto do item"/>
         <button className={botao} disabled={ocupado||!editando.texto.trim()} onClick={salvarEdicao}><Check className="w-4 h-4"/></button>
         <button className={botao} disabled={ocupado} onClick={()=>setEditando(null)}><X className="w-4 h-4"/></button>
        </>
       :<>
         <span className="flex-1 min-w-[200px] text-sm">{item.texto}
          {item.grafias.length>1&&<span className="ml-2 text-[10px] bg-amber-100 text-amber-900 rounded px-1.5 py-0.5">{item.grafias.length} grafias</span>}
         </span>
         <span className="text-xs text-slate-500 w-28">{item.usos?`${item.usos} registro(s)`:'sem uso'}</span>
         {item.grafias.length>1&&<button className={botao} disabled={ocupado} title={`Adotar "${item.texto}" em todos`} onClick={()=>unificar(item)}><Merge className="w-4 h-4"/> Unificar</button>}
         <button className={botao} disabled={ocupado} onClick={()=>setEditando({de:item.texto,texto:item.texto})}><Pencil className="w-4 h-4"/></button>
         <button className={botao+' !border-red-300 text-red-600'} disabled={ocupado} onClick={()=>pedirExclusao(item.texto)}><Trash2 className="w-4 h-4"/></button>
        </>}
     </li>)}
    </ul>
   </section>
  </div>

  {excluindo&&<div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Exclusão bloqueada">
   <div className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
    <h3 className="text-lg font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600"/>Item em uso</h3>
    <p className="text-sm">"{excluindo.item}" é usado por <strong>{excluindo.usos.length} registro(s)</strong> e por isso não pode ser excluído. Corrija os registros primeiro; depois a exclusão passa.</p>
    <ul className="text-sm list-disc pl-5 max-h-48 overflow-y-auto">
     {excluindo.usos.slice(0,20).map(u=><li key={u.id}>{u.descricao}</li>)}
     {excluindo.usos.length>20&&<li>… e mais {excluindo.usos.length-20}.</li>}
    </ul>
    <div className="flex justify-end gap-2">
     <button className={botao} onClick={()=>setExcluindo(null)}>Cancelar</button>
     <button className={botaoPrimario} onClick={()=>{onCorrigir({tela:definicao.tela,ids:excluindo.usos.map(u=>u.id),item:excluindo.item});setExcluindo(null);}}>Corrigir agora</button>
    </div>
   </div>
  </div>}
 </div>;
}
```

- [ ] **Step 2: Ligar no `App.tsx`**

1. Imports: `import {CatalogosPage} from './components/catalogos/CatalogosPage';`, `import {List} from 'lucide-react'` (acrescentar `List` à lista existente) e `import type {CatalogoId,Tela} from './services/catalogos';`.
2. Estado novo, junto aos demais: 

```tsx
 const [catalogoInicial,setCatalogoInicial]=useState<CatalogoId|undefined>(undefined);
 const [correcao,setCorrecao]=useState<{tela:Tela;ids:string[];item:string}|null>(null);
 const abrirCatalogo=(c:CatalogoId)=>{setCatalogoInicial(c);setTab('catalogos');};
```

3. Em `TABS`, acrescentar antes de Configurações: `  { id: 'catalogos', label: 'Catálogos', icon: List },`
4. No conteúdo das abas, antes de `{tab==='configuracoes'&&...}`:

```tsx
      {tab==='catalogos'&&<CatalogosPage config={config} photos={photos} inicial={catalogoInicial}
        onAplicar={(c,p)=>{setConfig(c);setPhotos(p);}}
        onCorrigir={c=>{setCorrecao(c);setTab(c.tela==='fotos'?'manager':c.tela);}}
        flush={flush} headers={()=>({'X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current})}/>}
```

- [ ] **Step 3: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 6: Campos com catálogo nas telas de cadastro

**Files:**
- Modify: `codigo-fonte/src/components/EquipePanel.tsx`
- Modify: `codigo-fonte/src/components/EquipamentosPanel.tsx`
- Modify: `codigo-fonte/src/components/AcoesCorretivasPanel.tsx`
- Modify: `codigo-fonte/src/App.tsx` (passar `onAbrirCatalogo` aos três painéis)

**Interfaces:**
- Consumes: `CampoCatalogo` (Tarefa 4), `registrarValores` (Tarefa 1).
- Produces: os três painéis aceitam `onAbrirCatalogo?:(c:CatalogoId)=>void` e registram no catálogo o que for gravado.

- [ ] **Step 1: Equipe Técnica**

Em `EquipePanel.tsx`:
1. Imports: `import {CampoCatalogo} from './CampoCatalogo';` e `import {registrarValores,CatalogoId} from '../services/catalogos';`
2. Props: acrescentar `onAbrirCatalogo`:

```tsx
export function EquipePanel({config,onChange,flush,headers,onAbrirCatalogo}:{config:ReportConfig;onChange:(c:Partial<ReportConfig>)=>void;flush:()=>Promise<unknown>;headers:()=>Record<string,string>;onAbrirCatalogo?:(c:CatalogoId)=>void}){
```

3. Substituir os dois `<datalist>` do topo do JSX por nada (as listas passam a vir do catálogo) e trocar os campos de equipe e função do formulário de inclusão por:

```tsx
    <CampoCatalogo className="w-48" catalogo="equipes" config={config} valor={novo.equipe} maiusculas
     rotulo={`Equipe em ${rotulo}`} placeholder="Ex: DRENAGEM" onAbrirCatalogo={onAbrirCatalogo}
     onChange={v=>setNovo({...novo,equipe:v})}/>
```

e

```tsx
    <CampoCatalogo className="flex-1 min-w-[200px]" catalogo="funcoes" config={config} valor={novo.funcao} maiusculas
     rotulo="Função" onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setNovo({...novo,funcao:v})}/>
```

4. Nos campos da tabela, trocar o `input` com `list="funcao-suggestions"` da edição por `<CampoCatalogo catalogo="funcoes" .../>` com `valor={editando.funcao}` e `onChange={v=>setEditando({...editando,funcao:v})}`; e o `input` com `list="equipe-suggestions"` da coluna de equipe por um `CampoCatalogo` com `catalogo="equipes"`, `valor` local e `onChange` chamando `trocarEquipe(m,v)` no `onBlur` — manter o comportamento atual de gravar ao sair do campo usando um estado local `rascunhoEquipe`.
5. Registrar no catálogo ao gravar. Acrescentar o auxiliar ao lado de `salvar`:

```tsx
 const salvarCom=(next:EquipeConfig,pares:[CatalogoId,string][])=>
  onChange({equipe:next,catalogos:registrarValores(config,pares).catalogos});
```

e trocar a chamada final de cada função: em `adicionar`, `salvarCom(next,[['equipes',equipe],['funcoes',funcao]])`; em `salvarEdicao`, `salvarCom(next,[['funcoes',funcao]])`; em `trocarEquipe`, `salvarCom(next,[['equipes',eq]])`. As demais chamadas de `salvar` (presença, remoção, ordenação) continuam como estão.
6. Em `aplicar` (importação da planilha), registrar os textos importados:

```tsx
  const cfgCom=registrarValores(config,[...previa.pares.map(p=>['funcoes',p.linha.funcao] as [CatalogoId,string]),
   ...previa.novas.map(l=>['funcoes',l.funcao] as [CatalogoId,string]),
   ...previa.meses.flatMap(mes=>[...previa.pares.map(p=>['equipes',p.linha.meses[mes]] as [CatalogoId,string]),...previa.novas.map(l=>['equipes',l.meses[mes]] as [CatalogoId,string])])]);
  onChange({equipe:aplicarPrevia(cfg,previa,escolhas),catalogos:cfgCom.catalogos});
```

- [ ] **Step 2: Equipamentos**

Em `EquipamentosPanel.tsx`:
1. Mesmos imports e a prop `onAbrirCatalogo`.
2. Apagar `tagSuggestions`, `placaSuggestions` e os dois `<datalist>`.
3. Trocar os quatro `input` (nome e placa, no formulário e na edição da tabela) por `CampoCatalogo` com `catalogo="equipamentos"` e `catalogo="placas"`, `maiusculas` nos dois.
4. Em `addItem` e `saveEdit`, trocar `onChange({equipamentos:...})` por

```tsx
    onChange({equipamentos:{items:nextItems,efetivo:nextEfetivo},catalogos:registrarValores(config,[['equipamentos',nome],['placas',placa]]).catalogos});
```

usando os valores já normalizados daquela função.

- [ ] **Step 3: Ações Corretivas**

Em `AcoesCorretivasPanel.tsx`: mesma prop e import; trocar o `input` da ação por `CampoCatalogo catalogo="acoes"`; em `addItem`, trocar `onChange({acoes:nextItems})` por

```tsx
    onChange({acoes:nextItems,catalogos:registrarValores(config,[['acoes',newItem.acao]]).catalogos});
```

- [ ] **Step 4: Passar a função no `App.tsx`**

Acrescentar `onAbrirCatalogo={abrirCatalogo}` nas três linhas de `EquipePanel`, `EquipamentosPanel` e `AcoesCorretivasPanel`.

- [ ] **Step 5: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 7: Campos com catálogo nas fotos e nas configurações

**Files:**
- Modify: `codigo-fonte/src/components/PhotoUploader.tsx`
- Modify: `codigo-fonte/src/components/PhotoList.tsx`
- Modify: `codigo-fonte/src/components/SettingsModal.tsx`
- Modify: `codigo-fonte/src/App.tsx`

**Interfaces:**
- Consumes: `CampoCatalogo`, `registrarValores`.
- Produces: os campos de foto passam a existir nas duas telas (4.3 da especificação).

- [ ] **Step 1: Importar fotos**

Em `PhotoUploader.tsx`:
1. Acrescentar `import {CampoCatalogo} from './CampoCatalogo';` e `import {registrarValores,CatalogoId} from '../services/catalogos';`, e a prop `onAbrirCatalogo?:(c:CatalogoId)=>void`.
2. No editor de cada foto em preparação, substituir o `select` de **Lado** e os `input` de **Rodovia** e **Trecho** pelos quatro campos abaixo (os dois últimos são novos), mantendo as classes de largura que já existem em volta:

```tsx
 <CampoCatalogo catalogo="lados" config={config} valor={photo.lado} rotulo="Lado" maiusculas
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>handleUpdateStaged(photo.id,'lado',v)}/>
 <CampoCatalogo catalogo="rodovias" config={config} valor={photo.rodovia} rotulo="Rodovia"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>handleUpdateStaged(photo.id,'rodovia',v)}/>
 <CampoCatalogo catalogo="trechos" config={config} valor={photo.trecho} rotulo="Trecho"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>handleUpdateStaged(photo.id,'trecho',v)}/>
 <CampoCatalogo catalogo="estacas" config={config} valor={photo.estaca} rotulo="Estaca"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>handleUpdateStaged(photo.id,'estaca',v)}/>
 <CampoCatalogo catalogo="categorias" config={config} valor={photo.categoria} rotulo="Categoria"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>handleUpdateStaged(photo.id,'categoria',v)}/>
```

3. Substituir o `input` da **Descrição do Serviço** e o bloco de botões de sugestão que vem logo abaixo dele por um único campo que preserva as três sugestões:

```tsx
 <CampoCatalogo catalogo="servicos" config={config} valor={photo.servico} rotulo="Descrição do Serviço"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>handleUpdateStaged(photo.id,'servico',v)}
  sugestoes={serviceSuggestions(photo.servico||'',descriptionCatalog,3)}
  onEscolherSugestao={v=>handleUpdateStaged(photo.id,'servico',v)}/>
```

4. Em `handleProcessAndSave`, antes de `onPhotosAdded(newRecords)`, registrar os textos:

```tsx
    if(onUpdateConfig){
     const pares=newRecords.flatMap(r=>[['rodovias',r.rodovia],['trechos',r.trecho],['estacas',r.estaca],['lados',r.lado],['categorias',r.categoria],['servicos',r.servico]] as [CatalogoId,string][]);
     onUpdateConfig({catalogos:registrarValores(config,pares).catalogos});
    }
```

- [ ] **Step 2: Gerenciar fotos**

Em `PhotoList.tsx`:
1. Acrescentar `import {CampoCatalogo} from './CampoCatalogo';` e `import {registrarValores,CatalogoId} from '../services/catalogos';`, e a prop `onAbrirCatalogo?:(c:CatalogoId)=>void`.
2. No formulário de edição da foto, substituir o `input` de estaca, o `select` de lado e o `input` de serviço (com o bloco de sugestões abaixo dele) por:

```tsx
 <CampoCatalogo catalogo="estacas" config={config} valor={editForm.estaca||''} rotulo="Estaca"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setEditForm({...editForm,estaca:v})}/>
 <CampoCatalogo catalogo="lados" config={config} valor={editForm.lado||''} rotulo="Lado" maiusculas
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setEditForm({...editForm,lado:v})}/>
 <CampoCatalogo catalogo="rodovias" config={config} valor={editForm.rodovia||''} rotulo="Rodovia"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setEditForm({...editForm,rodovia:v})}/>
 <CampoCatalogo catalogo="trechos" config={config} valor={editForm.trecho||''} rotulo="Trecho"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setEditForm({...editForm,trecho:v})}/>
 <CampoCatalogo catalogo="categorias" config={config} valor={editForm.categoria||''} rotulo="Categoria"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setEditForm({...editForm,categoria:v})}/>
 <CampoCatalogo catalogo="servicos" config={config} valor={editForm.servico||''} rotulo="Descrição do Serviço"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setEditForm({...editForm,servico:v})}
  sugestoes={serviceIdeas} onEscolherSugestao={v=>setEditForm({...editForm,servico:v})}/>
```

3. Em `startEdit`, acrescentar `rodovia`, `trecho` e `categoria` ao `setEditForm({...})`, que hoje só carrega data, hora, estaca, lado, serviço e pasta.
4. Na função que salva a edição, logo após `onUpdatePhoto(...)`, registrar os textos:

```tsx
    onUpdateConfig?.({catalogos:registrarValores(config,[
     ['rodovias',editForm.rodovia],['trechos',editForm.trecho],['estacas',editForm.estaca],
     ['lados',editForm.lado],['categorias',editForm.categoria],['servicos',editForm.servico],
    ] as [CatalogoId,unknown][]).catalogos});
```

- [ ] **Step 3: Configurações do relatório**

Em `SettingsModal.tsx`, acrescentar os mesmos imports e a prop `onAbrirCatalogo?:(c:CatalogoId)=>void`, e substituir os dois `input` por:

```tsx
 <CampoCatalogo catalogo="rodovias" config={config} valor={form.rodoviaPadrao} rotulo="Rodovia padrão"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setForm({...form,rodoviaPadrao:v})}/>
 <CampoCatalogo catalogo="trechos" config={config} valor={form.trechoPadrao} rotulo="Trecho padrão"
  onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setForm({...form,trechoPadrao:v})}/>
```

e, na função que grava as configurações, passar adiante também os catálogos:

```tsx
    onSave({...form,catalogos:registrarValores(config,[['rodovias',form.rodoviaPadrao],['trechos',form.trechoPadrao]]).catalogos});
```

- [ ] **Step 4: Passar a função no `App.tsx`**

Acrescentar `onAbrirCatalogo={abrirCatalogo}` em `PhotoUploader`, `PhotoList` e `SettingsModal`.

- [ ] **Step 5: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 8: "Corrigir agora"

**Files:**
- Modify: `codigo-fonte/src/App.tsx`
- Modify: `codigo-fonte/src/components/PhotoList.tsx`
- Modify: `codigo-fonte/src/components/EquipePanel.tsx`, `EquipamentosPanel.tsx`, `AcoesCorretivasPanel.tsx`

**Interfaces:**
- Consumes: `correcao` em `App.tsx` (Tarefa 5).
- Produces: cada tela recebe `correcao?:{ids:string[];item:string}` e `onLimparCorrecao?:()=>void`, mostra a faixa e filtra.

- [ ] **Step 1: Faixa reaproveitável**

Criar `codigo-fonte/src/components/FaixaCorrecao.tsx`:

```tsx
import React from 'react';
import {AlertTriangle} from 'lucide-react';

export function FaixaCorrecao({quantidade,item,onLimpar}:{quantidade:number;item:string;onLimpar:()=>void}){
 return <p role="status" className="text-sm bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg flex flex-wrap items-center gap-2">
  <AlertTriangle className="w-4 h-4"/>
  <span>Mostrando <strong>{quantidade}</strong> registro(s) que usam <strong>{item}</strong>. Corrija-os para liberar a exclusão no catálogo.</span>
  <button className="underline font-semibold" onClick={onLimpar}>Limpar filtro</button>
 </p>;
}
```

- [ ] **Step 2: Repassar no `App.tsx`**

Passar a cada painel, quando `correcao?.tela` corresponder:

```tsx
 const correcaoDe=(tela:Tela)=>correcao&&correcao.tela===tela?{ids:correcao.ids,item:correcao.item}:undefined;
 const limparCorrecao=()=>setCorrecao(null);
```

e acrescentar `correcao={correcaoDe('fotos')} onLimparCorrecao={limparCorrecao}` em `PhotoList`, `correcaoDe('equipe')` em `EquipePanel`, `correcaoDe('equipamentos')` em `EquipamentosPanel` e `correcaoDe('acoes')` em `AcoesCorretivasPanel`. Trocar de aba pelo menu limpa a correção: no `onClick` dos botões de `TABS`, acrescentar `setCorrecao(null);`.

- [ ] **Step 3: Aplicar o filtro em cada painel**

Em cada um dos quatro painéis: aceitar as duas props, renderizar `<FaixaCorrecao quantidade={lista.length} item={correcao.item} onLimpar={onLimparCorrecao}/>` no topo quando `correcao` existir, e filtrar a lista exibida por `correcao.ids`:
- `PhotoList`: aplicar sobre a lista já filtrada, antes da paginação (`const idsCorrecao=new Set(correcao?.ids||[])` e, quando houver, `.filter(p=>idsCorrecao.has(p.id))`).
- `EquipePanel`: filtrar `cadastro` (a tabela do cadastro).
- `EquipamentosPanel`: filtrar `items` exibidos na tabela.
- `AcoesCorretivasPanel`: filtrar `items` da tabela.

- [ ] **Step 4: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 9: Trazer catálogo de outra obra

**Files:**
- Create: `codigo-fonte/src/components/catalogos/TrazerDeOutraObra.tsx`
- Modify: `codigo-fonte/src/components/catalogos/CatalogosPage.tsx`

**Interfaces:**
- Consumes: `GET /api/obras/:id/catalogos` (Tarefa 3), `obrasApi.listar` (de `src/services/obrasApi.ts`), `registrarValor`.

- [ ] **Step 1: Criar o diálogo**

```tsx
import React,{useEffect,useState} from 'react';
import type {ReportConfig} from '../../types';
import {obrasApi,ObraRow} from '../../services/obrasApi';
import {CATALOGOS,CatalogoId,registrarValor} from '../../services/catalogos';

const botao='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold bg-white hover:bg-slate-100 disabled:opacity-50';

export function TrazerDeOutraObra({config,onAplicar,onFechar}:{config:ReportConfig;onAplicar:(c:ReportConfig,resumo:string)=>void;onFechar:()=>void}){
 const [obras,setObras]=useState<ObraRow[]>([]);
 const [obraId,setObraId]=useState('');
 const [escolhidos,setEscolhidos]=useState<Set<CatalogoId>>(new Set(CATALOGOS.map(c=>c.id)));
 const [erro,setErro]=useState('');const [ocupado,setOcupado]=useState(false);
 useEffect(()=>{obrasApi.listar().then(l=>setObras(l.items.filter(o=>!o.active&&o.hasProject))).catch(e=>setErro(e.message));},[]);
 const alternar=(id:CatalogoId)=>{const n=new Set(escolhidos);n.has(id)?n.delete(id):n.add(id);setEscolhidos(n);};
 const trazer=async()=>{
  setOcupado(true);setErro('');
  try{
   const r=await fetch(`/api/obras/${obraId}/catalogos`);
   const d:any=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.error||`Não foi possível ler os catálogos (HTTP ${r.status}).`);
   let c=config;let n=0;
   for(const id of CATALOGOS.map(x=>x.id))if(escolhidos.has(id))for(const t of d.catalogos?.[id]||[]){const antes=c;c=registrarValor(c,id,t);if(c!==antes)n++;}
   onAplicar(c,`${n} item(ns) trazido(s) de "${obras.find(o=>o.id===obraId)?.nome}".`);
  }catch(e:any){setErro(e?.message||'Erro desconhecido.');}finally{setOcupado(false);}
 };
 return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Trazer catálogo de outra obra">
  <div className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
   <h3 className="text-lg font-bold">Trazer catálogo de outra obra</h3>
   <p className="text-sm text-slate-600">Os itens são acrescentados aos catálogos desta obra. Nada é removido, renomeado, e nenhum registro é alterado.</p>
   <label className="block text-sm font-semibold">Obra de origem
    <select className="block w-full border rounded-lg p-2 mt-1 font-normal" value={obraId} onChange={e=>setObraId(e.target.value)}>
     <option value="">Escolha…</option>
     {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
    </select>
   </label>
   <div className="grid grid-cols-2 gap-1 text-sm">
    {CATALOGOS.map(c=><label key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={escolhidos.has(c.id)} onChange={()=>alternar(c.id)}/> {c.rotulo}</label>)}
   </div>
   {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
   <div className="flex justify-end gap-2">
    <button className={botao} disabled={ocupado} onClick={onFechar}>Cancelar</button>
    <button className={botao+' !bg-emerald-700 !text-white !border-emerald-700'} disabled={ocupado||!obraId||!escolhidos.size} onClick={trazer}>{ocupado?'Trazendo…':'Trazer'}</button>
   </div>
  </div>
 </div>;
}
```

- [ ] **Step 2: Ligar na tela Catálogos**

Em `CatalogosPage.tsx`: importar o diálogo, acrescentar `const [trazendo,setTrazendo]=useState(false);`, um botão `Trazer catálogo de outra obra` na barra do topo e, ao fim do JSX:

```tsx
  {trazendo&&<TrazerDeOutraObra config={config} onFechar={()=>setTrazendo(false)} onAplicar={(c,resumo)=>{onAplicar(c,photos);setTrazendo(false);setAviso(resumo);}}/>}
```

- [ ] **Step 3: Verificar compilação e suíte**

Run: `npx tsc --noEmit && npx vite build && node build-tmp.mjs && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done`
Expected: sem erros; nenhuma linha `FALHOU`.

---

### Task 10: Versão, documentação, distribuição e conferência

**Files:**
- Modify: `codigo-fonte/version.ts`, `desktop-launcher.cjs`, `codigo-fonte/package.json`
- Create: `RDO-V1.12.0-ALTERAÇÕES.md` (raiz)
- Modify: `LEIA-ME.txt` (raiz)
- Modify: `dist/` (raiz)

- [ ] **Step 1: Versão**

- `codigo-fonte/version.ts`: `export const VERSION='1.12.0-catalogos';`
- `desktop-launcher.cjs`: `VERSAO 1.12.0 - ...` e `const EXPECTED_VERSION = '1.12.0-catalogos';`
- `codigo-fonte/package.json`: `"version": "1.12.0",`

- [ ] **Step 2: Documentação**

`RDO-V1.12.0-ALTERAÇÕES.md` no formato dos anteriores, com: o que é o catálogo e quais são os onze; cadastro pelo campo e pela tela; edição que corrige todos os registros (com backup automático e aviso de quantos); exclusão bloqueada com "Corrigir agora"; unificação de grafias; trazer catálogo de outra obra; campos novos nas telas de fotos (estaca e categoria na importação; rodovia, trecho e categoria na edição); Uso; Arquivos alterados; Verificação.

No `LEIA-ME.txt`, seção curta sem acentos, logo após a da equipe: o que é a tela Catálogos, que editar corrige todos os registros, que excluir não apaga registro e fica bloqueado enquanto houver uso, e o teste `node --import tsx test-catalogos.mjs`.

- [ ] **Step 3: Reconstruir e sincronizar**

Run (em `codigo-fonte`):

```bash
npx tsc --noEmit && npx vite build && node build-tmp.mjs \
 && for t in test-*.mjs; do node --import tsx $t || echo "FALHOU $t"; done \
 && cp -r dist/. ../dist/ \
 && for f in ../dist/assets/*; do [ -e "dist/assets/$(basename "$f")" ] || rm "$f"; done \
 && rm -f ../dist/server.cjs.map \
 && (cd dist && find . -type f -exec md5sum {} + | sort -k2) > /tmp/a.txt \
 && (cd ../dist && find . -type f -exec md5sum {} + | sort -k2) > /tmp/b.txt \
 && diff /tmp/a.txt /tmp/b.txt && echo "dist sincronizado" \
 && grep -c "1.12.0-catalogos" dist/server.cjs
```

Expected: nenhuma linha `FALHOU`; `dist sincronizado`; `1`.

- [ ] **Step 4: Conferência manual no Windows (com o usuário)**

1. Abrir **Catálogos**: os onze catálogos aparecem preenchidos a partir da obra (108 fotos).
2. Em **Trechos**, conferir a entrada com "2 grafias" e usar **Unificar**; confirmar que as 108 fotos ficam com a mesma grafia e que o aviso informa a quantidade.
3. Editar uma **função** usada por alguém e conferir o aviso com a quantidade e o backup criado em Backup e Info.
4. Tentar excluir um item em uso: conferir a lista, usar **Corrigir agora**, ver a faixa na tela de destino e o filtro aplicado.
5. Digitar uma **equipe nova** direto no campo da Equipe Técnica, salvar e conferir que ela aparece no catálogo.
6. Na importação de fotos, conferir os campos novos **Estaca** e **Categoria**; na edição da foto, **Rodovia**, **Trecho** e **Categoria**.
7. **Trazer catálogo de outra obra** e conferir a contagem de itens trazidos.
