import React,{useState} from 'react';
import {photoTags,tagKey,uniqueTags} from '../services/organization';
import type {PhotoRecord} from '../types';
export function TagsEditor({photo,catalog,onClose,onSave}:{photo:PhotoRecord;catalog:string[];onClose:()=>void;onSave:(tags:string[])=>void}){
 const [selected,setSelected]=useState(photoTags(photo)),[name,setName]=useState(''),[error,setError]=useState('');
 function add(){const tag=name.trim();if(!tag||tag.length>64){setError('Informe uma tag de 1 a 64 caracteres.');return;}setSelected(v=>uniqueTags([...v,tag]));setName('');setError('');}
 return <div className="fixed inset-0 z-50 bg-black/60 p-4 overflow-auto" role="dialog" aria-modal="true" aria-label="Editar tags"><div className="max-w-xl mx-auto bg-white rounded-xl p-5 space-y-4">
  <h2 className="font-bold text-xl">Tags desta foto</h2><p>Selecione uma ou mais tags salvas ou crie uma nova. As novas descrições ficam disponíveis para outras fotos ao salvar.</p>
  <div className="flex flex-wrap gap-2">{selected.map(tag=><span key={tagKey(tag)} className="bg-emerald-50 border rounded p-2">{tag} <button aria-label={`Editar tag ${tag}`} onClick={()=>{const value=prompt('Novo nome da tag nesta foto:',tag);if(value===null)return;if(!value.trim()||value.trim().length>64){setError('Informe de 1 a 64 caracteres.');return;}setSelected(v=>uniqueTags(v.map(t=>t===tag?value:t)));}}>✎</button> <button aria-label={`Remover tag ${tag}`} onClick={()=>setSelected(v=>v.filter(t=>t!==tag))}>×</button></span>)}</div>
  <div className="flex gap-2"><input aria-label="Nova tag" maxLength={64} className="border rounded p-2 flex-1 min-w-0" placeholder="Ex.: Concretagem, Muro C7…" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}}/><button className="border rounded p-2" onClick={add}>Adicionar</button></div>
  <h3 className="font-semibold">Tags salvas</h3><div className="max-h-60 overflow-auto flex flex-wrap gap-3">{uniqueTags([...catalog,...selected]).map(tag=><label key={tagKey(tag)} className="border rounded p-2"><input type="checkbox" checked={selected.some(t=>tagKey(t)===tagKey(tag))} onChange={e=>setSelected(v=>e.target.checked?uniqueTags([...v,tag]):v.filter(t=>tagKey(t)!==tagKey(tag)))}/> {tag}</label>)}</div>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <p className="text-sm text-slate-600">Editar ou remover uma tag aqui afeta somente esta foto. Você também pode deixar a foto sem tags.</p>
  <div className="flex justify-end gap-3"><button onClick={onClose}>Cancelar</button><button className="bg-emerald-700 text-white rounded px-4 py-2" onClick={()=>{if(name.trim()){setError('Clique em Adicionar para incluir a tag digitada ou limpe o campo.');return;}if(selected.length>32){setError('Use até 32 tags por foto.');return;}onSave(selected);}}>Salvar tags</button></div>
 </div></div>;
}
