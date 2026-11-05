// App mínimo da onda 1: /health sem sessão; T10 global; rotas /api desconhecidas
// respondem 404 JSON (não caem no fallback SPA).
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const createApp = require('../src/app');

const app = createApp();

afterAll(async () => {
  // Os módulos de config abrem clientes (Prisma/ioredis); feche para o vitest sair limpo.
  const prisma = require('../src/config/db');
  await prisma.$disconnect();
});

describe('GET /health', () => {
  it('responde 200 sem sessão', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: 'sgtu-backend' });
  });
});

describe('T10 no app', () => {
  it('nenhuma rota aceita campo de credencial — 400 antes do handler', async () => {
    const res = await request(app).post('/health').send({ password: 'qualquer-coisa-aqui' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CREDENTIAL_FIELD_NOT_ACCEPTED');
    expect(JSON.stringify(res.body)).not.toContain('qualquer-coisa-aqui');
  });
});
