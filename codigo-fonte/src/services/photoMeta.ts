// Metadados lidos do próprio arquivo da foto durante a importação:
// EXIF (data, hora, GPS, orientação), hash de conteúdo para deduplicação,
// miniatura para a fila de revisão e validação de formato/tamanho.
// Tudo roda no navegador, sem dependências externas e sem alterar a imagem.

export interface ExifFoto {
  data?: string; // DD/MM/AAAA
  hora?: string; // HH:MM
  latitude?: string; // decimal com 6 casas
  longitude?: string;
  elevacao?: string; // metros
  orientacao?: number; // 1..8 (EXIF tag 0x0112)
}

/** Arquivos maiores que isso não cabem no projeto (o limite do servidor é 500 MB). */
export const MAXIMO_ARQUIVO = 50 * 1024 * 1024;

const MIME_CANONICO: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-ms-bmp': 'image/bmp',
  'image/x-windows-bmp': 'image/bmp',
  'image/x-bmp': 'image/bmp',
};

// Exatamente os formatos que photoStorage.ts grava em disco.
const MIME_A_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

const EXT_A_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

const EXT_NAO_SUPORTADAS = new Set(['heic', 'heif', 'avif', 'svg', 'svgz', 'tif', 'tiff', 'ico', 'jfif']);

export function extensaoDoNome(nome: string): string {
  const parte = String(nome || '').split('?')[0];
  const i = parte.lastIndexOf('.');
  return i < 0 ? '' : parte.slice(i + 1).toLowerCase();
}

/** Tipo MIME canonico do arquivo: usa o declarado pelo sistema, ou a extensão. */
export function mimeDoArquivo(file: File): string {
  let mime = String(file.type || '').toLowerCase().split(';')[0].trim();
  if (!mime || mime === 'application/octet-stream') mime = EXT_A_MIME[extensaoDoNome(file.name)] || '';
  return MIME_CANONICO[mime] || mime;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Devolve o motivo da recusa ou null quando o arquivo pode ser importado.
 * Sem isso, HEIC/AVIF passavam pela interface e sumiam no disco, porque
 * photoStorage.ts só grava jpeg/png/webp/gif/bmp.
 */
export function recusaDeArquivo(file: File): string | null {
  const ext = extensaoDoNome(file.name);
  const mime = mimeDoArquivo(file);
  if (!mime) {
    if (EXT_NAO_SUPORTADAS.has(ext)) return `formato ${ext.toUpperCase()} não é suportado — converta para JPG`;
    return 'não é uma imagem reconhecida (aceitos: JPG, PNG, WEBP, GIF, BMP)';
  }
  if (!MIME_A_EXT[mime]) {
    const tipo = mime.startsWith('image/') ? mime.slice(6).toUpperCase() : mime;
    return `formato ${tipo} não é suportado — converta para JPG, PNG, WEBP, GIF ou BMP`;
  }
  if (file.size === 0) return 'arquivo vazio';
  if (file.size > MAXIMO_ARQUIVO) return `tem ${megabytes(file.size)}, acima do limite de ${megabytes(MAXIMO_ARQUIVO)}`;
  return null;
}

// ---------------------------------------------------------------------------
// Hash de conteúdo (deduplicação)
// ---------------------------------------------------------------------------

function hexDe(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

// Servidor local em http://192.168.x.x não é contexto seguro e não expõe
// crypto.subtle: o hash de conteúdo cai para FNV-1a (basta para detectar
// duplicatas; não é criptográfico).
function fnv1a(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[i], 0x85ebca6b) >>> 0;
    h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
  }
  return `fnv-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-${bytes.length}`;
}

export async function hashDeBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto && (globalThis.crypto as Crypto).subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
      return hexDe(new Uint8Array(digest));
    } catch {
      // contexto inseguro ou navegador antigo: usa o fallback abaixo
    }
  }
  return fnv1a(bytes);
}

const cacheHash = new Map<string, string>();

/** Hash do base64 já gravado no projeto, memoizado por id + tamanho do dado. */
export async function hashDeDataUrl(id: string, dataUrl: string): Promise<string> {
  const chave = `${id}|${dataUrl.length}`;
  const guardado = cacheHash.get(chave);
  if (guardado !== undefined) return guardado;
  let hash = '';
  try {
    const i = dataUrl.indexOf(',');
    const bin = atob(i >= 0 ? dataUrl.slice(i + 1) : dataUrl);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    hash = await hashDeBytes(bytes);
  } catch {
    hash = '';
  }
  cacheHash.set(chave, hash);
  return hash;
}

/** Base64 a partir dos bytes já lidos, preservando o MIME canonizado. */
export function bytesParaDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

// ---------------------------------------------------------------------------
// EXIF (JPEG APP1, WebP chunk EXIF, PNG chunk eXIf)
// ---------------------------------------------------------------------------

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && offset + i < bytes.length; i++) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

