import React,{useState} from 'react';
import {ObraRow,obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao,useLocalDaObra} from './Painel';

export function Duplicar({obra,workspace,flush,raiz,sugestao,onClose,onDone}:PainelBase&{obra:ObraRow}){
 const [nome,setNome]=useState(`${obra.nome} (cópia)`.slice(0,80));
 const local=useLocalDaObra(raiz,sugestao);const {ocupado,erro,executar}=useAcao();
 const duplicar=()=>executar(async()=>{
  if(!nome.trim())throw new Error('Informe o nome da cópia.');
  if(!local.base)throw new Error('Informe onde guardar a cópia.');
  await local.confirmarRaiz();
  if(obra.active)await flush();
  const d=await obrasApi.duplicar(obra.id,{revision:workspace.revision,nome:nome.trim(),path:local.pathInformado});
  onDone(`Cópia "${d.obra.nome}" criada em ${d.obra.path}. A obra aberta não mudou.`);
 });
 return <Painel titulo={`Duplicar "${obra.nome}"`} onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Copia projeto, fotos e configurações para uma obra nova e independente. A obra original continua como está.</p>
  <label className="block text-sm font-semibold">Nome da cópia
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} autoFocus disabled={ocupado}/>
  </label>
  {local.campos(nome,ocupado)}
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!nome.trim()||!local.base} onClick={duplicar}>{ocupado?'Aguarde…':'Duplicar'}</button></div>
 </Painel>;
}
