import type {ReportConfig,PhotoRecord,EquipeMember,CatalogoId} from '../types';

export type {CatalogoId};
export type Tela='fotos'|'equipe'|'equipamentos'|'acoes';
export type Dados={config:ReportConfig;photos:PhotoRecord[]};
export type Uso={id:string;tela:Tela;descricao:string};
export type DefinicaoCatalogo={
 id:CatalogoId;rotulo:string;singular:string;tela:Tela;sementes:string[];
 caixaAlta?:boolean;
 valores:(d:Dados)=>string[];
 tally?:(d:Dados)=>Map<string,number>;
 usos:(d:Dados,item:string)=>Uso[];
 renomear:(d:Dados,de:string,para:string)=>Dados;
};

export const chaveItem=(v:unknown)=>String(v??'')
 .normalize('NFD').replace(/[̀-ͯ]/g,'')
 .replace(/[‐-―]/g,'-')
 .replace(/\s+/g,' ').trim().toUpperCase();

const texto=(v:unknown)=>String(v??'').trim();
// The server refuses a project whose catalog breaks these limits, which would block every save.
export const LIMITE_TEXTO=500;
export const LIMITE_ITENS=5000;
const LIMITE_TAG=64;
const conta=(chaves:string[])=>{const m=new Map<string,number>();for(const k of chaves)if(k)m.set(k,(m.get(k)||0)+1);return m;};
const CAMPOS_FOTO=['rodovia','trecho','estaca','lado','categoria','servico'] as const;
type CampoFoto=typeof CAMPOS_FOTO[number];
type PadraoRelatorio='rodoviaPadrao'|'trechoPadrao';

