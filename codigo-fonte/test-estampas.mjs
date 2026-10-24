import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {createWorker} from 'tesseract.js';
import {build} from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'der-stamp-test-'));
await build({entryPoints:['src/services/stamp.ts'],outfile:path.join(temp,'stamp.mjs'),bundle:true,format:'esm'});
const {renderStamp}=await import(pathToFileURL(path.join(temp,'stamp.mjs')));
globalThis.document={createElement:()=>createCanvas(1,1)};
const canvas=createCanvas(600,400),ctx=canvas.getContext('2d');
for(let y=0;y<400;y++){ctx.fillStyle=`rgb(${y%255},80,130)`;ctx.fillRect(0,y,600,1);}
const img=await loadImage(canvas.toBuffer('image/png'));
Object.defineProperties(img,{naturalWidth:{value:600},naturalHeight:{value:400}});
const source=ctx.getImageData(0,0,600,400).data;
const region={x:100,y:60,width:350,height:150};
for(const mode of ['band','replace']){
 const result=await loadImage(renderStamp(img,mode,'Descrição corrigida',region,20));
 const c=createCanvas(result.width,result.height);const cc=c.getContext('2d');cc.drawImage(result,0,0);
 const pixels=cc.getImageData(0,0,600,400).data;
 assert.equal(result.width,600);assert.ok(mode==='band'?result.height>400:result.height===400);
 for(let y=0;y<400;y++)for(let x=0;x<600;x++)if(mode==='band'||x<100||x>=450||y<60||y>=210){const i=(y*600+x)*4;assert.deepEqual(pixels.slice(i,i+4),source.slice(i,i+4));}
}
assert.throws(()=>renderStamp(img,'replace','Texto muito grande',region,200),/não cabe/);
const fixture=createCanvas(1200,180),f=fixture.getContext('2d');f.fillStyle='white';f.fillRect(0,0,1200,180);f.fillStyle='black';f.font='48px Arial';f.fillText('RODOVIA PR-317',40,85);
let worker;
try{worker=await createWorker('por',1,{langPath:path.resolve('public/ocr/lang'),cacheMethod:'none',cachePath:temp});const {data}=await worker.recognize(fixture.toBuffer('image/png'));assert.match(data.text,/RODOVIA/);assert.match(data.text,/317/);console.log('PASS: faixa preserva todos os pixels; substituição preserva exterior; texto excessivo rejeitado; OCR português com modelo local.');}finally{await worker?.terminate();fs.rmSync(temp,{recursive:true});}
