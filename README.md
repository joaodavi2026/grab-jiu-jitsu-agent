# Grab Jiu-Jitsu — Agente de Atendimento via WhatsApp

Projeto acadêmico: um agente virtual de atendimento para a **Academia Grab
Jiu-Jitsu**, que conversa com alunos e interessados diretamente pelo
WhatsApp, usando inteligência artificial (Google Gemini) para gerar as
respostas. Inclui também um **dashboard administrativo** para acompanhar o
atendimento (contatos, mensagens, histórico de conversas) pelo navegador.

## Já tenho o projeto — como atualizar

Se você já clonou este repositório antes e só quer pegar as novidades
(como o dashboard):

```powershell
git pull
npm install
```

O `npm install` é importante mesmo se você não mexeu em nada — ele instala
as dependências novas que podem ter sido adicionadas. Depois disso, veja a
seção [6. Configuração](#6-configuração) caso existam variáveis de ambiente
novas no `.env.example` que ainda não estão no seu `.env`.

## 1. Objetivo

Construir, de forma didática e organizada, um atendente automático que:

- conecta a uma conta de WhatsApp via QR Code (sem precisar de API paga da Meta);
- entende o que o usuário escreve e responde de forma natural e humanizada;
- conhece as informações da academia (horários, planos, endereço etc.);
- mantém o contexto da conversa (lembra o que foi dito antes);
- conduz quem tem interesse em aula experimental a informar nome, dia e horário;
- lida com falhas (API fora do ar, chave ausente, etc.) sem derrubar o processo.

## 2. Arquitetura

```text
WhatsApp
   ↓
Baileys            (conecta ao WhatsApp Web, envia/recebe mensagens)
   ↓
Node.js            (recebe o evento de mensagem)
   ↓
Memory / Context   (recupera o histórico daquele contato, para o Gemini)
   ↓                        ↘
Gemini             (persona)  SQLite (data/dashboard.sqlite)  ←→  Dashboard web
   ↓                        ↗          (mesmo processo, porta 3000)
Resposta           (texto gerado pela IA)
   ↓
Baileys
   ↓
WhatsApp
```

Cada mensagem recebida passa por esse fluxo completo antes de uma resposta
ser enviada de volta ao mesmo contato. Em paralelo, a mensagem recebida e a
resposta enviada são gravadas no banco SQLite local, que alimenta o
dashboard — isso não atrasa nem interfere no envio da resposta pelo
WhatsApp.

## 3. Estrutura do projeto

```text
grab-jiu-jitsu-agent/
│
├── src/
│   ├── index.js      # Ponto de entrada: valida ambiente e inicia agente + dashboard
│   ├── whatsapp.js    # Conexão com o WhatsApp (Baileys), QR Code, envio/recebimento
│   ├── gemini.js       # Integração com o Google Gemini (persona + geração de resposta)
│   ├── config.js       # Dados da academia e configurações gerais (fácil de editar)
│   ├── memory.js       # Histórico de conversa em memória, por contato (contexto do Gemini)
│   ├── db.js           # Banco SQLite (sql.js): grava e consulta mensagens para o dashboard
│   └── dashboard.js    # Servidor web (Express) do dashboard administrativo
│
├── public/             # Frontend do dashboard (HTML/CSS/JS puro, sem build)
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── data/                # Banco SQLite (gerado automaticamente, não versionado)
├── auth_info_baileys/  # Sessão do WhatsApp salva localmente (gerado automaticamente, não versionar)
├── .env                # Suas variáveis de ambiente reais (não versionar)
├── .env.example        # Modelo do .env
├── .gitignore
├── package.json
└── README.md
```

### Por que essa divisão de arquivos?

O projeto é dividido por responsabilidade (config, memória, IA, WhatsApp,
banco, dashboard, entrada) porque isso facilita explicar cada parte
separadamente na apresentação, sem transformar isso em algo complexo: cada
arquivo tem uma única razão para existir e pode ser lido em poucos minutos.
O dashboard roda **no mesmo processo** do agente (mesmo `npm start`) — não é
um serviço separado para instalar ou gerenciar.

## 4. Tecnologias utilizadas

| Tecnologia | Papel no projeto |
|---|---|
| **Node.js** | Ambiente de execução do JavaScript no servidor |
| **[Baileys](https://github.com/WhiskeySockets/Baileys)** (`@whiskeysockets/baileys`) | Biblioteca que implementa o protocolo do WhatsApp Web, permitindo conectar, enviar e receber mensagens sem usar a API paga oficial da Meta |
| **[Google Gen AI SDK](https://googleapis.github.io/js-genai/)** (`@google/genai`) | SDK oficial do Google para chamar os modelos Gemini |
| **`dotenv`** | Carrega variáveis de ambiente (como a API Key) a partir do arquivo `.env` |
| **`qrcode-terminal`** | Desenha o QR Code de autenticação diretamente no terminal |
| **`pino`** | Logger usado internamente pelo Baileys (aqui configurado em modo silencioso, para deixar o terminal limpo com nossos próprios logs) |
| **[`sql.js`](https://sql.js.org/)** | SQLite compilado para WebAssembly — usado pelo dashboard para guardar mensagens e contatos. Escolhido por não depender de compilador nenhum (ver nota abaixo) |
| **[`express`](https://expressjs.com/)** | Servidor web do dashboard (API + arquivos estáticos), rodando no mesmo processo do agente |
| **`nodemon`** (dev) | Reinicia o processo automaticamente a cada alteração de código durante o desenvolvimento |

> **Por que `sql.js` e não `better-sqlite3`?** Durante o desenvolvimento,
> `better-sqlite3` (a opção mais comum para SQLite em Node.js) se mostrou
> frágil para um projeto pensado para "clonar e rodar em qualquer PC": a
> versão mais recente trava com *segmentation fault* em versões do Node
> anteriores à 22, e uma versão mais antiga compatível exige um compilador
> C++ instalado (Visual Studio Build Tools no Windows) para funcionar.
> `sql.js` é SQLite real compilado para WebAssembly puro — o `npm install`
> nunca precisa compilar nada, em nenhum sistema operacional.

## 5. Instalação

Pré-requisito: [Node.js](https://nodejs.org/) 18 ou superior instalado.

Clone o repositório e instale as dependências.

**PowerShell:**
```powershell
git clone https://github.com/joaodavi2026/grab-jiu-jitsu-agent.git
cd grab-jiu-jitsu-agent
npm install
```

**CMD (Prompt de Comando):**
```cmd
git clone https://github.com/joaodavi2026/grab-jiu-jitsu-agent.git
cd grab-jiu-jitsu-agent
npm install
```

Os comandos são idênticos nos dois terminais a partir daqui — só o comando
para copiar o `.env` (próxima seção) muda entre PowerShell e CMD.

Isso instala todas as dependências listadas no `package.json` — nenhuma
outra configuração é necessária além do `.env` (próxima seção).

## 6. Configuração

### 6.1. Variáveis de ambiente

Copie o arquivo de exemplo:

**PowerShell:**
```powershell
Copy-Item .env.example .env
notepad .env
```

**CMD:**
```cmd
copy .env.example .env
notepad .env
```

Preencha:

```env
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.1-flash-lite
MAX_HISTORICO_MENSAGENS=20
DASHBOARD_PASSWORD=escolha-uma-senha-sua
DASHBOARD_PORT=3000
```

`DASHBOARD_PASSWORD` é a senha do dashboard administrativo (seção 9). Sem
ela definida, o dashboard simplesmente não inicia — o agente de WhatsApp
continua funcionando normalmente mesmo assim.

> **Sobre o modelo:** o projeto foi originalmente especificado com
> `gemini-1.5-flash`, mas esse modelo foi descontinuado pelo Google antes da
> entrega final (a API retorna `404 NOT_FOUND` para contas novas). O modelo
> atual, `gemini-3.1-flash-lite`, foi escolhido por estar disponível, ser
> gratuito e ter um limite de requisições por minuto no nível gratuito bem
> mais alto que o `gemini-3.6-flash` "cheio" (~17 RPM vs. 5 RPM medidos na
> prática) — importante para um chatbot que pode receber várias mensagens em
> sequência. Veja o histórico completo dessa investigação no final desta seção.

### 6.2. Como obter a API Key do Gemini

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Faça login com uma conta Google.
3. Clique em **"Create API key"**.
4. Copie a chave gerada e cole no `.env`, no campo `GEMINI_API_KEY`.

A chave é gratuita para uso em volume moderado, mas o nível gratuito tem
limite de requisições por minuto (RPM) que varia por modelo — veja a nota
acima. Se aparecer erro `429 RESOURCE_EXHAUSTED` no terminal, é esse limite
sendo atingido; espere alguns segundos (a própria mensagem de erro informa
quantos) e tente de novo.

### 6.3. Dados da academia

Os dados reais da GRAB Jiu-Jitsu (endereço, planos, grade horária etc.) já
estão preenchidos em [`src/config.js`](src/config.js), nos objetos `ACADEMIA`
e `GRADE_HORARIA`. Para atualizar qualquer informação (um preço que mudou,
um novo horário), edite diretamente esses objetos — nenhuma outra parte do
código precisa mudar.

Se um dado novo ainda não estiver disponível, use o marcador `PREENCHER` no
lugar do valor: **enquanto um campo estiver como `PREENCHER`, o agente vai
dizer ao usuário que aquela informação ainda precisa ser confirmada com a
equipe**, em vez de inventar um valor — isso é feito automaticamente em
`src/gemini.js`.

## 7. Como executar

```powershell
npm start
```

Ou, durante o desenvolvimento (reinicia sozinho a cada alteração):

```powershell
npm run dev
```

Saída esperada:

```text
================================
 GRAB JIU-JITSU — AGENTE IA
================================

✓ Variáveis de ambiente carregadas!
✓ Gemini configurado (modelo: gemini-3.1-flash-lite)
[23:01:19] Escaneie o QR Code abaixo com o WhatsApp do número da academia:
[QR Code aparece aqui]
```

## 8. Como conectar o WhatsApp

1. Rode `npm start`.
2. No celular que vai atuar como o WhatsApp da academia, abra o **WhatsApp**.
3. Vá em **Configurações → Aparelhos conectados → Conectar um aparelho**.
4. Escaneie o QR Code exibido no terminal.
5. Quando aparecer `✓ WhatsApp conectado!` no terminal, o agente já está
   recebendo e respondendo mensagens.

A sessão fica salva em `auth_info_baileys/`, então nas próximas vezes que
você rodar `npm start` **não** será necessário escanear o QR Code de novo,
a menos que a sessão seja desconectada/deslogada.

## 9. Como funciona o fluxo de uma mensagem

1. Alguém manda uma mensagem de texto para o número conectado.
2. O Baileys dispara o evento `messages.upsert`.
3. O agente ignora mensagens enviadas por ele mesmo e mensagens que não são texto.
4. O contato e o texto são registrados no console.
5. O agente marca "digitando..." no WhatsApp (`sendPresenceUpdate`).
6. O texto, junto com o histórico do contato e a persona da academia, é
   enviado ao Gemini (`src/gemini.js`).
7. A resposta gerada é registrada no histórico (`src/memory.js`) e enviada
   de volta ao mesmo contato.

### Fluxo de aula experimental

A lógica de conduzir alguém interessado em fazer uma aula experimental
**não é um fluxo de código separado com etapas fixas** — ela está descrita
diretamente na persona (system instruction) do Gemini, que já instrui o
modelo a perguntar nome, dia e horário preferidos, e depois avisar que a
equipe vai confirmar a disponibilidade. Isso evita duplicar lógica de
conversação em JavaScript quando o próprio modelo de linguagem já consegue
conduzir esse diálogo de forma natural, usando o histórico da conversa.

Nesta versão, **nenhum agendamento real é feito** — o agente apenas coleta
os dados e informa que a equipe entrará em contato.

## 10. Dashboard administrativo

Um painel web para acompanhar o atendimento sem precisar ler o terminal.
Ele roda automaticamente junto com o agente — não é preciso iniciar nada
separado.

### 10.1. Como acessar

1. Rode `npm start` normalmente (o dashboard sobe junto).
2. Abra no navegador: **http://localhost:3000** (ou a porta que você definiu
   em `DASHBOARD_PORT`).
3. O navegador vai pedir usuário e senha — pode digitar qualquer coisa no
   usuário, e a senha é o valor de `DASHBOARD_PASSWORD` no seu `.env`.

### 10.2. O que ele mostra

**Visão geral:**
- total de contatos únicos, mensagens recebidas, mensagens enviadas e
  contatos que já mandaram mensagem hoje;
- status da conexão do WhatsApp (conectado / conectando / desconectado),
  atualizado automaticamente;
- lista das conversas mais recentes.

**Conversas:**
- lista de todos os contatos, com nome (quando o WhatsApp informa) ou
  telefone parcialmente mascarado, e a última mensagem trocada;
- ao clicar em um contato, mostra o histórico completo da conversa, com
  bolhas diferenciadas: mensagens recebidas à esquerda, respostas do agente
  à direita.

A tela inteira se atualiza sozinha a cada poucos segundos — não é preciso
recarregar a página.

### 10.3. Segurança

- O telefone completo dos contatos **nunca** aparece na interface — só uma
  versão mascarada (ex.: `5511****9999`).
- Nenhuma credencial (chave do Gemini, sessão do WhatsApp, senha) é enviada
  ao navegador — a página só recebe métricas e mensagens.
- Sem `DASHBOARD_PASSWORD` configurada, o dashboard não inicia — mas o
  agente de WhatsApp continua funcionando normalmente.

## 11. Como testar

Roteiro sugerido para apresentar/validar o projeto:

1. **Inicialização**: rode `npm start` sem `.env` configurado — o agente
   deve mostrar um erro amigável e encerrar, sem travar ou gerar stack trace confuso.
2. **Variáveis de ambiente**: configure o `.env` corretamente e rode de
   novo — deve aparecer `✓ Variáveis de ambiente carregadas!`.
3. **Conexão com WhatsApp**: escaneie o QR Code e confirme a mensagem
   `✓ WhatsApp conectado!`.
4. **Saudação**: envie "Oi" pelo WhatsApp e confirme uma resposta natural de boas-vindas.
5. **Pergunta com dado ausente**: pergunte o endereço da academia (se ainda
   estiver como `PREENCHER`) e confirme que o agente diz que vai confirmar
   com a equipe, em vez de inventar um endereço.
6. **Contexto**: diga "Quero fazer uma aula experimental", depois responda
   às perguntas de nome/dia/horário e veja se o agente mantém o fio da conversa.
7. **Erro proposital**: coloque uma `GEMINI_API_KEY` inválida no `.env`,
   reinicie e mande uma mensagem — o agente deve responder com a mensagem
   de erro amigável ("Desculpe! 😅 ...") em vez de travar.
8. **Dashboard**: acesse `http://localhost:3000`, confirme que pede senha,
   e que os cards de métrica e a lista de conversas batem com o que você
   mandou pelo WhatsApp nos passos anteriores.
9. **Diferenciação visual**: na aba "Conversas", confirme que as mensagens
   que você mandou aparecem de um lado e as respostas do agente do outro.

## 12. Como apresentar este projeto na faculdade

Um roteiro simples para explicar o funcionamento ao professor:

- **O que é o Baileys?** Uma biblioteca que "conversa" com o WhatsApp da
  mesma forma que o WhatsApp Web faz no navegador — só que via código,
  sem precisar de um navegador aberto.
- **O que é uma API?** Uma "porta de entrada" padronizada que um sistema
  expõe para outros sistemas conversarem com ele — nosso agente usa a API
  do Google para pedir respostas geradas por IA.
- **O que é um SDK?** Um conjunto de ferramentas prontas (nesse caso, o
  pacote `@google/genai`) que facilita usar essa API sem precisar montar
  as requisições HTTP na mão.
- **O que é o Gemini?** O modelo de inteligência artificial do Google que
  lê o texto do usuário e gera uma resposta em linguagem natural.
- **O que é uma System Instruction?** É a "personalidade" fixa que damos
  ao modelo antes de qualquer conversa — no nosso caso, instrui o Gemini a
  agir como atendente da academia, com tom amigável e sem inventar dados.
- **Como o WhatsApp conversa com o Node.js?** O Baileys mantém uma conexão
  (WebSocket) com os servidores do WhatsApp; quando uma mensagem chega, ele
  dispara um evento (`messages.upsert`) que o nosso código escuta.
- **Como o Node.js conversa com o Gemini?** Fazendo uma chamada HTTPS (via
  SDK) enviando a pergunta, o histórico da conversa e a persona; o Gemini
  responde com um texto.
- **Como a resposta volta para o usuário?** O Node.js pega o texto que o
  Gemini gerou e chama `sock.sendMessage(...)` do Baileys, que devolve isso
  para o WhatsApp do contato.
- **Onde está a inteligência artificial no sistema?** Só em um lugar: dentro
  do Gemini (`src/gemini.js`). Todo o resto (Baileys, memória, config) é
  "encanamento" para levar a mensagem até a IA e trazer a resposta de volta.

## 13. Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| `GEMINI_API_KEY não foi encontrada` | `.env` não existe ou está vazio | Copie `.env.example` para `.env` e preencha a chave |
| `API key not valid` no log | Chave errada, revogada ou copiada com espaço extra | Gere uma nova chave em aistudio.google.com/apikey |
| `404 NOT_FOUND ... is not found for API version` no log | O modelo configurado em `GEMINI_MODEL` foi descontinuado ou não está disponível para a sua conta | Rode o script de listagem de modelos (seção 10) ou troque `GEMINI_MODEL` no `.env` por um modelo atual, ex. `gemini-3.1-flash-lite` |
| `429 RESOURCE_EXHAUSTED` / `You exceeded your current quota` no log | Limite de requisições por minuto do nível gratuito foi atingido | Aguarde o tempo indicado na própria mensagem de erro (`retryDelay`) antes de mandar outra mensagem; se acontecer com frequência, considere um modelo "lite" (maior limite gratuito) |
| QR Code não aparece | Terminal muito estreito, ou fonte não suporta os blocos Unicode | Aumente a janela do terminal ou use outro terminal (ex.: Windows Terminal) |
| `Sessão encerrada (logout)` | O WhatsApp do celular removeu o aparelho conectado | Apague a pasta `auth_info_baileys/` e rode `npm start` de novo para gerar um novo QR Code |
| Agente não responde nada | Mensagem não é de texto (áudio, figurinha, imagem) | Comportamento esperado nesta versão — só texto é suportado |
| Respostas genéricas demais (não conhece dados reais) | Campos ainda como `PREENCHER` em `src/config.js` | Preencha os dados reais da academia |
| Dashboard não inicia (`DASHBOARD_PASSWORD não configurada`) no log | Variável ausente no `.env` | Adicione `DASHBOARD_PASSWORD=algumasenha` ao `.env` e reinicie |
| Navegador pede senha e nada funciona | Senha errada, ou `DASHBOARD_PASSWORD` foi alterada depois que o navegador já tinha salvo a antiga | Confira o valor no `.env`; se necessário, feche e abra a aba do navegador de novo |
| `http://localhost:3000` não abre | Porta em uso por outro programa, ou o processo do agente não está rodando | Rode `npm start` e confira se apareceu `✓ Dashboard disponível em http://localhost:3000`; se a porta 3000 já estiver em uso, mude `DASHBOARD_PORT` no `.env` |
| Dashboard mostra dados diferentes em outro computador | O banco (`data/dashboard.sqlite`) é local a cada máquina | Comportamento esperado — veja a nota na seção 14 |

## 14. Limitações da versão atual

- Só entende mensagens de **texto** (imagens, áudios e figurinhas são ignorados).
- O histórico de conversa **para o Gemini** fica em memória — reiniciar o processo apaga o contexto da conversa (mas o histórico salvo no dashboard não se perde, pois fica no SQLite).
- Não faz **agendamento real** de aula experimental (apenas coleta os dados).
- Não há autenticação de múltiplos atendentes nem edição dos dados da academia pelo próprio dashboard (ainda é preciso editar `src/config.js`).
- **O banco de dados do dashboard é local**: cada computador onde o agente rodar terá seu próprio arquivo `data/dashboard.sqlite`, com os dados de atendimento daquela máquina. Se você e sua amiga rodarem o agente em computadores diferentes (por exemplo, cada um conectando um WhatsApp diferente para testar), cada um verá só as conversas que passaram pelo seu próprio computador — não existe um banco compartilhado entre máquinas nesta versão.
- Depende de uma sessão de WhatsApp pessoal via Baileys (não é a API oficial paga da Meta), o que é adequado para fins de estudo/MVP, mas tem termos de uso próprios do WhatsApp a se observar.

## 15. Melhorias futuras

1. Integrar com Google Calendar para agendamento real de aulas experimentais.
2. Permitir editar os dados da academia (planos, horários) pelo próprio dashboard, sem mexer em código.
3. Cadastro completo de alunos e histórico de matrícula.
4. Integração com meios de pagamento para renovação de planos.
5. Sistema de lembretes automáticos (aula marcada, vencimento de plano).
6. Classificação automática de leads (quente/frio) com base na conversa.
7. Handoff para atendimento humano quando o agente não conseguir ajudar.
8. Base de conhecimento com RAG para responder dúvidas mais complexas.
9. Múltiplos atendentes/números conectados simultaneamente.
10. Analytics de atendimento (principais dúvidas, taxa de conversão em aula experimental).
11. Campanhas de recuperação de leads que pararam de responder.
12. Banco compartilhado entre computadores (ex.: um servidor central), caso o projeto deixe de ser só local.

## 16. Comandos úteis (resumo)

```powershell
npm install     # instala as dependências
npm start        # inicia o agente + dashboard
npm run dev      # inicia com reinício automático (nodemon)
```

Depois de `npm start`, o dashboard fica em **http://localhost:3000**
(usuário: qualquer texto; senha: valor de `DASHBOARD_PASSWORD` no `.env`).

---

Projeto desenvolvido como MVP acadêmico — simples, funcional e pronto para evoluir.
