// Configuração de armazenamento de anexos.
// Os arquivos são gravados com nome hashado (src/utils/anexos.js) em um único
// diretório — nunca o nome enviado (path traversal). `UPLOADS_DIR` por env
// (default: `<backend>/uploads`, gitignored).
const path = require('path');
const fs = require('fs');
const env = require('./env');

const raiz = env.uploadsDir || path.resolve(__dirname, '..', '..', 'uploads');

// Idempotente: cria quando não existe (não falha o boot se já estiver lá).
fs.mkdirSync(raiz, { recursive: true });

module.exports = {
  raiz,
  caminhoNoDisco(nome) {
    // Nome SEMPRE hashado; qualquer coisa com separator é recusada.
    if (!/^[a-f0-9]{64}\.(png|jpg|webp|pdf)$/.test(String(nome || ''))) return null;
    return path.join(raiz, nome);
  },
  grava(caminho, bytes) {
    return fs.promises.writeFile(caminho, bytes);
  },
  apaga(caminho) {
    return fs.promises.unlink(caminho).catch(() => {}); // idempotente
  },
  le(caminho) {
    return fs.promises.readFile(caminho);
  },
};
