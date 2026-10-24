import React,{useEffect,useMemo,useState} from 'react';
import {Building2,FolderSearch,Plus,Search,Upload} from 'lucide-react';
import {ObraRow,Workspace,obrasApi} from '../../services/obrasApi';
import {VERSION} from '../../../version';
import {ObraCard} from './ObraCard';
import {botao,botaoPrimario} from './paineis/Painel';
import {DefinirRaiz} from './paineis/DefinirRaiz';
import {NovaObra} from './paineis/NovaObra';
import {AbrirOutraPasta} from './paineis/AbrirOutraPasta';
import {ImportarBackup} from './paineis/ImportarBackup';
import {Duplicar} from './paineis/Duplicar';
import {Mover} from './paineis/Mover';
import {Remover} from './paineis/Remover';

type PainelAberto={tipo:'raiz'}|{tipo:'nova'}|{tipo:'outra'}|{tipo:'importar'}|{tipo:'duplicar';obra:ObraRow}|{tipo:'mover';obra:ObraRow}|{tipo:'remover';obra:ObraRow}|null;

export function ObrasPage({workspace,flush,importing,boasVindas=false}:{workspace:Workspace;flush:()=>Promise<unknown>;importing:boolean;boasVindas?:boolean}){
 const [items,setItems]=useState<ObraRow[]>([]);const [raiz,setRaiz]=useState<string|null>(null);const [sugestao,setSugestao]=useState('');
 const [painel,setPainel]=useState<PainelAberto>(null);const [busca,setBusca]=useState('');const [ordem,setOrdem]=useState<'acesso'|'nome'>('acesso');
 const [erro,setErro]=useState('');const [aviso,setAviso]=useState('');const [versaoServidor,setVersaoServidor]=useState('');
 const carregar=async()=>{try{const [l,r]=await Promise.all([obrasApi.listar(),obrasApi.raiz()]);setItems(l.items);setRaiz(l.raiz);setSugestao(r.sugestao);}catch(e:any){setErro(e.message);}};
 useEffect(()=>{carregar();fetch('/api/health').then(r=>r.json()).then(h=>{if(h.version&&h.version!==VERSION)setVersaoServidor(h.version);}).catch(()=>{});},[]);
 const visiveis=useMemo(()=>{
  const termo=busca.trim().toLocaleLowerCase('pt-BR');
  return items
   .filter(o=>!termo||[o.nome,o.path,o.ficha.contrato,o.ficha.rodovia,o.ficha.trecho].some(v=>v.toLocaleLowerCase('pt-BR').includes(termo)))
   .sort((a,b)=>(Number(b.active)-Number(a.active))||(ordem==='nome'?a.nome.localeCompare(b.nome,'pt-BR'):b.lastAccessAt.localeCompare(a.lastAccessAt)));
 },[items,busca,ordem]);
 const abrir=async(o:ObraRow)=>{setErro('');try{if(importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');await flush();await obrasApi.abrir(o.id,workspace.revision);location.reload();}catch(e:any){setErro(e.message);}};
 const renomear=async(o:ObraRow,nome:string)=>{const d=await obrasApi.renomear(o.id,nome);setItems(old=>old.map(x=>x.id===o.id?{...x,...d.obra}:x));};
 const fechar=()=>setPainel(null);
 const concluido=async(mensagem?:string)=>{setPainel(null);setAviso(mensagem||'');await carregar();};
 const base={workspace,flush,importing,raiz,sugestao,onClose:fechar,onDone:concluido};
 const acoes=[
  {tipo:'nova' as const,titulo:'Nova obra',texto:'Começar uma obra vazia.',icone:Plus},
  {tipo:'outra' as const,titulo:'Abrir obra de outra pasta',texto:'Usar uma obra que já existe no computador.',icone:FolderSearch},
  {tipo:'importar' as const,titulo:'Importar backup',texto:'Criar uma obra a partir de um arquivo de backup.',icone:Upload},
 ];
 return <div className="max-w-4xl mx-auto space-y-4">
  {boasVindas&&<section className="bg-white border rounded-xl p-6 text-center space-y-2">
   <Building2 className="w-10 h-10 mx-auto text-emerald-700"/>
   <h2 className="text-2xl font-bold">Nenhuma obra aberta</h2>
   <p className="text-sm text-slate-600">Crie uma obra nova, abra uma obra que já existe no computador ou importe um backup. As demais abas ficam disponíveis assim que uma obra estiver aberta.</p>
  </section>}
  {versaoServidor&&<p role="alert" className="text-sm bg-red-50 border border-red-300 text-red-800 p-3 rounded-lg">O servidor está na versão <strong>{versaoServidor}</strong> e a interface é a <strong>{VERSION}</strong>. Feche a janela do aplicativo e a janela de comandos e abra novamente pelo INICIAR.cmd.</p>}
  <section className="bg-white border rounded-xl p-4 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm"><span className="font-semibold">Pasta das obras:</span> <span className="break-all">{raiz||<em className="text-slate-500">não definida (sugestão: {sugestao})</em>}</span></p>
    <button className={botao} onClick={()=>setPainel({tipo:'raiz'})}>{raiz?'Alterar':'Definir'}</button>
   </div>
   {boasVindas
    ?<div className="grid sm:grid-cols-3 gap-3">{acoes.map(a=><button key={a.tipo} className="border-2 border-slate-200 hover:border-emerald-500 rounded-xl p-4 text-left space-y-1" onClick={()=>setPainel({tipo:a.tipo})}><a.icone className="w-6 h-6 text-emerald-700"/><p className="font-semibold">{a.titulo}</p><p className="text-xs text-slate-600">{a.texto}</p></button>)}</div>
    :<div className="flex flex-wrap gap-2">{acoes.map(a=><button key={a.tipo} className={a.tipo==='nova'?botaoPrimario:botao} onClick={()=>setPainel({tipo:a.tipo})}><a.icone className="w-4 h-4"/> {a.titulo}</button>)}</div>}
  </section>
  {aviso&&<p role="status" className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 p-3 rounded-lg whitespace-pre-wrap">{aviso}</p>}
  {erro&&<p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 p-3 rounded-lg">{erro}</p>}
  <section className="space-y-3">
   {items.length>0&&<div className="flex flex-wrap gap-2 items-center">
    <label className="flex-1 min-w-[200px] relative"><Search className="w-4 h-4 absolute left-2 top-3 text-slate-400"/><input className="w-full border border-slate-300 rounded-lg p-2 pl-8 text-sm bg-white" placeholder="Buscar por nome, contrato, rodovia ou pasta" value={busca} onChange={e=>setBusca(e.target.value)} aria-label="Buscar obra"/></label>
    <select className="border border-slate-300 rounded-lg p-2 text-sm bg-white" value={ordem} onChange={e=>setOrdem(e.target.value as 'acesso'|'nome')} aria-label="Ordenar obras"><option value="acesso">Último acesso</option><option value="nome">Nome</option></select>
   </div>}
   {visiveis.length===0&&<p className="text-sm text-slate-500 bg-white border rounded-xl p-4">{items.length?'Nenhuma obra corresponde à busca.':'Nenhuma obra registrada.'}</p>}
   {visiveis.map(o=><React.Fragment key={o.id}><ObraCard obra={o} importing={importing} onAbrir={()=>abrir(o)} onRenomear={nome=>renomear(o,nome)} onDuplicar={()=>setPainel({tipo:'duplicar',obra:o})} onMover={()=>setPainel({tipo:'mover',obra:o})} onRemover={()=>setPainel({tipo:'remover',obra:o})}/></React.Fragment>)}
  </section>
  {painel?.tipo==='raiz'&&<DefinirRaiz raiz={raiz} sugestao={sugestao} onClose={fechar} onDone={concluido}/>}
  {painel?.tipo==='nova'&&<NovaObra {...base}/>}
  {painel?.tipo==='outra'&&<AbrirOutraPasta {...base}/>}
  {painel?.tipo==='importar'&&<ImportarBackup {...base}/>}
  {painel?.tipo==='duplicar'&&<Duplicar {...base} obra={painel.obra}/>}
  {painel?.tipo==='mover'&&<Mover {...base} obra={painel.obra}/>}
  {painel?.tipo==='remover'&&<Remover {...base} obra={painel.obra}/>}
 </div>;
}
