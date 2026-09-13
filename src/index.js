import { CONFIG } from './config.js';
import { iniciarWhatsApp } from './whatsapp.js';
import { iniciarBanco } from './db.js';
import { iniciarDashboard } from './dashboard.js';

function exibirBanner() {
  console.log('================================');
  console.log(' GRAB JIU-JITSU — AGENTE IA');
  console.log('================================\n');
}

async function main() {
  exibirBanner();

  if (!CONFIG.geminiApiKey) {
    console.error(
      'ERRO: a variável GEMINI_API_KEY não foi encontrada.\n' +
      'Copie o arquivo .env.example para .env e preencha sua chave da API do Gemini\n' +
      '(disponível em https://aistudio.google.com/apikey) antes de iniciar o agente.'
    );
    process.exit(1);
  }
  console.log('✓ Variáveis de ambiente carregadas!');
  console.log(`✓ Gemini configurado (modelo: ${CONFIG.geminiModel})`);

  await iniciarBanco();
  iniciarDashboard();
  await iniciarWhatsApp();
  console.log('✓ Agente pronto para atendimento.\n');
}

main().catch((erro) => {
  console.error('Erro fatal ao iniciar o agente:', erro);
  process.exit(1);
});
