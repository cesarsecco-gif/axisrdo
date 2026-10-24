import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {photoDate} from './src/services/organization';
const safe=(s:string)=>(String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,70)||'Pasta');
const short=(id:string)=>crypto.createHash('sha256').update(String(id)).digest('hex').slice(0,8);
function folderFor(v:any,p:any){return (v.config.availableFolders||[]).find((f:any)=>f.id===p.folderId)||{id:p.folderId||'geral',name:p.folderName||'Geral'};}
function album(v:any,f:any){let name=safe(f.name);if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name))name='_'+name;const collision=(v.config.availableFolders||[]).some((x:any)=>x.id!==f.id&&safe(x.name).toLowerCase()===safe(f.name).toLowerCase());return name+(collision?'_'+short(f.id):'');}
const EXT:{[k:string]:string}={jpeg:'jpg',jpg:'jpg',png:'png',webp:'webp',gif:'gif',bmp:'bmp','x-ms-bmp':'bmp'};
function image(p:any){const m=p.imageUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif|bmp|x-ms-bmp);base64,([A-Za-z0-9+/=\s]+)$/);if(!m)return null;const bytes=Buffer.from(m[2],'base64');return {bytes,name:crypto.createHash('sha256').update(p.id).update(bytes).digest('hex')+'.'+(EXT[m[1]]||'jpg')};}
export function relativePhotoPath(v:any,p:any){const data=image(p);return data?path.join(album(v,folderFor(v,p)),photoDate(p.data)?.day||'Sem-data',data.name):null;}
// Copies already compared byte by byte, with the file stamp seen at that moment.
// A copy is compared again only when its stamp changes (edited or replaced outside the app).
const verified=new Map<string,string>();
const stampOf=(s:fs.Stats)=>`${s.mtimeMs}|${s.size}|${s.ino}`;
export function mirror(dir:string,v:any,previousProject?:any){
 const root=path.join(dir,'fotos');
 function ensure(relative:string){let current=dir;for(const part of path.relative(dir,relative).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.existsSync(current)){if(fs.lstatSync(current).isSymbolicLink()||!fs.statSync(current).isDirectory())throw new Error('A pasta de fotos contém um atalho ou caminho inválido: '+current);}else fs.mkdirSync(current);}}
 ensure(root);
 let previous:any=previousProject??null;
 if(previousProject===undefined){try{previous=JSON.parse(fs.readFileSync(path.join(dir,'projeto.json'),'utf8'));}catch{}}
 const oldPhotos=new Map<string,any>((previous?.photos||[]).map((p:any)=>[p.id,p]));
 const cleanup=new Map<string,Buffer>();const targets=new Set<string>();
 for(const p of v.photos){
  const data=image(p);if(!data)continue;
  const target=path.join(root,relativePhotoPath(v,p)!);targets.add(target);ensure(path.dirname(target));
  if(fs.existsSync(target)){
   const st=fs.lstatSync(target);
   if(st.isSymbolicLink())throw new Error('Uma cópia local foi modificada fora do app. Preserve ou renomeie este arquivo antes de salvar: '+target);
   if(verified.get(target)!==stampOf(st)){
    if(!fs.readFileSync(target).equals(data.bytes))throw new Error('Uma cópia local foi modificada fora do app. Preserve ou renomeie este arquivo antes de salvar: '+target);
    verified.set(target,stampOf(st));
   }
  }
  else{fs.writeFileSync(target,data.bytes,{flag:'wx'});verified.set(target,stampOf(fs.lstatSync(target)));}
  const old=oldPhotos.get(p.id);
  if(old&&old.imageUrl===p.imageUrl){
   const oldFolder=folderFor(previous,old);
   const candidates=[path.join(root,relativePhotoPath(previous,old)!),path.join(root,safe(oldFolder.name)+'_'+short(oldFolder.id),data.name)];
   for(const candidate of candidates)if(candidate!==target)cleanup.set(candidate,data.bytes);
  }
 }
 // Caller commits projeto.json before removing verified obsolete managed copies.
 return ()=>{
  const warnings:string[]=[];
  for(const [file,bytes] of cleanup){if(targets.has(file)||!fs.existsSync(file))continue;
   try{
    let ancestor=path.dirname(file),linked=false;while(ancestor!==root){if(fs.lstatSync(ancestor).isSymbolicLink())linked=true;ancestor=path.dirname(ancestor);}
    if(linked||fs.lstatSync(file).isSymbolicLink()||!fs.readFileSync(file).equals(bytes)){warnings.push('Uma cópia antiga modificada fora do app foi preservada: '+file);continue;}
    fs.unlinkSync(file);
    let parent=path.dirname(file);while(parent!==root&&fs.readdirSync(parent).length===0){fs.rmdirSync(parent);parent=path.dirname(parent);}
   }catch(e:any){warnings.push('Foto gravada no novo local, mas a cópia antiga não pôde ser removida: '+file+' ('+e.message+')');}
  }
  return warnings.join('\n');
 };
}
