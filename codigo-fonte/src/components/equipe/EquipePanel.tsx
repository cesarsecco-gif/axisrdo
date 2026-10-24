import React,{useEffect,useMemo,useState} from 'react';
import {ReportConfig,EquipeConfig} from '../../types';
import {migrarEquipe} from '../../services/equipe';
import {rotuloMes} from '../../services/equipePlanilha';
import {registrarValores,CatalogoId} from '../../services/catalogos';
import {mesCorrente,chaveCorrecao} from './comum';
import {CadastroEquipe} from './CadastroEquipe';
import {EfetivoDoMes} from './EfetivoDoMes';
import {definirProfissionais} from '../../services/rdo';

export function EquipePanel({config,onChange,flush,headers,onAbrirCatalogo,correcao,onLimparCorrecao}:{
 config:ReportConfig;onChange:(c:Partial<ReportConfig>)=>void;flush:()=>Promise<unknown>;headers:()=>Record<string,string>;
 onAbrirCatalogo?:(c:CatalogoId)=>void;correcao?:{ids:string[];item:string};onLimparCorrecao?:()=>void;
}){
 const base=useMemo<EquipeConfig>(()=>({members:Array.isArray(config.equipe?.members)?config.equipe!.members:[],efetivo:config.equipe?.efetivo||{}}),[config.equipe]);
 const cfg=useMemo(()=>migrarEquipe(base,mesCorrente()),[base]);
 useEffect(()=>{if(cfg!==base)onChange({equipe:cfg});},[cfg,base]);
 const salvar=(next:EquipeConfig)=>onChange({equipe:next});
 const salvarCom=(next:EquipeConfig,pares:[CatalogoId,string][])=>
  onChange({equipe:next,catalogos:registrarValores(config,pares).catalogos});
 const rdoDays=config.rdo?.days||[];
 const onNumeroRdo=(date:string,total:number)=>{
  const atual=config.rdo;if(!atual)return;
  const novo=definirProfissionais(atual,date,total);
  if(novo!==atual)onChange({rdo:novo});
 };

 const allDates=useMemo(()=>{const s=new Set(rdoDays.map(d=>d.date));Object.keys(cfg.efetivo).forEach(d=>s.add(d));return [...s].sort();},[rdoDays,cfg.efetivo]);
 const [monthFilter,setMonthFilter]=useState(()=>allDates.length?allDates[allDates.length-1].slice(0,7):mesCorrente());
 const monthDates=allDates.filter(d=>d.startsWith(monthFilter));
 const rotulo=rotuloMes(monthFilter);

 const [aba,setAba]=useState<'efetivo'|'cadastro'>('efetivo');
 // "Corrigir agora" points at people in the cadastro, so that is the tab to open.
 // Keyed on the content: App.tsx rebuilds this object on every render.
 const chave=chaveCorrecao(correcao);
 useEffect(()=>{if(chave)setAba('cadastro');},[chave]);
 const estilo=(id:'efetivo'|'cadastro')=>`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 ${aba===id?'border-emerald-700 text-emerald-800 bg-white':'border-transparent text-slate-500 hover:text-slate-800'}`;

 return <div className="space-y-4 print:space-y-2">
  <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-bold">Equipe Técnica</h2>
    <p className="text-sm text-slate-600">A equipe de cada pessoa é registrada mês a mês. O mês escolhido vale para as duas abas.</p>
   </div>
   <label className="flex items-center gap-2 text-sm font-semibold">Mês
    <input type="month" className="border p-2 rounded font-normal" value={monthFilter} onChange={e=>{if(e.target.value)setMonthFilter(e.target.value);}}/>
   </label>
  </div>

  <div className="flex gap-1 border-b border-slate-200 print:hidden" role="tablist">
   <button role="tab" aria-selected={aba==='efetivo'} className={estilo('efetivo')} onClick={()=>setAba('efetivo')}>Efetivo do mês</button>
   <button role="tab" aria-selected={aba==='cadastro'} className={estilo('cadastro')} onClick={()=>setAba('cadastro')}>Cadastro</button>
  </div>

  {aba==='efetivo'
   ?<EfetivoDoMes cfg={cfg} monthFilter={monthFilter} rotulo={rotulo} monthDates={monthDates} rdoDays={rdoDays} salvar={salvar} flush={flush} onNumeroRdo={onNumeroRdo}/>
   :<CadastroEquipe config={config} cfg={cfg} monthFilter={monthFilter} rotulo={rotulo} salvar={salvar} salvarCom={salvarCom}
     flush={flush} headers={headers} onAbrirCatalogo={onAbrirCatalogo}
     correcao={correcao} onLimparCorrecao={onLimparCorrecao}/>}
 </div>;
}
