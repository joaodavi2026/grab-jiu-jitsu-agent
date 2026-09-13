import { GoogleGenAI } from '@google/genai';
import { CONFIG, ACADEMIA, GRADE_HORARIA, PERSONA_SYSTEM_INSTRUCTION, PREENCHER } from './config.js';
import { obterHistorico, adicionarMensagem } from './memory.js';

const NAO_INFORMADO = 'não informado — a confirmar com a equipe da academia';

// Troca cada valor ainda igual a PREENCHER por um aviso claro de que aquela
// informação não está disponível, para o Gemini nunca "inventar" um dado.
function formatarValor(valor) {
  return valor === PREENCHER ? NAO_INFORMADO : valor;
}

const NOMES_DIAS = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
};

// Converte a grade horária estruturada (config.js) em texto legível.
function montarGradeHoraria() {
  return Object.entries(GRADE_HORARIA)
    .map(([dia, aulas]) => {
      const linhas = aulas
        .map((aula) => `  - ${aula.horario} ${aula.modalidade}${aula.nivel ? ` (${aula.nivel})` : ''}`)
        .join('\n');
      return `${NOMES_DIAS[dia]}:\n${linhas}`;
    })
    .join('\n');
}

// Converte o objeto ACADEMIA (config.js) em um bloco de texto legível, que é
// enviado ao Gemini como contexto factual junto com a persona fixa.
function montarBlocoDeDados() {
  const p = ACADEMIA.planos;

  return `Dados oficiais da academia (use apenas estas informações, nunca invente outras):
- Nome: ${ACADEMIA.nome}
- Endereço: ${formatarValor(ACADEMIA.endereco)}
- Estacionamento conveniado: ${formatarValor(ACADEMIA.estacionamentoConveniado)}
- Contato: e-mail ${ACADEMIA.contato.email}, WhatsApp ${ACADEMIA.contato.whatsapp}, site ${ACADEMIA.contato.site}
- Horário geral de funcionamento: segunda a sexta ${ACADEMIA.horarioGeral.segundaASexta}, sábado ${ACADEMIA.horarioGeral.sabado}
- Modalidades oferecidas: ${formatarValor(ACADEMIA.modalidades)}
- Diferencial da academia: ${ACADEMIA.destaque}

Grade horária semanal (nomes das modalidades e níveis exatamente como aparecem aqui):
${montarGradeHoraria()}

Planos e valores (use exatamente estes números, nunca arredonde ou invente outros):
- PIX à vista — anual: ${p.pixAVista.anual} | semestral: ${p.pixAVista.semestral} | trimestral: ${p.pixAVista.trimestral} | mensal sem recorrência: ${p.pixAVista.mensalSemRecorrencia}
- Cartão parcelado — anual: ${p.cartaoParcelado.anual} | semestral: ${p.cartaoParcelado.semestral} | trimestral: ${p.cartaoParcelado.trimestral} | mensal recorrente: ${p.cartaoParcelado.mensalRecorrente}
- Plano Kids — mensal: ${p.kids.mensal}
- Aula avulsa/visitante: ${p.aulaAvulsaVisitante}
- Aula experimental disponível: ${ACADEMIA.aulaExperimental.disponivel ? 'sim' : 'não'} — valor: ${formatarValor(ACADEMIA.aulaExperimental.valor)}`;
}

let clienteGemini;

function obterCliente() {
  if (!CONFIG.geminiApiKey) {
    throw new Error('GEMINI_API_KEY não configurada no arquivo .env');
  }
  if (!clienteGemini) {
    clienteGemini = new GoogleGenAI({ apiKey: CONFIG.geminiApiKey });
  }
  return clienteGemini;
}

// Extrai os campos mais úteis de um erro da API do Gemini para diagnóstico,
// sem nunca incluir a API Key (que não faz parte do objeto de erro do SDK).
function descreverErro(erro) {
  return {
    modelo: CONFIG.geminiModel,
    mensagem: erro?.message,
    status: erro?.status,
    code: erro?.code,
    nome: erro?.name,
  };
}

/**
 * Gera a resposta do agente para uma mensagem recebida de um contato,
 * aplicando a persona fixa, os dados da academia e o histórico da conversa.
 *
 * Recebe o histórico via memory.js, aplica a persona, envia para o Gemini e
 * retorna somente o texto da resposta.
 */
export async function gerarResposta(contatoId, mensagemUsuario) {
  try {
    const ai = obterCliente();
    const historico = obterHistorico(contatoId);

    const resposta = await ai.models.generateContent({
      model: CONFIG.geminiModel,
      contents: [...historico, { role: 'user', parts: [{ text: mensagemUsuario }] }],
      config: {
        systemInstruction: `${PERSONA_SYSTEM_INSTRUCTION}\n\n${montarBlocoDeDados()}`,
      },
    });

    const textoResposta = resposta.text?.trim();
    if (!textoResposta) {
      throw new Error('Gemini retornou uma resposta vazia');
    }

    adicionarMensagem(contatoId, 'user', mensagemUsuario);
    adicionarMensagem(contatoId, 'model', textoResposta);

    return textoResposta;
  } catch (erro) {
    // Log técnico completo no terminal (nunca inclui a API Key) para
    // facilitar o debug — a mensagem amigável abaixo é a única coisa que
    // chega até o usuário no WhatsApp.
    console.error('[GEMINI] Falha ao gerar resposta. Detalhes técnicos:', descreverErro(erro));
    return 'Desculpe! 😅 Estou com uma pequena dificuldade para responder agora. Tente novamente em alguns instantes.';
  }
}