function catalogoDeFoto(id:CatalogoId,rotulo:string,singular:string,campo:CampoFoto,sementes:string[]=[],padrao?:PadraoRelatorio):DefinicaoCatalogo{
 return {
  id,rotulo,singular,tela:'fotos',sementes,
  valores:d=>[...(d.photos||[]).map(p=>texto(p[campo])),...(padrao?[texto(d.config[padrao])]:[])].filter(Boolean),
  usos:(d,item)=>(d.photos||[]).filter(p=>chaveItem(p[campo])===chaveItem(item))
   .map(p=>({id:p.id,tela:'fotos' as const,descricao:[p.data,p.servico].filter(Boolean).join(' · ')||p.id})),
  tally:d=>conta((d.photos||[]).map(p=>chaveItem(p[campo]))),
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

function comEquipe(d:Dados,fn:(m:EquipeMember)=>EquipeMember):Dados{
 const equipe=d.config.equipe;if(!equipe)return d;
 const members=equipe.members.map(fn);
 return members.some((m,i)=>m!==equipe.members[i])?{...d,config:{...d.config,equipe:{...equipe,members}}}:d;
}
const ultimaEquipe=(meses:Record<string,string>)=>{
 const k=Object.keys(meses).sort();return k.length?meses[k[k.length-1]]:undefined;
};

const categorias=(()=>{
 const base=catalogoDeFoto('categorias','Categorias','categoria','categoria',['Terraplenagem','Drenagem e Obras de Arte','Pavimentação','Contenção e Estruturas','Sinalização e Segurança','Geral']);
 return {...base,renomear:(d:Dados,de:string,para:string)=>{
  const r=base.renomear(d,de,para);
  // The categoria is the photo's tag when it has none of its own, so the tag catalog follows it.
  const cat=r.config.tagCatalog;
  if(!cat||!cat.some(t=>chaveItem(t)===chaveItem(de))||para.length>LIMITE_TAG)return r;
  const tagCatalog=cat.map(t=>chaveItem(t)===chaveItem(de)?para:t)
   .filter((t,i,a)=>a.findIndex(x=>chaveItem(x)===chaveItem(t))===i);
  return {...r,config:{...r.config,tagCatalog}};
 }};
})();

export const CATALOGOS:DefinicaoCatalogo[]=[
 catalogoDeFoto('rodovias','Rodovias','rodovia','rodovia',[],'rodoviaPadrao'),
 catalogoDeFoto('trechos','Trechos','trecho','trecho',[],'trechoPadrao'),
 catalogoDeFoto('estacas','Estacas','estaca','estaca'),
 {...catalogoDeFoto('lados','Lados','lado','lado',['LD','LE','MD','ME','PISTA','AMBOS']),caixaAlta:true},
 categorias,
 catalogoDeFoto('servicos','Descrições de serviço','descrição','servico'),
 {id:'equipes',rotulo:'Equipes',singular:'equipe',tela:'equipe',caixaAlta:true,
  sementes:['TERRAPLENAGEM','DRENAGEM','PAVIMENTAÇÃO','CONTENÇÃO E ESTRUTURAS','SINALIZAÇÃO E SEGURANÇA','ADMINISTRAÇÃO'],
  valores:d=>(d.config.equipe?.members||[]).flatMap(m=>Object.values(m.meses||{})).map(texto).filter(Boolean),
  usos:(d,item)=>(d.config.equipe?.members||[])
   .filter(m=>Object.values(m.meses||{}).some(e=>chaveItem(e)===chaveItem(item)))
   .map(m=>({id:m.id,tela:'equipe' as const,descricao:m.nome})),
  tally:d=>conta((d.config.equipe?.members||[]).flatMap(m=>[...new Set(Object.values(m.meses||{}).map(chaveItem))])),
  renomear:(d,de,para)=>comEquipe(d,m=>{
   const meses={...(m.meses||{})};let mudou=false;
   for(const [mes,eq] of Object.entries(meses))if(chaveItem(eq)===chaveItem(de)){meses[mes]=para;mudou=true;}
   return mudou?{...m,meses,equipe:ultimaEquipe(meses)}:m;
  })},
 {id:'funcoes',rotulo:'Funções',singular:'função',tela:'equipe',caixaAlta:true,
  sementes:['AJUDANTE GERAL','APONTADOR','ARMADOR','CARPINTEIRO','ENCARREGADO','MOTORISTA','OPERADOR','PEDREIRO','SERVENTE','TOPÓGRAFO','VIGIA','MECÂNICO','SOLDADOR','AUXILIAR DE LABORATÓRIO'],
  valores:d=>(d.config.equipe?.members||[]).flatMap(m=>[m.funcao,...(m.historicoFuncao||[]).flatMap(h=>[h.funcao,h.anterior])]).map(texto).filter(Boolean),
  usos:(d,item)=>(d.config.equipe?.members||[])
   .filter(m=>chaveItem(m.funcao)===chaveItem(item)||(m.historicoFuncao||[]).some(h=>chaveItem(h.funcao)===chaveItem(item)||chaveItem(h.anterior)===chaveItem(item)))
   .map(m=>({id:m.id,tela:'equipe' as const,descricao:m.nome})),
  tally:d=>conta((d.config.equipe?.members||[]).flatMap(m=>[...new Set([m.funcao,...(m.historicoFuncao||[]).flatMap(h=>[h.funcao,h.anterior])].map(chaveItem))])),
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
 {id:'equipamentos',rotulo:'Equipamentos',singular:'equipamento',tela:'equipamentos',caixaAlta:true,
  sementes:['ESCAVADEIRA HIDRÁULICA','RETROESCAVADEIRA','MOTONIVELADORA','ROLO COMPACTADOR','TRATOR DE ESTEIRA','CAMINHÃO BASCULANTE','CAMINHÃO PIPA','PÁ CARREGADEIRA'],
  valores:d=>(d.config.equipamentos?.items||[]).map(i=>texto(i.nome)).filter(Boolean),
  usos:(d,item)=>(d.config.equipamentos?.items||[]).filter(i=>chaveItem(i.nome)===chaveItem(item))
   .map(i=>({id:i.id,tela:'equipamentos' as const,descricao:[i.nome,i.placa].filter(Boolean).join(' · ')})),
  tally:d=>conta((d.config.equipamentos?.items||[]).map(i=>chaveItem(i.nome))),
  renomear:(d,de,para)=>{
   const eq=d.config.equipamentos;if(!eq||!Array.isArray(eq.items))return d;
   const k=chaveItem(de);
   const items=eq.items.map(i=>chaveItem(i.nome)===k?{...i,nome:para}:i);
   // efetivo is keyed by the equipment name; every spelling of it moves to the new key.
   const novo=texto(para).toUpperCase();
   const efetivo:typeof eq.efetivo={};
   let mudouEfetivo=false;
   for(const [data,dia] of Object.entries(eq.efetivo||{})){
    const copia:Record<string,number>={};
    for(const [nome,valor] of Object.entries(dia||{})){
     const alvo=chaveItem(nome)===k?novo:nome;
     if(alvo!==nome)mudouEfetivo=true;
     copia[alvo]=(copia[alvo]||0)+valor;
    }
    efetivo[data]=copia;
   }
   if(!items.some((i,n)=>i!==eq.items[n])&&!mudouEfetivo)return d;
   return {...d,config:{...d.config,equipamentos:{items,efetivo}}};
  }},
 {id:'placas',rotulo:'Placas e tags',singular:'placa',tela:'equipamentos',sementes:[],caixaAlta:true,
  tally:d=>conta((d.config.equipamentos?.items||[]).map(i=>chaveItem(i.placa))),
  valores:d=>(d.config.equipamentos?.items||[]).map(i=>texto(i.placa)).filter(Boolean),
  usos:(d,item)=>(d.config.equipamentos?.items||[]).filter(i=>chaveItem(i.placa)===chaveItem(item))
   .map(i=>({id:i.id,tela:'equipamentos' as const,descricao:[i.nome,i.placa].filter(Boolean).join(' · ')})),
  renomear:(d,de,para)=>{
   const eq=d.config.equipamentos;if(!eq)return d;
   const items=eq.items.map(i=>chaveItem(i.placa)===chaveItem(de)?{...i,placa:para}:i);
   return items.some((i,n)=>i!==eq.items[n])?{...d,config:{...d.config,equipamentos:{...eq,items}}}:d;
  }},
 {id:'acoes',rotulo:'Ações corretivas',singular:'ação',tela:'acoes',sementes:[],
  tally:d=>conta((d.config.acoes||[]).map(a=>chaveItem(a.acao))),
  valores:d=>(d.config.acoes||[]).map(a=>texto(a.acao)).filter(Boolean),
  usos:(d,item)=>(d.config.acoes||[]).filter(a=>chaveItem(a.acao)===chaveItem(item))
   .map(a=>({id:a.id,tela:'acoes' as const,descricao:[a.rnf,a.acao].filter(Boolean).join(' · ')})),
  renomear:(d,de,para)=>{
   const acoes=(d.config.acoes||[]).map(a=>chaveItem(a.acao)===chaveItem(de)?{...a,acao:para}:a);
   return acoes.some((a,i)=>a!==(d.config.acoes||[])[i])?{...d,config:{...d.config,acoes}}:d;
  }},
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
export const textoDoCatalogo=(id:CatalogoId,valor:unknown)=>{
 const t=texto(valor);
 return catalogoPorId(id).caixaAlta?t.replace(/\s+/g,' ').toLocaleUpperCase('pt-BR'):t;
};
export function registrarValor(config:ReportConfig,id:CatalogoId,valor:unknown):ReportConfig{
 const t=textoDoCatalogo(id,valor);
 if(!t||t.length>LIMITE_TEXTO)return config;
 const atuais=catalogoDe(config,id);
 if(atuais.length>=LIMITE_ITENS||atuais.some(x=>chaveItem(x)===chaveItem(t)))return config;
 return comItens(config,id,[...atuais,t]);
}
export function registrarValores(config:ReportConfig,pares:[CatalogoId,unknown][]):ReportConfig{
 return pares.reduce((c,[id,v])=>registrarValor(c,id,v),config);
}

export function semearCatalogos(d:Dados):Dados{
 let config=d.config;
 for(const c of CATALOGOS){
  const primeiraVez=!Array.isArray(config.catalogos?.[c.id]);
  const atuais=catalogoDe(config,c.id);
  const vistos=new Set(atuais.map(chaveItem));
  const novos:string[]=[];
  // Seeds are offered only when the catalog is created: a seed the user deleted must not come back.
  for(const v of [...c.valores(d),...(primeiraVez?c.sementes:[])]){
   const t=textoDoCatalogo(c.id,v);const k=chaveItem(t);
   if(!t||t.length>LIMITE_TEXTO||vistos.has(k)||atuais.length+novos.length>=LIMITE_ITENS)continue;
   vistos.add(k);novos.push(t);
  }
  if(novos.length||primeiraVez)config=comItens(config,c.id,[...atuais,...novos]);
 }
 return config===d.config?d:{...d,config};
}

export function renomearItem(d:Dados,id:CatalogoId,de:string,para:string){
 const novo=textoDoCatalogo(id,para);
 if(!novo||!texto(de)||novo.length>LIMITE_TEXTO||novo===textoDoCatalogo(id,de))return {dados:d,alterados:0};
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
 const contagem=c.tally?c.tally(d):undefined;
 for(const [k,g] of grupos)g.usos=contagem?(contagem.get(k)||0):c.usos(d,g.texto).length;
 return [...grupos.values()].sort((a,b)=>a.texto.localeCompare(b.texto,'pt-BR'));
}

export function excluirItem(d:Dados,id:CatalogoId,item:string):Dados{
 const itens=catalogoDe(d.config,id).filter(x=>chaveItem(x)!==chaveItem(item));
 return {...d,config:{...d.config,catalogos:{...(d.config.catalogos||{}),[id]:itens}}};
}
