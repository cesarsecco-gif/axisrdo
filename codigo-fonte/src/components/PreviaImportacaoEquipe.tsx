import React,{useState} from 'react';
import {Previa,EscolhasImportacao,Alteracao,rotuloMes,rotuloPessoaNova} from '../services/equipePlanilha';
import {chaveMatricula} from '../services/equipe';

const button='border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';
function descrever(a:Alteracao){
 const mes=a.mes?rotuloMes(a.mes):'';
 if(a.tipo==='nome')return `Matrícula ${a.matricula}: ${a.de} → ${a.para}`;
 if(a.tipo==='funcao')return `${a.nome}: ${a.de} → ${a.para}`;
 if(a.tipo==='ativa')return `${a.nome}: passa a ATIVA`;
 if(a.tipo==='inativa')return `${a.nome}: passa a INATIVA`;
 if(a.tipo==='entrada')return `${a.nome}: entra em ${mes} (${a.para})`;
 if(a.tipo==='transferencia')return `${a.nome}: ${mes} ${a.de} → ${a.para}`;
 if(a.tipo==='saida')return `${a.nome}: sai de ${mes} (${a.de})`;
 return `${a.nome}: ${mes} mantido em ${a.de} — há ${a.presencas} presença(s) marcada(s) nesse mês`;
}

export function PreviaImportacaoEquipe({previa,onCancelar,onAplicar}:{previa:Previa;onCancelar:()=>void;onAplicar:(e:EscolhasImportacao)=>Promise<void>}){
 const [mesFuncao,setMesFuncao]=useState(previa.mesFuncaoPadrao);
 const [desvincular,setDesvincular]=useState<Set<string>>(new Set());
 const [remover,setRemover]=useState<Set<string>>(new Set());
 const [ocupado,setOcupado]=useState(false);const [erro,setErro]=useState('');
 const alternar=(atual:Set<string>,definir:(s:Set<string>)=>void,chave:string)=>{const n=new Set(atual);if(n.has(chave))n.delete(chave);else n.add(chave);definir(n);};
 const de=(tipo:Alteracao['tipo'])=>previa.alteracoes.filter(a=>a.tipo===tipo).map(descrever);
 const vinculadas=previa.pares.filter(p=>p.porNome);
 const aplicar=async()=>{setOcupado(true);setErro('');try{await onAplicar({mesFuncao,desvincular,remover});}catch(e:any){setErro(e?.message||'Erro desconhecido.');}finally{setOcupado(false);}};
 const secao=(titulo:string,itens:string[],cor='border-slate-200')=>itens.length?<section className={`border rounded-lg p-3 ${cor}`}>
  <h4 className="font-semibold text-sm mb-1">{titulo} ({itens.length})</h4>
  <ul className="text-sm list-disc pl-5 max-h-40 overflow-y-auto">{itens.map((t,i)=><li key={i}>{t}</li>)}</ul>
 </section>:null;
 const semMudanca=!previa.novas.length&&!previa.alteracoes.some(a=>a.tipo!=='saidaRecusada')&&!remover.size;
 return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Prévia da importação da equipe">
  <div className="bg-white rounded-2xl p-5 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-3">
   <h3 className="text-lg font-bold">Prévia da importação da equipe</h3>
   <p className="text-sm text-slate-600">Meses da planilha: {previa.meses.map(rotuloMes).join(', ')}. Meses que não estão na planilha não são alterados. Nada muda até você clicar em Aplicar.</p>
   {secao('Pessoas novas',previa.novas.map(rotuloPessoaNova),'border-emerald-200')}
   {vinculadas.length>0&&<section className="border rounded-lg p-3 border-sky-200">
    <h4 className="font-semibold text-sm mb-1">Reconhecidas pelo nome — cadastradas sem matrícula ({vinculadas.length})</h4>
    {vinculadas.map(p=><label key={p.membro.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!desvincular.has(chaveMatricula(p.linha.matricula))} onChange={()=>alternar(desvincular,setDesvincular,chaveMatricula(p.linha.matricula))}/> {p.linha.nome} recebe a matrícula {p.linha.matricula} (desmarque se não for a mesma pessoa)</label>)}
   </section>}
   {secao('Nome alterado',de('nome'))}
   {de('funcao').length>0&&<section className="border rounded-lg p-3 border-slate-200 space-y-1">
    {secao('Função alterada',de('funcao'))}
    <label className="text-sm flex items-center gap-2">As mudanças de função valem a partir de
     <select className="border rounded p-1" value={mesFuncao} onChange={e=>setMesFuncao(e.target.value)}>{previa.meses.map(m=><option key={m} value={m}>{rotuloMes(m)}</option>)}</select>
    </label>
   </section>}
   {secao('Passam a inativas — ficam fora do preenchimento automático',de('inativa'),'border-amber-300')}
   {secao('Voltam a ativas',de('ativa'),'border-emerald-200')}
   {secao('Coluna ATIVO não entendida — a marca não muda',previa.situacoesIgnoradas.map(s=>`Linha ${s.linha}: "${s.texto}"`),'border-slate-200')}
   {secao('Transferências de equipe',de('transferencia'))}
   {secao('Entradas no mês',de('entrada'))}
   {secao('Saídas do mês',de('saida'))}
   {secao('Saídas recusadas (há presença marcada)',de('saidaRecusada'),'border-amber-300')}
   {secao('Equipes novas — confira se não é erro de digitação',previa.equipesNovas,'border-amber-300')}
   {previa.foraDaPlanilha.length>0&&<section className="border rounded-lg p-3 border-slate-200">
    <h4 className="font-semibold text-sm mb-1">Cadastradas, mas fora da planilha ({previa.foraDaPlanilha.length}) — mantidas, a menos que você marque</h4>
    {previa.foraDaPlanilha.map(f=><label key={f.membro.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={remover.has(f.membro.id)} onChange={()=>alternar(remover,setRemover,f.membro.id)}/> remover {f.membro.nome}{f.membro.matricula?` (${f.membro.matricula})`:''}{f.presencas?<span className="text-red-700"> — apaga {f.presencas} presença(s)</span>:null}</label>)}
   </section>}
   {secao('Linhas não importadas',previa.recusadas.map(r=>`Linha ${r.linha}: ${r.motivo}`),'border-red-200')}
   {secao('Colunas ignoradas',previa.colunasIgnoradas,'border-slate-200')}
   {semMudanca&&<p className="text-sm bg-slate-50 border rounded-lg p-3">A planilha não traz alterações para o cadastro.</p>}
   {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
   <div className="flex justify-end gap-2">
    <button className={button} disabled={ocupado} onClick={onCancelar}>Cancelar</button>
    <button className={button+' !bg-emerald-700 text-white'} disabled={ocupado||semMudanca} onClick={aplicar}>{ocupado?'Aplicando…':'Aplicar importação'}</button>
   </div>
  </div>
 </div>;
}
