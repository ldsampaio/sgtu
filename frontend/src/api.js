/**
 * Cliente de API do SGTU — mapeamento de erro do contrato de sessão
 * (docs/session-contract.md), copy idêntica à página `error.md`:
 *
 *  - 401 → SEM redirect automático: `login_url` do corpo, o usuário escolhe ir.
 *  - 503 → SEM redirect para o saga (o problema pode ser no saga — mandar o
 *    usuário para ele piora). Página própria, sem cache.
 *  - 403/404/400 → texto do corpo; nada de stack.
 *  - falha de rede → `code: 'REDE'` (status 0), nunca confundir com erro de
 *    servidor.
 *
 * Sem sessão em processo: cada request consulta o backend.
 */

const CABECALHOS = { 'Content-Type': 'application/json' };

/** Query só com chaves permitidas pelo backend; nada de valor vazio na URL. */
export function comUrl(caminho, query) {
  const pares = Object.entries(query || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!pares.length) return caminho;
  const qs = new URLSearchParams(pares).toString();
  return `${caminho}?${qs}`;
}

export async function api(caminho, { method = 'GET', body, headers = {}, query = null } = {}) {
  let res;
  try {
    res = await fetch(comUrl(caminho, query), {
      method,
      headers: { ...CABECALHOS, ...headers },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch {
    return { ok: false, status: 0, code: 'REDE', body: null };
  }

  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, code: json?.code ?? null, body: json };
}

/** Multipart (anexos) — mesmo tratamento de erro, sem JSON no corpo. */
export async function apiForm(caminho, formData) {
  let res;
  try {
    res = await fetch(caminho, { method: 'POST', body: formData, credentials: 'include' });
  } catch {
    return { ok: false, status: 0, code: 'REDE', body: null };
  }
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, code: json?.code ?? null, body: json };
}

/**
 * Tradução para a UI: o que renderizar para cada código.
 * `login_url` só existe em 401; em 503 a ação é "tentar de novo" — nunca
 * mandar o usuário para o serviço que caiu.
 */
export function traduzErro(resultado) {
  if (!resultado) return { tipo: 'REDE', titulo: 'Não foi possível carregar.' };

  if (resultado.status === 0) {
    return { tipo: 'REDE', titulo: 'Não foi possível carregar.', texto: 'Verifique sua conexão e tente de novo.' };
  }
  if (resultado.status === 503) {
    return {
      tipo: 'SERVICO',
      titulo: 'Serviço temporariamente indisponível.',
      texto: 'Não foi possível confirmar sua sessão agora. Tente de novo em alguns instantes.',
      retryAfter: resultado.body?.retry_after ?? null,
    };
  }
  if (resultado.status === 401) {
    return {
      tipo: 'SESSAO',
      titulo: 'Sua sessão não está ativa.',
      texto: 'Para acessar, entre no portal do saga.',
      loginUrl: resultado.body?.login_url ?? null,
    };
  }
  if (resultado.status === 403) {
    return {
      tipo: 'PERMISSAO',
      titulo: 'Você não tem acesso a esta página.',
      texto: 'Se você precisa desse acesso, fale com o administrador pelo SGTU.',
    };
  }
  if (resultado.status === 404) {
    return { tipo: 'NAO_ENCONTRADO', titulo: 'Página não encontrada.', texto: 'O endereço não existe ou o ticket foi removido.' };
  }
  if (resultado.status === 400) {
    return { tipo: 'VALIDACAO', titulo: 'Requisição inválida.', texto: resultado.body?.message ?? 'Revise os campos e tente de novo.' };
  }
  return { tipo: 'ERRO', titulo: 'Não foi possível carregar.', texto: 'Tente de novo em alguns instantes.' };
}
