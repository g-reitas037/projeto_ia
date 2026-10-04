/**
 * Organiza+ — Lógica da Interface do Chatbot Financeiro Inteligente
 */

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------
  // 0. CONSTANTES E CONFIGURAÇÕES DE PERFIS FINANCEIROS
  // ---------------------------------------------------------
  const CHAVE_TEMA = 'aurafinance_theme';

  const RASA_URL = "http://localhost:5005/webhooks/rest/webhook";

  const PERFIS_CONFIG = {
    conservador: {
      nome: 'Conservador',
      classeBadge: 'badge-conservador',
      subtitulo: 'Prioridade à segurança e blindagem',
      poupancaPctMargem: 0.15,
      variavelPctMargem: 0.85,
      alocacao: [
        { ativo: 'Tesouro Selic / Reserva Imediata', pct: 75, desc: 'Liquidez diária e risco soberano mínimo' },
        { ativo: 'CDB 100%+ CDI com garantia FGC', pct: 25, desc: 'Rendimento previsível e seguro' }
      ],
      diretriz: 'Foco na proteção do patrimônio e construção de uma Reserva de Emergência robusta equivalente a 6 a 12 meses dos seus gastos essenciais.'
    },
    moderado: {
      nome: 'Moderado',
      classeBadge: 'badge-moderado',
      subtitulo: 'Equilíbrio entre reserva e rentabilidade',
      poupancaPctMargem: 0.25,
      variavelPctMargem: 0.75,
      alocacao: [
        { ativo: 'Renda Fixa / Reserva (CDI / Selic)', pct: 50, desc: 'Segurança e liquidez' },
        { ativo: 'Fundos Imobiliários (FIIs) & IPCA+', pct: 35, desc: 'Renda passiva mensal e proteção inflacionária' },
        { ativo: 'Ações / ETFs / Multimercado', pct: 15, desc: 'Potencial de valorização acima da média' }
      ],
      diretriz: 'Construção equilibrada: protege metade do capital em renda fixa e busca crescimento e dividendos regulares no restante.'
    },
    arrojado: {
      nome: 'Arrojado',
      classeBadge: 'badge-arrojado',
      subtitulo: 'Foco em aceleração e valorização no longo prazo',
      poupancaPctMargem: 0.35,
      variavelPctMargem: 0.65,
      alocacao: [
        { ativo: 'Ações & Dividendos (Bolsa Brasil)', pct: 45, desc: 'Empresas consolidadas com alto retorno' },
        { ativo: 'ETFs Globais & FIIs Estratégicos', pct: 30, desc: 'Diversificação internacional e renda' },
        { ativo: 'Reserva de Oportunidade / Pós-fixado', pct: 25, desc: 'Liquidez rápida para aproveitar baixas do mercado' }
      ],
      diretriz: 'Maximização do efeito dos juros compostos com horizonte de longo prazo, tolerando oscilações em prol de retornos superiores.'
    }
  };

  const formatBRL = (valor) => {
    if (valor == null || isNaN(valor)) return 'R$ 0,00';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------
// MOTOR DE GRÁFICOS INTERATIVOS (Chart.js)
// ---------------------------------------------------------
const graficosRenderizados = new Map();
const chartsAtivos = new Map();
const MARCADOR_MENSAGEM_COM_GRAFICOS = '__ORGANIZA_CHAT_GRAFICOS_V1__';

function serializarMensagemComGraficos(textoHtml, graficos) {
  return `${MARCADOR_MENSAGEM_COM_GRAFICOS}${JSON.stringify({ textoHtml, graficos })}`;
}

function desserializarMensagemComGraficos(conteudo) {
  if (typeof conteudo !== 'string') return null;
  if (!conteudo.startsWith(MARCADOR_MENSAGEM_COM_GRAFICOS)) return null;

  try {
    const mensagem = JSON.parse(conteudo.slice(MARCADOR_MENSAGEM_COM_GRAFICOS.length));
    if (!Array.isArray(mensagem.graficos)) {
      throw new Error('A lista de gráficos persistidos é inválida.');
    }
    return mensagem;
  } catch (erro) {
    console.error('Não foi possível restaurar os gráficos do histórico:', erro);
    return null;
  }
}

function corTema(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function criarGrafico(container, spec) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const textoPrincipal = corTema('--texto-principal', '#122218');
  const textoSecundario = corTema('--texto-secundario', '#4b6154');
  const borda = corTema('--borda', 'rgba(0,0,0,0.1)');

  const optsBase = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: textoPrincipal,
          font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
          boxWidth: 12,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        titleFont: { family: 'Plus Jakarta Sans', weight: '700' },
        bodyFont: { family: 'Plus Jakarta Sans' },
        padding: 10,
        cornerRadius: 8
      }
    }
  };

  const escala = {
    x: {
      ticks: { color: textoSecundario, font: { family: 'Plus Jakarta Sans', size: 11 } },
      grid: { color: borda, display: false }
    },
    y: {
      ticks: { color: textoSecundario, font: { family: 'Plus Jakarta Sans', size: 11 } },
      grid: { color: borda, drawBorder: false }
    }
  };

  const onClick = (evt, elements) => {
    if (!elements.length) return;
    const el = elements[0];
    const label = spec.data.labels[el.index];
    const msg = spec.clickMessages?.[label];
    if (msg && typeof enviarMensagem === 'function') {
      enviarMensagem(msg);
    }
  };

  const interatividadeCursor = spec.clickMessages
    ? { onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } }
    : {};

  let options;
  switch (spec.chart_type) {
    case 'doughnut':
    case 'pie':
      options = {
        ...optsBase,
        cutout: spec.chart_type === 'doughnut' ? '62%' : 0,
        onClick,
        ...interatividadeCursor
      };
      break;
    case 'line':
      options = {
        ...optsBase,
        scales: escala,
        elements: { line: { borderWidth: 2 } },
        onClick,
        ...interatividadeCursor
      };
      break;
    case 'bar':
    default:
      options = { ...optsBase, scales: escala, onClick, ...interatividadeCursor };
      break;
  }

  const instancia = new Chart(canvas, {
    type: spec.chart_type || 'bar',
    data: spec.data,
    options
  });

  canvas._specOriginal = spec;
  chartsAtivos.set(canvas, instancia);
  return instancia;
}

