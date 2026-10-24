import type {PhotoRecord} from '../types';
import {photoDate,orderPhotos} from './organization';
export type RdoSettings={company:string;contract:string;supervisor:string;preposto:string;manager:string;supervisorEngineer:string;inspector:string;supervisorNotes:string;inspectorNotes:string};
export type RdoDay={date:string;folderId?:string;number:number;weather:''|'BOM'|'INSTÁVEL'|'CHUVOSO'|'IMPRATICÁVEL';professionals:number|null;sufficient:''|'SIM'|'NÃO';present:''|'SIM'|'NÃO';contractorNotes:string;status:'draft'|'final';finalSignature?:string;finalizedAt?:string;reopenedReason?:string};
export type RdoState={settings:RdoSettings;days:RdoDay[]};
export const defaultRdoSettings:RdoSettings={company:'Consórcio Rodovia PR-317 Iguaraçu Maringá',contract:'CO141/2025 - DT',supervisor:'Iguatemi Consultoria e Serviços de Engenharia LTDA.',preposto:'Rodrigo Martins Pereira',manager:'Rodrigo Martins Pereira',supervisorEngineer:'João Carlos Deríssio',inspector:'Jéssica Mayumi Kumasaka',supervisorNotes:'',inspectorNotes:''};
export const emptyRdo=():RdoState=>({settings:{...defaultRdoSettings},days:[]});
export function brDate(iso:string){return iso.split('-').reverse().join('/');}
export function validRdoDate(iso:string){return typeof iso==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(iso)&&photoDate(brDate(iso))?.key===iso;}
export function rdoPhotos(photos:PhotoRecord[],date:string,folderId?:string){return orderPhotos(photos).filter(p=>p.includedInReport!==false&&(!folderId||(p.folderId||'folder-jul-2026')===folderId)&&photoDate(p.data)?.key===date);}
export function rdoServices(photos:PhotoRecord[],date:string,folderId?:string){
 const services:{text:string;photoIds:string[]}[]=[],index=new Map<string,number>();
 for(const p of rdoPhotos(photos,date,folderId)){
  const text=String(p.servico||'').trim().normalize('NFC').replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');if(!text)continue;
  const found=index.get(text);if(found!==undefined)services[found].photoIds.push(p.id);else{index.set(text,services.length);services.push({text,photoIds:[p.id]});}
 }return services;
}
export function rdoSignature(day:RdoDay,settings:RdoSettings,photos:PhotoRecord[]){return JSON.stringify({date:day.date,number:day.number,weather:day.weather,professionals:day.professionals,sufficient:day.sufficient,present:day.present,contractorNotes:day.contractorNotes,settings,services:rdoServices(photos,day.date,day.folderId),sources:rdoPhotos(photos,day.date,day.folderId).map(p=>({id:p.id,text:p.servico,timestamp:p.timestamp}))});}
export function syncRdo(state:RdoState,photos:PhotoRecord[],pluviometria:import('../types').PluviometriaDia[]=[]){let changed=false;const days=state.days.map(day=>{let nextDay={...day};const pDia=(pluviometria||[]).find(d=>d.data===day.date);if(pDia&&pDia.clima&&pDia.clima!==nextDay.weather){nextDay.weather=pDia.clima as any;changed=true;}if(nextDay.status==='final'&&nextDay.finalSignature!==rdoSignature(nextDay,state.settings,photos)){changed=true;return {...nextDay,status:'draft' as const,finalSignature:undefined,reopenedReason:'As fotos ou os dados do RDO mudaram. Confira e finalize novamente.'};}return nextDay;});return changed?{...state,days}:state;}
export function repairRdoFolderIds(state:RdoState,photos:PhotoRecord[],folders:{id:string}[]|undefined){
 if(!folders||!folders.length)return state;
 const valid=new Set(folders.map(f=>f.id));
 if(!state.days.some(d=>d.folderId&&!valid.has(d.folderId)))return state;
 const byDate=new Map<string,Set<string>>();
 for(const p of photos){const key=photoDate(p.data)?.key;if(!key)continue;const set=byDate.get(key)||new Set<string>();set.add(p.folderId||'folder-jul-2026');byDate.set(key,set);}
 const days=state.days.map(d=>{
  if(!d.folderId||valid.has(d.folderId))return d;
  const ofDate=byDate.get(d.date);
  return {...d,folderId:ofDate&&ofDate.size===1?[...ofDate][0]:undefined};
 });
 return {...state,days};
}
export function newRdoDay(date:string,days:RdoDay[]):RdoDay{
 if(!validRdoDate(date))throw new Error('Data inválida.');if(days.some(d=>d.date===date))throw new Error('Já existe RDO nesta data.');
 return {date,number:Math.max(0,...days.map(d=>d.number))+1,weather:'',professionals:null,sufficient:'',present:'',contractorNotes:'',status:'draft'};
}
// The RDO's professional count reports the presence marked in Equipe Tecnica.
// A finalized RDO is a closed document and is never rewritten from there.
export function definirProfissionais(state:RdoState,date:string,total:number):RdoState{
 const dia=state.days.find(d=>d.date===date);
 if(!dia||dia.status==='final'||dia.professionals===total)return state;
 return {...state,days:state.days.map(d=>d.date===date?{...d,professionals:total}:d)};
}
export function rdoIssues(day:RdoDay,settings:RdoSettings,photos:PhotoRecord[]){const issues:string[]=[];
 for(const [key,label] of [['company','Empresa'],['contract','Contrato'],['supervisor','Supervisora'],['preposto','Engenheiro preposto'],['manager','Gerente da executora'],['supervisorEngineer','Engenheiro da supervisora'],['inspector','Fiscal do DER']] as const)if(!settings[key].trim())issues.push('Preencha '+label+' nas configurações.');
 if(!day.weather)issues.push('Selecione o Clima Geral na aba Pluviometria.');if(day.professionals===null)issues.push('Informe a quantidade de profissionais.');if(!day.sufficient)issues.push('Informe se a equipe é suficiente.');if(!day.present)issues.push('Informe a presença do preposto.');
 if(!rdoPhotos(photos,day.date,day.folderId).length&&!day.contractorNotes.trim())issues.push('Informe em Observações da contratada o motivo do dia sem fotos.');
 if(rdoPhotos(photos,day.date,day.folderId).some(p=>!String(p.servico||'').trim()))issues.push('Há foto marcada sem descrição. Corrija em Gerenciar fotos.');return issues;
}
export function validRdo(value:any){
 if(value===undefined)return true;if(!value||!value.settings||!Array.isArray(value.days))return false;
 if(!Object.keys(defaultRdoSettings).every(k=>typeof value.settings[k]==='string'&&value.settings[k].length<20000))return false;
 const dates=new Set(),numbers=new Set();return value.days.every((d:any)=>{if(!d||(d.folderId!==undefined&&typeof d.folderId!=='string')||!validRdoDate(d.date)||dates.has(d.date)||!Number.isSafeInteger(d.number)||d.number<1||numbers.has(d.number)||!['draft','final'].includes(d.status)||!['','BOM','INSTÁVEL','CHUVOSO','IMPRATICÁVEL'].includes(d.weather)||!(d.professionals===null||(Number.isInteger(d.professionals)&&d.professionals>=0&&d.professionals<=10000))||!['','SIM','NÃO'].includes(d.sufficient)||!['','SIM','NÃO'].includes(d.present)||typeof d.contractorNotes!=='string'||d.contractorNotes.length>20000)return false;dates.add(d.date);numbers.add(d.number);return true;});
}
export type RdoBatchDefaults=Pick<RdoDay,'weather'|'professionals'|'sufficient'|'present'|'contractorNotes'>;
export function folderRdos(state:RdoState,photos:PhotoRecord[],folderId:string){const dates=new Set(photos.filter(p=>(p.folderId||'folder-jul-2026')===folderId).map(p=>photoDate(p.data)?.key));return state.days.filter(d=>d.folderId===folderId||(!d.folderId&&dates.has(d.date))).sort((a,b)=>a.date.localeCompare(b.date));}
export function createRdoBatch(state:RdoState,photos:PhotoRecord[],folderId:string,defaults:RdoBatchDefaults,includeEmpty=false){
 if(!folderId)throw new Error('Selecione uma pasta.');
 const dates=[...new Set(photos.filter(p=>p.includedInReport!==false&&(p.folderId||'folder-jul-2026')===folderId).map(p=>photoDate(p.data)?.key).filter(Boolean))].sort() as string[];
 if(!dates.length)throw new Error('Esta pasta não tem fotos marcadas com data válida.');
 if(includeEmpty){const start=new Date(dates[0]+'T12:00:00Z'),end=new Date(dates.at(-1)!+'T12:00:00Z');if((+end-+start)/86400000>366)throw new Error('O intervalo da pasta ultrapassa 366 dias.');dates.length=0;for(let d=start;d<=end;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));}
 const days=[...state.days],created:string[]=[],skipped:string[]=[];
 for(const date of dates){if(days.some(d=>d.date===date)){skipped.push(date);continue;}days.push({...newRdoDay(date,days),...defaults,folderId,status:'draft'});created.push(date);}
 const next={...state,days};if(!validRdo(next))throw new Error('Confira os valores iniciais do lote.');return {state:next,created,skipped};
}