function tiffDoJpeg(b: Uint8Array): number | null {
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) {
      p++;
      continue;
    }
    let marca = b[p + 1];
    while (marca === 0xff && p + 2 < b.length) {
      p++;
      marca = b[p + 1];
    }
    // marcadores sem comprimento (SOI, EOI, RSTn, TEM)
    if (marca === 0xd8 || marca === 0xd9 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) {
      p += 2;
      if (marca === 0xd9) return null;
      continue;
    }
    if (marca === 0xda) return null; // começo dos dados: EXIF anterior não existe
    const tamanho = (b[p + 2] << 8) | b[p + 3];
    if (tamanho < 2) return null;
    if (marca === 0xe1 && ascii(b, p + 4, 4) === 'Exif' && b[p + 8] === 0 && b[p + 9] === 0) return p + 10;
    p += 2 + tamanho;
  }
  return null;
}

function tiffDoWebp(b: Uint8Array): number | null {
  let p = 12;
  while (p + 8 <= b.length) {
    const tipo = ascii(b, p, 4);
    const tamanho = (b[p + 4] | (b[p + 5] << 8) | (b[p + 6] << 16) | (b[p + 7] << 24)) >>> 0;
    const inicio = p + 8;
    if (tipo === 'EXIF') return inicio;
    if (inicio + tamanho > b.length) return null;
    p = inicio + tamanho + (tamanho & 1);
  }
  return null;
}

function tiffDoPng(b: Uint8Array): number | null {
  let p = 8;
  while (p + 8 <= b.length) {
    const tamanho = ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
    const tipo = ascii(b, p + 4, 4);
    if (tipo === 'eXIf') return p + 8;
    if (tipo === 'IDAT' || tipo === 'IEND') return null;
    if (tamanho > b.length) return null;
    p += 12 + tamanho;
  }
  return null;
}

