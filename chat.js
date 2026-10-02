/**
 * Organiza+ — Lógica da Interface do Chatbot Financeiro Inteligente
 */

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------
  // 0. CONSTANTES E CONFIGURAÇÕES DE PERFIS FINANCEIROS
  // ---------------------------------------------------------
  const CHAVE_TEMA = 'aurafinance_theme';

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
  // 1. GERENCIAMENTO DE SESSÃO DO USUÁRIO (SUPABASE)
  // ---------------------------------------------------------
  let usuario = null;

  async function inicializarChatbot() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
      window.location.replace('index.html');
      return;
    }

    const { data: perfilData } = await _supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single();

    usuario = {
      id: user.id,
      email: user.email,
      nome: perfilData ? perfilData.nome : 'Usuário',
      perfil: perfilData ? perfilData.perfil : 'moderado',
      renda: perfilData ? perfilData.renda : 0,
      gastosFixos: perfilData ? perfilData.gastos_fixos : 0,
      foto: perfilData ? perfilData.foto : null
    };

    renderizarPerfilSidebar();
    await carregarHistoricoChat();
  }

  inicializarChatbot();

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

    const hora = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div class="message-avatar">${isUser ? iniciais(usuario.nome) : '🤖'}</div>
      <div class="message-content-wrap">
        <div class="message-bubble">${msg.textoHtml}</div>
        <span class="message-time">${hora}</span>
      </div>
    `;

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
        renderizarMensagem({
          remetente: m.remetente,
          textoHtml: m.texto_html,
          timestamp: new Date(m.created_at).getTime()
        }, false);
      });
      scrollChatParaFim();
    }
  }

  async function salvarMensagemNoBanco(remetente, textoHtml) {
    if (!usuario) return;
    
    const { error } = await _supabase.from('historico_chat').insert([
      {
        user_id: usuario.id,
        remetente: remetente,
        texto_html: textoHtml
      }
    ]);

    if (error) {
      console.error('Erro ao salvar no banco:', error);
    }
  }

  if (btnLimparChat) {
    btnLimparChat.addEventListener('click', async () => {
      if (confirm('Deseja realmente limpar toda a conversa com o assistente?')) {
        await _supabase.from('historico_chat').delete().eq('user_id', usuario.id);
        
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

    const elTom = $('select-tom');
    const elFoco = $('select-foco');
    const tom = elTom ? elTom.value : 'direto';
    const foco = elFoco ? elFoco.value : 'equilibrado';

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

    if (chatWelcome) chatWelcome.style.display = 'none';

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const textoFormatado = esc(textoLimpo).replace(/\n/g, '<br>');

    renderizarMensagem({ remetente: 'user', textoHtml: textoFormatado, timestamp: Date.now() });
    scrollChatParaFim();
    await salvarMensagemNoBanco('user', textoFormatado);

    chatInput.value = '';
    chatInput.style.height = 'auto';

    exibirIndicadorDigitacao();
    if (sendBtn) sendBtn.disabled = true;

    setTimeout(async () => {
      removerIndicadorDigitacao();
      if (sendBtn) sendBtn.disabled = false;

      const respostaHtml = gerarRespostaFinanceira(textoLimpo);

      renderizarMensagem({ remetente: 'bot', textoHtml: respostaHtml, timestamp: Date.now() });
      scrollChatParaFim();
      await salvarMensagemNoBanco('bot', respostaHtml);
    }, 700);
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