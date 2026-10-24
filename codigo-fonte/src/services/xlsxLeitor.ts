import {unzipSync,strFromU8} from 'fflate';

export type Celula=string|number|null;
const INVALIDO='O arquivo não é uma planilha .xlsx válida.';

function atributos(tag:string){const r:Record<string,string>={};for(const m of tag.matchAll(/([\w:]+)="([^"]*)"/g))r[m[1]]=m[2];return r;}
function decodificar(s:string){
 return s.replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-fA-F]+));/g,(_t,nome,dec,hex)=>dec?String.fromCodePoint(Number(dec)):hex?String.fromCodePoint(parseInt(hex,16)):({lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'} as Record<string,string>)[nome]);
}
// Rich text keeps one <t> per run; phonetic hints (<rPh>) are not part of the value.
function texto(xml:string){
 return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g,'').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decodificar(m[1])).join('');
}
function indiceColuna(ref:string){let n=0;for(const ch of ref.replace(/\d+$/,''))n=n*26+(ch.charCodeAt(0)-64);return n-1;}

export function lerPrimeiraAba(bytes:Uint8Array):Celula[][]{
 let arquivos:Record<string,Uint8Array>;
 try{arquivos=unzipSync(bytes);}catch{throw new Error(INVALIDO);}
 const ler=(nome:string)=>arquivos[nome]?strFromU8(arquivos[nome]):'';
 const workbook=ler('xl/workbook.xml');if(!workbook)throw new Error(INVALIDO);
 const primeira=workbook.match(/<sheet\b[^>]*>/);if(!primeira)throw new Error('A planilha não tem abas.');
 const rid=atributos(primeira[0])['r:id'];
 let alvo='worksheets/sheet1.xml';
 for(const m of ler('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)){const a=atributos(m[0]);if(a.Id===rid&&a.Target)alvo=a.Target;}
 const caminho=alvo.startsWith('/')?alvo.slice(1):'xl/'+alvo.replace(/^\.\//,'');
 const folha=ler(caminho).replace(/<row\b[^>]*\/>/g,'');
 if(!folha)throw new Error('Não foi possível ler a primeira aba da planilha.');
 const compartilhadas=[...ler('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>texto(m[1]));
 const linhas:Celula[][]=[];
 for(const lm of folha.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
  const numero=Number(atributos(lm[1]).r)||linhas.length+1;
  const linha:Celula[]=[];
  for(const cm of lm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const a=atributos(cm[1]);const corpo=cm[2]||'';const i=a.r?indiceColuna(a.r):linha.length;
   const v=corpo.match(/<v>([\s\S]*?)<\/v>/);
   let valor:Celula=null;
   if(a.t==='s'&&v)valor=compartilhadas[Number(v[1])]??'';
   else if(a.t==='inlineStr')valor=texto(corpo);
   else if(a.t==='str'&&v)valor=decodificar(v[1]);
   else if(a.t==='b'&&v)valor=v[1]==='1'?'VERDADEIRO':'FALSO';
   else if(v){const n=Number(v[1]);valor=Number.isFinite(n)?n:decodificar(v[1]);}
   linha[i]=valor;
  }
  linhas[numero-1]=Array.from(linha,x=>x===undefined?null:x);
 }
 return Array.from(linhas,l=>l||[]);
}
