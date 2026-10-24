import React,{useState} from 'react';
import {obrasApi,sugerirNome} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao,useLocalDaObra} from './Painel';

export function ImportarBackup({workspace,flush,importing,raiz,sugestao,onClose}:PainelBase){
 const [arquivo,setArquivo]=useState<File|null>(null);const [nome,setNome]=useState('');
 const local=useLocalDaObra(raiz,sugestao);const {ocupado,erro,executar}=useAcao();
 const nomeDoArquivo=(f:File)=>sugerirNome(f.name.replace(/\.json$/i,'').replace(/^DER-backup-/i,''));
 const escolher=async(file:File|null)=>{
  setArquivo(file);if(!file)return;
  try{const data=JSON.parse(await file.text());const project=data?.kind==='der-backup'?data.project:data;const contrato=project?.config?.contrato;setNome(typeof contrato==='string'&&contrato.trim()?sugerirNome(contrato):nomeDoArquivo(file));}
  catch{setNome(nomeDoArquivo(file));}
 };
 const importar=()=>executar(async()=>{
  if(importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');
  if(!arquivo)throw new Error('Selecione o arquivo de backup.');
  if(!nome.trim())throw new Error('Informe o nome da obra.');
  if(!local.base)throw new Error('Informe onde guardar a obra.');
  let data:any;try{data=JSON.parse(await arquivo.text());}catch{throw new Error('O arquivo não é um backup válido (conteúdo ilegível).');}
  const managed=data?.kind==='der-backup';
  if(managed&&(data.version!==1||typeof data.sha256!=='string'))throw new Error('Arquivo de backup interno inválido.');
  await local.confirmarRaiz();
  await flush();
  await obrasApi.importar({revision:workspace.revision,nome:nome.trim(),project:managed?data.project:data,backupHash:managed?data.sha256:undefined,path:local.pathInformado});
  location.reload();
 });
 return <Painel titulo="Importar obra de backup" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Cria uma <strong>obra nova</strong> a partir do arquivo de backup e a abre em seguida. A obra aberta agora não é alterada. Para voltar a obra aberta a um backup anterior, use <strong>Backup e Info</strong>.</p>
  <label className="block text-sm font-semibold">Arquivo de backup (.json)
   <input className={campo+' mt-1 text-sm'} type="file" accept=".json,application/json" disabled={ocupado} onChange={e=>escolher(e.target.files?.[0]||null)}/>
  </label>
  <label className="block text-sm font-semibold">Nome da obra
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} disabled={ocupado}/>
  </label>
  {local.campos(nome,ocupado)}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!arquivo||!nome.trim()||!local.base} onClick={importar}>{ocupado?'Importando…':'Importar e abrir'}</button></div>
 </Painel>;
}
