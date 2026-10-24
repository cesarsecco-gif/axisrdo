// Shared by the Equipe Técnica shell and its two tabs.
export const button='border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';

export const mesCorrente=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};

export function baixar(bytes:Uint8Array,nome:string){
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export const diaSemana=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase().slice(0,3);
export const curto=(iso:string)=>`${iso.slice(8,10)}/${iso.slice(5,7)}`;
export const listaDatas=(ds:string[],max=8)=>ds.length<=max?ds.map(curto).join(', '):ds.slice(0,max).map(curto).join(', ')+`… (+${ds.length-max})`;

// App.tsx rebuilds the correcao object on every render, so an effect keyed on the
// object itself would re-fire on every save. Key on the content instead.
export const chaveCorrecao=(c?:{ids:string[];item:string})=>c?`${c.item}|${c.ids.join(',')}`:'';
