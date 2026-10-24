import React,{useMemo,useState} from 'react';
import {EquipeConfig} from '../../types';
import {Download,Printer,AlertTriangle} from 'lucide-react';
import {createXlsx} from '../../../xlsxWriter';
import {membrosDoMes,histogramaPorEquipe,funcaoNoMes,preencherEfetivoComRdo,perguntasSyncRdo,estaAtivo} from '../../services/equipe';
import {rotuloMes} from '../../services/equipePlanilha';
import {button,baixar,diaSemana,listaDatas} from './comum';

export function EfetivoDoMes({cfg,monthFilter,rotulo,monthDates,rdoDays,salvar,flush,onNumeroRdo}:{
 cfg:EquipeConfig;monthFilter:string;rotulo:string;monthDates:string[];
 rdoDays:{date:string;professionals:number|null}[];salvar:(next:EquipeConfig)=>void;flush:()=>Promise<unknown>;
 onNumeroRdo?:(date:string,total:number)=>void;
}){
 const [erro,setErro]=useState('');const [aviso,setAviso]=useState('');
 const doMes=useMemo(()=>membrosDoMes(cfg,monthFilter),[cfg,monthFilter]);
 const histograma=useMemo(()=>histogramaPorEquipe(cfg,monthDates),[cfg,monthDates.join()]);

 const togglePresence=(date:string,id:string)=>{
  const dia={...(cfg.efetivo[date]||{})};dia[id]=dia[id]?0:1;
  salvar({...cfg,efetivo:{...cfg.efetivo,[date]:dia}});
  // The RDO's professional count reports this presence, so it follows the grid.
  onNumeroRdo?.(date,Object.values(dia).filter(Boolean).length);
 };
 const syncWithRdo=()=>{
  setErro('');setAviso('');
  const dias=rdoDays.filter(d=>d.date.startsWith(monthFilter));
  if(!dias.length){
   const meses=[...new Set(rdoDays.map(d=>d.date.slice(0,7)))].sort();
   setErro(meses.length?`Não há RDO em ${rotulo}. Há dias de RDO em ${meses.map(rotuloMes).join(', ')} — troque o mês acima para sincronizar.`:'Não há RDO cadastrado. Gere os dias na aba Diário de obras.');
   return;
  }
  const sem=preencherEfetivoComRdo(cfg,rdoDays,monthFilter,false);
  if(sem.res.semMembros){setErro(`Ninguém está na lista de ${rotulo}. Informe a equipe das pessoas na aba Cadastro antes de preencher.`);return;}
  const inativosDoMes=doMes.filter(x=>!estaAtivo(x.membro)).map(x=>x.membro.nome);
  const nomesInativos=inativosDoMes.length<=5?inativosDoMes.join(', '):inativosDoMes.slice(0,5).join(', ')+`… (+${inativosDoMes.length-5})`;
  if(sem.res.semAtivos){setErro(`As ${inativosDoMes.length} pessoas de ${rotulo} estão marcadas como inativas, então não há quem preencher. Marque como ativa, na aba Cadastro, quem está à disposição.`);return;}
  if(!sem.res.preenchidos&&!sem.res.zerados&&!sem.res.mantidos){
   setErro(`Nenhum dia de ${rotulo} tem "Profissionais em atividade" preenchido no RDO (${listaDatas(sem.res.semNumero)}). Preencha o número na aba Diário de obras e clique de novo.`);
   return;
  }
  const perguntas=perguntasSyncRdo(sem.res,rotulo,nomesInativos,listaDatas);
  let escolha=sem;
  if(perguntas.confirmar&&!confirm(perguntas.confirmar))return;
  if(perguntas.sobrescrever)escolha=confirm(perguntas.sobrescrever)?preencherEfetivoComRdo(cfg,rdoDays,monthFilter,true):sem;
  if(escolha.res.preenchidos||escolha.res.zerados)salvar({...cfg,efetivo:escolha.efetivo});
  const feito:string[]=[];
  if(escolha.res.preenchidos)feito.push(`${escolha.res.preenchidos} dia(s) com ${escolha.res.marcacoes} presença(s)`);
  if(escolha.res.zerados)feito.push(`${escolha.res.zerados} dia(s) zerado(s)`);
  if(escolha.res.substituidos)feito.push(`${escolha.res.substituidos} dia(s) manual(is) sobrescrito(s)`);
  if(escolha.res.mantidos)feito.push(`${escolha.res.mantidos} dia(s) manual(is) mantido(s)`);
  if(escolha.res.semNumero.length)feito.push(`${escolha.res.semNumero.length} dia(s) sem número ignorado(s): ${listaDatas(escolha.res.semNumero)}`);
  const texto=`${rotulo}: ${feito.join('; ')}.`;
  if(escolha.res.preenchidos||escolha.res.zerados){setAviso(texto);}
  else setErro('Nada foi alterado. '+texto);
 };

 const linhasHistograma=()=>{
  const out:(string|number|null)[][]=[];
  for(const eq of [...new Set(histograma.map(l=>l.equipe))]){
   const ls=histograma.filter(l=>l.equipe===eq);
   ls.forEach(l=>out.push([eq,l.funcao,...monthDates.map(d=>l.porData[d]||null)]));
   out.push([`SUBTOTAL ${eq}`,'',...monthDates.map(d=>ls.reduce((a,l)=>a+(l.porData[d]||0),0))]);
  }
  out.push(['TOTAL GERAL','',...monthDates.map(d=>histograma.reduce((a,l)=>a+(l.porData[d]||0),0))]);
  return out;
 };
 const exportarEfetivo=async()=>{
  if(!doMes.length||!monthDates.length)return;
  try{await flush();}catch(e:any){alert('Não foi possível concluir o salvamento antes da exportação: '+(e?.message||'erro desconhecido'));return;}
  const dias=monthDates.map(d=>String(new Date(d+'T12:00:00').getDate()));
  const rows:(string|number|null)[][]=doMes.map(({membro,equipe})=>[membro.matricula||'',equipe,membro.nome,funcaoNoMes(membro,monthFilter),...monthDates.map(d=>cfg.efetivo[d]?.[membro.id]?1:null)]);
  rows.push(['','TOTAL PRESENTES','','',...monthDates.map(d=>doMes.reduce((a,x)=>a+(cfg.efetivo[d]?.[x.membro.id]?1:0),0))]);
  rows.push(['','TOTAL NO RDO','','',...monthDates.map(d=>{const v=rdoDays.find(r=>r.date===d)?.professionals;return v===null||v===undefined?null:v;})]);
  baixar(createXlsx([{name:'Efetivo',headers:['Matrícula','Equipe','Nome','Função',...dias],rows},{name:'Histograma por Equipe',headers:['Equipe','Função',...dias],rows:linhasHistograma()}]),`Efetivo-${monthFilter}.xlsx`);
 };

 const totalHistograma=(d:string)=>histograma.reduce((a,l)=>a+(l.porData[d]||0),0);
 return <>
  <div className="bg-white border rounded-xl p-4 space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-bold">Efetivo (Histograma) — {rotulo}</h2>
    <div className="flex items-center gap-2 flex-wrap">
     <button className={button} onClick={syncWithRdo}>Auto-preencher com RDO</button>
     <button className={button+' flex items-center gap-1'} onClick={exportarEfetivo} disabled={!doMes.length||!monthDates.length}><Download className="w-4 h-4"/> XLSX</button>
     <button className={button+' flex items-center gap-1'} onClick={()=>window.print()} disabled={!doMes.length||!monthDates.length}><Printer className="w-4 h-4"/> Imprimir (PDF)</button>
    </div>
   </div>
   {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
   {aviso&&<p role="status" className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">{aviso}</p>}
   {!doMes.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Ninguém está na lista de {rotulo}. Informe a equipe das pessoas neste mês na aba Cadastro ou importe a planilha.</p>
    :!monthDates.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Não há datas de RDO ou registros para este mês.</p>
    :<div className="overflow-x-auto border rounded-lg">
     <table className="w-full text-xs text-center border-collapse">
      <thead className="bg-slate-50 border-b"><tr>
       <th className="p-2 border-r text-left sticky left-0 bg-slate-50 z-10 min-w-[220px]">Nome / Equipe</th>
       {monthDates.map(date=><th key={date} className="p-2 border-r min-w-[36px]" title={date}>{new Date(date+'T12:00:00').getDate()}<br/><span className="text-[10px] text-slate-500 font-normal">{diaSemana(date)}</span></th>)}
      </tr></thead>
      <tbody className="divide-y">
       {doMes.map(({membro:m,equipe,semEquipeNoMes})=><tr key={m.id} className="hover:bg-slate-50">
        <td className="p-2 border-r text-left sticky left-0 bg-white font-medium truncate z-10" title={semEquipeNoMes?'Tem presença marcada neste mês, mas não está na lista do mês':undefined}>
         {semEquipeNoMes&&<AlertTriangle className="w-3 h-3 inline text-amber-600 mr-1 -mt-0.5"/>}
         {!estaAtivo(m)&&<span className="text-[9px] bg-slate-200 text-slate-700 rounded px-1 py-0.5 mr-1 align-middle" title="Inativo: fica fora do preenchimento automático">INATIVO</span>}
         {m.nome} <span className="text-slate-400 font-normal">· {equipe}</span>
        </td>
        {monthDates.map(date=>{const present=!!cfg.efetivo[date]?.[m.id];return <td key={date} className="p-0 border-r relative">
         <button className={`w-full h-full min-h-[32px] hover:bg-slate-100 ${present?'text-emerald-700 font-bold bg-emerald-50':'text-slate-200'}`} onClick={()=>togglePresence(date,m.id)}>{present?'1':'•'}</button>
        </td>;})}
       </tr>)}
       <tr className="bg-slate-100 font-bold border-t">
        <td className="p-2 border-r text-left sticky left-0 z-10 bg-slate-100">Total Presentes</td>
        {monthDates.map(date=>{const total=doMes.reduce((a,x)=>a+(cfg.efetivo[date]?.[x.membro.id]?1:0),0);const rdo=rdoDays.find(d=>d.date===date)?.professionals??null;
         const titulo=rdo===null?'RDO sem número de profissionais':total>rdo?`RDO: ${rdo} — ${total-rdo} a mais`:total<rdo?`RDO: ${rdo} — falta ${rdo-total}`:`RDO: ${rdo}`;
         const cor=rdo===null?'text-slate-500':total===rdo?'text-emerald-700':rdo>0?'text-amber-600':'text-slate-800';
         return <td key={date} className="p-2 border-r" title={titulo}><span className={cor}>{total}</span></td>;})}
       </tr>
      </tbody>
     </table>
    </div>}
  </div>

  <div className="bg-white border rounded-xl p-4 space-y-4">
   <h2 className="text-xl font-bold">Histograma por Equipe — {rotulo}</h2>
   <p className="text-sm text-slate-600">Profissionais presentes por equipe e função em cada dia, pela equipe de cada pessoa neste mês.</p>
   {!histograma.length||!monthDates.length?<p className="text-amber-700 bg-amber-50 p-3 rounded">Não há dados para este mês.</p>
    :<div className="overflow-x-auto border rounded-lg">
     <table className="w-full text-xs text-center border-collapse">
      <thead className="bg-slate-50 border-b"><tr>
       <th className="p-2 border-r text-left bg-slate-50 min-w-[120px]">Equipe</th>
       <th className="p-2 border-r text-left bg-slate-50 min-w-[150px]">Função</th>
       {monthDates.map(date=><th key={date} className="p-2 border-r min-w-[36px]">{new Date(date+'T12:00:00').getDate()}</th>)}
      </tr></thead>
      <tbody className="divide-y">
       {[...new Set(histograma.map(l=>l.equipe))].map(eq=>{const ls=histograma.filter(l=>l.equipe===eq);return <React.Fragment key={eq}>
        {ls.map((l,idx)=><tr key={eq+l.funcao} className="hover:bg-slate-50">
         {idx===0&&<td className="p-2 border-r text-left bg-white font-bold align-top" rowSpan={ls.length}>{eq}</td>}
         <td className="p-2 border-r text-left font-medium truncate">{l.funcao}</td>
         {monthDates.map(d=><td key={d} className="p-0 border-r"><span className={`inline-block w-full min-h-[32px] pt-2 ${l.porData[d]?'text-emerald-700 font-bold bg-emerald-50':'text-slate-300'}`}>{l.porData[d]||'•'}</span></td>)}
        </tr>)}
        <tr className="bg-slate-50 font-semibold border-t">
         <td colSpan={2} className="p-2 border-r text-right text-slate-600 uppercase text-[10px]">Subtotal {eq}</td>
         {monthDates.map(d=><td key={d} className="p-2 border-r">{ls.reduce((a,l)=>a+(l.porData[d]||0),0)}</td>)}
        </tr>
       </React.Fragment>;})}
       <tr className="bg-slate-100 font-bold border-t">
        <td colSpan={2} className="p-2 border-r text-left">TOTAL GERAL</td>
        {monthDates.map(d=><td key={d} className="p-2 border-r">{totalHistograma(d)}</td>)}
       </tr>
      </tbody>
     </table>
    </div>}
  </div>
 </>;
}
