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
 const alternar=(id:CatalogoId)=>{const n=new Set(escolhidos);if(n.has(id))n.delete(id);else n.add(id);setEscolhidos(n);};
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
   <p className="text-sm text-slate-600">Os itens são acrescentados aos catálogos desta obra. Nada é removido nem renomeado, e nenhum registro é alterado.</p>
   <label className="block text-sm font-semibold">Obra de origem
    <select className="block w-full border rounded-lg p-2 mt-1 font-normal" value={obraId} onChange={e=>setObraId(e.target.value)}>
     <option value="">Escolha…</option>
     {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
    </select>
   </label>
   {!obras.length&&<p className="text-sm text-slate-500">Nenhuma outra obra com projeto disponível.</p>}
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
