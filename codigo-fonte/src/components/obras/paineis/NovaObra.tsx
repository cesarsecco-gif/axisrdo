import React,{useState} from 'react';
import {obrasApi} from '../../../services/obrasApi';
import {Painel,PainelBase,Erro,botao,botaoPrimario,campo,useAcao,useLocalDaObra} from './Painel';

export function NovaObra({flush,importing,raiz,sugestao,onClose,onDone}:PainelBase){
 const [nome,setNome]=useState('');const [abrirDepois,setAbrirDepois]=useState(true);
 const local=useLocalDaObra(raiz,sugestao);const {ocupado,erro,executar}=useAcao();
 const criar=()=>executar(async()=>{
  if(!nome.trim())throw new Error('Informe o nome da obra.');
  if(!local.base)throw new Error('Informe onde guardar a obra.');
  if(abrirDepois&&importing)throw new Error('Aguarde a importação das fotos terminar antes de trocar de obra.');
  await local.confirmarRaiz();
  await flush();
  const d=await obrasApi.criar(nome.trim(),local.pathInformado,abrirDepois);
  if(abrirDepois&&d.path){location.reload();return;}
  onDone(`Obra "${d.obra.nome}" criada em ${d.obra.path}.`);
 });
 return <Painel titulo="Nova obra" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Cria uma obra vazia (sem fotos), com pasta própria para projeto, fotos e backups.</p>
  <label className="block text-sm font-semibold">Nome da obra
   <input className={campo+' mt-1'} value={nome} maxLength={80} onChange={e=>setNome(e.target.value)} autoFocus placeholder="Ex.: PR-317 Iguaraçu–Maringá" disabled={ocupado}/>
  </label>
  {local.campos(nome,ocupado)}
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={abrirDepois} disabled={ocupado} onChange={e=>setAbrirDepois(e.target.checked)}/> Abrir esta obra em seguida</label>
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!nome.trim()||!local.base} onClick={criar}>{ocupado?'Aguarde…':'Criar obra'}</button></div>
 </Painel>;
}
