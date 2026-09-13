import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

// sql.js é SQLite compilado para WebAssembly puro — zero dependência nativa.
// Escolhido depois de testar better-sqlite3, que exige compilador (Visual
// Studio no Windows) para versões compatíveis com Node 20, e cujo binário
// pré-compilado mais recente falha (segmentation fault) em Node < 22. Como a
// prioridade do projeto é "instalar com `npm install` em qualquer máquina",
// sql.js é a opção mais confiável, ao custo de persistir o banco inteiro em
// disco a cada escrita — irrelevante aqui pelo volume baixo de mensagens de
// um chat.
const PASTA_DADOS = 'data';
const CAMINHO_BANCO = path.join(PASTA_DADOS, 'dashboard.sqlite');

let db;

export async function iniciarBanco() {
  if (!fs.existsSync(PASTA_DADOS)) {
    fs.mkdirSync(PASTA_DADOS, { recursive: true });
  }

  const SQL = await initSqlJs();
  db = fs.existsSync(CAMINHO_BANCO) ? new SQL.Database(fs.readFileSync(CAMINHO_BANCO)) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS mensagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contato_id TEXT NOT NULL,
      nome_contato TEXT,
      direcao TEXT NOT NULL CHECK (direcao IN ('recebida', 'enviada')),
      texto TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_mensagens_contato ON mensagens(contato_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_mensagens_criado_em ON mensagens(criado_em);');

  persistir();
  console.log(`✓ Banco de dados pronto (${CAMINHO_BANCO})`);
}

function persistir() {
  fs.writeFileSync(CAMINHO_BANCO, Buffer.from(db.export()));
}

// Limites (em ISO 8601 UTC) do dia local de hoje, usados para "contatos que
// chamaram hoje". Comparação lexicográfica de strings ISO 8601 é equivalente
// à comparação cronológica, então não precisamos de funções de data do SQL.
function limitesDoDiaAtual() {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

/**
 * Registra uma mensagem (recebida do contato ou enviada pelo agente).
 * Nunca lança erro — uma falha aqui não pode derrubar o atendimento no
 * WhatsApp, então qualquer problema só é logado no console.
 */
export function registrarMensagem(contatoId, nomeContato, direcao, texto) {
  if (!db) return; // banco ainda não iniciado (ex.: dashboard desabilitado)
  try {
    db.run('INSERT INTO mensagens (contato_id, nome_contato, direcao, texto, criado_em) VALUES (?, ?, ?, ?, ?)', [
      contatoId,
      nomeContato || null,
      direcao,
      texto,
      new Date().toISOString(),
    ]);
    persistir();
  } catch (erro) {
    console.error('[DB] Falha ao registrar mensagem (atendimento não foi afetado):', erro.message);
  }
}

function consultar(sql, params = []) {
  const resultado = db.exec(sql, params);
  if (resultado.length === 0) return [];
  const { columns, values } = resultado[0];
  return values.map((linha) => Object.fromEntries(columns.map((coluna, i) => [coluna, linha[i]])));
}

export function obterVisaoGeral() {
  const { inicio, fim } = limitesDoDiaAtual();

  const totalContatos = consultar('SELECT COUNT(DISTINCT contato_id) as total FROM mensagens')[0]?.total || 0;
  const totalRecebidas = consultar("SELECT COUNT(*) as total FROM mensagens WHERE direcao = 'recebida'")[0]?.total || 0;
  const totalEnviadas = consultar("SELECT COUNT(*) as total FROM mensagens WHERE direcao = 'enviada'")[0]?.total || 0;
  const contatosHoje = consultar(
    "SELECT COUNT(DISTINCT contato_id) as total FROM mensagens WHERE direcao = 'recebida' AND criado_em >= ? AND criado_em < ?",
    [inicio, fim]
  )[0]?.total || 0;

  return { totalContatos, totalRecebidas, totalEnviadas, contatosHoje };
}

/**
 * Um contato por linha, com a última mensagem e o total de mensagens
 * trocadas — usado tanto na lista de "Conversas" quanto nas "conversas
 * recentes" da Visão Geral.
 */
export function obterContatos() {
  return consultar(`
    SELECT
      m.contato_id AS contatoId,
      (SELECT nome_contato FROM mensagens WHERE contato_id = m.contato_id AND nome_contato IS NOT NULL ORDER BY criado_em DESC LIMIT 1) AS nomeContato,
      MAX(m.criado_em) AS ultimaMensagemEm,
      COUNT(*) AS totalMensagens,
      (SELECT texto FROM mensagens WHERE contato_id = m.contato_id ORDER BY criado_em DESC LIMIT 1) AS ultimaMensagemTexto,
      (SELECT direcao FROM mensagens WHERE contato_id = m.contato_id ORDER BY criado_em DESC LIMIT 1) AS ultimaMensagemDirecao
    FROM mensagens m
    GROUP BY m.contato_id
    ORDER BY ultimaMensagemEm DESC
  `);
}

export function obterMensagensDoContato(contatoId) {
  return consultar(
    'SELECT direcao AS direcao, texto AS texto, criado_em AS criadoEm FROM mensagens WHERE contato_id = ? ORDER BY criado_em ASC',
    [contatoId]
  );
}
