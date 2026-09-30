/**
 * Organiza+ — Lógica da Interface do Chatbot Financeiro Inteligente
 * 
 * Integração:
 * - Valida sessão ativa (redireciona para index.html se não logado)
 * - Exibe dados do perfil na barra lateral esquerda (clicável para index.html#perfil)
 * - Diagnóstico dinâmico em tempo real baseado no perfil do usuário
 * - Motor de respostas financeiras personalizadas e contextuais
 * - Histórico de conversa salvo no localStorage por usuário
 * - Alternância de tema claro/escuro sincronizada
 */

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------
  // 0. CONSTANTES E CONFIGURAÇÕES DE PERFIS FINANCEIROS
  // ---------------------------------------------------------
  const CHAVE_USUARIOS = 'organizamais_usuarios';
  const CHAVE_SESSAO = 'organizamais_sessao';
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
  // 1. GERENCIAMENTO DE SESSÃO DO USUÁRIO
  // ---------------------------------------------------------
  function lerUsuarios() {
    try { return JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || {}; } catch (e) { return {}; }
  }

  function lerSessao() {
    try { return localStorage.getItem(CHAVE_SESSAO); } catch (e) { return null; }
  }

  function getUsuarioAtual() {
    const email = lerSessao();
    if (!email) return null;
    return lerUsuarios()[email] || null;
  }

  let usuario = getUsuarioAtual();

  // Se não estiver com sessão ativa, tenta recuperar o último usuário ou redireciona
  if (!usuario) {
    const todos = lerUsuarios();
    const emails = Object.keys(todos);
    if (emails.length > 0) {
      usuario = todos[emails[emails.length - 1]];
      try { localStorage.setItem(CHAVE_SESSAO, usuario.email); } catch (e) {}
    } else {
      window.location.replace('index.html');
      return;
    }
  }

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
  // 3. POVOAR DADOS DO PERFIL NA BARRA LATERAL ESQUERDA
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
    // Avatar
    const avatarContainer = $('sidebar-user-avatar');
    avatarContainer.textContent = '';
    if (usuario.foto) {
      const img = new Image();
      img.src = usuario.foto;
      img.alt = 'Foto de perfil';
      avatarContainer.appendChild(img);
    } else {
      avatarContainer.textContent = iniciais(usuario.nome);
    }

    // Mini Avatar no topo
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

    // Nomes e Email
    $('sidebar-user-name').textContent = usuario.nome || 'Usuário';
    $('sidebar-user-email').textContent = usuario.email || '';
    if ($('header-user-nome')) $('header-user-nome').textContent = primeiroNome(usuario.nome);
    if ($('welcome-user-name')) $('welcome-user-name').textContent = primeiroNome(usuario.nome);

    // Badge do perfil
    const perfilKey = (usuario.perfil || 'moderado').toLowerCase();
    const configPerfil = PERFIS_CONFIG[perfilKey] || PERFIS_CONFIG.moderado;
    const badgeEl = $('sidebar-user-badge');
    badgeEl.textContent = configPerfil.nome;
    badgeEl.className = `badge-perfil ${configPerfil.classeBadge}`;

    // Resumo Financeiro
    const renda = Number(usuario.renda) || 0;
    const gastos = Number(usuario.gastosFixos) || 0;
    const margem = Math.max(0, renda - gastos);
    const tetoLivre = margem * configPerfil.variavelPctMargem;

    $('sb-renda').textContent = formatBRL(renda);
    $('sb-gastos').textContent = formatBRL(gastos);
    $('sb-margem').textContent = formatBRL(margem);
    $('sb-teto').textContent = formatBRL(tetoLivre);

    const alertaPreenchimento = $('sb-alerta-preenchimento');
    if (renda <= 0 || gastos <= 0) {
      alertaPreenchimento.hidden = false;
    } else {
      alertaPreenchimento.hidden = true;
    }
  }

  renderizarPerfilSidebar();

  // ---------------------------------------------------------
  // 4. LOGOUT E CONTROLES DA BARRA LATERAL
  // ---------------------------------------------------------
  $('btn-logout').addEventListener('click', () => {
    try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
    window.location.replace('index.html');
  });

  // Mobile menu drawer
  const sidebarEl = $('chat-sidebar');
  const sidebarOverlay = $('sidebar-overlay');
  const btnToggleSidebar = $('btn-toggle-sidebar');
  const btnCloseSidebar = $('btn-sidebar-close');

  function abrirSidebarMobile() {
    sidebarEl.classList.add('aberta');
    sidebarOverlay.classList.add('aberta');
  }

  function fecharSidebarMobile() {
    sidebarEl.classList.remove('aberta');
    sidebarOverlay.classList.remove('aberta');
  }

  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', abrirSidebarMobile);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', fecharSidebarMobile);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', fecharSidebarMobile);

  // ---------------------------------------------------------
  // 5. HISTÓRICO E MENSAGENS DO CHAT
  // ---------------------------------------------------------
  const CHAVE_HISTORICO = `organizamais_chat_${usuario.email}`;
  const messagesContainer = $('chat-messages');
  const chatWelcome = $('chat-welcome');
  const chatForm = $('chat-form');
  const chatInput = $('chat-input');
  const sendBtn = $('chat-send-btn');
  const btnLimparChat = $('btn-limpar-chat');
  const selectTom = $('select-tom');
  const selectFoco = $('select-foco');

  function carregarHistorico() {
    try {
      const salvo = localStorage.getItem(CHAVE_HISTORICO);
      return salvo ? JSON.parse(salvo) : [];
    } catch (e) {
      return [];
    }
  }

  function salvarHistorico(mensagens) {
    try {
      localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(mensagens));
    } catch (e) {}
  }

  function scrollChatParaFim() {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  }

  function formatarHora(timestamp) {
    const d = new Date(timestamp || Date.now());
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // Renderiza uma mensagem no DOM
  function renderizarMensagem(msg, animar = true) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.remetente}`;
    if (!animar) row.style.animation = 'none';

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (msg.remetente === 'bot') {
      avatar.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      `;
    } else {
      if (usuario.foto) {
        const uImg = new Image();
        uImg.src = usuario.foto;
        uImg.style.width = '100%';
        uImg.style.height = '100%';
        uImg.style.borderRadius = '50%';
        uImg.style.objectFit = 'cover';
        avatar.appendChild(uImg);
      } else {
        avatar.textContent = iniciais(usuario.nome);
      }
    }

    const contentWrap = document.createElement('div');
    contentWrap.className = 'message-content-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = msg.textoHtml || msg.texto;

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = `${msg.remetente === 'bot' ? 'Organiza+ IA • ' : ''}${formatarHora(msg.timestamp)}`;

    contentWrap.appendChild(bubble);
    contentWrap.appendChild(time);

    row.appendChild(avatar);
    row.appendChild(contentWrap);

    messagesContainer.appendChild(row);
  }

  // Exibe indicador de "Digitando..."
  function exibirIndicadorDigitacao() {
    const row = document.createElement('div');
    row.className = 'message-row bot typing-row';
    row.id = 'typing-indicator-row';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    `;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble typing-indicator';
    bubble.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;

    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);
    scrollChatParaFim();
  }

  function removerIndicadorDigitacao() {
    const el = $('typing-indicator-row');
    if (el) el.remove();
  }

  // Inicializa mensagens salvas
  const historico = carregarHistorico();
  if (historico.length > 0) {
    chatWelcome.style.display = 'none';
    historico.forEach((m) => renderizarMensagem(m, false));
    scrollChatParaFim();
  }

  // Limpar histórico
  btnLimparChat.addEventListener('click', () => {
    if (confirm('Deseja realmente limpar toda a conversa com o assistente?')) {
      salvarHistorico([]);
      // Remove todas as linhas de mensagem preservando o welcome banner
      const rows = messagesContainer.querySelectorAll('.message-row');
      rows.forEach((r) => r.remove());
      chatWelcome.style.display = '';
      mostrarToast('Histórico de mensagens limpo com sucesso.');
    }
  });

  // ---------------------------------------------------------
  // 6. MOTOR DE RESPOSTAS INTELIGENTES DO ASSISTENTE
  // ---------------------------------------------------------
  function gerarRespostaFinanceira(pergunta) {
    const textoLower = pergunta.toLowerCase().trim();
    const tom = selectTom.value; // 'direto', 'educativo', 'estrategico'
    const foco = selectFoco.value;

    const perfilKey = (usuario.perfil || 'moderado').toLowerCase();
    const conf = PERFIS_CONFIG[perfilKey] || PERFIS_CONFIG.moderado;

    const renda = Number(usuario.renda) || 0;
    const gastos = Number(usuario.gastosFixos) || 0;
    const margemLivre = Math.max(0, renda - gastos);
    const metaPoupanca = margemLivre * conf.poupancaPctMargem;
    const tetoGastosLivres = margemLivre * conf.variavelPctMargem;
    const comprometimento = renda > 0 ? ((gastos / renda) * 100).toFixed(1) : 0;

    // Se o usuário ainda não cadastrou finanças e perguntou algo que precisa de números
    const semDados = renda <= 0 || gastos <= 0;

    // INTENÇÃO 1: Teto de Gastos / Margem Livre
    if (textoLower.includes('teto') || textoLower.includes('quanto posso gastar') || textoLower.includes('gasto livre') || textoLower.includes('limite')) {
      if (semDados) {
        return `
          <p>Você ainda não informou sua renda e seus gastos fixos no seu perfil.</p>
          <div class="msg-highlight-box">
            👉 Clique no botão <strong>"Editar Perfil"</strong> na barra lateral esquerda para preencher seus valores. Assim poderei calcular exatamente o seu teto seguro!
          </div>
          <p>Como regra geral recomendada para o perfil <strong>${conf.nome}</strong>, sugerimos reservar <strong>${(conf.variavelPctMargem * 100).toFixed(0)}% da sua margem livre</strong> para gastos variáveis e o restante para aportes.</p>
        `;
      }

      let resp = ``;
      if (tom === 'direto') {
        resp += `<p>Aqui estão os seus números exatos para este mês:</p>`;
      } else if (tom === 'estrategico') {
        resp += `<p>Pensando na saúde e sustentabilidade das suas finanças para o longo prazo, este é o equilíbrio calculado:</p>`;
      } else {
        resp += `<p>Com base no seu perfil <strong>${conf.nome}</strong> e nas suas contas informadas, realizamos a separação segura da sua margem livre:</p>`;
      }

      resp += `
        <div class="msg-metrics-grid">
          <div class="msg-metric-pill">
            <span>Renda Líquida</span>
            <span>${formatBRL(renda)}</span>
          </div>
          <div class="msg-metric-pill">
            <span>Gastos Fixos</span>
            <span>${formatBRL(gastos)}</span>
          </div>
          <div class="msg-metric-pill">
            <span>Margem Livre</span>
            <span>${formatBRL(margemLivre)}</span>
          </div>
          <div class="msg-metric-pill">
            <span>Teto Recomendado</span>
            <span>${formatBRL(tetoGastosLivres)}</span>
          </div>
        </div>

        <p>🎯 <strong>Seu teto seguro para gastos livres é de ${formatBRL(tetoGastosLivres)}</strong> (${(conf.variavelPctMargem * 100).toFixed(0)}% da sua margem livre).</p>
        <p>💵 Ao respeitar esse teto, você garante automaticamente <strong>${formatBRL(metaPoupanca)}</strong> por mês para a sua meta de investimentos e reserva de emergência.</p>
      `;

      if (comprometimento > 65) {
        resp += `
          <div class="msg-highlight-box">
            ⚠️ <strong>Atenção:</strong> Seus custos fixos comprometem <strong>${comprometimento}%</strong> da sua renda. O ideal é manter esse índice abaixo de 60% para maior tranquilidade.
          </div>
        `;
      }
      return resp;
    }

    // INTENÇÃO 2: Investimentos / Alocação / Como investir
    if (textoLower.includes('invest') || textoLower.includes('aloc') || textoLower.includes('onde aplicar') || textoLower.includes('onde guardar') || textoLower.includes('carteira')) {
      let resp = `
        <p>Segundo o seu perfil de investidor <strong>${conf.nome}</strong> (${conf.subtitulo}), a sugestão de alocação recomendada é:</p>
        <ul>
      `;

      conf.alocacao.forEach((item) => {
        const valorAporte = margemLivre > 0 ? (metaPoupanca * (item.pct / 100)) : 0;
        const textoValor = margemLivre > 0 ? ` &rarr; <strong>${formatBRL(valorAporte)}/mês</strong>` : '';
        resp += `<li><strong>${item.pct}% em ${item.ativo}</strong>: ${item.desc}${textoValor}</li>`;
      });

      resp += `</ul>`;
      resp += `<div class="msg-highlight-box">💡 <strong>Diretriz do seu perfil:</strong> ${conf.diretriz}</div>`;

      if (tom === 'educativo') {
        resp += `<p>Lembre-se: antes de arriscar em ativos de maior volatilidade, o primeiro passo é sempre atingir a meta da sua Reserva de Emergência.</p>`;
      }
      return resp;
    }

    // INTENÇÃO 3: Reserva de Emergência
    if (textoLower.includes('reserva') || textoLower.includes('emergenc') || textoLower.includes('segurança')) {
      const meses = perfilKey === 'conservador' ? 12 : 6;
      const valorIdeal = gastos > 0 ? gastos * meses : 0;

      let resp = `
        <p>🛡️ A <strong>Reserva de Emergência</strong> é a blindagem financeira mais importante da sua vida.</p>
        <p>Para o perfil <strong>${conf.nome}</strong>, recomendamos ter de <strong>${meses === 12 ? '6 a 12' : '6'} meses</strong> dos seus custos essenciais aplicados em ativos com liquidez imediata e risco soberano (Tesouro Selic ou CDB 100% CDI com liquidez diária).</p>
      `;

      if (gastos > 0) {
        const mesesParaAtingir = metaPoupanca > 0 ? Math.ceil(valorIdeal / metaPoupanca) : null;
        resp += `
          <div class="msg-metrics-grid">
            <div class="msg-metric-pill">
              <span>Gastos Essenciais</span>
              <span>${formatBRL(gastos)}</span>
            </div>
            <div class="msg-metric-pill">
              <span>Meta da Reserva (${meses} meses)</span>
              <span>${formatBRL(valorIdeal)}</span>
            </div>
            ${mesesParaAtingir ? `
            <div class="msg-metric-pill">
              <span>Tempo Estimado</span>
              <span>~${mesesParaAtingir} meses</span>
            </div>` : ''}
          </div>
          <p>Guardando a sua meta sugerida de <strong>${formatBRL(metaPoupanca)}</strong> todos os meses, você atinge a sua blindagem total em aproximadamente <strong>${mesesParaAtingir || 'alguns'} meses</strong>.</p>
        `;
      } else {
        resp += `
          <div class="msg-highlight-box">
            👉 Informe seus gastos fixos mensais no <strong>"Editar Perfil"</strong> para eu calcular o montante exato da sua reserva em Reais!
          </div>
        `;
      }
      return resp;
    }

    // INTENÇÃO 4: Dicas para cortar gastos / Economizar
    if (textoLower.includes('cortar') || textoLower.includes('economiz') || textoLower.includes('poupar') || textoLower.includes('reduzir') || textoLower.includes('gasto fixo')) {
      return `
        <p>Aqui estão 4 táticas comprovadas para reduzir despesas e aumentar sua margem livre:</p>
        <ul>
          <li><strong>1. Varredura de Assinaturas Esquecidas:</strong> Cancele streamings, aplicativos ou serviços contratados que você não usou nos últimos 30 dias.</li>
          <li><strong>2. Renegociação de Contas Fixas:</strong> Ligue para sua operadora de internet, telefone e seguro solicitando planos promocionais de fidelidade.</li>
          <li><strong>3. Regra dos 3 Dias:</strong> Antes de compras impulsivas não essenciais, espere 72 horas. 80% dos impulsos desaparecem nesse período.</li>
          <li><strong>4. Meta Automática:</strong> No dia em que seu salário cair na conta, separe primeiro a sua meta de poupança (${metaPoupanca > 0 ? formatBRL(metaPoupanca) : 'sua meta'}). Nunca guarde "o que sobrar".</li>
        </ul>
        <div class="msg-highlight-box">
          📈 Cada R$ 100 economizados nos gastos fixos aumentam sua capacidade de acumular patrimônio em mais de R$ 7.500 em 5 anos com juros compostos.
        </div>
      `;
    }

    // INTENÇÃO 5: Simulação de Poupança / Tempo
    if (textoLower.includes('simul') || textoLower.includes('meses') || textoLower.includes('acumular') || textoLower.includes('futuro')) {
      const aporte = metaPoupanca > 0 ? metaPoupanca : 300;
      const taxaMensal = 0.0085; // ~0,85% ao mês (aprox. 10,5% a.a. CDI líquido)

      const futuro = (meses) => {
        let total = 0;
        for (let i = 0; i < meses; i++) {
          total = (total + aporte) * (1 + taxaMensal);
        }
        return total;
      };

      const em6 = futuro(6);
      const em12 = futuro(12);
      const em24 = futuro(24);

      return `
        <p>🎯 <strong>Simulação de Projeção Financeira</strong> (considerando rendimento de ~10,5% ao ano em Renda Fixa / CDI):</p>
        <p>Aportando a meta estimada de <strong>${formatBRL(aporte)} por mês</strong>:</p>
        <div class="msg-metrics-grid">
          <div class="msg-metric-pill">
            <span>Em 6 meses</span>
            <span>${formatBRL(em6)}</span>
          </div>
          <div class="msg-metric-pill">
            <span>Em 12 meses</span>
            <span>${formatBRL(em12)}</span>
          </div>
          <div class="msg-metric-pill">
            <span>Em 24 meses</span>
            <span>${formatBRL(em24)}</span>
          </div>
        </div>
        <p>💡 Em 2 anos, você terá acumulado mais de <strong>${formatBRL(em24)}</strong>, sendo uma parte significativa gerada puramente pelo poder dos juros compostos!</p>
      `;
    }

    // RESPOSTA GERAL / CONSULTIVA
    return `
      <p>Entendi sua questão sobre <em>"${pergunta}"</em>.</p>
      <p>Como assistente da <strong>Organiza+</strong>, meu objetivo é ajudar você a manter seu orçamento equilibrado e seu patrimônio crescendo.</p>
      <div class="msg-highlight-box">
        💡 <strong>Recomendação personalizada para você:</strong><br>
        Como investidor <strong>${conf.nome}</strong>, priorize manter seus gastos essenciais abaixo de 60% da sua renda e destine a margem livre conforme suas metas de segurança e rentabilidade.
      </div>
      <p>Você pode me perguntar sobre: <strong>teto de gastos</strong>, <strong>como investir</strong>, <strong>reserva de emergência</strong> ou pedir <strong>dicas para economizar</strong>!</p>
    `;
  }

  // ---------------------------------------------------------
  // 7. ENVIO DE MENSAGENS E INTERAÇÃO
  // ---------------------------------------------------------
  async function enviarMensagem(texto) {
    const textoLimpo = String(texto || '').trim();
    if (!textoLimpo) return;

    chatWelcome.style.display = 'none';

    // Evita injeção e preserva quebras de linha
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const textoFormatado = esc(textoLimpo).replace(/\n/g, '<br>');

    // 1. Mensagem do Usuário
    const msgUsuario = {
      remetente: 'user',
      texto: textoLimpo,
      textoHtml: textoFormatado,
      timestamp: Date.now()
    };

    historico.push(msgUsuario);
    salvarHistorico(historico);
    renderizarMensagem(msgUsuario);
    scrollChatParaFim();

    // Limpar campo de input e resetar altura
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.focus();

    // 2. Simulação de processamento da IA
    exibirIndicadorDigitacao();
    sendBtn.disabled = true;

    // Tempo de delay natural (600 a 1000ms) para sensação premium de resposta inteligente
    const delay = Math.floor(Math.random() * 400) + 600;

    setTimeout(() => {
      removerIndicadorDigitacao();
      sendBtn.disabled = false;

      const respostaHtml = gerarRespostaFinanceira(textoLimpo);

      const msgBot = {
        remetente: 'bot',
        textoHtml: respostaHtml,
        timestamp: Date.now()
      };

      historico.push(msgBot);
      salvarHistorico(historico);
      renderizarMensagem(msgBot);
      scrollChatParaFim();
    }, delay);
  }

  // Envio pelo Formulário
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    enviarMensagem(chatInput.value);
  });

  // Ajuste automático de altura do textarea e suporte ao Enter
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 130)}px`;
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.value.trim()) {
        chatForm.requestSubmit();
      }
    }
  });

  // Chips de perguntas rápidas
  const quickChips = document.querySelectorAll('.quick-chip');
  quickChips.forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) enviarMensagem(prompt);
    });
  });

  // ---------------------------------------------------------
  // 8. TOAST DE FEEDBACK
  // ---------------------------------------------------------
  const toastEl = $('toast');
  let toastTimer = null;
  function mostrarToast(mensagem) {
    if (!toastEl) return;
    toastEl.textContent = mensagem;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 3000);
  }

});
