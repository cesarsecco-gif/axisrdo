import type {PhotoRecord} from '../types';
export const tagKey=(tag:string)=>tag.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
export function uniqueTags(tags:string[]){const seen=new Set<string>();return tags.map(t=>t.trim().normalize('NFC')).filter(t=>{const key=tagKey(t);if(!t||seen.has(key))return false;seen.add(key);return true;});}
export function photoTags(photo:Pick<PhotoRecord,'tags'|'categoria'>){return uniqueTags(photo.tags??[photo.categoria||'Geral']);}
export const AUTO_SUBTITLE=/^(RODOVIA:|REGISTRO FOTOGRÁFICO DOS SERVIÇOS EXECUTADOS)/i;
export function reportSubtitle(rodovia?:string,trecho?:string,periodo?:string){
 return [rodovia?`RODOVIA: ${rodovia}`:'',trecho?`TRECHO: ${trecho}`:'',periodo?`PERÍODO: ${periodo}`:''].filter(Boolean).join(' | ');
}
export function photoDate(value:string){
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'');if(!match)return null;
  const [day,month,year]=match.slice(1).map(Number);const date=new Date(year,month-1,day,12);
  if(year<1900||year>9999||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return null;
  return {day:match[1],key:`${match[3]}-${match[2]}-${match[1]}`,year,month,date};
}
export const foldText=(value:string)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();

const chronological=(list:PhotoRecord[])=>[...list].sort((a,b)=>a.timestamp-b.timestamp);
const position=(photo:PhotoRecord)=>Number.isFinite(photo.manualOrder as number)?photo.manualOrder as number:undefined;
export function orderPhotos(list:PhotoRecord[]){
  const manual=list.filter(p=>position(p)!==undefined);
  if(!manual.length)return chronological(list);
  const byPosition=new Map<number,PhotoRecord>();
  for(const photo of [...manual].sort((a,b)=>position(a)!-position(b)!))if(!byPosition.has(position(photo)!))byPosition.set(position(photo)!,photo);
  const placed=new Set<string>();const result:PhotoRecord[]=[];
  const unlisted=chronological(list.filter(p=>position(p)===undefined));
  let next=0;
  for(let pos=0;pos<list.length;pos++){
    const chosen=byPosition.get(pos);
    if(chosen&&!placed.has(chosen.id)){result.push(chosen);placed.add(chosen.id);continue;}
    if(next<unlisted.length){const photo=unlisted[next++];result.push(photo);placed.add(photo.id);}
  }
  for(const photo of manual)if(!placed.has(photo.id)){result.push(photo);placed.add(photo.id);}
  for(const photo of unlisted)if(!placed.has(photo.id))result.push(photo);
  return result;
}
export function serviceSuggestions(query:string,catalog:string[],limit=3){
  const seen=new Set<string>();const items:string[]=[];
  for(const raw of catalog){const text=String(raw||'').trim();if(!text)continue;const key=foldText(text);if(!key||seen.has(key))continue;seen.add(key);items.push(text);}
  if(!items.length)return [];
  const q=foldText(query);
  if(q.length<2)return items.slice(0,limit);
  const scored:{text:string;score:number;index:number}[]=[];
  items.forEach((text,index)=>{
    const key=foldText(text);if(key===q)return;
    let score=-1;
    if(key.startsWith(q))score=0;
    else if(key.split(/[ ,\-/().;:]+/).some(word=>word.startsWith(q)))score=1;
    else if(key.includes(q))score=2;
    if(score>=0)scored.push({text,score,index});
  });
  scored.sort((a,b)=>a.score-b.score||a.index-b.index);
  return scored.slice(0,limit).map(item=>item.text);
}
