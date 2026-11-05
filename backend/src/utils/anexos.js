// Inspeção de anexos (decisão E do plano §11 + risco 2).
//
// Content-Type declarado NÃO é confiança: o nome e o content-type vêm do
// cliente. O que vale são os **magic bytes** — é com eles que SVG disfarçado
// (vetor de XSS servido inline) é rejeitado, mesmo marcado como png.
//
// Allowlist: image/png, image/jpeg, image/webp, application/pdf.
// **SVG é proibido** em qualquer forma (plan: risco 2).
const crypto = require('crypto');

const MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

// Detecta MIME pelos primeiros bytes. `null` quando não é nenhum dos tipos da
// allowlist — inclusive quando é texto/XML/SVG por baixo.
function sniff(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : Buffer.from(bytes || []);
  if (u8.length < 12) return null;

  const ascii4 = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (ascii4 === '%PDF') return 'application/pdf';
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image/png';
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg';
  // WEBP: 'RIFF' + 4 de tamanho + 'WEBP'.
  if (ascii4 === 'RIFF' && String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) === 'WEBP') {
    return 'image/webp';
  }
  return MIMES.has(ascii4) ? ascii4 : null;
}

// Nome em disco é SHA-256 do conteúdo + extensão detectada — nunca o nome
// enviado (path traversal / sobreposição). Mesmo conteúdo → mesmo caminho.
function caminhoHash(bytes, mime) {
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const ext = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }[mime] || '';
  return `${hash}${ext}`;
}

// Nome de exibição: basename sem path, sem escapes, limitado. O cliente pode
// enviar '../../etc/passwd' no filename do multipart.
function nomeExibicao(nome) {
  const base = String(nome || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'anexo';
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').slice(0, 200) || 'anexo';
}

module.exports = { MIMES, sniff, caminhoHash, nomeExibicao };
