// Domínio do dashboard (onda 6, plano §9).
//
// Tudo aqui é leitura sobre o AGREGADO permanente `sgtu.vuso_diario` — nunca
// sobre a tabela raw de eventos. As funções são puras (recebem linhas, devolvem
// números) para que o teste de agregação exercite exatamente este lugar.
//
// Regras do spec:
//  - faixas de tempo de resposta: <= 24 h, <= 7 d, > 7 d;
//  - média e mediana em texto (o frontend formata "2 d 4 h");
//  - erros 401 e 503 SEMPRE separados por sistema — juntar os dois é errado;
//  - nenhum número sem rótulo: o frontend renderiza o valor ao lado de cada barra.

const STATUS = ['ABERTO', 'EM_ANALISE', 'AGUARDANDO', 'RESOLVIDO', 'CANCELADO'];

const FAIXAS = [
  { chave: 'ate24h', limiteMs: 24 * 60 * 60 * 1000 },
  { chave: 'ate7d', limiteMs: 7 * 24 * 60 * 60 * 1000 },
  { chave: 'mais7d', limiteMs: null },
];

// BigInt (Postgres bigint via $queryRaw) nunca vai para JSON sem conversão.
function numero(valor) {
  return Number(valor ?? 0);
}

function porStatus(tickets) {
  const contagem = Object.fromEntries(STATUS.map((s) => [s, 0]));
  for (const t of tickets) {
    if (contagem[t.status] !== undefined) contagem[t.status] += 1;
  }
  return contagem;
}

function tempoResposta(tickets) {
  const fechados = tickets.filter((t) => t.fechadoEm);
  const duracoes = fechados
    .map((t) => new Date(t.fechadoEm).getTime() - new Date(t.abertoEm).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const faixas = Object.fromEntries(FAIXAS.map((f) => [f.chave, 0]));
  for (const ms of duracoes) {
    const ate24h = FAIXAS[0].limiteMs;
    const ate7d = FAIXAS[1].limiteMs;
    if (ms <= ate24h) faixas.ate24h += 1;
    else if (ms <= ate7d) faixas.ate7d += 1;
    else faixas.mais7d += 1;
  }

  const ordenadas = [...duracoes].sort((a, b) => a - b);
  const soma = duracoes.reduce((a, b) => a + b, 0);

  return {
    fechados: duracoes.length,
    faixas,
    mediaHoras: duracoes.length ? round1(soma / duracoes.length / 3600000) : null,
    medianaHoras: ordenadas.length ? round1(mediana(ordenadas) / 3600000) : null,
  };
}

function mediana(ordenadas) {
  const n = ordenadas.length;
  if (!n) return 0;
  const meio = Math.floor(n / 2);
  return n % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Uso por sistema sobre o agregado (dia × sistema) — soma do período.
//
// `usuariosDiaMax` é o máximo de usuários únicos em um dia do período, não a
// soma dos DISTINCT por dia (isso contaria a mesma pessoa várias vezes). O
// agregado não permite contar pessoas ao longo do período — então o número é
// apresentado como "usuários únicos no dia (máximo)", que é o que ele é.
function usoPorSistema(serie) {
  const porSistema = new Map();
  for (const linha of serie) {
    const atual = porSistema.get(linha.sistema) || { sistema: linha.sistema, eventos: 0, usuariosDiaMax: 0, erros401: 0, erros503: 0 };
    atual.eventos += numero(linha.eventos);
    atual.usuariosDiaMax = Math.max(atual.usuariosDiaMax, numero(linha.usuarios));
    atual.erros401 += numero(linha.erros401);
    atual.erros503 += numero(linha.erros503);
    porSistema.set(linha.sistema, atual);
  }
  return [...porSistema.values()].sort((a, b) => b.eventos - a.eventos || a.sistema.localeCompare(b.sistema));
}

function montaResposta({ dias, tickets, serie }) {
  const limpa = serie.map((linha) => ({
    dia: linha.dia,
    sistema: linha.sistema,
    eventos: numero(linha.eventos),
    usuarios: numero(linha.usuarios),
    erros401: numero(linha.erros_401),
    erros503: numero(linha.erros_503),
  }));

  return {
    dias,
    tickets: { total: tickets.length, porStatus: porStatus(tickets) },
    tempoResposta: tempoResposta(tickets),
    uso: usoPorSistema(limpa),
    serie: limpa,
  };
}

module.exports = { STATUS, FAIXAS, porStatus, tempoResposta, usoPorSistema, montaResposta };
