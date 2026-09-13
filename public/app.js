const INTERVALO_ATUALIZACAO_MS = 8000;

const RÓTULOS_STATUS = {
  conectado: 'Conectado',
  conectando: 'Conectando...',
  reconectando: 'Reconectando...',
  aguardando_qr: 'Aguardando QR Code',
  deslogado: 'Sessão encerrada',
  desconectado: 'Desconectado',
};

let contatoSelecionadoId = null;

async function buscarJson(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao buscar ${url}: ${resposta.status}`);
  return resposta.json();
}

function formatarHora(isoString) {
  const data = new Date(isoString);
  const hoje = new Date();
  const éHoje = data.toDateString() === hoje.toDateString();
  return éHoje
    ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' ' +
        data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function nomeDeExibicao(contato) {
  return contato.nomeContato || contato.telefoneMascarado;
}

// ===== Status de conexão (topo) =====

async function atualizarStatus() {
  try {
    const { status } = await buscarJson('/api/status');
    document.getElementById('status-ponto').className = `status-ponto ${status}`;
    document.getElementById('status-texto').textContent = RÓTULOS_STATUS[status] || status;
  } catch {
    document.getElementById('status-texto').textContent = 'indisponível';
  }
}

// ===== Visão geral =====

async function atualizarVisaoGeral() {
  const carregando = document.getElementById('visao-geral-carregando');
  const erro = document.getElementById('visao-geral-erro');
  const conteudo = document.getElementById('visao-geral-conteudo');

  try {
    const dados = await buscarJson('/api/overview');

    document.getElementById('metrica-contatos').textContent = dados.totalContatos;
    document.getElementById('metrica-recebidas').textContent = dados.totalRecebidas;
    document.getElementById('metrica-enviadas').textContent = dados.totalEnviadas;
    document.getElementById('metrica-hoje').textContent = dados.contatosHoje;

    const lista = document.getElementById('conversas-recentes-lista');
    const vazio = document.getElementById('conversas-recentes-vazio');

    if (dados.conversasRecentes.length === 0) {
      lista.innerHTML = '';
      vazio.hidden = false;
    } else {
      vazio.hidden = true;
      lista.innerHTML = dados.conversasRecentes
        .map((c) => {
          const prefixo = c.ultimaMensagemDirecao === 'enviada' ? 'Você: ' : '';
          return `
            <div class="conversa-recente-item">
              <div class="conversa-recente-info">
                <span class="conversa-recente-nome">${escaparHtml(nomeDeExibicao(c))}</span>
                <span class="conversa-recente-preview">${escaparHtml(prefixo + (c.ultimaMensagemTexto || ''))}</span>
              </div>
              <span class="conversa-recente-hora">${formatarHora(c.ultimaMensagemEm)}</span>
            </div>
          `;
        })
        .join('');
    }

    carregando.hidden = true;
    erro.hidden = true;
    conteudo.hidden = false;
  } catch (e) {
    if (conteudo.hidden) {
      carregando.hidden = true;
      erro.hidden = false;
    }
    // Se já havia dados na tela, mantemos o que está visível e só logamos —
    // evita que uma falha passageira de rede pisque a interface inteira.
    console.error('Erro ao atualizar visão geral:', e);
  }
}

// ===== Conversas =====

async function atualizarListaContatos() {
  const carregando = document.getElementById('contatos-carregando');
  const vazio = document.getElementById('contatos-vazio');
  const itensEl = document.getElementById('contatos-itens');

  try {
    const contatos = await buscarJson('/api/contacts');
    carregando.hidden = true;

    if (contatos.length === 0) {
      vazio.hidden = false;
      itensEl.innerHTML = '';
      return;
    }

    vazio.hidden = true;
    itensEl.innerHTML = contatos
      .map(
        (c) => `
          <div class="contato-item ${c.contatoId === contatoSelecionadoId ? 'selecionado' : ''}" data-contato-id="${escaparHtml(c.contatoId)}">
            <span class="contato-nome">${escaparHtml(nomeDeExibicao(c))}</span>
            <span class="contato-preview">${escaparHtml(c.ultimaMensagemTexto || '')}</span>
            <span class="contato-hora">${formatarHora(c.ultimaMensagemEm)}</span>
          </div>
        `
      )
      .join('');

    itensEl.querySelectorAll('.contato-item').forEach((el) => {
      el.addEventListener('click', () => selecionarContato(el.dataset.contatoId));
    });
  } catch (e) {
    console.error('Erro ao carregar contatos:', e);
  }
}

async function selecionarContato(contatoId) {
  contatoSelecionadoId = contatoId;

  document.getElementById('chat-vazio').hidden = true;
  document.getElementById('chat-cabecalho').hidden = true;
  document.getElementById('chat-mensagens').hidden = true;
  document.getElementById('chat-carregando').hidden = false;

  document.querySelector('.conversas-layout').classList.add('mostrando-chat');
  document.getElementById('botao-voltar').hidden = false;

  await carregarMensagensDoContatoSelecionado();
  atualizarListaContatos();
}

async function carregarMensagensDoContatoSelecionado() {
  if (!contatoSelecionadoId) return;

  try {
    const [contatos, mensagens] = await Promise.all([
      buscarJson('/api/contacts'),
      buscarJson(`/api/contacts/${encodeURIComponent(contatoSelecionadoId)}/messages`),
    ]);

    const contato = contatos.find((c) => c.contatoId === contatoSelecionadoId);

    document.getElementById('chat-titulo').textContent = contato ? nomeDeExibicao(contato) : 'Conversa';
    document.getElementById('chat-cabecalho').hidden = false;

    const container = document.getElementById('chat-mensagens');
    container.innerHTML = mensagens
      .map(
        (m) => `
          <div class="bolha ${m.direcao === 'enviada' ? 'bolha-enviada' : 'bolha-recebida'}">
            ${escaparHtml(m.texto)}
            <span class="bolha-hora">${formatarHora(m.criadoEm)}</span>
          </div>
        `
      )
      .join('');

    document.getElementById('chat-carregando').hidden = true;
    container.hidden = false;
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    console.error('Erro ao carregar mensagens do contato:', e);
  }
}

function voltarParaListaDeContatos() {
  document.querySelector('.conversas-layout').classList.remove('mostrando-chat');
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ===== Navegação entre abas =====

function mudarAba(nomeAba) {
  document.querySelectorAll('.aba').forEach((el) => el.classList.toggle('ativa', el.dataset.aba === nomeAba));
  document.getElementById('painel-visao-geral').hidden = nomeAba !== 'visao-geral';
  document.getElementById('painel-conversas').hidden = nomeAba !== 'conversas';
}

document.querySelectorAll('.aba').forEach((el) => {
  el.addEventListener('click', () => mudarAba(el.dataset.aba));
});

document.getElementById('botao-voltar').addEventListener('click', voltarParaListaDeContatos);

// ===== Inicialização e atualização automática =====

function atualizarTudo() {
  atualizarStatus();
  atualizarVisaoGeral();
  atualizarListaContatos();
  if (contatoSelecionadoId) carregarMensagensDoContatoSelecionado();
}

atualizarTudo();
setInterval(atualizarTudo, INTERVALO_ATUALIZACAO_MS);
