import React, {useState,useEffect,useRef,useMemo} from 'react';
import {PhotoUploader,StagedPhoto} from './components/PhotoUploader';
import {PhotoList} from './components/PhotoList';
import {ReportViewer} from './components/ReportViewer';
import {SettingsModal} from './components/SettingsModal';
import {AxisLogo, DERParanaLogo} from './components/DERLogos';
import {PhotoRecord,ReportConfig} from './types';
import {ReliabilityPanel} from './components/ReliabilityPanel';
import {DEFAULT_CONFIG} from './data/sampleData';
import {photoTags,uniqueTags,orderPhotos} from './services/organization';
import {RdoPanel} from './components/RdoPanel';
import {EquipePanel} from './components/equipe/EquipePanel';
import {migrarEquipe,marcarAtivosNoDia} from './services/equipe';
import {mesCorrente} from './components/equipe/comum';
import {EquipamentosPanel} from './components/EquipamentosPanel';
import {AcoesCorretivasPanel} from './components/AcoesCorretivasPanel';
import {PluviometriaPanel} from './components/PluviometriaPanel';
import {ObrasPage} from './components/obras/ObrasPage';
import {BoasVindas} from './components/obras/BoasVindas';
import {syncRdo,repairRdoFolderIds} from './services/rdo';
import { Camera, Image as ImageIcon, FileText, Calendar, Users, Tractor, AlertTriangle, CloudRain, Settings, HardDrive, Menu, X, Building2, List } from 'lucide-react';
import {CatalogosPage} from './components/catalogos/CatalogosPage';
import type {CatalogoId,Tela} from './services/catalogos';
import { createXlsx } from '../xlsxWriter';
import { VERSION } from '../version';
import { AuthModal } from './components/auth/AuthModal';
import { TeamModal } from './components/auth/TeamModal';
import { PlansModal } from './components/billing/PlansModal';
import { AdminBackofficeModal } from './components/admin/AdminBackofficeModal';
import { authApi, AuthUser, TenantInfo } from './services/authApi';
import { LogIn, LogOut, Crown, Zap, ShieldAlert } from 'lucide-react';

async function api(url:string,options?:RequestInit){
 const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw new Error(data.error||'Não foi possível concluir a operação.');return data;
}
const button='rounded-lg border border-slate-300 px-4 py-2 font-semibold bg-white hover:bg-slate-100 disabled:opacity-50';

