import React,{useEffect,useMemo,useState} from 'react';
import {List,Plus,Pencil,Trash2,Check,X,Merge,AlertTriangle,Download} from 'lucide-react';
import type {ReportConfig,PhotoRecord} from '../../types';
import {TrazerDeOutraObra} from './TrazerDeOutraObra';
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
 const [trazendo,setTrazendo]=useState(false);
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
  onAplicar(c,photos);setNovo('');setErro('');setAviso('Item adicionado ao catálogo.');
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
     <button className={botao} disabled={ocupado} onClick={()=>setTrazendo(true)}><Download className="w-4 h-4"/> Trazer de outra obra</button>
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
  {trazendo&&<TrazerDeOutraObra config={config} onFechar={()=>setTrazendo(false)}
   onAplicar={(c,resumo)=>{onAplicar(c,photos);setTrazendo(false);setAviso(resumo);}}/>}
 </div>;
}