function localizarTiff(b: Uint8Array): number | null {
  if (b.length > 16 && b[0] === 0xff && b[1] === 0xd8) return tiffDoJpeg(b);
  if (b.length > 20 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return tiffDoWebp(b);
  if (b.length > 16 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return tiffDoPng(b);
  return null;
}

interface EntradaIfd {
  tipo: number;
  quantidade: number;
  pos: number; // posição do campo de 4 bytes (valor ou offset)
}

const TAMANHO_TIPO: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function ifd(dv: DataView, le: boolean, inicio: number): Map<number, EntradaIfd> {
  const mapa = new Map<number, EntradaIfd>();
  if (!Number.isFinite(inicio) || inicio < 8 || inicio + 2 > dv.byteLength) return mapa;
  const total = dv.getUint16(inicio, le);
  if (total > 512) return mapa;
  for (let i = 0; i < total; i++) {
    const p = inicio + 2 + i * 12;
    if (p + 12 > dv.byteLength) break;
    mapa.set(dv.getUint16(p, le), { tipo: dv.getUint16(p + 2, le), quantidade: dv.getUint32(p + 4, le), pos: p + 8 });
  }
  return mapa;
}

function ondeComeca(dv: DataView, le: boolean, e: EntradaIfd): number {
  const tamanho = TAMANHO_TIPO[e.tipo];
  if (!tamanho) return -1;
  const total = tamanho * e.quantidade;
  if (total <= 4) return e.pos;
  const offset = dv.getUint32(e.pos, le);
  return offset + total <= dv.byteLength ? offset : -1;
}

function lerAscii(dv: DataView, le: boolean, e: EntradaIfd | undefined): string {
  if (!e) return '';
  const p = ondeComeca(dv, le, e);
  if (p < 0) return '';
  let out = '';
  for (let i = 0; i < Math.min(e.quantidade, 128); i++) {
    const c = dv.getUint8(p + i);
    if (!c) break;
    out += String.fromCharCode(c);
  }
  return out;
}

function lerLongo(dv: DataView, le: boolean, e: EntradaIfd | undefined): number {
  if (!e) return NaN;
  if (e.tipo === 3 && e.quantidade === 1) return dv.getUint16(e.pos, le);
  if (e.tipo === 4 && e.quantidade === 1) return dv.getUint32(e.pos, le);
  if (e.tipo === 1 || e.tipo === 7) {
    const p = ondeComeca(dv, le, e);
    return p >= 0 && p < dv.byteLength ? dv.getUint8(p) : NaN;
  }
  return NaN;
}

function lerRacional(dv: DataView, le: boolean, e: EntradaIfd | undefined, indice: number): number {
  if (!e || e.tipo !== 5) return NaN;
  const p = ondeComeca(dv, le, e);
  if (p < 0) return NaN;
  const o = p + indice * 8;
  if (o + 8 > dv.byteLength) return NaN;
  const numerador = dv.getUint32(o, le);
  const denominador = dv.getUint32(o + 4, le);
  return denominador ? numerador / denominador : NaN;
}

function grausParaDecimal(graus: number, ref: string): string | undefined {
  if (!Number.isFinite(graus)) return undefined;
  let valor = Math.abs(graus);
  if (ref === 'S' || ref === 'W') valor = -valor;
  if (valor < -180 || valor > 180 || valor === 0) return undefined;
  return valor.toFixed(6);
}

function dataHoraDoExif(texto: string): { data?: string; hora?: string } {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/.exec(String(texto || '').trim());
  if (!m) return {};
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  // Relógio de câmera mal configurado costuma cair em 1970/1980: ignoramos.
  if (ano < 2000 || ano > new Date().getFullYear() + 1) return {};
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return {};
  return { data: `${m[3]}/${m[2]}/${m[1]}`, hora: `${m[4]}:${m[5]}` };
}

/** Lê EXIF sem decodificar a imagem. Devolve objeto vazio quando não há metadados. */
export function lerExif(bytes: Uint8Array): ExifFoto {
  const inicio = localizarTiff(bytes);
  if (inicio === null) return {};
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + inicio, bytes.byteLength - inicio);
    if (dv.byteLength < 8) return {};
    const ordem = dv.getUint16(0, false);
    const le = ordem === 0x4949;
    if (!le && ordem !== 0x4d4d) return {};
    if (dv.getUint16(2, le) !== 42) return {};

    const principal = ifd(dv, le, dv.getUint32(4, le));
    const saida: ExifFoto = {};

    const orientacao = lerLongo(dv, le, principal.get(0x0112));
    if (Number.isFinite(orientacao) && orientacao >= 1 && orientacao <= 8) saida.orientacao = orientacao;

    const exifIfd = lerLongo(dv, le, principal.get(0x8769));
    const detalhes = Number.isFinite(exifIfd) ? ifd(dv, le, exifIfd) : new Map<number, EntradaIfd>();

    const textoData =
      lerAscii(dv, le, detalhes.get(0x9003)) ||
      lerAscii(dv, le, detalhes.get(0x9004)) ||
      lerAscii(dv, le, principal.get(0x0132));
    Object.assign(saida, dataHoraDoExif(textoData));

    const gpsIfd = lerLongo(dv, le, principal.get(0x8825));
    if (Number.isFinite(gpsIfd)) {
      const gps = ifd(dv, le, gpsIfd);
      const latRef = lerAscii(dv, le, gps.get(0x0001)).trim().toUpperCase();
      const lonRef = lerAscii(dv, le, gps.get(0x0003)).trim().toUpperCase();
      const lat = grausParaDecimal(
        grausDeDms(lerRacional(dv, le, gps.get(0x0002), 0), lerRacional(dv, le, gps.get(0x0002), 1), lerRacional(dv, le, gps.get(0x0002), 2)),
        latRef || 'N',
      );
      const lon = grausParaDecimal(
        grausDeDms(lerRacional(dv, le, gps.get(0x0004), 0), lerRacional(dv, le, gps.get(0x0004), 1), lerRacional(dv, le, gps.get(0x0004), 2)),
        lonRef || 'E',
      );
      if (lat && lon && !(Number(lat) === 0 && Number(lon) === 0)) {
        saida.latitude = lat;
        saida.longitude = lon;
        const altitude = lerRacional(dv, le, gps.get(0x0006), 0);
        if (Number.isFinite(altitude)) {
          const abaixo = lerLongo(dv, le, gps.get(0x0005)) === 1;
          saida.elevacao = `${(abaixo ? -altitude : altitude).toFixed(1)}m`;
        }
      }
    }
    return saida;
  } catch {
    return {};
  }
}

function grausDeDms(graus: number, minutos: number, segundos: number): number {
  if (!Number.isFinite(graus)) return NaN;
  const g = Number.isFinite(minutos) ? minutos : 0;
  const s = Number.isFinite(segundos) ? segundos : 0;
  return Math.abs(graus) + g / 60 + s / 3600;
}

// ---------------------------------------------------------------------------
// Miniatura para a fila de revisão
// ---------------------------------------------------------------------------

function carregarImagem(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    image.src = source;
  });
}

/**
 * Gera uma cópia reduzida usada apenas para desenhar a fila de revisão.
 * A foto original (previewUrl) continua intacta e é a que vai para o disco.
 *
 * Quando o EXIF declara orientação diferente de 1 a miniatura é descartada:
 * o navegador aplica a orientação no <img>, mas nem sempre ao desenhar no
 * canvas, e uma miniatura girada errado seria pior que a imagem cheia.
 */
export async function miniatura(dataUrl: string, orientacao?: number, maxLado = 1600): Promise<string> {
  if (orientacao && orientacao !== 1) return dataUrl;
  try {
    const img = await carregarImagem(dataUrl);
    const largura = img.naturalWidth || img.width;
    const altura = img.naturalHeight || img.height;
    if (!largura || !altura || Math.max(largura, altura) <= maxLado) return dataUrl;
    const escala = maxLado / Math.max(largura, altura);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(largura * escala));
    canvas.height = Math.max(1, Math.round(altura * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const saida = canvas.toDataURL('image/jpeg', 0.82);
    return saida.startsWith('data:image/jpeg') ? saida : dataUrl;
  } catch {
    return dataUrl;
  }
}
