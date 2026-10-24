import React,{useId,useMemo} from 'react';
import {List} from 'lucide-react';
import type {ReportConfig} from '../types';
import {CatalogoId,catalogoDe,chaveItem} from '../services/catalogos';

const CAMPO_PADRAO='w-full border p-2 rounded bg-white';
const ROTULO_PADRAO='block text-xs font-semibold uppercase';

export function CampoCatalogo({catalogo,config,valor,onChange,onAbrirCatalogo,rotulo,placeholder,className='',sugestoes,onEscolherSugestao,maiusculas,disabled,autoFocus,inputClassName,rotuloClassName,multiline}:{
 catalogo:CatalogoId;config:ReportConfig;valor:string;onChange:(v:string)=>void;onAbrirCatalogo?:(c:CatalogoId)=>void;
 rotulo?:React.ReactNode;placeholder?:string;className?:string;sugestoes?:string[];onEscolherSugestao?:(v:string)=>void;
 maiusculas?:boolean;disabled?:boolean;autoFocus?:boolean;inputClassName?:string;rotuloClassName?:string;multiline?:boolean;
}){
 const listaId=useId();
 const itens=useMemo(()=>{
  const lista=catalogoDe(config,catalogo);
  const k=chaveItem(valor);
  // The typed text is not offered back to the user as a suggestion.
  return k?lista.filter(x=>chaveItem(x)!==k):lista;
 },[config.catalogos,catalogo,valor]);
 const nome=typeof rotulo==='string'?rotulo:catalogo;
 const comuns={
  value:valor,placeholder,disabled,autoFocus,'aria-label':nome,
  className:`${inputClassName||CAMPO_PADRAO} ${maiusculas?'uppercase':''}`,
  onChange:(e:any)=>onChange(maiusculas?e.target.value.toLocaleUpperCase('pt-BR'):e.target.value),
 };
 return <div className={className}>
  {rotulo&&<div className="flex items-center justify-between gap-1 mb-1">
   <span className={rotuloClassName||ROTULO_PADRAO}>{rotulo}</span>
   {onAbrirCatalogo&&<button type="button" className="text-slate-400 hover:text-emerald-700 p-0.5 shrink-0" title={`Administrar o catálogo de ${nome}`} onClick={()=>onAbrirCatalogo(catalogo)}><List className="w-3.5 h-3.5"/></button>}
  </div>}
  {/* A datalist does not attach to a textarea, so the long field keeps the suggestion buttons below it. */}
  {multiline?<textarea rows={2} {...comuns}/>:<input list={listaId} {...comuns}/>}
  <datalist id={listaId}>{itens.map(t=><option key={t} value={t}/>)}</datalist>
  {sugestoes&&sugestoes.length>0&&<div className="flex flex-wrap gap-1 mt-1">
   {sugestoes.map(s=><button type="button" key={s} className="text-[10px] bg-slate-100 hover:bg-emerald-100 border rounded px-1.5 py-0.5 text-left" onClick={()=>onEscolherSugestao?.(s)} title={s}>{s.length>48?s.slice(0,48)+'…':s}</button>)}
  </div>}
 </div>;
}
