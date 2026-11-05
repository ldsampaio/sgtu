// Gate SEC-02 na sessão compartilhada — throw/no-throw (molde do sgrf).
//
// O SGTU não autentica credencial: não há segredos de JWT próprios, não há cookie
// próprio e não há senha de admin. O que precisa ser seguro em produção é o acesso
// ao Redis (ACL read-only) e as URLs do saga. Este arquivo exercita esse gate.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const CHAVES_GATE = ['REDIS_URL', 'SAGA_JWKS_URL', 'SAGA_LOGIN_URL', 'PORTAL_ALLOWED_REDIRECT_HOSTS'];

describe('SEC-02 Production gate on the session contract - Throw/No-throw matrix', () => {
  const originalEnv = { ...process.env };

  function limpaGate() {
    for (const chave of CHAVES_GATE) delete process.env[chave];
    // O CI define INITIAL_ADMIN_LOGIN (ci-admin): a asserção do default
    // ('ldsampaio') não pode depender do ambiente do runner.
    delete process.env.INITIAL_ADMIN_LOGIN;
  }

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NODE_ENV;
    limpaGate();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function carregarEnv(envVars) {
    limpaGate();
    Object.assign(process.env, envVars);
    vi.resetModules();
    delete require.cache[require.resolve('../src/config/env.js')];
    return require('../src/config/env.js');
  }

  function envBase() {
    return {
      REDIS_URL: 'redis://saga_readonly:seguro@redis:6379/0',
      SAGA_JWKS_URL: 'https://saga.dacom-cp.com.br/.well-known/jwks.json',
      SAGA_LOGIN_URL: 'https://saga.dacom-cp.com.br/login',
      PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.dacom-cp.com.br,sgtu.dacom-cp.com.br',
    };
  }

  describe('Throw cases — produção recusa boot com valor inseguro', () => {
    it('REDIS_URL vazio em produção', () => {
      expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), REDIS_URL: '' })).toThrow('insecure');
    });

    it('REDIS_URL com usuário de acesso completo (sem saga_readonly)', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', ...envBase(), REDIS_URL: 'redis://admin:seguro@redis:6379/0' })
      ).toThrow('saga_readonly');
    });

    it('REDIS_URL com prefixo dev-', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', ...envBase(), REDIS_URL: 'redis://dev-algo@redis:6379/0' })
      ).toThrow('insecure');
    });

    it('SAGA_JWKS_URL com placeholder change-me', () => {
      expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), SAGA_JWKS_URL: 'https://change-me/.well-known/jwks.json' })).toThrow('insecure');
    });

    it('SAGA_LOGIN_URL vazio em produção', () => {
      expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), SAGA_LOGIN_URL: '' })).toThrow('insecure');
    });

    it('PORTAL_ALLOWED_REDIRECT_HOSTS vazio em produção (open redirect sem allowlist)', () => {
      expect(() => carregarEnv({ NODE_ENV: 'production', ...envBase(), PORTAL_ALLOWED_REDIRECT_HOSTS: '' })).toThrow('insecure');
    });
  });

  describe('No-throw cases', () => {
    it('valores válidos em produção bootam', () => {
      const env = carregarEnv({ NODE_ENV: 'production', ...envBase() });
      // Portas/interfaces do SGTU (:3003/:5175) e papel do admin.
      expect(env.port).toBe(3003);
      expect(env.frontendUrl).toBe('http://localhost:5175');
      expect(env.sagaJwksUrl).toBe('https://saga.dacom-cp.com.br/.well-known/jwks.json');
      expect(env.portalAllowedRedirectHosts).toEqual(['saga.dacom-cp.com.br', 'sgtu.dacom-cp.com.br']);
      expect(env.initialAdminLogin).toBe('ldsampaio');
    });

    it('defaults inseguros de dev NÃO recusam boot fora de produção', () => {
      const env = carregarEnv({});
      expect(env.sagaLoginUrl).toBe('http://localhost:8000/login');
      expect(env.redisUrl).toContain('saga_readonly');
    });

    it('SKIP_GW_ENV=true pula o gate mesmo em produção (uso: teste)', () => {
      process.env.SKIP_GW_ENV = 'true';
      expect(() => carregarEnv({ NODE_ENV: 'production', REDIS_URL: '' })).not.toThrow();
    });
  });
});
