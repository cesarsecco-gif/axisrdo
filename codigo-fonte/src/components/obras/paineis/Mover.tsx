import React,{useState} from 'react';
import {ObraRow,caminhoFinal,obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,CampoPasta,Erro,botao,botaoPrimario,destaque,useAcao} from './Painel';

export function Mover({obra,workspace,flush,importing,onClose,onDone}:PainelBase&{obra:ObraRow}){
 const [destino,setDestino]=useState('');const [avisoFinal,setAvisoFinal]=useState('');const {ocupado,erro,executar}=useAcao();
 const mover=()=>executar(async()=>{
  if(obra.active&&importing)throw new Error('Aguarde a importação das fotos terminar.');
  if(!destino.trim())throw new Error('Informe a nova pasta da obra.');
  if(obra.active)await flush();
  const d=await obrasApi.mover(obra.id,workspace.revision,destino.trim());
  if(d.ativa){if(d.warning){setAvisoFinal(d.warning);return;}location.reload();return;}
  onDone(d.warning||`Obra "${obra.nome}" movida para ${d.obra.path}.`);
 });
 if(avisoFinal)return <Painel titulo="Obra movida" onClose={()=>location.reload()}>
  <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">{avisoFinal}</p>
  <div className="flex justify-end"><button className={botaoPrimario} onClick={()=>location.reload()}>Continuar</button></div>
 </Painel>;
 return <Painel titulo={`Mover "${obra.nome}"`} onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Projeto, fotos e backups são copiados para o novo local, conferidos arquivo por arquivo e só então apagados de <span className="break-all">{obra.path}</span>. Outros arquivos da pasta atual não são tocados.</p>
  <div className="space-y-1"><span className="block text-sm font-semibold">Nova pasta-base</span><CampoPasta valor={destino} onChange={setDestino} ocupado={ocupado}/></div>
  {destino.trim()&&<p className={destaque}>A obra ficará em: <strong>{caminhoFinal(destino,obra.nome)}</strong></p>}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!destino.trim()} onClick={mover}>{ocupado?'Movendo…':'Mover obra'}</button></div>
 </Painel>;
}