function gerarImagemGrafico(container, spec) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const textoPrincipal = corTema('--texto-principal', '#122218');
  const textoSecundario = corTema('--texto-secundario', '#4b6154');
  const borda = corTema('--borda', 'rgba(0,0,0,0.1)');

  const optsBase = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: textoPrincipal,
          font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
          boxWidth: 12,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        titleFont: { family: 'Plus Jakarta Sans', weight: '700' },
        bodyFont: { family: 'Plus Jakarta Sans' },
        padding: 10,
        cornerRadius: 8
      }
    }
  };

  const escala = {
    x: {
      ticks: { color: textoSecundario, font: { family: 'Plus Jakarta Sans', size: 11 } },
      grid: { color: borda, display: false }
    },
    y: {
      ticks: { color: textoSecundario, font: { family: 'Plus Jakarta Sans', size: 11 } },
      grid: { color: borda, drawBorder: false }
    }
  };

  let options;
  switch (spec.chart_type) {
    case 'doughnut':
    case 'pie':
      options = { ...optsBase, cutout: spec.chart_type === 'doughnut' ? '62%' : 0 };
      break;
    case 'line':
      options = { ...optsBase, scales: escala, elements: { line: { borderWidth: 2 } } };
      break;
    case 'bar':
    default:
      options = { ...optsBase, scales: escala };
      break;
  }

  const instancia = new Chart(canvas, {
    type: spec.chart_type || 'bar',
    data: spec.data,
    options
  });

  const imagemExistente = container.querySelector('.msg-chart-image');
  const imagemGrafico = imagemExistente || new Image();
  imagemGrafico.className = 'msg-chart-image';
  imagemGrafico.alt = spec.title ? `Gráfico: ${spec.title}` : 'Gráfico da conversa';
  imagemGrafico.src = canvas.toDataURL('image/png');
  instancia.destroy();

  if (!imagemExistente) {
    container.replaceChildren(imagemGrafico);
  }
  graficosRenderizados.set(imagemGrafico, spec);
  return imagemGrafico;
}

