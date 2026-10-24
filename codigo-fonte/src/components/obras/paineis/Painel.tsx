import React,{useState} from 'react';
import {X} from 'lucide-react';
import {Workspace,caminhoFinal,obrasApi} from '../../../services/obrasApi';

export type PainelBase={workspace:Workspace;flush:()=>Promise<unknown>;importing:boolean;raiz:string|null;sugestao:string;onClose:()=>void;onDone:(mensagem?:string)=>void};
export const botao='rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold bg-white hover:bg-slate-100 disabled:opacity-50 inline-flex items-center gap-1';
export const botaoPrimario=botao+' !bg-emerald-700 !text-white !border-emerald-700 hover:!bg-emerald-800';
export const campo='block w-full border border-slate-300 rounded-lg p-2.5 font-normal bg-white focus:ring-1 focus:ring-emerald-500';
export const destaque='text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2 break-all';

export function Painel({titulo,onClose,ocupado,children}:{titulo:string;onClose:()=>void;ocupado?:boolean;children:React.ReactNode}){
 return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titulo}>
  <div className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3">
   <div className="flex items-start justify-between gap-3">
    <h3 className="text-lg font-bold">{titulo}</h3>
    <button className="text-slate-400 hover:text-slate-700 p-1 disabled:opacity-40" onClick={onClose} disabled={ocupado} aria-label="Fechar"><X className="w-5 h-5"/></button>
   </div>
   {children}
  </div>
 </div>;
}

export function Erro({texto}:{texto:string}){
 return texto?<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg whitespace-pre-wrap">{texto}</p>:null;
}

export function useAcao(){
 const [ocupado,setOcupado]=useState(false);const [erro,setErro]=useState('');
 const executar=async(fn:()=>Promise<void>)=>{setOcupado(true);setErro('');try{await fn();}catch(e:any){setErro(e?.message||'Erro desconhecido.');}finally{setOcupado(false);}};
 return {ocupado,erro,executar};
}

export function CampoPasta({valor,onChange,ocupado,placeholder='C:\\AXIS RDO'}:{valor:string;onChange:(v:string)=>void;ocupado:boolean;placeholder?:string}){
 const [procurando,setProcurando]=useState(false);const [erro,setErro]=useState('');
 const procurar=async()=>{setProcurando(true);setErro('');try{const p=await obrasApi.escolherPasta();if(p)onChange(p);}catch(e:any){setErro(e.message);}finally{setProcurando(false);}};
 return <div className="space-y-1">
  <div className="flex gap-2">
   <input className={campo+' text-sm'} value={valor} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={ocupado} aria-label="Caminho da pasta"/>
   <button type="button" className={botao+' shrink-0'} disabled={ocupado||procurando} onClick={procurar}>{procurando?'Aguarde…':'Procurar'}</button>
  </div>
  {erro&&<p className="text-xs text-red-700">{erro}</p>}
 </div>;
}

// Shared "where will this obra live" fields for Nova obra, Importar backup and Duplicar.
export function useLocalDaObra(raiz:string|null,sugestao:string){
 const [outroLocal,setOutroLocal]=useState(false);const [local,setLocal]=useState('');const [raizNova,setRaizNova]=useState(sugestao);
 const base=outroLocal?local.trim():(raiz||raizNova.trim());
 const confirmarRaiz=async()=>{if(!raiz&&!outroLocal)await obrasApi.definirRaiz(raizNova.trim());};
 const pathInformado=outroLocal?base:undefined;
 const campos=(nome:string,ocupado:boolean)=><div className="space-y-2">
  {!raiz&&!outroLocal&&<div className="space-y-1"><p className="text-sm">Defina a pasta onde todas as obras serão guardadas (pode ser alterada depois):</p><CampoPasta valor={raizNova} onChange={setRaizNova} ocupado={ocupado}/></div>}
  {outroLocal&&<div className="space-y-1"><p className="text-sm font-semibold">Outro local para esta obra</p><CampoPasta valor={local} onChange={setLocal} ocupado={ocupado}/></div>}
  {base&&nome.trim()&&<p className={destaque}>Será criada em: <strong>{caminhoFinal(base,nome)}</strong></p>}
  <button type="button" className="text-sm text-emerald-700 underline disabled:opacity-50" disabled={ocupado} onClick={()=>setOutroLocal(v=>!v)}>{outroLocal?'Usar a pasta das obras':'Escolher outro local'}</button>
 </div>;
 return {base,pathInformado,confirmarRaiz,campos};
}
