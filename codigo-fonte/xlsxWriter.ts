import {zipSync} from 'fflate';

function esc(s:any){
 return String(s??'')
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
const takenSheetNames=new Set<string>();
function sheetName(raw:string,index:number){
 const clean=String(raw||'').replace(/[\\\/\?\*\[\]:]/g,' ').replace(/[\x00-\x1F]/g,'').trim().slice(0,31)||`Planilha${index+1}`;
 let name=clean;let n=2;
 while(takenSheetNames.has(name.toLocaleLowerCase('pt-BR')))name=`${clean.slice(0,27)} ${n++}`.slice(0,31);
 takenSheetNames.add(name.toLocaleLowerCase('pt-BR'));return name;
}
function col(n:number){let x=n+1,r='';while(x){const m=(x-1)%26;r=String.fromCharCode(65+m)+r;x=Math.floor((x-1)/26);}return r;}
export type Sheet={name:string;headers:string[];rows:(string|number|null)[][]};
export function createXlsx(sheets:Sheet[]){
 const now=new Date().toISOString();
 takenSheetNames.clear();
 const names=sheets.map((s,i)=>sheetName(s.name,i));
 const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${esc(names[i])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
 const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const content=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 const rootrels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0"/></cellXfs></styleSheet>`;
 const files:Record<string,Uint8Array|ArrayBuffer|string>={'[Content_Types].xml':content,'_rels/.rels':rootrels,'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':rels,'xl/styles.xml':styles};
 sheets.forEach((s,si)=>{const rows=[s.headers,...s.rows];let xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>`;for(let c=0;c<s.headers.length;c++)xml+=`<col min="${c+1}" max="${c+1}" width="${Math.min(45,Math.max(12,(s.headers[c]||'').length+2))}" customWidth="1"/>`;xml+=`</cols><sheetData>`;rows.forEach((row,ri)=>{xml+=`<row r="${ri+1}">`;row.forEach((v,ci)=>{if(v===null||v===undefined||v==='')return;const ref=col(ci)+(ri+1);if(typeof v==='number'&&Number.isFinite(v))xml+=`<c r="${ref}"><v>${v}</v></c>`;else xml+=`<c r="${ref}" t="inlineStr" s="${ri===0?1:0}"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;});xml+=`</row>`;});xml+=`</sheetData><autoFilter ref="A1:${col(Math.max(0,s.headers.length-1))}${rows.length}"/></worksheet>`;files[`xl/worksheets/sheet${si+1}.xml`]=xml;});
 const encoder = new TextEncoder();
 const zippableFiles: Record<string, Uint8Array> = {};
 for (const [k, v] of Object.entries(files)) {
   zippableFiles[k] = typeof v === 'string' ? encoder.encode(v) : new Uint8Array(v);
 }
 return zipSync(zippableFiles,{level:6});
}
