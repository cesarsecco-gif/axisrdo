import React,{useState} from 'react';
import {Check,Copy,FolderInput,FolderOpen,MapPin,Pencil,Trash2} from 'lucide-react';
import {ObraRow} from '../../services/obrasApi';
import {botao,campo} from './paineis/Painel';

function quando(iso:string){if(!iso)return '—';const d=new Date(iso);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});}
const etiqueta='text-[10px] font-bold uppercase text-white rounded px-1.5 py-0.5';

export function ObraCard({obra:o,importing,onAbrir,onRenomear,onDuplicar,onMover,onRemover}:{obra:ObraRow;importing:boolean;onAbrir:()=>void;onRenomear:(nome:string)=>Promise<void>;onDuplicar:()=>void;onMover:()=>void;onRemover:()=>void}){
 const [editando,setEditando]=useState(false);const [nome,setNome]=useState(o.nome);const [erro,setErro]=useState('');const [ocupado,setOcupado]=useState(false);
 const salvar=async()=>{setOcupado(true);setErro('');try{await onRenomear(nome.trim());setEditando(false);}catch(e:any){setErro(e.message);}finally{setOcupado(false);}};
 const ficha=[o.ficha.contrato,o.ficha.rodovia&&o.ficha.trecho?`${o.ficha.rodovia} • ${o.ficha.trecho}`:o.ficha.rodovia||o.ficha.trecho].filter(Boolean).join(' | ');
 const bloqueadaPorImportacao=o.active&&importing;
 return <article className={`bg-white border rounded-xl p-4 space-y-2 ${o.active?'border-emerald-500 ring-1 ring-emerald-500':'border-slate-200'}`}>
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0 space-y-1">
    {editando
     ?<div className="flex gap-2">
       <input className={campo+' text-sm'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} autoFocus aria-label="Novo nome da obra"/>
       <button className={botao} disabled={ocupado||!nome.trim()} onClick={salvar} aria-label="Salvar nome"><Check className="w-4 h-4"/></button>
       <button className={botao} disabled={ocupado} onClick={()=>{setEditando(false);setNome(o.nome);setErro('');}}>Cancelar</button>
      </div>
     :<p className="font-semibold flex items-center gap-2 flex-wrap">
       <span className="truncate">{o.nome}</span>
       {o.active&&<span className={etiqueta+' bg-emerald-700'}>Em uso</span>}
       {!o.available&&<span className={etiqueta+' bg-amber-500'}>Pasta indisponível</span>}
       {o.available&&!o.hasProject&&<span className={etiqueta+' bg-slate-400'}>Sem projeto</span>}
      </p>}
    {erro&&<p className="text-xs text-red-700">{erro}</p>}
    <p className="text-xs text-slate-600">{ficha||'Ficha ainda não preenchida (contrato, rodovia e trecho aparecem após o primeiro salvamento).'}</p>
    <p className="text-xs text-slate-400 break-all" title={o.path}><MapPin className="w-3 h-3 inline -mt-0.5"/> {o.path}</p>
    <p className="text-xs text-slate-500">Último acesso: {quando(o.lastAccessAt)} • Fotos: {o.photos} • Salvo: {quando(o.lastSaved)}</p>
    {!o.available&&<p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">A pasta não foi encontrada. Reconecte o disco ou remova a obra da lista. Nada foi criado no lugar dela.</p>}
    {o.available&&!o.hasProject&&<p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">Esta pasta não tem projeto.json. Remova a obra da lista ou use "Abrir obra de outra pasta" com a pasta correta.</p>}
   </div>
   {!o.active&&<button className={botao+' !border-emerald-600 text-emerald-700 shrink-0'} disabled={!o.available||!o.hasProject||importing} onClick={onAbrir}><FolderOpen className="w-4 h-4"/> Abrir</button>}
  </div>
  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
   <button className={botao} disabled={editando} onClick={()=>{setEditando(true);setNome(o.nome);setErro('');}}><Pencil className="w-4 h-4"/> Renomear</button>
   <button className={botao} disabled={!o.hasProject} onClick={onDuplicar}><Copy className="w-4 h-4"/> Duplicar</button>
   <button className={botao} disabled={!o.hasProject||bloqueadaPorImportacao} onClick={onMover}><FolderInput className="w-4 h-4"/> Mover</button>
   <button className={botao+' !border-red-300 text-red-600'} disabled={bloqueadaPorImportacao} onClick={onRemover}><Trash2 className="w-4 h-4"/> Remover</button>
  </div>
 </article>;
}
