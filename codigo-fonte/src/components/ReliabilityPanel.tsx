import React,{useEffect,useState} from 'react';
const button='px-3 py-2 border rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50';
export function ReliabilityPanel({onClose,workspace,contentRevision,flush}:any){
 const [data,setData]=useState<any>(null),[diag,setDiag]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [settings,setSettings]=useState({daily:7,weekly:4,secondary:'',max:0});
 async function read(url:string){const r=await fetch(url);let j:any=null;try{j=await r.json();}catch{/*@keep*/}if(!r.ok)throw new Error(j?.error||`Falha ao consultar o servidor (HTTP ${r.status}).`);return j;}
 async function reload(){const [b,d]=await Promise.all([workspace.path?read('/api/backups'):Promise.resolve(null),read('/api/diagnostics')]);setData(b);setSettings({daily:7,weekly:4,secondary:'',max:0,...(b?.settings||{})});setDiag(d);}
 useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
 async function action(url:string,body:any,method='POST'){
  setBusy(true);setError('');try{
    await flush();const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision()},body:JSON.stringify(body)});
    let j:any=null;try{j=await r.json();}catch{/*@keep*/}if(!r.ok)throw new Error(j?.error||`Falha na operação (HTTP ${r.status}).`);
   if(url==='/api/project/restore'){location.reload();return;}
   await reload();if(j.warning)setError(j.warning);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 const exportDiagnostic=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(diag,null,2)],{type:'application/json'}));a.download='DER-diagnostico.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);};
 return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="backup-title">
  <div className="bg-white rounded-xl p-5 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-4">
   <div className="flex justify-between items-center"><h2 id="backup-title" className="text-xl font-bold">Backups e diagnóstico</h2><button className={button} disabled={busy} onClick={onClose}>Fechar</button></div>
   {diag&&<section className="bg-slate-50 border rounded-lg p-3 text-sm space-y-1">
    <p><strong>Versão:</strong> {diag.version} • Offline</p><p className="break-all"><strong>Pasta:</strong> {diag.workspace}</p>
    <p><strong>Espaço livre:</strong> {diag.freeBytes===null?'Indisponível':`${(diag.freeBytes/1073741824).toFixed(1)} GB`}</p>
    <p><strong>Último salvamento:</strong> {diag.lastSaved?new Date(diag.lastSaved).toLocaleString('pt-BR'):'Nenhum'}</p>
    <p><strong>Último backup:</strong> {diag.lastBackup?new Date(diag.lastBackup).toLocaleString('pt-BR'):'Nenhum'}</p>
    {diag.lastError&&<p className="text-red-800">Último erro: {diag.lastError.message}</p>}
    <button onClick={exportDiagnostic} className={button}>Exportar diagnóstico sem fotografias</button>
   </section>}
   {workspace.path?<>
   <section className="border rounded-lg p-3 space-y-3">
    <h3 className="font-bold">Backup automático</h3>
    <p className="text-sm">Preserva o estado anterior ao primeiro salvamento da sessão/dia e antes de remoções ou restaurações. Cópias manuais e antes de alterações não são removidas pela retenção diária/semanal, mas respeitam o limite máximo de cópias.</p>
    <div className="flex gap-3 flex-wrap">
      <label className="text-sm">Cópias diárias<input aria-label="Cópias diárias" type="number" min="1" max="90" className="block border rounded p-2 w-24" value={settings.daily} onChange={e=>setSettings({...settings,daily:Math.max(1,Math.min(90,Math.round(Number(e.target.value))||1))})}/></label>
      <label className="text-sm">Cópias semanais<input aria-label="Cópias semanais" type="number" min="0" max="52" className="block border rounded p-2 w-24" value={settings.weekly} onChange={e=>setSettings({...settings,weekly:Math.max(0,Math.min(52,Math.round(Number(e.target.value))||0))})}/></label>
      <label className="text-sm">Máximo de backups<input aria-label="Máximo de backups" type="number" min="0" max="1000" className="block border rounded p-2 w-24" value={settings.max} onChange={e=>setSettings({...settings,max:Math.max(0,Math.min(1000,Math.round(Number(e.target.value))||0))})}/><span className="text-xs text-slate-500">0 = sem limite. Ao ultrapassar, os mais antigos são apagados.</span></label>
    </div>
    <label className="block text-sm">Segundo destino (opcional, caminho completo)<input className="block w-full border rounded p-2 mt-1" value={settings.secondary} onChange={e=>setSettings({...settings,secondary:e.target.value})} placeholder="D:\\Backups\\Obra-PR317"/></label>
    <p className="text-sm text-slate-600">Prefira outro disco ou pendrive. Uma segunda pasta no mesmo disco não protege contra falha física desse disco.</p>
    <button className={button} disabled={busy} onClick={()=>action('/api/backups/settings',settings,'PUT')}>Salvar opções</button>
    <button className={button+' ml-2'} disabled={busy} onClick={()=>action('/api/backups',{})}>Criar backup agora</button>
   </section>
   {(error||data?.warning)&&<p role="alert" className="bg-amber-50 text-amber-900 p-3 rounded">{error||data.warning}</p>}
   <h3 className="font-bold">Restaurar esta obra para um backup anterior</h3>
   <p className="text-sm text-slate-600">Substitui o conteúdo da obra aberta pelo da cópia escolhida. Um backup do estado atual é criado antes. Para trazer um backup como obra nova, use <strong>Obras → Importar backup</strong>.</p>
   {!data?.items?.length&&<p className="text-sm">Nenhum backup datado nesta pasta.</p>}
   <div className="space-y-2">{data?.items?.map((b:any)=><div key={b.id} className="border rounded-lg p-3 flex justify-between gap-3 items-center">
    <div className="text-sm"><p className="font-semibold">{b.date?new Date(b.date).toLocaleString('pt-BR'):'Arquivo inválido'}</p><p>{b.contract} • {b.photos} fotos • {b.drafts} rascunhos</p><p>{b.reason} • {b.valid?'Integridade verificada':'Não pode ser restaurado'}</p></div>
    <div className="flex items-center gap-2 shrink-0">
     <button className={button} disabled={busy||!b.valid} onClick={()=>{if(confirm(`Restaurar a cópia de ${new Date(b.date).toLocaleString('pt-BR')} (${b.photos} fotos e ${b.drafts} rascunhos)? O projeto atual será preservado antes da substituição.`))action('/api/project/restore',{id:b.id});}}>Restaurar</button>
     <button className={button+' !text-rose-700 hover:!bg-rose-50'} disabled={busy} onClick={()=>{if(confirm(`Excluir permanentemente a cópia de ${b.date?new Date(b.date).toLocaleString('pt-BR'):b.id} (${b.photos} fotos)? Esta ação não pode ser desfeita.`))action('/api/backups/'+encodeURIComponent(b.id),{},'DELETE');}}>Excluir</button>
    </div>
   </div>)}</div>
   </>:<p className="text-sm bg-slate-50 border rounded-lg p-3">Nenhuma obra aberta. Os backups ficam disponíveis depois de abrir ou criar uma obra.</p>}
  </div>
 </div>;
}
