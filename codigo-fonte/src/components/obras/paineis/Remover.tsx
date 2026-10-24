import React,{useState} from 'react';
import {ObraRow,ResultadoRemocao,normalizarNome,obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao} from './Painel';

export function Remover({obra,workspace,flush,importing,onClose,onDone}:PainelBase&{obra:ObraRow}){
 const [apagar,setApagar]=useState(false);const [backupAntes,setBackupAntes]=useState(true);const [confirmacao,setConfirmacao]=useState('');
 const [resultado,setResultado]=useState<ResultadoRemocao|null>(null);const {ocupado,erro,executar}=useAcao();
 const podeBaixar=obra.available&&obra.hasProject;
 const confere=normalizarNome(confirmacao)===normalizarNome(obra.nome);
 const remover=()=>executar(async()=>{
  if(obra.active&&importing)throw new Error('Aguarde a importação das fotos terminar antes de remover a obra em uso.');
  if(obra.active)await flush();
  if(apagar&&backupAntes&&podeBaixar)await obrasApi.baixarBackup(obra);
  const r=await obrasApi.remover(obra.id,{revision:workspace.revision,apagarArquivos:apagar,confirmacao:apagar?confirmacao:undefined});
  if(r.semObra&&!r.preservados.length){location.reload();return;}
  setResultado(r);
 });
 const continuar=()=>{
  if(resultado?.semObra){location.reload();return;}
  onDone(apagar?`Obra "${obra.nome}" removida e arquivos apagados.`:`Obra "${obra.nome}" removida da lista. Os arquivos continuam em ${obra.path}.`);
 };
 if(resultado)return <Painel titulo="Obra removida" onClose={continuar}>
  <p className="text-sm">"{obra.nome}" saiu da lista.</p>
  {resultado.apagados.length>0&&<p className="text-sm">Apagados: {resultado.apagados.join(', ')}.</p>}
  {resultado.preservados.length>0&&<div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
   <p className="font-semibold">Estes itens não pertencem ao app e foram mantidos em <span className="break-all">{obra.path}</span>:</p>
   <ul className="list-disc pl-5">{resultado.preservados.map(n=><li key={n}>{n}</li>)}</ul>
  </div>}
  {!apagar&&<p className="text-sm">Os arquivos continuam em <span className="break-all">{obra.path}</span>.</p>}
  <div className="flex justify-end"><button className={botaoPrimario} onClick={continuar}>Continuar</button></div>
 </Painel>;
 return <Painel titulo={`Remover "${obra.nome}"`} onClose={onClose} ocupado={ocupado}>
  <p className="text-sm">A obra sai da lista.{!apagar&&<> Os arquivos continuam em <span className="break-all">{obra.path}</span>.</>}</p>
  {obra.active&&<p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">Esta é a obra em uso. Depois disso nenhuma obra ficará aberta e você escolherá ou criará outra.</p>}
  <label className="flex items-start gap-2 text-sm">
   <input type="checkbox" className="mt-0.5" checked={apagar} disabled={ocupado||!obra.available} onChange={e=>setApagar(e.target.checked)}/>
   <span><strong>Apagar também os arquivos do disco</strong>{!obra.available&&<span className="block text-xs text-slate-500">Indisponível: a pasta da obra não foi encontrada.</span>}</span>
  </label>
  {apagar&&<div className="space-y-2 border border-red-200 bg-red-50/50 rounded-lg p-3 text-sm">
   <p>Serão apagados de <span className="break-all">{obra.path}</span>: o projeto (projeto.json e cópias de segurança), as fotos copiadas pelo app (pasta fotos) e os backups da obra (pasta backups).</p>
   <p>Outros arquivos e pastas que estiverem ali serão preservados.</p>
   {podeBaixar&&<label className="flex items-center gap-2"><input type="checkbox" checked={backupAntes} disabled={ocupado} onChange={e=>setBackupAntes(e.target.checked)}/> Baixar um backup completo antes de apagar</label>}
   {(!backupAntes||!podeBaixar)&&<p className="text-red-800">Sem o backup, não será possível recuperar esta obra.</p>}
   <label className="block font-semibold">Digite o nome da obra para confirmar: <span className="font-normal">{obra.nome}</span>
    <input className={campo+' mt-1'} value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} disabled={ocupado} aria-label="Nome da obra para confirmar"/>
   </label>
  </div>}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2">
   <button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button>
   <button className={botao+' !bg-red-600 !text-white !border-red-600 hover:!bg-red-700'} disabled={ocupado||(apagar&&!confere)} onClick={remover}>{ocupado?'Aguarde…':apagar?'Remover e apagar arquivos':'Remover da lista'}</button>
  </div>
 </Painel>;
}
