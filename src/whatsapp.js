import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { gerarResposta } from './gemini.js';
import { registrarMensagem } from './db.js';

// O Baileys é bastante verboso por padrão (loga cada evento interno do
// protocolo em JSON). Mantemos apenas os nossos próprios logs, mais
// didáticos, silenciando o logger interno da biblioteca.
const loggerSilencioso = pino({ level: 'silent' });

const PASTA_SESSAO = 'auth_info_baileys';
const MAX_TENTATIVAS_RECONEXAO = 5;
let tentativasReconexao = 0;

// Status da conexão, consultado pelo dashboard (src/dashboard.js) via
// obterStatusConexao(). Mantido em memória — não precisa de mais que isso.
let statusConexao = 'conectando';

export function obterStatusConexao() {
  return statusConexao;
}

function log(mensagem) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${hora}] ${mensagem}`);
}

// Extrai o texto de uma mensagem recebida. Mensagens simples chegam em
// `conversation`; mensagens com preview de link ou em resposta a outra
// mensagem chegam em `extendedTextMessage.text`. Qualquer outro tipo
// (imagem, áudio, figurinha etc.) não é suportado nesta primeira versão.
function extrairTexto(mensagem) {
  return mensagem.message?.conversation || mensagem.message?.extendedTextMessage?.text || null;
}

// Marcadores temporários da área de uso privado do Unicode (nunca aparecem em
// texto normal) usados para proteger o negrito enquanto o itálico é
// convertido. Evitamos o caractere de controle NUL (código 0) aqui porque o
// Git interpreta arquivos com byte nulo como binários, deixando os diffs
// ilegíveis no GitHub.
const MARCADOR_INICIO = '';
const MARCADOR_FIM = '';

// O Gemini escreve em markdown padrão (**negrito**, headers com #), mas o
// WhatsApp usa sua própria sintaxe (*negrito*, _itálico_) e não interpreta
// headers. Sem essa conversão, o usuário veria os asteriscos duplos e as
// marcações de # literalmente na tela.
function converterParaFormatoWhatsApp(texto) {
  const negritos = [];
  let resultado = texto.replace(/\*\*(.+?)\*\*/g, (_, conteudo) => {
    negritos.push(conteudo);
    return `${MARCADOR_INICIO}${negritos.length - 1}${MARCADOR_FIM}`;
  });

  resultado = resultado.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_'); // itálico markdown -> itálico WhatsApp
  resultado = resultado.replace(
    new RegExp(`${MARCADOR_INICIO}(\\d+)${MARCADOR_FIM}`, 'g'),
    (_, i) => `*${negritos[Number(i)]}*`
  ); // restaura negrito
  resultado = resultado.replace(/^#{1,6}\s*/gm, ''); // remove headers markdown

  return resultado;
}

async function processarMensagem(sock, mensagem) {
  const contatoId = mensagem.key.remoteJid;
  const texto = extrairTexto(mensagem);

  if (!texto) {
    return; // Ignora mensagens que não sejam texto (imagem, áudio, etc.)
  }

  log(`Nova mensagem\nContato: ${contatoId}\nMensagem: ${texto}`);
  registrarMensagem(contatoId, mensagem.pushName, 'recebida', texto);

  try {
    // Indica "digitando..." enquanto o Gemini processa a resposta.
    await sock.sendPresenceUpdate('composing', contatoId);

    log('Enviando para Gemini...');
    const respostaBruta = await gerarResposta(contatoId, texto);
    const resposta = converterParaFormatoWhatsApp(respostaBruta);
    log(`Resposta gerada:\n${resposta}`);

    await sock.sendPresenceUpdate('paused', contatoId);
    await sock.sendMessage(contatoId, { text: resposta });
    registrarMensagem(contatoId, mensagem.pushName, 'enviada', resposta);
    log('Mensagem enviada ✓');
  } catch (erro) {
    console.error('[WHATSAPP] Erro ao processar mensagem:', erro.message);
    await sock.sendMessage(contatoId, {
      text: 'Desculpe! 😅 Estou com uma pequena dificuldade para responder agora. Tente novamente em alguns instantes.',
    }).catch((erroEnvio) => console.error('[WHATSAPP] Falha ao enviar mensagem de erro:', erroEnvio.message));
  }
}

export async function iniciarWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA_SESSAO);

  const sock = makeWASocket({
    auth: state,
    logger: loggerSilencioso,
    printQRInTerminal: false, // fazemos isso manualmente com qrcode-terminal para controlar o layout
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      statusConexao = 'aguardando_qr';
      log('Escaneie o QR Code abaixo com o WhatsApp do número da academia:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      tentativasReconexao = 0;
      statusConexao = 'conectado';
      log('✓ WhatsApp conectado!');
    }

    if (connection === 'close') {
      const codigoErro = lastDisconnect?.error?.output?.statusCode;
      const deslogado = codigoErro === DisconnectReason.loggedOut;

      if (deslogado) {
        statusConexao = 'deslogado';
        log('Sessão encerrada (logout). Apague a pasta auth_info_baileys e reinicie para gerar um novo QR Code.');
        return;
      }

      if (tentativasReconexao < MAX_TENTATIVAS_RECONEXAO) {
        statusConexao = 'reconectando';
        tentativasReconexao += 1;
        const espera = Math.min(1000 * 2 ** tentativasReconexao, 30000);
        log(`Conexão perdida. Tentando reconectar em ${espera / 1000}s (tentativa ${tentativasReconexao}/${MAX_TENTATIVAS_RECONEXAO})...`);
        setTimeout(iniciarWhatsApp, espera);
      } else {
        statusConexao = 'desconectado';
        console.error('[WHATSAPP] Número máximo de tentativas de reconexão excedido. Encerrando.');
        process.exit(1);
      }
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const mensagem of messages) {
      if (mensagem.key.fromMe) continue; // ignora mensagens enviadas pelo próprio bot
      processarMensagem(sock, mensagem).catch((erro) =>
        console.error('[WHATSAPP] Erro inesperado ao processar mensagem:', erro.message)
      );
    }
  });

  return sock;
}
