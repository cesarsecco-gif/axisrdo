import React,{useState} from 'react';
import {obrasApi} from '../../../services/obrasApi';
import {Painel,CampoPasta,Erro,botao,botaoPrimario,useAcao} from './Painel';

export function DefinirRaiz({raiz,sugestao,onClose,onDone}:{raiz:string|null;sugestao:string;onClose:()=>void;onDone:(m?:string)=>void}){
 const [valor,setValor]=useState(raiz||sugestao);const {ocupado,erro,executar}=useAcao();
 const salvar=()=>executar(async()=>{
  if(!valor.trim())throw new Error('Informe a pasta das obras.');
  const d=await obrasApi.definirRaiz(valor.trim());
  onDone(`Pasta das obras definida: ${d.raiz}. As próximas obras serão criadas em ${d.raiz}\\Obras.`);
 });
 return <Painel titulo="Pasta das obras" onClose={onClose} ocupado={ocupado}>
  <p className="text-sm text-slate-700">Novas obras, cópias e backups importados são criados em <strong>pasta\Obras\nome da obra</strong>. Alterar esta pasta não move as obras que já existem; para isso, use <strong>Mover</strong> em cada obra.</p>
  <CampoPasta valor={valor} onChange={setValor} ocupado={ocupado}/>
  <Erro texto={erro}/>
  <div className="flex justify-end gap-2"><button className={botao} disabled={ocupado} onClick={onClose}>Cancelar</button><button className={botaoPrimario} disabled={ocupado||!valor.trim()} onClick={salvar}>{ocupado?'Aguarde…':'Salvar'}</button></div>
 </Painel>;
}
