export type Region = {x:number;y:number;width:number;height:number};
export function reconstruct(data:Uint8ClampedArray, width:number, height:number, r:Region) {
  const out = new Uint8ClampedArray(data);
  const x0=Math.max(1,Math.floor(r.x)), y0=Math.max(1,Math.floor(r.y));
  const x1=Math.min(width-2,Math.ceil(r.x+r.width)-1), y1=Math.min(height-2,Math.ceil(r.y+r.height)-1);
  if(x1<x0||y1<y0) throw new Error('Selecione uma área dentro da foto.');
  // Interpolação dos contornos: aproximação local, sem inventar precisão documental.
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
    const a=(x-x0+1)/(x1-x0+2), b=(y-y0+1)/(y1-y0+2);
    for(let c=0;c<3;c++) out[(y*width+x)*4+c]=Math.round((
      data[(y*width+x0-1)*4+c]*(1-a)+data[(y*width+x1+1)*4+c]*a+
      data[((y0-1)*width+x)*4+c]*(1-b)+data[((y1+1)*width+x)*4+c]*b)/2);
  }
  return out;
}
export function wrapText(ctx:CanvasRenderingContext2D,text:string,max:number) {
  const lines:string[]=[];
  for(const paragraph of text.split('\n')) {
    let line='';
    for(const char of paragraph) {
      if(line && ctx.measureText(line+char).width>max){lines.push(line);line='';}
      line+=char;
    }
    lines.push(line);
  }
  return lines;
}
export function renderStamp(img:HTMLImageElement, mode:'band'|'replace', text:string, r:Region, size:number) {
  const w=img.naturalWidth,h=img.naturalHeight;
  if(w*h>24000000) throw new Error('O editor aceita fotos de até 24 megapixels.');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.font=`${size}px Arial`;
  const pad=Math.max(8,Math.round(size*.6));
  const lines=wrapText(ctx,text,mode==='band'?w-pad*2:r.width-pad*2);
  const lineHeight=Math.ceil(size*1.3), bandHeight=lines.length*lineHeight+pad*2;
  if(mode==='band') {
    if(w*(h+bandHeight)>32000000)throw new Error('A legenda ficou muito grande. Reduza o texto.');
    canvas.height=h+bandHeight;ctx.drawImage(img,0,0);
    ctx.fillStyle='#ffffff';ctx.fillRect(0,h,w,bandHeight);
  } else {
    if(r.width<pad*2+size||bandHeight>r.height)throw new Error('O texto não cabe na seleção. Aumente a área ou diminua a fonte.');
    ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,w,h);
    pixels.data.set(reconstruct(pixels.data,w,h,r));ctx.putImageData(pixels,0,0);
    ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.width,r.height);ctx.clip();
  }
  ctx.font=`${size}px Arial`;ctx.textBaseline='top';
  ctx.fillStyle=mode==='band'?'#111827':'#ffffff';
  if(mode==='replace'){ctx.shadowColor='#000';ctx.shadowBlur=2;ctx.shadowOffsetY=1;}
  lines.forEach((line,i)=>ctx.fillText(line,(mode==='band'?0:r.x)+pad,(mode==='band'?h:r.y)+pad+i*lineHeight));
  if(mode==='replace')ctx.restore();
  return canvas.toDataURL('image/png');
}
