import React,{useState} from 'react';
import {obrasApi,sugerirNome} from '../../../services/obrasApi';
import {Painel,PainelBase,CampoPasta,Erro,botao,botaoPrimario,campo,useAcao} from './Painel';

export function AbrirOutraPasta({flush,importing,onClose}:PainelBase){
 const [pasta,setPasta]=useState('');const [nome,setNome]=useState('');const {ocupado,erro,executar}=useAcao();
 const definirPasta=(p:string)=>{setPasta(p);if(!nome.trim())setNome(sugerirNome(p.trim().replace(/[\\/]+$/,'').split(/[\\/]/).pop()||''));};
 const abrir=()=>executar(async()=>{
  if(importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');
  if(!pasta.trim())throw new Error('Informe a pasta da obra.');
  if(!nome.trim())throw new Error('Informe o nome da obra para a lista.');
  await flush();
  await obrasApi.registrar(nome.trim(),pasta.trim());
  location.reload();
 });
 return <Painel titulo="Abrir obra de outra pasta" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Use para uma obra que já existe no computador (a pasta contém <strong>projeto.json</strong>), por exemplo vinda de outro computador ou removida da lista antes. Nada é copiado: a obra passa a ser usada direto dessa pasta.</p>
  <div className="space-y-1"><span className="block text-sm font-semibold">Pasta da obra</span><CampoPasta valor={pasta} onChange={definirPasta} ocupado={ocupado}/></div>
  <label className="block text-sm font-semibold">Nome na lista de obras
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} disabled={ocupado}/>
  </label>
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!pasta.trim()||!nome.trim()} onClick={abrir}>{ocupado?'Aguarde…':'Abrir obra'}</button></div>
 </Painel>;
}