function renderizarBlocoGrafico(spec) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-chart-wrap';

  // ---- Cabeçalho: título + botão de download ----
  const header = document.createElement('div');
  header.className = 'msg-chart-header';

  const titulo = document.createElement('div');
  titulo.className = 'msg-chart-title';
  titulo.textContent = spec.title || 'Gráfico';
  header.appendChild(titulo);

  const btnBaixar = document.createElement('button');
  btnBaixar.type = 'button';
  btnBaixar.className = 'msg-chart-download';
  btnBaixar.title = 'Baixar como imagem';
  btnBaixar.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  `;
  header.appendChild(btnBaixar);

  wrap.appendChild(header);

  // ---- Área onde o canvas será desenhado ----
  const holder = document.createElement('div');
  holder.className = 'msg-chart-canvas-holder';
  wrap.appendChild(holder);

  // ---- Cria o gráfico e liga o botão de download ----
  requestAnimationFrame(() => {
    const chart = criarGrafico(holder, spec);

    btnBaixar.addEventListener('click', () => {
      try {
        const dataUrl = chart.toBase64Image('image/png', 1);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `organiza-mais-${(spec.title || 'grafico')
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
          .replace(/[^a-z0-9]+/g, '-')} .png`.replace(/\s/g, '');
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (typeof mostrarToast === 'function') {
          mostrarToast('Imagem do gráfico baixada.');
        }
      } catch (e) {
        console.error('Erro ao exportar gráfico:', e);
      }
    });
  });

  return wrap;
}

function extrairEspecificacaoGrafico(mensagem) {
  let conteudo = mensagem.custom ?? mensagem.json_message ?? mensagem;

  if (typeof conteudo === 'string') {
    try {
      conteudo = JSON.parse(conteudo);
    } catch (erro) {
      console.warn('Payload de gráfico recebido em formato inválido:', erro);
      return null;
    }
  }

  return conteudo && conteudo.type === 'chart' ? conteudo : null;
}

  // ---------------------------------------------------------
  // 1. GERENCIAMENTO DE SESSÃO DO USUÁRIO (SUPABASE)
  // ---------------------------------------------------------
  let usuario = null;

  async function atualizarPerfilUsuario() {
    const { data: { user }, error: erroUsuario } = await _supabase.auth.getUser();
    if (erroUsuario) throw erroUsuario;

    if (!user) {
      window.location.replace('index.html');
      return false;
    }

    const { data: perfilData, error: erroPerfil } = await _supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (erroPerfil) {
      console.error('Erro ao carregar dados do perfil; usando dados disponíveis na sessão:', erroPerfil);
    }

    const metadados = user.user_metadata || {};
    const renda = Number(perfilData?.renda ?? metadados.renda ?? 0);
    const gastosFixos = Number(perfilData?.gastos_fixos ?? metadados.gastos_fixos ?? metadados.gastosFixos ?? 0);

    usuario = {
      id: user.id,
      email: user.email,
      nome: perfilData?.nome || metadados.nome || 'Usuário',
      perfil: perfilData?.perfil || metadados.perfil || 'moderado',
      renda: Number.isFinite(renda) ? renda : 0,
      gastosFixos: Number.isFinite(gastosFixos) ? gastosFixos : 0,
      foto: perfilData?.foto || metadados.foto || null
    };

    renderizarPerfilSidebar();
    return true;
  }

  async function inicializarChatbot() {
    try {
      if (!await atualizarPerfilUsuario()) return;
    } catch (erro) {
      console.error('Erro ao carregar perfil do usuário:', erro);
      return;
    }

    await carregarHistoricoChat();
  }

  inicializarChatbot();

  async function atualizarPerfilAoRetornar() {
    if (document.visibilityState !== 'visible') return;

    try {
      await atualizarPerfilUsuario();
    } catch (erro) {
      console.error('Erro ao atualizar perfil do usuário:', erro);
    }
  }

  document.addEventListener('visibilitychange', atualizarPerfilAoRetornar);
  window.addEventListener('pageshow', atualizarPerfilAoRetornar);

  // ---------------------------------------------------------
  // 2. TEMA CLARO / ESCURO (SINCRONIZADO)
  // ---------------------------------------------------------
  const htmlElement = document.documentElement;
  const themeToggleBtn = $('theme-toggle');

  let temaSalvo = 'light';
  try { temaSalvo = localStorage.getItem(CHAVE_TEMA) || 'light'; } catch (e) {}
  htmlElement.setAttribute('data-theme', temaSalvo);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const temaAtual = htmlElement.getAttribute('data-theme');
      const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
      htmlElement.setAttribute('data-theme', novoTema);
      try { localStorage.setItem(CHAVE_TEMA, novoTema); } catch (e) {}
      // Recria as imagens para manter as cores do gráfico sincronizadas ao tema.
      requestAnimationFrame(() => {
        graficosRenderizados.forEach((spec, imagem) => {
          if (imagem.isConnected) criarGrafico(imagem.parentElement, spec);
        });
      });
    });
  }

  // ---------------------------------------------------------
  // 3. BARRA LATERAL ESQUERDA
  // ---------------------------------------------------------
  function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    const pri = partes[0][0] || '';
    const ult = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (pri + ult).toUpperCase();
  }

  function primeiroNome(nome) {
    return String(nome || '').trim().split(/\s+/)[0] || 'Usuário';
  }

  function renderizarPerfilSidebar() {
    const avatarContainer = $('sidebar-user-avatar');
    if (avatarContainer) {
      avatarContainer.textContent = '';
      if (usuario.foto) {
        const img = new Image();
        img.src = usuario.foto;
        img.alt = 'Foto de perfil';
        avatarContainer.appendChild(img);
      } else {
        avatarContainer.textContent = iniciais(usuario.nome);
      }
    }

    const headerAvatar = $('header-avatar');
    if (headerAvatar) {
      headerAvatar.textContent = '';
      if (usuario.foto) {
        const hImg = new Image();
        hImg.src = usuario.foto;
        headerAvatar.appendChild(hImg);
      } else {
        headerAvatar.textContent = iniciais(usuario.nome);
      }
    }

    if ($('sidebar-user-name'))$('sidebar-user-name').textContent = usuario.nome || 'Usuário';
    if ($('sidebar-user-email'))$('sidebar-user-email').textContent = usuario.email || '';
    if ($('header-user-nome'))$('header-user-nome').textContent = primeiroNome(usuario.nome);
    if ($('welcome-user-name'))$('welcome-user-name').textContent = primeiroNome(usuario.nome);

    const perfilKey = (usuario.perfil || 'moderado').toLowerCase();
    const configPerfil = PERFIS_CONFIG[perfilKey] || PERFIS_CONFIG.moderado;
    const badgeEl = $('sidebar-user-badge');
    if (badgeEl) {
      badgeEl.textContent = configPerfil.nome;
      badgeEl.className = `badge-perfil ${configPerfil.classeBadge}`;
    }

    const renda = Number(usuario.renda) || 0;
    const gastos = Number(usuario.gastosFixos) || 0;
    const margem = Math.max(0, renda - gastos);
    const tetoLivre = margem * configPerfil.variavelPctMargem;

    if ($('sb-renda'))$('sb-renda').textContent = formatBRL(renda);
    if ($('sb-gastos'))$('sb-gastos').textContent = formatBRL(gastos);
    if ($('sb-margem'))$('sb-margem').textContent = formatBRL(margem);
    if ($('sb-teto'))$('sb-teto').textContent = formatBRL(tetoLivre);

    const alertaPreenchimento = $('sb-alerta-preenchimento');
    if (alertaPreenchimento) {
      alertaPreenchimento.hidden = !(renda <= 0 || gastos <= 0);
    }
  }

  // ---------------------------------------------------------
  // 4. CONTROLES DE INTERFACE
  // ---------------------------------------------------------
  const btnLogout = $('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await _supabase.auth.signOut();
      window.location.replace('index.html');
    });
  }

  const sidebarEl = $('chat-sidebar');
  const sidebarOverlay = $('sidebar-overlay');
  const btnToggleSidebar = $('btn-toggle-sidebar');
  const btnCloseSidebar = $('btn-sidebar-close');

  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', () => {
    sidebarEl.classList.add('aberta');
    sidebarOverlay.classList.add('aberta');
  });

  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', fecharSidebarMobile);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', fecharSidebarMobile);

  function fecharSidebarMobile() {
    sidebarEl.classList.remove('aberta');
    sidebarOverlay.classList.remove('aberta');
  }

  // ---------------------------------------------------------
  // 5. MENSAGENS E HISTÓRICO (FUNÇÕES DE TELA)
  // ---------------------------------------------------------
  const messagesContainer = $('chat-messages');
  const chatWelcome = $('chat-welcome');
  const chatForm = $('chat-form');
  const chatInput = $('chat-input');
  const sendBtn = $('chat-send-btn');
  const btnLimparChat = $('btn-limpar-chat');

  function scrollChatParaFim() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function renderizarMensagem(msg, animar = true) {
  const isUser = msg.remetente === 'user';
  const row = document.createElement('div');
  row.className = `message-row ${isUser ? 'user' : 'bot'}`;
  if (!animar) row.style.animation = 'none';

  const hora = new Date(msg.timestamp || Date.now())
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = isUser ? iniciais(usuario.nome) : '🤖';

  const wrap = document.createElement('div');
  wrap.className = 'message-content-wrap';
  if (msg.chartSpec) wrap.classList.add('message-content-wrap--chart');

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (msg.textoHtml) {
    const texto = document.createElement('div');
    texto.innerHTML = msg.textoHtml;
    bubble.appendChild(texto);
  }

  if (msg.chartSpec) {
    bubble.appendChild(renderizarBlocoGrafico(msg.chartSpec));
  }

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = hora;

  wrap.appendChild(bubble);
  wrap.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesContainer.appendChild(row);
}

  function exibirIndicadorDigitacao() {
    const row = document.createElement('div');
    row.className = 'message-row bot';
    row.id = 'typing-indicator-row';
    row.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content-wrap">
        <div class="message-bubble">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    `;
    messagesContainer.appendChild(row);
    scrollChatParaFim();
  }

  function removerIndicadorDigitacao() {
    const indicator = $('typing-indicator-row');
    if (indicator) indicator.remove();
  }

  // ---------------------------------------------------------
  // 6. INTEGRAÇÃO BANCO DE DADOS
  // ---------------------------------------------------------
  async function carregarHistoricoChat() {
    if (!usuario) return;

    const { data: historico, error } = await _supabase
      .from('historico_chat')
      .select('*')
      .eq('user_id', usuario.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar histórico:', error);
      return;
    }

    if (historico && historico.length > 0) {
      if (chatWelcome) chatWelcome.style.display = 'none';
      historico.forEach((m) => {
        const mensagemSalva = desserializarMensagemComGraficos(m.texto_html);
        if (mensagemSalva) {
          mensagemSalva.graficos.forEach((chartSpec, index) => {
            renderizarMensagem({
              remetente: m.remetente,
              textoHtml: index === 0 ? mensagemSalva.textoHtml : '',
              chartSpec,
              timestamp: new Date(m.created_at).getTime()
            }, false);
          });
          return;
        }

        renderizarMensagem({
          remetente: m.remetente,
          textoHtml: m.texto_html,
          timestamp: new Date(m.created_at).getTime()
        }, false);
      });
      scrollChatParaFim();
    }
  }

  let filaSalvamentoChat = Promise.resolve();

  function salvarMensagemNoBanco(remetente, textoHtml) {
    if (!usuario) return filaSalvamentoChat;

    const userId = usuario.id;
    filaSalvamentoChat = filaSalvamentoChat
      .then(async () => {
        const { error } = await _supabase.from('historico_chat').insert([
          {
            user_id: userId,
            remetente,
            texto_html: textoHtml
          }
        ]);

        if (error) throw error;
      })
      .catch((erro) => {
        console.error('Erro ao salvar mensagem no histórico:', erro);
      });

    return filaSalvamentoChat;
  }

 if (btnLimparChat) {
  btnLimparChat.addEventListener('click', async () => {
    if (confirm('Deseja realmente limpar toda a conversa com o assistente?')) {
      await _supabase.from('historico_chat').delete().eq('user_id', usuario.id);

      graficosRenderizados.clear();

      const rows = messagesContainer.querySelectorAll('.message-row');
      rows.forEach((r) => r.remove());
      if (chatWelcome) chatWelcome.style.display = '';
      mostrarToast('Histórico de mensagens limpo com sucesso.');
    }
  });
}

  // ---------------------------------------------------------
  // 7. MOTOR DE RESPOSTAS DA IA
  // ---------------------------------------------------------
  function gerarRespostaFinanceira(pergunta) {
    const textoLower = pergunta.toLowerCase().trim();

    const perfilKey = (usuario.perfil || 'moderado').toLowerCase();
    const conf = PERFIS_CONFIG[perfilKey] || PERFIS_CONFIG.moderado;

    const renda = Number(usuario.renda) || 0;
    const gastos = Number(usuario.gastosFixos) || 0;
    const margemLivre = Math.max(0, renda - gastos);
    const metaPoupanca = margemLivre * conf.poupancaPctMargem;
    const tetoGastosLivres = margemLivre * conf.variavelPctMargem;
    const comprometimento = renda > 0 ? ((gastos / renda) * 100).toFixed(1) : 0;

    const semDados = renda <= 0 || gastos <= 0;

    // Teto de Gastos
    if (textoLower.includes('teto') || textoLower.includes('quanto posso gastar') || textoLower.includes('gasto livre') || textoLower.includes('limite')) {
      if (semDados) {
        return `
          <p>Você ainda não informou sua renda e seus gastos fixos no seu perfil.</p>
          <div class="msg-highlight-box">
            👉 Clique no botão <strong>"Editar Perfil"</strong> na barra lateral esquerda para preencher seus valores.
          </div>
        `;
      }

      return `
        <p>Com base no seu perfil <strong>${conf.nome}</strong>, aqui está a sua análise:</p>
        <div class="msg-metrics-grid">
          <div class="msg-metric-pill"><span>Renda Líquida</span><span>${formatBRL(renda)}</span></div>
          <div class="msg-metric-pill"><span>Gastos Fixos</span><span>${formatBRL(gastos)}</span></div>
          <div class="msg-metric-pill"><span>Margem Livre</span><span>${formatBRL(margemLivre)}</span></div>
          <div class="msg-metric-pill"><span>Teto Recomendado</span><span>${formatBRL(tetoGastosLivres)}</span></div>
        </div>
        <p>🎯 <strong>Seu teto seguro para gastos livres é de ${formatBRL(tetoGastosLivres)}</strong> por mês.</p>
      `;
    }

    // Investimentos
    if (textoLower.includes('invest') || textoLower.includes('aloc') || textoLower.includes('onde aplicar') || textoLower.includes('onde guardar')) {
      let resp = `<p>Segundo o perfil <strong>${conf.nome}</strong>, a recomendação é:</p><ul>`;
      conf.alocacao.forEach((item) => {
        resp += `<li><strong>${item.pct}% em ${item.ativo}</strong>: ${item.desc}</li>`;
      });
      resp += `</ul><div class="msg-highlight-box">💡 <strong>Diretriz:</strong> ${conf.diretriz}</div>`;
      return resp;
    }

    // Reserva
    if (textoLower.includes('reserva') || textoLower.includes('emergenc') || textoLower.includes('segurança')) {
      const meses = perfilKey === 'conservador' ? 12 : 6;
      const valorIdeal = gastos > 0 ? gastos * meses : 0;

      return `
        <p>🛡️ Recomendamos uma Reserva de Emergência equivalente a <strong>${meses} meses</strong> dos seus gastos fixos.</p>
        <div class="msg-metrics-grid">
          <div class="msg-metric-pill"><span>Gastos Fixos</span><span>${formatBRL(gastos)}</span></div>
          <div class="msg-metric-pill"><span>Meta da Reserva</span><span>${formatBRL(valorIdeal)}</span></div>
        </div>
      `;
    }

    // Cortar gastos
    if (textoLower.includes('cortar') || textoLower.includes('economiz') || textoLower.includes('poupar') || textoLower.includes('reduzir')) {
      return `
        <p>Dicas para aumentar sua margem livre:</p>
        <ul>
          <li><strong>1. Assinaturas:</strong> Cancele serviços que você não usou no último mês.</li>
          <li><strong>2. Contas Fixas:</strong> Renegocie planos de internet e telefone.</li>
          <li><strong>3. Regra das 72h:</strong> Espere 3 dias antes de fazer compras por impulso.</li>
        </ul>
      `;
    }

    // Geral
    return `
      <p>Entendi sua pergunta sobre <em>"${pergunta}"</em>.</p>
      <p>Como investidor <strong>${conf.nome}</strong>, mantenha seus gastos essenciais abaixo de 60% da renda.</p>
      <p>Você pode perguntar sobre: <strong>teto de gastos</strong>, <strong>alocação recomendada</strong> ou <strong>reserva de emergência</strong>!</p>
    `;
  }

  // ---------------------------------------------------------
  // 8. ENVIO DE MENSAGENS E EVENTOS
  // ---------------------------------------------------------
  async function enviarMensagem(texto) {
  const textoLimpo = String(texto || '').trim();
  if (!textoLimpo) return;
  if (!usuario) {
    console.error('Não foi possível enviar a mensagem antes de carregar o perfil do usuário.');
    return;
  }

  if (chatWelcome) chatWelcome.style.display = 'none';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const textoFormatado = esc(textoLimpo).replace(/\n/g, '<br>');

  // 1. Renderiza mensagem do usuário
  renderizarMensagem({ remetente: 'user', textoHtml: textoFormatado, timestamp: Date.now() });

  chatInput.value = '';
  chatInput.style.height = 'auto';

  // 2. Indicador de digitação
  exibirIndicadorDigitacao();
  if (sendBtn) sendBtn.disabled = true;

  salvarMensagemNoBanco('user', textoFormatado);

  try {
  const resposta = await fetch(RASA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: usuario.id,
      message: textoLimpo,
      metadata: {
        perfil_usuario: {
          perfil: usuario.perfil,
          renda: Number(usuario.renda) || 0,
          gastos_fixos: Number(usuario.gastosFixos) || 0
        }
      }
    })
  });

  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const dados = await resposta.json();

  removerIndicadorDigitacao();
  if (sendBtn) sendBtn.disabled = false;

  // Separa textos e gráficos
  const mensagens = Array.isArray(dados)
    ? dados
    : dados?.messages ?? dados?.value;
  if (!Array.isArray(mensagens)) {
    throw new Error('O webhook retornou um formato de resposta inválido.');
  }
  const textos = mensagens.map(i => i.text).filter(Boolean);
  const graficos = mensagens
    .map(extrairEspecificacaoGrafico)
    .filter(Boolean);

  const respostaTexto = textos.join('\n\n');
  const respostaHtml = respostaTexto
    ? esc(respostaTexto).replace(/\n/g, '<br>')
    : '';

  // Uma bolha por gráfico (para ficar organizado)
  if (graficos.length === 0) {
    renderizarMensagem({
      remetente: 'bot',
      textoHtml: respostaHtml || 'Não recebi uma resposta válida.',
      timestamp: Date.now()
    });
    if (respostaHtml) salvarMensagemNoBanco('bot', respostaHtml);
  } else {
    // Primeira bolha: texto (se houver) + primeiro gráfico
    renderizarMensagem({
      remetente: 'bot',
      textoHtml: respostaHtml,
      chartSpec: graficos[0],
      timestamp: Date.now()
    });
    // Gráficos extras em bolhas separadas (raro, mas seguro)
    for (let i = 1; i < graficos.length; i++) {
      renderizarMensagem({
        remetente: 'bot',
        chartSpec: graficos[i],
        timestamp: Date.now()
      });
    }
    // Persiste apenas o texto no histórico (gráficos são regenerados)
    salvarMensagemNoBanco(
      'bot',
      serializarMensagemComGraficos(respostaHtml, graficos)
    );
  }

  scrollChatParaFim();

} catch (erro) {
  console.warn('Rasa indisponível, usando motor local:', erro);
  removerIndicadorDigitacao();
  if (sendBtn) sendBtn.disabled = false;

  const respostaHtml = gerarRespostaFinanceira(textoLimpo);
  renderizarMensagem({
    remetente: 'bot',
    textoHtml: respostaHtml,
    timestamp: Date.now()
  });
  salvarMensagemNoBanco('bot', respostaHtml);
}
}

  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      enviarMensagem(chatInput.value);
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatInput.value.trim()) chatForm.requestSubmit();
      }
    });
  }

  // Configura cliques nos botões de perguntas rápidas
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.quick-chip');
    if (chip) {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) enviarMensagem(prompt);
    }
  });

  // Toast
  const toastEl = $('toast');
  function mostrarToast(mensagem) {
    if (!toastEl) return;
    toastEl.textContent = mensagem;
    toastEl.classList.add('visivel');
    setTimeout(() => toastEl.classList.remove('visivel'), 3000);
  }

});