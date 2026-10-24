import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ReportConfig,EquipeConfig,EquipeMember} from '../../types';
import {Plus,Trash2,Pencil,Check,X,Upload,FileSpreadsheet} from 'lucide-react';
import {definirEquipeNoMes,registrarFuncao,removerMembros,contarPresencas,normalizarTexto,chaveMatricula,funcaoNoMes,estaAtivo} from '../../services/equipe';
import {lerPlanilhaEquipe,gerarPlanilhaEquipe,montarPrevia,aplicarPrevia,Previa,EscolhasImportacao} from '../../services/equipePlanilha';
import {PreviaImportacaoEquipe} from '../PreviaImportacaoEquipe';
import {FaixaCorrecao} from '../FaixaCorrecao';
import {CampoCatalogo} from '../CampoCatalogo';
import {CatalogoId} from '../../services/catalogos';
import {button,baixar,mesCorrente} from './comum';

export function CadastroEquipe({config,cfg,monthFilter,rotulo,salvar,salvarCom,flush,headers,onAbrirCatalogo,correcao,onLimparCorrecao}:{
 config:ReportConfig;cfg:EquipeConfig;monthFilter:string;rotulo:string;
 salvar:(next:EquipeConfig)=>void;salvarCom:(next:EquipeConfig,pares:[CatalogoId,string][])=>void;
 flush:()=>Promise<unknown>;headers:()=>Record<string,string>;
 onAbrirCatalogo?:(c:CatalogoId)=>void;correcao?:{ids:string[];item:string};onLimparCorrecao?:()=>void;
}){
 const cadastro=useMemo(()=>{
  const lista=[...cfg.members].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  if(!correcao)return lista;
  const alvos=new Set(correcao.ids);
  return lista.filter(m=>alvos.has(m.id));
 },[cfg.members,correcao]);


 const [busca,setBusca]=useState('');
 const semAcento=(v:string)=>v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('pt-BR');
 const ativas=useMemo(()=>cfg.members.filter(estaAtivo).length,[cfg.members]);
 const visiveis=useMemo(()=>{
  const t=semAcento(busca.trim());
  if(!t)return cadastro;
  return cadastro.filter(m=>[m.nome,m.matricula||'',m.funcao].some(v=>semAcento(v).includes(t)));
 },[cadastro,busca]);

 const [novo,setNovo]=useState({matricula:'',nome:'',funcao:'',equipe:'',ativo:true});
 const [editando,setEditando]=useState<{id:string;matricula:string;nome:string;funcao:string}|null>(null);
 const [erro,setErro]=useState('');const [aviso,setAviso]=useState('');
 const [previa,setPrevia]=useState<Previa|null>(null);
 const arquivoRef=useRef<HTMLInputElement>(null);
 const matriculaEmUso=(mat:string,exceto?:string)=>!!mat.trim()&&cfg.members.some(m=>m.id!==exceto&&!!m.matricula&&chaveMatricula(m.matricula)===chaveMatricula(mat));

 const adicionar=()=>{
  setErro('');
  const nome=normalizarTexto(novo.nome),funcao=normalizarTexto(novo.funcao),equipe=normalizarTexto(novo.equipe);
  if(!nome||!funcao||!equipe){setErro('Informe nome, função e equipe.');return;}
  if(matriculaEmUso(novo.matricula)){setErro(`A matrícula ${novo.matricula.trim()} já está cadastrada.`);return;}
  const m:EquipeMember={id:crypto.randomUUID(),matricula:novo.matricula.trim()||undefined,nome,funcao,ativo:novo.ativo,meses:{[monthFilter]:equipe},equipe};
  salvarCom({...cfg,members:[...cfg.members,m]},[['equipes',equipe],['funcoes',funcao]]);
  setNovo({matricula:'',nome:'',funcao:'',equipe:novo.equipe,ativo:novo.ativo});
 };
 const salvarEdicao=()=>{
  if(!editando)return;setErro('');
  const nome=normalizarTexto(editando.nome),funcao=normalizarTexto(editando.funcao);
  if(!nome||!funcao){setErro('Informe nome e função.');return;}
  if(matriculaEmUso(editando.matricula,editando.id)){setErro(`A matrícula ${editando.matricula.trim()} já está cadastrada.`);return;}
  salvarCom({...cfg,members:cfg.members.map(m=>m.id!==editando.id?m:registrarFuncao({...m,nome,matricula:editando.matricula.trim()||undefined},funcao,monthFilter))},[['funcoes',funcao]]);
  setEditando(null);
 };
 const remover=(m:EquipeMember)=>{
  const n=contarPresencas(cfg,m.id);
  if(!confirm(n?`Remover ${m.nome}? ${n} presença(s) marcada(s) também serão apagadas.`:`Remover ${m.nome}?`))return;
  salvar(removerMembros(cfg,new Set([m.id])));
 };
 const trocarEquipe=(m:EquipeMember,valor:string)=>{
  const eq=normalizarTexto(valor);if((m.meses?.[monthFilter]||'')===eq)return;
  salvarCom(definirEquipeNoMes(cfg,m.id,monthFilter,eq||null),[['equipes',eq]]);
 };

 const exportarPlanilha=async()=>{
  setErro('');
  try{await flush();}catch(e:any){setErro('Não foi possível concluir o salvamento antes da exportação: '+(e?.message||'erro desconhecido'));return;}
  const obra=String(config.contrato||'obra').replace(/[<>:"/\\|?*\s]+/g,'-').slice(0,40);
  baixar(gerarPlanilhaEquipe(cfg,mesCorrente()),`Equipe-${obra}-${new Date().toISOString().slice(0,10)}.xlsx`);
 };
 const importar=async(file?:File)=>{
  setErro('');setAviso('');if(!file)return;
  try{setPrevia(montarPrevia(cfg,lerPlanilhaEquipe({nome:file.name,bytes:new Uint8Array(await file.arrayBuffer())})));}
  catch(e:any){setErro(e?.message||'Não foi possível ler a planilha.');}
  finally{if(arquivoRef.current)arquivoRef.current.value='';}
 };
 const aplicar=async(escolhas:EscolhasImportacao)=>{
  if(!previa)return;
  await flush();
  const r=await fetch('/api/backups',{method:'POST',headers:{'Content-Type':'application/json',...headers()},body:JSON.stringify({reason:'antes-de-importar-equipe'})});
  if(!r.ok){const d:any=await r.json().catch(()=>({}));throw new Error('O backup antes da importação falhou; nada foi alterado. '+(d.error||`HTTP ${r.status}`));}
  const pares:[CatalogoId,string][]=[
   ...previa.pares.map(p=>['funcoes',p.linha.funcao] as [CatalogoId,string]),
   ...previa.novas.map(l=>['funcoes',l.funcao] as [CatalogoId,string]),
   ...previa.meses.flatMap(mes=>[
    ...previa.pares.map(p=>['equipes',p.linha.meses[mes]] as [CatalogoId,string]),
    ...previa.novas.map(l=>['equipes',l.meses[mes]] as [CatalogoId,string])]),
  ];
  salvarCom(aplicarPrevia(cfg,previa,escolhas),pares);
  setPrevia(null);setAviso('Planilha importada. Um backup foi criado antes da alteração.');
 };

 return <>
  {correcao&&<FaixaCorrecao quantidade={cadastro.length} item={correcao.item} onLimpar={()=>onLimparCorrecao?.()}/>}

  <div className="bg-white border rounded-xl p-4 space-y-4">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <p className="text-sm text-slate-600">Função e equipe mostradas são as de {rotulo}.</p>
    <div className="flex flex-wrap gap-2">
     <button className={button+' flex items-center gap-1'} onClick={exportarPlanilha}><FileSpreadsheet className="w-4 h-4"/> Exportar planilha da equipe</button>
     <button className={button+' flex items-center gap-1'} onClick={()=>arquivoRef.current?.click()}><Upload className="w-4 h-4"/> Importar planilha</button>
     <input ref={arquivoRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={e=>importar(e.target.files?.[0])}/>
    </div>
   </div>
   {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
   {aviso&&<p role="status" className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">{aviso}</p>}
   <div className="flex flex-wrap gap-2 items-end">
    <label className="w-32"><span className="block text-xs font-semibold uppercase mb-1">Matrícula</span>
     <input className="w-full border p-2 rounded" value={novo.matricula} onChange={e=>setNovo({...novo,matricula:e.target.value})} placeholder="Ex: 1234"/></label>
    <CampoCatalogo className="w-48" catalogo="equipes" config={config} valor={novo.equipe} maiusculas
     rotulo={`Equipe em ${rotulo}`} placeholder="Ex: DRENAGEM" onAbrirCatalogo={onAbrirCatalogo}
     onChange={v=>setNovo({...novo,equipe:v})}/>
    <label className="flex-1 min-w-[200px]"><span className="block text-xs font-semibold uppercase mb-1">Nome</span>
     <input className="w-full border p-2 rounded uppercase" value={novo.nome} onChange={e=>setNovo({...novo,nome:e.target.value})}/></label>
    <CampoCatalogo className="flex-1 min-w-[200px]" catalogo="funcoes" config={config} valor={novo.funcao} maiusculas
     rotulo="Função" onAbrirCatalogo={onAbrirCatalogo} onChange={v=>setNovo({...novo,funcao:v})}/>
    <label className="flex items-center gap-2 text-sm font-semibold pb-2">
     <input type="checkbox" checked={novo.ativo} onChange={e=>setNovo({...novo,ativo:e.target.checked})}/> Ativo
    </label>
    <button className={button+' !bg-emerald-700 text-white'} onClick={adicionar}><Plus className="w-5 h-5 inline mr-1 -mt-1"/> Adicionar</button>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm text-slate-600"><strong>{ativas}</strong> de <strong>{cfg.members.length}</strong> pessoas ativas</p>
    <input className="border rounded-lg p-2 text-sm min-w-[220px]" placeholder="Buscar por nome, matrícula ou função"
     value={busca} onChange={e=>setBusca(e.target.value)} aria-label="Buscar pessoa"/>
   </div>
   {!visiveis.length&&cadastro.length>0&&<p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">Nenhuma pessoa corresponde à busca.</p>}
   {visiveis.length>0&&<div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm text-left">
     <thead className="bg-slate-50 border-b"><tr>
      <th className="p-3">Matrícula</th><th className="p-3">Nome</th><th className="p-3">Função em {rotulo}</th><th className="p-3">Equipe em {rotulo}</th><th className="p-3 w-20">Ativo</th><th className="p-3 w-24">Ação</th>
     </tr></thead>
     <tbody className="divide-y">
      {visiveis.map(m=>editando?.id===m.id
       ?<tr key={m.id}>
         <td className="p-2"><input className="w-full border p-1 rounded text-xs" value={editando.matricula} onChange={e=>setEditando({...editando,matricula:e.target.value})} aria-label="Matrícula"/></td>
         <td className="p-2"><input className="w-full border p-1 rounded text-xs uppercase" value={editando.nome} onChange={e=>setEditando({...editando,nome:e.target.value})} aria-label="Nome"/></td>
         <td className="p-2"><CampoCatalogo catalogo="funcoes" config={config} valor={editando.funcao} maiusculas onChange={v=>setEditando({...editando,funcao:v})}/><span className="block text-[10px] text-slate-500">mudança vale a partir de {rotulo}</span></td>
         <td className="p-2 text-xs">{m.meses?.[monthFilter]||'—'}</td>
         <td className="p-2"/>
         <td className="p-2"><div className="flex items-center gap-1">
          <button onClick={salvarEdicao} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded" title="Salvar"><Check className="w-4 h-4"/></button>
          <button onClick={()=>setEditando(null)} className="text-slate-500 hover:bg-slate-100 p-1 rounded" title="Cancelar"><X className="w-4 h-4"/></button>
         </div></td>
        </tr>
       :<tr key={m.id} className="hover:bg-slate-50">
         <td className="p-3 text-xs">{m.matricula||<span className="text-amber-700">sem matrícula</span>}</td>
         <td className="p-3 font-medium">{m.nome}</td>
         <td className="p-3">{funcaoNoMes(m,monthFilter)}</td>
         <td className="p-2"><EquipeDoMes membro={m} config={config} valor={m.meses?.[monthFilter]||''} onGravar={v=>trocarEquipe(m,v)} onAbrirCatalogo={onAbrirCatalogo}/></td>
         <td className="p-3">
          <input type="checkbox" checked={estaAtivo(m)} aria-label={`Ativo: ${m.nome}`}
           onChange={e=>salvar({...cfg,members:cfg.members.map(x=>x.id===m.id?{...x,ativo:e.target.checked}:x)})}/>
         </td>
         <td className="p-3"><div className="flex items-center gap-1">
          <button onClick={()=>setEditando({id:m.id,matricula:m.matricula||'',nome:m.nome,funcao:m.funcao})} className="text-slate-500 hover:bg-slate-100 p-1 rounded" title="Editar"><Pencil className="w-4 h-4"/></button>
          <button onClick={()=>remover(m)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Remover"><Trash2 className="w-4 h-4"/></button>
         </div></td>
        </tr>)}
     </tbody>
    </table>
   </div>}
  </div>

  {previa&&<PreviaImportacaoEquipe previa={previa} onCancelar={()=>setPrevia(null)} onAplicar={aplicar}/>}
 </>;
}

// Keeps the month's team in a local draft and saves it when the field loses focus.
function EquipeDoMes({membro,config,valor,onGravar,onAbrirCatalogo}:{membro:EquipeMember;config:ReportConfig;valor:string;onGravar:(v:string)=>void;onAbrirCatalogo?:(c:CatalogoId)=>void}){
 const [rascunho,setRascunho]=useState(valor);
 useEffect(()=>{setRascunho(valor);},[valor,membro.id]);
 return <div onBlur={()=>{if(rascunho!==valor)onGravar(rascunho);}}
  onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}>
  <CampoCatalogo catalogo="equipes" config={config} valor={rascunho} maiusculas placeholder="fora deste mês"
   onChange={setRascunho} onAbrirCatalogo={onAbrirCatalogo}/>
 </div>;
}
