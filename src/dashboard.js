import path from 'path';
import crypto from 'crypto';
import express from 'express';
import { CONFIG } from './config.js';
import { obterVisaoGeral, obterContatos, obterMensagensDoContato } from './db.js';
import { obterStatusConexao } from './whatsapp.js';

// Compara duas strings em tempo constante, para não vazar informação sobre a
// senha através do tempo de resposta (timing attack). As strings precisam
// ter o mesmo comprimento para o crypto.timingSafeEqual não lançar erro.
function senhasIguais(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Autenticação HTTP Basic simples: o navegador mostra seu próprio diálogo de
// usuário/senha, sem precisarmos implementar login, sessão ou cookies. Só a
// senha importa — qualquer usuário é aceito.
function exigirAutenticacao(req, res, next) {
  const cabecalho = req.headers.authorization;

  if (cabecalho?.startsWith('Basic ')) {
    const [, senha] = Buffer.from(cabecalho.slice(6), 'base64').toString().split(':');
    if (senha && senhasIguais(senha, CONFIG.dashboardPassword)) {
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Dashboard GRAB Jiu-Jitsu"');
  res.status(401).send('Autenticação necessária.');
}

// Mostra só o início e o fim do identificador do contato (número de telefone
// ou LID), escondendo o meio — evita expor o telefone completo na interface.
function mascarar(contatoId) {
  const digitos = contatoId.split('@')[0];
  if (digitos.length <= 6) return `${digitos.slice(0, 2)}***`;
  return `${digitos.slice(0, 4)}${'*'.repeat(digitos.length - 6)}${digitos.slice(-2)}`;
}

export function iniciarDashboard() {
  if (!CONFIG.dashboardPassword) {
    console.warn(
      '[DASHBOARD] DASHBOARD_PASSWORD não configurada no .env — o dashboard não será iniciado ' +
      '(o agente de WhatsApp continua funcionando normalmente).'
    );
    return;
  }

  const app = express();
  app.use(exigirAutenticacao);
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.get('/api/status', (req, res) => {
    res.json({ status: obterStatusConexao() });
  });

  app.get('/api/overview', (req, res) => {
    const visaoGeral = obterVisaoGeral();
    const conversasRecentes = obterContatos()
      .slice(0, 10)
      .map((c) => ({ ...c, telefoneMascarado: mascarar(c.contatoId) }));
    res.json({ ...visaoGeral, status: obterStatusConexao(), conversasRecentes });
  });

  app.get('/api/contacts', (req, res) => {
    // contatoId é necessário para o front-end pedir o histórico de cada
    // conversa; a interface nunca deve exibi-lo cru, só telefoneMascarado ou
    // nomeContato (ver public/app.js).
    const contatos = obterContatos().map((c) => ({ ...c, telefoneMascarado: mascarar(c.contatoId) }));
    res.json(contatos);
  });

  app.get('/api/contacts/:contatoId/messages', (req, res) => {
    res.json(obterMensagensDoContato(req.params.contatoId));
  });

  app.listen(CONFIG.dashboardPort, () => {
    console.log(`✓ Dashboard disponível em http://localhost:${CONFIG.dashboardPort}`);
  });
}
