import 'dotenv/config';

// Marcador usado nos campos que ainda não foram preenchidos com dados reais
// da academia. O agente é instruído a nunca inventar um valor para substituir isso.
export const PREENCHER = 'PREENCHER';

// Dados oficiais da academia. Edite livremente estes valores — nenhuma outra
// parte do código precisa mudar quando as informações reais forem atualizadas.
export const ACADEMIA = {
  nome: 'GRAB Jiu-Jitsu',

  endereco: 'Rua Domingos de Morais, 1672 - 2º andar, Vila Mariana - São Paulo/SP',

  estacionamentoConveniado: 'UP — Rua Madre Cabrini, 38',

  contato: {
    email: 'contato@grabjiujitsu.com',
    whatsapp: '11 91511-1270',
    site: 'https://www.grabjiujitsu.com/',
  },

  horarioGeral: {
    segundaASexta: '7h às 21h',
    sabado: '9h às 12h',
  },

  modalidades: 'Jiu-Jitsu, Grappling/No-Gi, Wrestling e aulas Kids',

  destaque: 'grade equilibrada entre Grappling e Jiu-Jitsu com kimono, com treinos de No-Gi todos os dias',

  planos: {
    pixAVista: {
      anual: 'R$ 3.300',
      semestral: 'R$ 1.900',
      trimestral: 'R$ 1.000',
      mensalSemRecorrencia: 'R$ 380',
    },
    cartaoParcelado: {
      anual: '6x de R$ 3.600',
      semestral: '6x de R$ 2.000',
      trimestral: '3x de R$ 1.100',
      mensalRecorrente: 'R$ 300',
    },
    kids: {
      mensal: 'R$ 199',
    },
    aulaAvulsaVisitante: 'R$ 60',
  },

  aulaExperimental: {
    disponivel: true,
    valor: 'gratuita',
  },

  telefone: '11 91511-1270',
};

// Grade horária semanal, estruturada para ser fácil de consultar e de
// atualizar sem precisar mexer na lógica do agente (src/gemini.js apenas
// percorre este objeto para montar o texto que vai para o Gemini).
export const GRADE_HORARIA = {
  segunda: [
    { horario: '08:00', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '10:30', modalidade: 'Profissional', nivel: null },
    { horario: '17:20', modalidade: 'Kids NoGi', nivel: '6 a 10 anos' },
    { horario: '18:30', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '20:20', modalidade: 'Kimono', nivel: 'Iniciante/Intermediário' },
  ],
  terca: [
    { horario: '07:00', modalidade: 'NoGi', nivel: 'Iniciante/Intermediário' },
    { horario: '08:00', modalidade: 'Kimono', nivel: 'Iniciante/Intermediário' },
    { horario: '12:00', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '18:30', modalidade: 'Kimono', nivel: 'Avançado/Intermediário' },
    { horario: '20:20', modalidade: 'Wrestling', nivel: 'Iniciante/Intermediário' },
  ],
  quarta: [
    { horario: '08:00', modalidade: 'NoGi', nivel: 'Iniciante/Intermediário' },
    { horario: '10:30', modalidade: 'Profissional', nivel: null },
    { horario: '17:20', modalidade: 'Kids NoGi', nivel: '6 a 10 anos' },
    { horario: '18:30', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '20:20', modalidade: 'Kimono', nivel: 'Iniciante/Intermediário' },
  ],
  quinta: [
    { horario: '07:00', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '08:00', modalidade: 'Kimono', nivel: 'Iniciante/Intermediário' },
    { horario: '12:00', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '18:30', modalidade: 'Kimono', nivel: 'Avançado/Intermediário' },
    { horario: '20:20', modalidade: 'NoGi', nivel: 'Iniciante/Intermediário' },
  ],
  sexta: [
    { horario: '08:00', modalidade: 'NoGi', nivel: 'Avançado/Intermediário' },
    { horario: '10:30', modalidade: 'Profissional', nivel: null },
    { horario: '18:30', modalidade: 'NoGi', nivel: 'Iniciante/Intermediário' },
  ],
  sabado: [
    { horario: '09:00', modalidade: 'Jiu-Jitsu Kids Kimono', nivel: '4 a 10 anos' },
    { horario: '10:30', modalidade: 'NoGi', nivel: 'Iniciante/Intermediário' },
  ],
};

// System Instruction fixa da persona do agente. Mantém o comportamento e os
// limites definidos pelo cliente, com ênfase em variar a redação das
// respostas (para não soar robótico) e nunca confirmar um agendamento real.
export const PERSONA_SYSTEM_INSTRUCTION = `Você é o assistente virtual da "GRAB Jiu-Jitsu", uma academia de artes marciais.
Seu tom é amigável, motivador e prestativo — como um ótimo atendente humano, mas sem fingir ser uma pessoa.
Você deve ajudar alunos e interessados com informações sobre:
- horários das aulas;
- modalidades (Jiu-Jitsu, Grappling/No-Gi, Wrestling, Kids);
- valores dos planos;
- funcionamento da academia;
- aulas experimentais;
- processo de matrícula;
- dúvidas gerais relacionadas à academia.

Estilo de resposta:
- Respostas curtas, naturais e adequadas para WhatsApp (evite parágrafos longos).
- Use emojis ocasionalmente, sem exagerar.
- Varie a forma de cumprimentar e de responder a cada conversa — não repita sempre a mesma frase pronta, mesmo mantendo a personalidade. Duas pessoas perguntando "Oi" em conversas diferentes devem receber saudações com formulações distintas.
- Seja objetivo: responda primeiro o que foi perguntado, e só depois ofereça ajuda adicional (ex.: sugerir aula experimental) quando fizer sentido.

Regras sobre informação:
- Nunca invente informações sobre a academia (preços, horários, endereço, etc.). Use somente os dados fornecidos a seguir.
- Quando não souber uma informação, diga claramente que não possui aquela informação e sugira falar com a equipe da academia.
- Não prometa algo que não pode realmente realizar.

Sobre aula experimental / matrícula:
- Se o usuário demonstrar interesse em uma aula experimental, conduza a conversa naturalmente para coletar: nome, modalidade de interesse, dia e horário desejados (e idade, se for aula Kids).
- NUNCA diga que um horário "está confirmado" ou "está marcado" — você não tem acesso à agenda real da academia. Diga algo como "vou deixar essas informações organizadas para a equipe confirmar a disponibilidade" ou equivalente, variando a frase.`;

// Configurações gerais lidas do .env, com valores padrão sensatos.
export const CONFIG = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  maxHistoricoMensagens: Number(process.env.MAX_HISTORICO_MENSAGENS) || 20,
  dashboardPassword: process.env.DASHBOARD_PASSWORD,
  dashboardPort: Number(process.env.DASHBOARD_PORT) || 3000,
};
