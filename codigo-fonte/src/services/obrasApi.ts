export type Workspace={path:string|null;revision:string};
export type ObraFicha={contrato:string;rodovia:string;trecho:string;empresa:string;fiscal:string;responsavel:string};
export type ObraRow={id:string;nome:string;path:string;createdAt:string;lastAccessAt:string;ficha:ObraFicha;photos:number;drafts:number;lastSaved:string;available:boolean;hasProject:boolean;active:boolean};
export type ObrasLista={activeId:string|null;raiz:string|null;items:ObraRow[]};
export type ResultadoRemocao={success:boolean;semObra:boolean;path:string;apagados:string[];preservados:string[];falhas:string[];pastaRemovida:boolean};

async function api<T>(url:string,options?:RequestInit):Promise<T>{
 const r=await fetch(url,options);const data:any=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||`Não foi possível concluir a operação (HTTP ${r.status}).`);
 return data as T;
}
const json=(method:string,body:unknown):RequestInit=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

export function caminhoFinal(base:string,nome:string){
 const b=base.trim().replace(/[\\/]+$/,'');const n=nome.trim().replace(/\s+/g,' ');
 return b&&n?`${b}\\Obras\\${n}`:'';
}
export const normalizarNome=(v:string)=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
// Folder names cannot contain these characters on Windows (e.g. contract "CO141/2025").
export const sugerirNome=(v:string)=>v.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/\s+/g,' ').trim().replace(/\.+$/,'').slice(0,80);

export const obrasApi={
 listar:()=>api<ObrasLista>('/api/obras'),
 raiz:()=>api<{raiz:string|null;sugestao:string}>('/api/obras/raiz'),
 definirRaiz:(raiz:string)=>api<{raiz:string}>('/api/obras/raiz',json('PUT',{raiz})),
 escolherPasta:async()=>{const d=await api<{path:string;cancelled:boolean}>('/api/workspace/pick',json('POST',{}));return d.cancelled?'':d.path;},
 criar:(nome:string,path:string|undefined,open:boolean)=>api<{obra:ObraRow;path?:string}>('/api/obras',json('POST',{nome,mode:'new',open,...(path?{path}:{})})),
 registrar:(nome:string,path:string)=>api<{obra:ObraRow;path?:string}>('/api/obras',json('POST',{nome,mode:'open',path,open:true})),
 abrir:(id:string,revision:string)=>api<{path:string}>(`/api/obras/${id}/open`,json('POST',{revision})),
 importar:(dados:{revision:string;nome:string;project:unknown;backupHash?:string;path?:string})=>api<{obra:ObraRow;path:string}>('/api/obras/import',json('POST',dados)),
 duplicar:(id:string,dados:{revision:string;nome:string;path?:string})=>api<{obra:ObraRow}>(`/api/obras/${id}/duplicate`,json('POST',dados)),
 mover:(id:string,revision:string,path:string)=>api<{path:string|null;obra:ObraRow;warning:string;ativa:boolean}>(`/api/obras/${id}/move`,json('POST',{revision,path})),
 renomear:(id:string,nome:string)=>api<{obra:ObraRow}>(`/api/obras/${id}`,json('PUT',{nome})),
 remover:(id:string,dados:{revision:string;apagarArquivos:boolean;confirmacao?:string})=>api<ResultadoRemocao>(`/api/obras/${id}`,json('DELETE',dados)),
 baixarBackup:async(obra:ObraRow)=>{
  const r=await fetch(`/api/obras/${obra.id}/backup`);
  if(!r.ok){const d:any=await r.json().catch(()=>({}));throw new Error(d.error||'Não foi possível gerar o backup. Nada foi apagado.');}
  const blob=await r.blob();const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`DER-backup-${sugerirNome(obra.nome)}-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),30000);
 },
};
