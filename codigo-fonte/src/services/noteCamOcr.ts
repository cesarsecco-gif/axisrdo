import {createWorker, Worker} from 'tesseract.js';

let worker: Worker | null = null;

function cleanLine(value: string): string {
  return value
    .replace(/[|¦]/g, 'I')
    .replace(/^\s*[^\p{L}\d]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMetadataLine(line: string): boolean {
  const normalized = line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!normalized) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(normalized)) return true;
  if (/\b\d{1,2}:\d{2}\b/.test(normalized)) return true;
  if (/^\d{1,2}[KX]\s+\d/.test(normalized)) return true;
  if (/^\d+[°º]\s*[A-Z]{1,3}$/.test(normalized)) return true;
  if (/\b(N|NE|E|SE|S|SW|W|NW)\b/.test(normalized) && /\d/.test(normalized)) return true;
  if (/NUMERO\s+DE\s+INDICE/.test(normalized)) return true;
  if (/^(LATITUDE|LONGITUDE|ELEVACAO|ALTITUDE|PRECISAO)\b/.test(normalized)) return true;
  if (/^\d+(?:[.,]\d+)?$/.test(normalized)) return true;
  return false;
}

// On field photos, lines read from gravel, sky or logos score 0–45 while a
// legible stamp line scores above 60.
const MIN_LINE_CONFIDENCE = 60;

function chooseDescription(lines: string[]): string {
  const candidates = lines
    .map(cleanLine)
    .filter(line => line.length >= 4 && !isMetadataLine(line));

  const ranked = candidates
    .map(line => {
      const letters = (line.match(/[\p{L}]/gu) || []).length;
      const digits = (line.match(/\d/g) || []).length;
      const words = line.split(/\s+/).filter(Boolean).length;
      const upper = (line.match(/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/g) || []).length;
      const lower = (line.match(/[a-záàâãéêíóôõúç]/g) || []).length;
      let score = letters * 2 + Math.min(words, 8) * 3;
      if (upper > lower) score += 10;
      if (digits > letters * 0.25) score -= 20;
      if (line.length > 100) score -= 10;
      return {line, score};
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.line || '';
}

async function getWorker(onProgress?: (message: string) => void): Promise<Worker> {
  if (!worker) {
    worker = await createWorker('por', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      workerBlobURL: false,
      logger: message => {
        const percent = Math.round((message.progress || 0) * 100);
        onProgress?.(`Lendo descrição da foto… ${percent}%`);
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as any,
      preserve_interword_spaces: '1',
    });
  }
  return worker;
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem para leitura.'));
    image.src = source;
  });
  return image;
}

/**
 * Reads the lower-right NoteCam/GPS Map Camera stamp and extracts the most
 * likely service description, e.g. "LIMPEZA CANALETA". The original image
 * is never altered and the OCR runs entirely locally.
 */
export async function readNoteCamDescription(
  source: string,
  onProgress?: (message: string) => void,
): Promise<{description: string; rawText: string}> {
  const image = await loadImage(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  // NoteCam places the stamp at the lower-right. Keep enough context for
  // multiline descriptions but avoid most of the photograph.
  const sx = Math.floor(width * 0.54);
  const sy = Math.floor(height * 0.64);
  const sw = width - sx;
  const sh = height - sy;
  const scale = Math.max(2, Math.min(4, 1600 / sw));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas indisponível para leitura OCR.');

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // White watermark on dark/varied backgrounds benefits from grayscale and
  // moderate contrast while retaining anti-aliased letter edges.
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i];
    const g = pixels.data[i + 1];
    const b = pixels.data[i + 2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = Math.max(0, Math.min(255, (gray - 100) * 1.35 + 100));
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
  }
  ctx.putImageData(pixels, 0, 0);

  onProgress?.('Lendo descrição da foto…');
  const ocr = await getWorker(onProgress);
  const result = await ocr.recognize(canvas, {}, {text: true, blocks: true});
  const rawText = result.data.text || '';
  const confident = (result.data.blocks || [])
    .flatMap(block => block.paragraphs)
    .flatMap(paragraph => paragraph.lines)
    .filter(line => line.confidence >= MIN_LINE_CONFIDENCE)
    .map(line => line.text);
  const description = chooseDescription(confident);
  return {description, rawText};
}

export async function disposeNoteCamOcr(): Promise<void> {
  if (worker) {
    const current = worker;
    worker = null;
    await current.terminate();
  }
}
