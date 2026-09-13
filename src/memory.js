import { CONFIG } from './config.js';

// Histórico de conversa em memória, organizado por contato (chave = JID do WhatsApp).
// Cada entrada é um array de mensagens no formato exigido pelo Gemini:
// { role: 'user' | 'model', parts: [{ text: '...' }] }
//
// Decisão técnica: para o escopo deste projeto (MVP acadêmico), um Map em
// memória é suficiente e muito mais simples que um banco de dados — o
// histórico só precisa sobreviver enquanto o processo está rodando. Se o
// projeto evoluir para produção, este arquivo é o único ponto que precisaria
// ser trocado por uma implementação com persistência real (ex.: SQLite/Redis).
const historicoPorContato = new Map();

/**
 * Retorna o histórico de mensagens de um contato (array vazio se for novo).
 */
export function obterHistorico(contatoId) {
  return historicoPorContato.get(contatoId) || [];
}

/**
 * Adiciona uma mensagem ao histórico do contato, respeitando o limite máximo
 * configurado para evitar crescimento infinito de memória.
 */
export function adicionarMensagem(contatoId, role, texto) {
  const historico = obterHistorico(contatoId);
  historico.push({ role, parts: [{ text: texto }] });

  const excedente = historico.length - CONFIG.maxHistoricoMensagens;
  if (excedente > 0) {
    historico.splice(0, excedente);
  }

  historicoPorContato.set(contatoId, historico);
}