// Helper function to export consolidated XLSX
async function exportConsolidatedXlsx(config: any, photos: any, workspace: any, rdo: any) {
  const sheets: any[] = [];
  
  // RDOs
  const rdoDays = rdo?.days || [];
  if (rdoDays.length > 0) {
    sheets.push({
      name: 'RDO',
      headers: ['Data', 'Nº RDO', 'Status', 'Clima', 'Profissionais', 'Suficiente?', 'Presente?', 'Observações'],
      rows: rdoDays.map((d: any) => [d.date, d.number, d.status, d.weather, d.professionals, d.sufficient, d.present, d.contractorNotes])
    });
  }

  // Equipe
  const equipe = config.equipe;
  if (equipe && equipe.members?.length > 0) {
    const dates = new Set(rdoDays.map((d:any) => d.date));
    Object.keys(equipe.efetivo || {}).forEach(d => dates.add(d));
    const allDates = Array.from(dates).sort() as string[];
    
    sheets.push({
      name: 'Equipe',
      headers: ['Nome', 'Função', ...allDates.map(d => d.slice(5)), 'Total'],
      rows: equipe.members.map((m: any) => {
        let total = 0;
        const row = [m.nome, m.funcao];
        allDates.forEach(date => {
          const present = !!equipe.efetivo[date]?.[m.id];
          if (present) total++;
          row.push(present ? 1 : null as any);
        });
        row.push(total);
        return row;
      })
    });
  }

  // Equipamentos
  const equip = config.equipamentos;
  if (equip && equip.items?.length > 0) {
    const dates = new Set(rdoDays.map((d:any) => d.date));
    Object.keys(equip.efetivo || {}).forEach(d => dates.add(d));
    const allDates = Array.from(dates).sort() as string[];
    
    const types = Array.from(new Set(equip.items.map((m: any) => m.nome.trim().toUpperCase()))).sort() as string[];
    sheets.push({
      name: 'Equipamentos',
      headers: ['Equipamento', ...allDates.map(d => d.slice(5)), 'Total'],
      rows: types.map(typeName => {
        let total = 0;
        const row = [typeName];
        allDates.forEach(date => {
          const val = equip.efetivo?.[date]?.[typeName] || 0;
          total += val;
          row.push(val ? String(val) : (null as any));
        });
        row.push(String(total));
        return row;
      })
    });
  }

  // Ações Corretivas
  const acoes = config.acoes;
  if (acoes && acoes.length > 0) {
    sheets.push({
      name: 'Acoes_Corretivas',
      headers: ['Nº RNF', 'Ação', 'Habilitação', 'Implementação'],
      rows: acoes.map((a: any) => [a.rnf, a.acao, a.habilitacao, a.implementacao])
    });
  }

  // Pluviometria
  const pluv = config.pluviometria;
  if (pluv && pluv.dias?.length > 0) {
    sheets.push({
      name: 'Pluviometria',
      headers: ['Data', 'Manhã', 'Tarde', 'Noite', 'Clima Geral', 'Precipitação (mm)', 'Observação'],
      rows: pluv.dias.map((d: any) => [d.data, d.manha, d.tarde, d.noite, d.clima || '', d.precipitacao || '', d.observacao])
    });
  }

  if (sheets.length === 0) return alert('Não há dados para exportar.');
  
  const bytes = createXlsx(sheets);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Pacote-Consolidado.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function App(){
 const [tab,setTab]=useState('capture');
 const [config,setConfig]=useState<ReportConfig>(DEFAULT_CONFIG);
 const [drafts,setDrafts]=useState<StagedPhoto[]>([]);
 const [importing,setImporting]=useState(false);
 const [panel,setPanel]=useState(false);
 const [retry,setRetry]=useState(0);
 const contentRevision=useRef('empty');
 const lastSaved=useRef('');
 const [photos,setPhotos]=useState<PhotoRecord[]>([]);
 const [ready,setReady]=useState(false);
 const [status,setStatus]=useState('Abrindo projeto…');
 const [error,setError]=useState('');
 const [storageWarning,setStorageWarning]=useState('');
 const [workspace,setWorkspace]=useState<{path:string|null;revision:string}>({path:'',revision:''});
 const [obraAtiva,setObraAtiva]=useState<any>(null);
 const [settings,setSettings]=useState(false);
 const [catalogoInicial,setCatalogoInicial]=useState<CatalogoId|undefined>(undefined);
 const [correcao,setCorrecao]=useState<{tela:Tela;ids:string[];item:string}|null>(null);
 const queue=useRef(Promise.resolve());const sequence=useRef(0);
 // The open obra could not be read (folder missing, invalid project): keep only
 // the Obras screen usable so another obra can be opened or this one removed.
 const [falhaAbertura,setFalhaAbertura]=useState(false);
 const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
 const [currentTenant, setCurrentTenant] = useState<TenantInfo | null>(null);
 const [authModalOpen, setAuthModalOpen] = useState(false);
 const [teamModalOpen, setTeamModalOpen] = useState(false);
 const [plansModalOpen, setPlansModalOpen] = useState(false);
 const [backofficeOpen, setBackofficeOpen] = useState(false);
 const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'admin_login'>('login');

 useEffect(() => {
   authApi.me().then(res => {
     setCurrentUser(res.user);
     setCurrentTenant(res.tenant);
   }).catch(() => {});
 }, []);
 useEffect(()=>{let pastaLida=false;(async()=>{
   const w=await api('/api/workspace');setWorkspace(w);contentRevision.current=w.contentRevision;pastaLida=true;
   if(!w.path){setReady(true);setTab('obras');return;}
   api('/api/obras').then((o:any)=>setObraAtiva((o.items||[]).find((x:any)=>x.id===o.activeId)||null)).catch(()=>{});
   const data=await api('/api/project');
  if(data){
   const c={...DEFAULT_CONFIG,...data.config};
   c.tagCatalog=uniqueTags([...(c.tagCatalog||[]),...data.photos.flatMap(photoTags)]);
   // Keep legacy folder IDs and memberships, but remove cloud connection settings.
   c.driveFolderId='';c.driveFolderUrl='';c.spreadsheetId='';c.spreadsheetUrl='';
   setConfig(c);setPhotos(data.photos);setDrafts(data.drafts||[]);contentRevision.current=data.contentRevision;
  }
  setReady(true);
 })().catch(e=>{setError(e.message);if(pastaLida){setFalhaAbertura(true);setTab('obras');}});},[]);
  useEffect(()=>{
   if(!ready||!config.rdo)return;
   const repaired=repairRdoFolderIds(config.rdo,photos,config.availableFolders);
   const next=syncRdo(repaired,photos,config.pluviometria?.dias||[]);
   if(next!==config.rdo)setConfig(c=>({...c,rdo:next}));
  },[ready,photos,config.rdo,config.pluviometria,config.availableFolders]);
 // The project carries every photo, so typing must not trigger one full
 // write per keystroke: changes are grouped and written after a short pause.
 const pendingSave=useRef<(()=>void)|null>(null);const saveTimer=useRef<number|undefined>(undefined);
 useEffect(()=>{
  if(!ready||!workspace.path)return;
  const seq=++sequence.current;setStatus('Salvando…');
  const run=()=>{
   pendingSave.current=null;window.clearTimeout(saveTimer.current);
   const body=JSON.stringify({version:1,config,photos,drafts});
   queue.current=queue.current.catch(()=>{}).then(async()=>{
    const result=await api('/api/project',{method:'PUT',headers:{'Content-Type':'application/json','X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current},body});
    contentRevision.current=result.contentRevision;lastSaved.current=new Date(result.savedAt).toLocaleTimeString('pt-BR');
    setStorageWarning(result.warning||'');
    if(seq===sequence.current)setStatus('Salvo neste PC');
   }).catch(e=>{setStatus('Falha ao salvar — exporte um backup');setError(e.message);throw e;});
   queue.current.catch(()=>{});
  };
  pendingSave.current=run;window.clearTimeout(saveTimer.current);saveTimer.current=window.setTimeout(run,800);
 },[ready,config,photos,drafts,retry]);
 const flush=()=>{pendingSave.current?.();return queue.current;};
 useEffect(()=>{
  const warn=(e:BeforeUnloadEvent)=>{if(importing||(ready&&workspace.path&&status!=='Salvo neste PC')){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[ready,status,importing,workspace.path]);
 const update=(v:Partial<ReportConfig>)=>setConfig(c=>({...c,...v}));
 // The RDO asks the team how many are active instead of asking the user to guess.
 const equipePronta=useMemo(()=>migrarEquipe({members:Array.isArray(config.equipe?.members)?config.equipe!.members:[],efetivo:config.equipe?.efetivo||{}},mesCorrente()),[config.equipe]);
 const resumoEfetivo=(data:string)=>{const r=marcarAtivosNoDia(equipePronta,data);return {ativos:r.marcados,inativos:r.inativos,tinhaMarca:r.tinhaMarca};};
 const aplicarEfetivo=(data:string)=>{const r=marcarAtivosNoDia(equipePronta,data);if(r.marcados)update({equipe:r.cfg});return r.marcados;};

 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

 const semObra=ready&&!workspace.path;
 const abrirCatalogo=(c:CatalogoId)=>{setCatalogoInicial(c);setTab('catalogos');};
 const correcaoDe=(tela:Tela)=>correcao&&correcao.tela===tela?{ids:correcao.ids,item:correcao.item}:undefined;
 const limparCorrecao=()=>setCorrecao(null);
 const TABS = [
  { id: 'obras', label: 'Obras', icon: Building2 },
  { id: 'capture', label: 'Importar fotos', icon: Camera },
  { id: 'manager', label: `Gerenciar fotos (${photos.length})`, icon: ImageIcon },
  { id: 'report', label: 'Relatório Fotográfico', icon: FileText },
  { id: 'rdo', label: 'Diário de obras', icon: Calendar },
  { id: 'equipe', label: 'Equipe Técnica', icon: Users },
  { id: 'equipamentos', label: 'Equipamentos', icon: Tractor },
  { id: 'acoes', label: 'Ações Corretivas', icon: AlertTriangle },
  { id: 'pluviometria', label: 'Pluviometria', icon: CloudRain },
  { id: 'catalogos', label: 'Catálogos', icon: List },
  { id: 'configuracoes', label: 'Configurações', icon: Settings }
 ];

 return <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col md:flex-row">
   <aside className={`print:hidden ${mobileMenuOpen ? 'block' : 'hidden'} md:flex flex-col w-full md:w-64 bg-slate-900 text-slate-300 shrink-0 border-r border-slate-800 sticky top-0 md:h-screen overflow-y-auto`}>
    <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
      <AxisLogo className="h-8" variant="full" />
      <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
        <X className="w-5 h-5" />
      </button>
    </div>
    <nav className="flex-1 py-4 flex flex-col gap-1 px-2" aria-label="Seções">
     {TABS.map(t => {
       const Icon = t.icon;
       const active = tab === t.id;
       return <button key={t.id} onClick={() => { setTab(t.id); setCorrecao(null); setMobileMenuOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-emerald-700 text-white shadow-sm' : 'hover:bg-slate-800 hover:text-white'} disabled:opacity-50`} disabled={(!ready && !(falhaAbertura && t.id === 'obras')) || importing || (semObra && t.id !== 'obras')}>
         <Icon className="w-4 h-4 shrink-0" />
         <span className="truncate">{t.label}</span>
       </button>;
     })}
    </nav>
    <button className="p-4 border-t border-slate-800 text-xs text-left w-full hover:bg-slate-800 disabled:hover:bg-transparent" disabled={!ready && !falhaAbertura} onClick={() => { setTab('obras'); setMobileMenuOpen(false); }} title="Ver obras">
      {semObra ? <p className="text-white font-semibold">Nenhuma obra aberta</p> : obraAtiva && <p className="text-white font-semibold truncate" title={obraAtiva.nome}>{obraAtiva.nome}</p>}
      <p className="text-slate-500 truncate" title={workspace.path || ''}>{workspace.path || (ready ? '' : 'Carregando…')}</p>
      <p className="text-emerald-500 mt-1">{semObra ? 'Escolha ou crie uma obra' : importing ? 'Lendo fotos...' : status}</p>
    </button>
   </aside>

   <div className="flex-1 flex flex-col min-w-0">
    <header className="print:hidden md:hidden bg-slate-900 text-white p-3.5 flex items-center justify-between sticky top-0 z-30">
      <AxisLogo className="h-8" variant="full" />
      <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-400 hover:text-white">
        <Menu className="w-6 h-6" />
      </button>
    </header>

    <section className="print:hidden p-4 bg-white border-b sticky top-0 z-20 md:static shadow-sm flex flex-wrap gap-2 items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="hidden md:block">
          <AxisLogo className="h-8" variant="report" />
        </div>
        <div className="text-sm">
          <p className="font-semibold">{semObra ? 'Nenhuma obra aberta' : TABS.find(t => t.id === tab)?.label}</p>
          <p className="text-xs text-slate-500">{lastSaved.current && `Salvo: ${lastSaved.current}`} {drafts.length > 0 && `• ${drafts.length} rascunhos`}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {currentUser && currentTenant ? (
          <>
            {(currentUser.isSuperAdmin || currentUser.role === 'SUPERADMIN') && (
              <button
                type="button"
                onClick={() => setBackofficeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-md shadow-amber-500/20 transition"
                title="Abrir Backoffice Master da Axis Consultoria"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Gestão Master Axis</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPlansModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition shadow-xs ${
                currentTenant.plano === 'CORPORATIVO'
                  ? 'bg-amber-500/10 text-amber-800 border-amber-300 hover:bg-amber-500/20'
                  : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              }`}
              title="Gerenciar Plano e Assinatura"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>{currentTenant.plano === 'CORPORATIVO' ? 'Corporativo' : 'Individual'}</span>
              {currentTenant.plano === 'INDIVIDUAL' && currentUser.role === 'ADMIN' && (
                <span className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> Upgrade
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <div className="flex flex-col text-right leading-tight">
              <span className="font-bold text-slate-900">{currentUser.nome}</span>
              <span className="text-[10px] text-sky-700 font-semibold">{currentTenant.nome} ({currentUser.role})</span>
            </div>
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setTeamModalOpen(true)}
                className="p-1.5 hover:bg-slate-200 text-sky-700 rounded-md transition-colors"
                title="Gestão de Usuários / Assentos"
              >
                <Users className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await authApi.logout();
                setCurrentUser(null);
                setCurrentTenant(null);
              }}
              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white px-3 py-1.5 rounded-lg shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Área do Cliente</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthModalMode('admin_login'); setAuthModalOpen(true); }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
              title="Acesso Master para Gestores da Axis Consultoria"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Gestão Axis</span>
            </button>
          </div>
        )}
        <button className={button + ' !bg-emerald-700 !text-white !border-emerald-700 flex items-center gap-1'} onClick={() => exportConsolidatedXlsx(config, photos, workspace, config.rdo)} disabled={!ready || importing || semObra}>
          <FileText className="w-4 h-4" /> Pacote Consolidado (XLSX)
        </button>
        <button className={button} disabled={importing} onClick={()=>setPanel(true)}><HardDrive className="w-4 h-4 inline mr-1 -mt-0.5" />Backup e Info</button>
        {status.startsWith('Falha')&&<button className={button} onClick={()=>setRetry(x=>x+1)}>Tentar salvar novamente</button>}
      </div>
    </section>

    <main className="p-4 md:p-6 flex-1 overflow-auto bg-slate-50 relative">
     {error&&<p role="alert" className="p-3 bg-red-50 text-red-800 rounded-lg mb-4">{error}</p>}
     {storageWarning&&<p role="alert" className="p-3 bg-amber-50 text-amber-900 rounded-lg mb-4 whitespace-pre-wrap">{storageWarning}</p>}
     {photos.some(p=>!p.imageUrl.startsWith('data:'))&&<p role="alert" className="p-3 bg-amber-50 text-amber-900 rounded-lg mb-4">Há imagens antigas que não estão incorporadas ao projeto. Importe os arquivos originais do PC para utilizá-las offline.</p>}

     {semObra&&<BoasVindas workspace={workspace} flush={flush} importing={importing}/>}
     {falhaAbertura&&!ready&&<ObrasPage workspace={workspace} flush={flush} importing={importing}/>}
     {ready&&!semObra&&<>
      {tab==='obras'&&<ObrasPage workspace={workspace} flush={flush} importing={importing}/>}
      {tab==='capture'&&<PhotoUploader stagedPhotos={drafts} setStagedPhotos={setDrafts} onImportBusy={setImporting} config={config} allPhotos={photos} onUpdateConfig={update} onDeletePhotos={ids=>{const selected=new Set(ids);setPhotos(old=>old.filter(p=>!selected.has(p.id)));}} flush={flush} headers={()=>({'X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current})} onPhotosAdded={p=>{setPhotos(prev=>{
  const merged=[...prev,...p].sort((a,b)=>a.timestamp-b.timestamp);
  if(!prev.some(x=>x.manualOrder!==undefined))return merged;
  // Keep the manual sequence: new photos are inserted at their chronological
  // position and the whole sequence is renumbered.
  const sequence=orderPhotos(prev);
  for(const added of [...p].sort((a,b)=>a.timestamp-b.timestamp)){
    let index=sequence.findIndex(x=>x.timestamp>added.timestamp);
    if(index<0)index=sequence.length;
    sequence.splice(index,0,added);
  }
  return sequence.map((photo,i)=>({...photo,manualOrder:i}));
});setDrafts([]);setTab('report');}}onAbrirCatalogo={abrirCatalogo} />}
      {tab==='manager'&&<PhotoList config={config} photos={photos} onUpdateConfig={update} onAddEditedPhoto={p=>setPhotos(old=>[...old,p])} onUpdatePhoto={p=>setPhotos(old=>old.map(x=>x.id===p.id?p:x))} onMovePhotos={(ids,folderId)=>{const target=config.availableFolders?.find(f=>f.id===folderId);const set=new Set(ids);setPhotos(old=>old.map(p=>set.has(p.id)?{...p,folderId,folderName:target?.name||p.folderName}:p));}} onSetPhotoOrder={ids=>{const pos=new Map(ids.map((id,i)=>[id,i]));setPhotos(old=>old.map(p=>{const i=pos.get(p.id);if(i===undefined)return p.manualOrder===undefined?p:{...p,manualOrder:undefined};return p.manualOrder===i?p:{...p,manualOrder:i};}));}} onClearPhotoOrder={()=>setPhotos(old=>old.map(p=>p.manualOrder===undefined?p:{...p,manualOrder:undefined}))} onDeletePhotos={ids=>{const selected=new Set(ids);setPhotos(old=>old.filter(p=>!selected.has(p.id)));}} onDeletePhoto={id=>{if(confirm('Remover esta foto do projeto?'))setPhotos(p=>p.filter(x=>x.id!==id));}}onAbrirCatalogo={abrirCatalogo} correcao={correcaoDe('fotos')} onLimparCorrecao={limparCorrecao} />}
      {tab==='report'&&<ReportViewer config={config} photos={photos} onUpdateConfig={update}/>}
      {tab==='rdo'&&<RdoPanel config={config} photos={photos} resumoEfetivo={resumoEfetivo} aplicarEfetivo={aplicarEfetivo} onChange={rdo=>update({rdo})} flush={flush} headers={()=>({'X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current})} onPhotos={()=>setTab('manager')}/>}
      
      {/* New Tabs Content placeholers */}
      {tab==='equipe'&&<EquipePanel config={config} onChange={update} flush={flush} onAbrirCatalogo={abrirCatalogo} headers={()=>({'X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current})} correcao={correcaoDe('equipe')} onLimparCorrecao={limparCorrecao} />}
      {tab==='equipamentos'&&<EquipamentosPanel config={config} onChange={update} flush={flush} onAbrirCatalogo={abrirCatalogo} correcao={correcaoDe('equipamentos')} onLimparCorrecao={limparCorrecao} />}
      {tab==='acoes'&&<AcoesCorretivasPanel config={config} onChange={update} flush={flush} onAbrirCatalogo={abrirCatalogo} correcao={correcaoDe('acoes')} onLimparCorrecao={limparCorrecao} />}
      {tab==='pluviometria'&&<PluviometriaPanel config={config} onChange={update} flush={flush} />}
      {tab==='catalogos'&&<CatalogosPage config={config} photos={photos} inicial={catalogoInicial}
        onAplicar={(c,p)=>{setConfig(c);setPhotos(p);}}
        onCorrigir={c=>{setCorrecao(c);setTab(c.tela==='fotos'?'manager':c.tela);}}
        flush={flush} headers={()=>({'X-Workspace-Revision':workspace.revision,'X-Project-Revision':contentRevision.current})}/>}
      {tab==='configuracoes'&&<div className="max-w-2xl mx-auto"><SettingsModal isOpen={true} onClose={()=>{}} config={config} onSave={setConfig} inline={true} onAbrirCatalogo={abrirCatalogo} /></div>}
     </>}
    </main>
   </div>

   {panel&&<ReliabilityPanel onClose={()=>setPanel(false)} workspace={workspace} contentRevision={()=>contentRevision.current} flush={flush}/> }

   <AuthModal
     isOpen={authModalOpen}
     onClose={() => setAuthModalOpen(false)}
     initialMode={authModalMode}
     onSuccess={(user, tenant) => {
       setCurrentUser(user);
       setCurrentTenant(tenant);
       if (user.isSuperAdmin || user.role === 'SUPERADMIN') {
         setBackofficeOpen(true);
       }
     }}
   />

   {currentTenant && (
     <TeamModal
       isOpen={teamModalOpen}
       onClose={() => setTeamModalOpen(false)}
       tenant={currentTenant}
     />
   )}

   <PlansModal
     isOpen={plansModalOpen}
     onClose={() => setPlansModalOpen(false)}
     currentUser={currentUser}
     onPlanUpdated={() => {
       authApi.me().then(res => {
         setCurrentUser(res.user);
         setCurrentTenant(res.tenant);
       }).catch(() => {});
     }}
   />

   <AdminBackofficeModal
     isOpen={backofficeOpen}
     onClose={() => setBackofficeOpen(false)}
     currentUser={currentUser}
   />
 </div>;
}
