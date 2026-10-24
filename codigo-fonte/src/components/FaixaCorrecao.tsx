import React from 'react';
import {AlertTriangle} from 'lucide-react';

export function FaixaCorrecao({quantidade,item,onLimpar}:{quantidade:number;item:string;onLimpar:()=>void}){
 return <p role="status" className="text-sm bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg flex flex-wrap items-center gap-2">
  <AlertTriangle className="w-4 h-4"/>
  <span>Mostrando <strong>{quantidade}</strong> registro(s) que usam <strong>{item}</strong>. Corrija-os para liberar a exclusão no catálogo.</span>
  <button className="underline font-semibold" onClick={onLimpar}>Limpar filtro</button>
 </p>;
}
