import assert from 'node:assert/strict';
import {build} from 'esbuild';

// photoMeta roda no navegador, mas não usa DOM nas funções testadas aqui.
const code=await build({entryPoints:['src/services/photoMeta.ts'],bundle:true,format:'esm',write:false,platform:'node'});
const m=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));

const u16=(v)=>[v&255,(v>>8)&255];
const u32=(v)=>[v&255,(v>>8)&255,(v>>16)&255,((v>>24)&255)];

// TIFF little-endian com IFD0, ExifIFD (DateTimeOriginal) e GPS IFD.
function tiffExif(){
 const b=[];
 const push=(...v)=>b.push(...v.flat(1));
 push([...Buffer.from('II')],u16(42),u32(8));
 // IFD0 em 8: 3 entradas + próximo IFD
 push(u16(3));
 push(u16(0x0112),u16(3),u32(1),u32(6));            // orientação 6 (retrato)
 push(u16(0x8769),u16(4),u32(1),u32(50));           // ExifIFD
 push(u16(0x8825),u16(4),u32(1),u32(88));           // GPS IFD
 push(u32(0));
 assert.equal(b.length,50,'IFD0 termina em 50');
 // ExifIFD em 50: DateTimeOriginal
 push(u16(1));
 push(u16(0x9003),u16(2),u32(20),u32(68));
 push(u32(0));
 push([...Buffer.from('2026:09:12 14:33:07\0','ascii')]);
 assert.equal(b.length,88,'ExifIFD termina em 88');
 // GPS IFD em 88
 push(u16(6));
 push(u16(0x0001),u16(2),u32(2),[83,0,0,0]);        // 'S'
 push(u16(0x0002),u16(5),u32(3),u32(166));          // 23°48'30,5"
 push(u16(0x0003),u16(2),u32(2),[87,0,0,0]);        // 'W'
 push(u16(0x0004),u16(5),u32(3),u32(190));          // 51°55'12"
 push(u16(0x0005),u16(1),u32(1),[0,0,0,0]);         // acima do nível do mar
 push(u16(0x0006),u16(5),u32(1),u32(214));          // 492,5 m
 push(u32(0));
 assert.equal(b.length,166,'GPS IFD termina em 166');
 push(u32(23),u32(1),u32(48),u32(1),u32(305),u32(10));
 push(u32(51),u32(1),u32(55),u32(1),u32(12),u32(1));
 push(u32(985),u32(2));
 assert.equal(b.length,222,'TIFF com 222 bytes');
 return Buffer.from(b.flat());
}

function jpegComExif(tiff){
 const payload=Buffer.concat([Buffer.from('Exif\0\0','ascii'),tiff]);
 const cabecalho=Buffer.from([0xFF,0xD8,0xFF,0xE1,(payload.length+2)>>8,(payload.length+2)&255]);
 return new Uint8Array(Buffer.concat([cabecalho,payload,Buffer.from([0xFF,0xD9])]));
}

// 1) EXIF: data, hora, GPS e orientação lidos do arquivo
const jpeg=jpegComExif(tiffExif());
const exif=m.lerExif(jpeg);
assert.equal(exif.data,'12/09/2026','data vem do DateTimeOriginal');
assert.equal(exif.hora,'14:33','hora vem do DateTimeOriginal');
assert.equal(exif.latitude,'-23.808472','latitude convertida de DMS para decimal');
assert.equal(exif.longitude,'-51.920000','longitude convertida de DMS para decimal');
assert.equal(exif.elevacao,'492.5m','elevação lida do GPS');
assert.equal(exif.orientacao,6,'orientação lida do EXIF');

// 2) JPEG sem APP1 de EXIF devolve objeto vazio
const semExif=new Uint8Array([0xFF,0xD8,0xFF,0xD9]);
assert.deepEqual(m.lerExif(semExif),{},'sem EXIF não inventa metadado');
assert.deepEqual(m.lerExif(new Uint8Array(0)),{},'arquivo vazio não quebra');

// 3) Ano de relógio de câmera corrompido é ignorado
const dataRuim=Buffer.from(tiffExif());
dataRuim.write('1970:01:01 00:00:00\0',68,'ascii');
const exifRuim=m.lerExif(jpegComExif(dataRuim));
assert.equal(exifRuim.data,undefined,'ano anterior a 2000 é descartado');
assert.equal(exifRuim.latitude,'-23.808472','GPS continua lido mesmo com data inválida');

// 4) Validação de formato e tamanho
const arq=(nome,tipo,tamanho)=>({name:nome,type:tipo,size:tamanho});
assert.equal(m.recusaDeArquivo(arq('IMG_001.JPG','image/jpeg',3*1024*1024)),null,'JPG é aceito');
assert.equal(m.recusaDeArquivo(arq('IMG_001.jpg','',3000)),null,'sem MIME a extensão decide');
assert.match(m.recusaDeArquivo(arq('IMG.heic','image/heic',3000))||'',/HEIC.*converta para JPG/,'HEIC é recusado com explicação');
assert.match(m.recusaDeArquivo(arq('x.avif','',3000))||'',/AVIF/,'AVIF é recusado pelo nome');
assert.match(m.recusaDeArquivo(arq('x.tif','image/tiff',3000))||'',/TIFF/,'TIFF é recusado');
assert.match(m.recusaDeArquivo(arq('vazio.jpg','image/jpeg',0))||'',/arquivo vazio/,'arquivo vazio é recusado');
assert.match(m.recusaDeArquivo(arq('grande.jpg','image/jpeg',60*1024*1024))||'',/acima do limite/,'arquivo acima de 50 MB é recusado');
assert.equal(m.mimeDoArquivo(arq('a.bmp','image/x-ms-bmp',1)),'image/bmp','alias de BMP é canonizado');

// 5) Hash de conteúdo: igual para o mesmo arquivo, diferente para conteúdos distintos
const a=await m.hashDeBytes(new Uint8Array([1,2,3,4]));
const b=await m.hashDeBytes(new Uint8Array([1,2,3,4]));
const c=await m.hashDeBytes(new Uint8Array([1,2,3,5]));
assert.equal(a,b,'mesmo conteúdo gera o mesmo hash');
assert.notEqual(a,c,'conteúdo diferente gera hash diferente');

// 6) Deduplicação por hash das fotos já salvas no projeto
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const hashSalvo=await m.hashDeDataUrl('p1',pixel);
const bytesPixel=new Uint8Array(Buffer.from(pixel.split(',')[1],'base64'));
assert.equal(await m.hashDeBytes(bytesPixel),hashSalvo,'hash da foto importada bate com o da foto salva');
assert.equal(await m.hashDeDataUrl('p1',pixel),hashSalvo,'segunda chamada usa o cache');

// 7) Data URL canoniza o MIME que photoStorage.ts aceita gravar
const url=m.bytesParaDataUrl(new Uint8Array([1,2,3]),'image/jpeg');
assert.ok(url.startsWith('data:image/jpeg;base64,'),'MIME canonizado no data URL');

console.log('test-foto-meta: ok');
