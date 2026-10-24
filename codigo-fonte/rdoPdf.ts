import fs from 'node:fs';
import path from 'node:path';
import {jsPDF} from 'jspdf';
import {brDate,rdoServices,rdoPhotos,rdoSignature,type RdoDay,type RdoSettings} from './src/services/rdo';
import type {PhotoRecord} from './src/types';
type Line={text:string;number?:number};
function setupDocFonts(doc:jsPDF,assetDir:string){
 for(const [file,style,windowsFile] of [['LiberationSans-Regular.ttf','normal','arial.ttf'],['LiberationSans-Bold.ttf','bold','arialbd.ttf']]){
  let bytes=fs.readFileSync(path.join(assetDir,file));
  if(process.platform==='win32'){try{bytes=fs.readFileSync(path.join(process.env.WINDIR||'C:\\Windows','Fonts',windowsFile));}catch{/* Embedded metric-compatible fallback for PCs without Arial. */}}
  doc.addFileToVFS(file,bytes.toString('base64'));doc.addFont(file,'Rdo',style);
 }
}

export function renderRdoIntoDoc(doc:jsPDF,day:RdoDay,settings:RdoSettings,photos:PhotoRecord[],assetDir=path.join(process.cwd(),process.env.NODE_ENV==='production'?'dist':'public','rdo'),addPageBefore=false,pageSelection?:number,headerBannerBase64?:string){
 const template=JSON.parse(fs.readFileSync(path.join(assetDir,'template.json'),'utf8'));
 const font=(size=7.189,bold=false)=>{doc.setFont('Rdo',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(0);};
 const wrap=(text:string,width:number,size=7.189)=>{font(size);return doc.splitTextToSize(text,width) as string[];};
 const serviceLines:Line[]=[];
 rdoServices(photos,day.date,day.folderId).forEach((service,i)=>wrap(service.text,508).forEach((text,j)=>serviceLines.push({text,number:j===0?i+1:undefined})));
 const servicePages:Line[][]=[serviceLines.slice(0,19)];for(let i=19;i<serviceLines.length;i+=49)servicePages.push(serviceLines.slice(i,i+49));
 const notes=[{title:'OBSERVAÇÕES DA CONTRATADA:',text:day.contractorNotes,y:525.7},{title:'OBSERVAÇÕES DA SUPERVISORA:',text:settings.supervisorNotes,y:597},{title:'OBSERVAÇÕES DO FISCAL DO DER/PR:',text:settings.inspectorNotes,y:668.3}];
 const notePages:{title:string;lines:string[]}[]=[];
 const firstNotes=notes.map(n=>{const lines=wrap(n.text,551);if(lines.length<=5)return {...n,lines};const page=servicePages.length+notePages.length+1;for(let i=4;i<lines.length;i+=49)notePages.push({title:n.title+' (CONTINUAÇÃO)',lines:lines.slice(i,i+49)});return {...n,lines:[...lines.slice(0,4),`(CONTINUA NA PÁGINA ${page})`]};});
 const pageCount=servicePages.length+notePages.length;
 if(pageCount>200)throw new Error('O RDO ultrapassou 200 páginas. Revise as descrições.');
 const text=(value:string,x:number,y:number,size=7.189,bold=false,align:'left'|'center'='left')=>{font(size,bold);doc.text(value,x,y,{align});};
  function field(value:string,x:number,y:number,width:number,size=8.005,align:'left'|'center'='left',bold=false){
   let current=size;font(current,bold);
   if(doc.getTextWidth(value)>width){
    const scaled=current*(width/doc.getTextWidth(value))*0.98;
    if(scaled<5)throw new Error(`O campo "${value.slice(0,45)}" não cabe no modelo. Abrevie o dado nas configurações do RDO.`);
    current=Math.max(5,scaled);font(current,bold);
    if(doc.getTextWidth(value)>width)throw new Error(`O campo "${value.slice(0,45)}" não cabe no modelo. Abrevie o dado nas configurações do RDO.`);
   }
   doc.text(value,align==='center'?x+width/2:x,y,{align});
  }
 function choice(label:string,x:number,y:number,w:number,selected:boolean){doc.setFillColor(selected?0:255,selected?122:255,selected?55:255);doc.rect(x+.35,y+.35,w-.7,9.5,'F');text(label,x+w/2,y+7.7,6.009,false,'center');}
 function yesNo(value:string,y:number){choice('',394.152,y,45.354,value==='SIM');choice('',484.86,y,45.354,value==='NÃO');}
 const final=day.status==='final'&&day.finalSignature===rdoSignature(day,settings,photos);
 function frame(page:number,continuation:boolean,title='SERVIÇOS DESENVOLVIDOS NO DIA:',displayPage=page){
  if(page>0||(addPageBefore&&page===0))doc.addPage();doc.setDrawColor(0);doc.setLineWidth(.45);
  for(const [x1,y1,x2,y2] of template.lines){if(!continuation||Math.max(y1,y2)<243||Math.abs(x1-x2)<.01&&(x1<20||x1>575)||y1>751)doc.line(x1,y1,x2,y2);}
  if(headerBannerBase64){
    doc.addImage(headerBannerBase64,headerBannerBase64.startsWith('data:image/png')?'PNG':'JPEG',19.5,22,556.5,75,undefined,'FAST');
  }else{
    for(const im of template.images)doc.addImage(im.data,im.data.startsWith('data:image/png')?'PNG':'JPEG',im.x,im.y,im.w,im.h);
  }
  for(const t of template.texts){
    if(continuation&&t.y>243)continue;
    if(headerBannerBase64&&t.y<120)continue;
    if(t.text.trim()==='SERVIÇOS DESENVOLVIDOS NO DIA:')text(title,t.x,t.y,t.size,t.bold);
    else text(t.text,t.x,t.y,t.size,t.bold);
  }
  field(String(day.number),259,158.9,88,8.005,'center');
  const [year,month,date]=day.date.split('-');field(date,440,158.9,44,8.005,'center');field(month,486,158.9,43,8.005,'center');field(year,531,158.9,44,8.005,'center');
  field(settings.company,20.4,179.3,191);field(settings.contract,258.9,179.3,315);field(settings.supervisor,258.9,199.7,315);
  const climates=['BOM','INSTÁVEL','CHUVOSO','IMPRATICÁVEL'],xs=[19.57,64.358,109.145,154.5,212.734];climates.forEach((c,i)=>choice(c,xs[i],191.51,xs[i+1]-xs[i],day.weather===c));
  const weekday=new Date(Number(year),Number(month)-1,Number(date),12).getDay();['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].forEach((d,i)=>choice(d,258.089+i*45.354,211.874,45.354,i===weekday));
 }
 // Footer is right-aligned separately to remain within the original paper width.
 function footer(page:number,displayPage=page){font(7);doc.text(`${final?'':'RASCUNHO - '}FOLHA ${day.number} - PÁGINA ${displayPage+1} DE ${pageCount}`,575.5,765,{align:'right'});}
 let outputPage=0;
 servicePages.forEach((lines,i)=>{
  if(pageSelection!==undefined&&pageSelection!==i+1)return;
  const continuation=i>0;frame(outputPage,continuation,continuation?'SERVIÇOS DESENVOLVIDOS NO DIA: (CONTINUAÇÃO)':'SERVIÇOS DESENVOLVIDOS NO DIA:',i);lines.forEach((line,j)=>{if(line.number!==undefined)text(String(line.number),42,249.96+j*10.182,7.189,false,'center');text(line.text,65.17,249.96+j*10.182);});
  if(i===0){field(day.professionals===null?'':String(day.professionals),20.4,463.8,191,7.189,'center');field(settings.preposto,20.4,494.4,191,7.189);yesNo(day.sufficient,456.243);yesNo(day.present,486.789);firstNotes.forEach(n=>n.lines.forEach((line,j)=>text(line,20.4,n.y+j*10.182)));field(settings.manager,20.4,748.4,191,6.009,'center',true);field(settings.supervisorEngineer,214,748.4,178,6.009,'center',true);field(settings.inspector,395,748.4,180,6.009,'center',true);}
  footer(outputPage,i);outputPage++;
 });
 notePages.forEach((p,i)=>{const index=servicePages.length+i;if(pageSelection!==undefined&&pageSelection!==index+1)return;frame(outputPage,true,p.title,index);p.lines.forEach((line,j)=>text(line,20.4,249.96+j*10.182));footer(outputPage,index);outputPage++;});
 return {pageCount,serviceCount:rdoServices(photos,day.date,day.folderId).length,photoCount:rdoPhotos(photos,day.date,day.folderId).length};
}

export function generateRdoPdf(day:RdoDay,settings:RdoSettings,photos:PhotoRecord[],assetDir=path.join(process.cwd(),process.env.NODE_ENV==='production'?'dist':'public','rdo'),headerBannerBase64?:string){
 const template=JSON.parse(fs.readFileSync(path.join(assetDir,'template.json'),'utf8'));
 const doc=new jsPDF({unit:'pt',format:[template.width,template.height],compress:true,putOnlyUsedFonts:true});
 setupDocFonts(doc,assetDir);
 const result=renderRdoIntoDoc(doc,day,settings,photos,assetDir,false,undefined,headerBannerBase64);
 const final=day.status==='final'&&day.finalSignature===rdoSignature(day,settings,photos);
 doc.setProperties({title:`RDO ${day.number} - ${brDate(day.date)}`,subject:final?'Finalizado':'Rascunho',creator:'DER/PR offline'});
 return {bytes:Buffer.from(doc.output('arraybuffer')),pageCount:result.pageCount,serviceCount:result.serviceCount,photoCount:result.photoCount};
}

export function generateRdoPagePdf(day:RdoDay,settings:RdoSettings,photos:PhotoRecord[],page:number,assetDir=path.join(process.cwd(),process.env.NODE_ENV==='production'?'dist':'public','rdo'),headerBannerBase64?:string){
 const template=JSON.parse(fs.readFileSync(path.join(assetDir,'template.json'),'utf8'));
 const doc=new jsPDF({unit:'pt',format:[template.width,template.height],compress:true,putOnlyUsedFonts:true});
 setupDocFonts(doc,assetDir);
 const result=renderRdoIntoDoc(doc,day,settings,photos,assetDir,false,page,headerBannerBase64);
 if(!result.pageCount||page<1||page>result.pageCount)throw new Error('Página de RDO inválida.');
 doc.setProperties({title:`RDO ${day.number} - ${brDate(day.date)} - página ${page}`,subject:day.status==='final'?'Finalizado':'Rascunho',creator:'DER/PR offline'});
 return {bytes:Buffer.from(doc.output('arraybuffer')),pageCount:result.pageCount};
}

export function generateRdoCollectionPdf(days:RdoDay[],settings:RdoSettings,photos:PhotoRecord[],assetDir=path.join(process.cwd(),process.env.NODE_ENV==='production'?'dist':'public','rdo'),headerBannerBase64?:string){
 if(!days.length)throw new Error('Nenhum RDO encontrado para a seleção.');
 const template=JSON.parse(fs.readFileSync(path.join(assetDir,'template.json'),'utf8'));
 const doc=new jsPDF({unit:'pt',format:[template.width,template.height],compress:true,putOnlyUsedFonts:true});
 setupDocFonts(doc,assetDir);
 let totalPages=0;
 days.forEach((day,i)=>{ const r=renderRdoIntoDoc(doc,day,settings,photos,assetDir,i>0,undefined,headerBannerBase64); totalPages+=r.pageCount; });
 doc.setProperties({title:'RDOs DER/PR - seleção',subject:'Relatórios Diários de Obra',creator:'DER/PR offline'});
 return {bytes:Buffer.from(doc.output('arraybuffer')),pageCount:totalPages};
}

