/**
 * Organiza+ - Tema, Cadastro/Login, Perfil editável, Diagnóstico e Tutorial guiado
 *
 * Fluxo do sistema:
 *   Cadastro (dados básicos) -> Perfil (renda, gastos, fotos) -> Diagnóstico
 *
 * Armazenamento: localStorage (é um protótipo). Em um sistema real, esses dados
 * ficariam em um back-end com banco de dados e a senha seria tratada no servidor.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------------------------------------
  // 0. UTILIDADES E REFERÊNCIAS DO DOM
  // ---------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  const formatBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Evita que texto digitado pelo usuário vire HTML ao ser inserido na página
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function criar(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
  }

  const viewHome = $('view-home');
  const viewPerfil = $('view-perfil');

  const modalCadastro = $('modal-cadastro');
  const tituloModal = $('modal-titulo');
  const abasModal = document.querySelectorAll('.aba-btn');
  const formCadastro = $('form-cadastro');
  const formLogin = $('form-login');
  const erroCadastro = $('erro-cadastro');
  const erroLogin = $('erro-login');

  const btnOpenCadastro = $('open-cadastro-btn');
  const btnPerfilTopo = $('btn-perfil-topo');
  const heroBtn = $('hero-open-cadastro-btn');
  const btnCadastroInferior = $('btn-cadastro-inferior');
  const btnCloseCadastro = $('close-cadastro-btn');

  const formDados = $('form-dados');
  const formFinancas = $('form-financas');
  const capaImg = $('capa-img');
  const toastEl = $('toast');

  // ---------------------------------------------------------
  // 1. GERENCIAMENTO DE TEMA (CLARO / ESCURO)
  // ---------------------------------------------------------
  const themeToggleBtn = $('theme-toggle');
  const htmlElement = document.documentElement;

  // Carrega o tema salvo ou usa 'light' como padrão
  let temaSalvo = 'light';
  try { temaSalvo = localStorage.getItem('aurafinance_theme') || 'light'; } catch (e) { /* segue com o padrão */ }
  htmlElement.setAttribute('data-theme', temaSalvo);

  themeToggleBtn.addEventListener('click', () => {
    const temaAtual = htmlElement.getAttribute('data-theme');
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';

    htmlElement.setAttribute('data-theme', novoTema);
    try { localStorage.setItem('aurafinance_theme', novoTema); } catch (e) { /* ignora */ }
  });

  // ---------------------------------------------------------
  // 2. PERSISTÊNCIA: CONTAS E SESSÃO
  // ---------------------------------------------------------
  const CHAVE_USUARIOS = 'organizamais_usuarios';
  const CHAVE_SESSAO = 'organizamais_sessao';

  function lerUsuarios() {
    try { return JSON.parse(localStorage.getItem(CHAVE_USUARIOS)) || {}; } catch (e) { return {}; }
  }

  function gravarUsuarios(todos) {
    try { localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(todos)); return true; } catch (e) { return false; }
  }

  function lerSessao() {
    try { return localStorage.getItem(CHAVE_SESSAO); } catch (e) { return null; }
  }

  function gravarSessao(email) {
    try {
      if (email) localStorage.setItem(CHAVE_SESSAO, email);
      else localStorage.removeItem(CHAVE_SESSAO);
      return true;
    } catch (e) { return false; }
  }

  function usuarioLogado() {
    const email = lerSessao();
    return email ? (lerUsuarios()[email] || null) : null;
  }

  // Mescla alterações no usuário logado. Retorna false se não conseguiu gravar.
  function atualizarUsuario(alteracoes) {
    const email = lerSessao();
    const todos = lerUsuarios();
    if (!email || !todos[email]) return false;
    todos[email] = { ...todos[email], ...alteracoes };
    return gravarUsuarios(todos);
  }

  // Senha nunca é guardada em texto puro: salvamos apenas um hash com "sal".
  // (Em produção isso é feito no servidor com bcrypt/argon2.)
  function gerarSal() {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function gerarHash(senha, sal) {
    const texto = `${sal}:${senha}`;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Alternativa simples para navegadores sem SubtleCrypto (apenas protótipo)
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
    return `x${h.toString(16)}`;
  }

  function iniciais(nome) {
    // Considera só letras/números, ignorando símbolos e pontuação soltos no nome
    const partes = String(nome).trim().split(/\s+/)
      .map((p) => (p.match(/[\p{L}\p{N}]/u) || [''])[0])
      .filter(Boolean);
    if (!partes.length) return '?';
    const primeira = partes[0];
    const ultima = partes.length > 1 ? partes[partes.length - 1] : '';
    return (primeira + ultima).toUpperCase();
  }

  const primeiroNome = (nome) => String(nome).trim().split(/\s+/)[0] || '';

  // Coloca a foto (ou as iniciais) dentro de um container de avatar
  function preencherAvatar(container, usuario, comAlt) {
    container.textContent = '';
    if (usuario.foto) {
      const img = new Image();
      img.alt = comAlt ? 'Foto de perfil' : '';
      img.src = usuario.foto;
      container.appendChild(img);
    } else {
      container.textContent = iniciais(usuario.nome);
    }
  }

  // ---------------------------------------------------------
  // 3. MENSAGENS RÁPIDAS (TOAST)
  // ---------------------------------------------------------
  let toastTimer = null;

  function mostrarToast(mensagem, tipo) {
    toastEl.textContent = mensagem;
    toastEl.classList.toggle('erro', tipo === 'erro');
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 3400);
  }

  function mostrarErro(elemento, mensagem) {
    elemento.textContent = mensagem;
    elemento.hidden = false;
  }

  function limparErros() {
    [erroCadastro, erroLogin].forEach((el) => { el.textContent = ''; el.hidden = true; });
  }

  // ---------------------------------------------------------
  // 4. NAVEGAÇÃO ENTRE AS TELAS (INÍCIO / PERFIL)
  // ---------------------------------------------------------
  function mostrarView(nome) {
    const perfil = nome === 'perfil';
    viewHome.hidden = perfil;
    viewPerfil.hidden = !perfil;
    document.body.dataset.view = nome;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function abrirPerfil() {
    const usuario = usuarioLogado();
    if (!usuario) { abrirModal('login'); return; }

    renderizarCabecalho(usuario);
    preencherFormDados(usuario);
    preencherFormFinancas(usuario);
    renderizarDiagnostico(usuario);
    mostrarView('perfil');

    // Primeira visita ao perfil (logo após o cadastro): mostra o tutorial
    if (!usuario.tutorialVisto) setTimeout(iniciarTutorial, 450);
  }

  // Atualiza botões do topo e da página inicial conforme o usuário está logado ou não
  function atualizarInterface() {
    const usuario = usuarioLogado();
    const logado = !!usuario;

    btnOpenCadastro.hidden = logado;
    btnPerfilTopo.hidden = !logado;

    const btnChatTopo = $('btn-chat-topo');
    if (btnChatTopo) btnChatTopo.hidden = !logado;

    if (logado) {
      $('topo-nome').textContent = primeiroNome(usuario.nome);
      preencherAvatar($('topo-avatar'), usuario, false);
      btnPerfilTopo.setAttribute('aria-label', `Abrir perfil de ${usuario.nome}`);
    }

    heroBtn.textContent = logado ? 'Acessar Chatbot IA' : 'Criar Cadastro';
    btnCadastroInferior.textContent = logado ? 'Acessar Chatbot IA' : 'Cadastrar Perfil e Gerar Diagnóstico';
  }

  // Botões de chamada para ação: cadastram (visitante) ou levam ao chatbot (logado)
  function acaoPrincipal() {
    if (usuarioLogado()) window.location.href = 'chat.html';
    else abrirModal('cadastro');
  }

  $('logo-link').addEventListener('click', (e) => {
    e.preventDefault();
    mostrarView('home');
  });

  btnPerfilTopo.addEventListener('click', abrirPerfil);

  // ---------------------------------------------------------
  // 5. MODAL DE CADASTRO / LOGIN
  // ---------------------------------------------------------
  function trocarAba(aba) {
    abasModal.forEach((btn) => {
      const ativo = btn.dataset.aba === aba;
      btn.classList.toggle('ativo', ativo);
      btn.setAttribute('aria-selected', String(ativo));
    });
    formCadastro.hidden = aba !== 'cadastro';
    formLogin.hidden = aba !== 'login';
    tituloModal.textContent = aba === 'cadastro' ? 'Cadastro de Perfil' : 'Entrar na sua conta';
    limparErros();
  }

  function abrirModal(aba) {
    trocarAba(aba || 'cadastro');
    modalCadastro.classList.add('ativo');
    document.body.style.overflow = 'hidden'; // Impede rolagem de fundo com modal aberto
    const primeiro = (aba === 'login' ? $('login-email') : $('nome'));
    setTimeout(() => primeiro.focus(), 60);
  }

  function fecharModal() {
    modalCadastro.classList.remove('ativo');
    document.body.style.overflow = '';
  }

  abasModal.forEach((btn) => btn.addEventListener('click', () => trocarAba(btn.dataset.aba)));

  btnOpenCadastro.addEventListener('click', () => abrirModal('cadastro'));
  heroBtn.addEventListener('click', acaoPrincipal);
  btnCadastroInferior.addEventListener('click', acaoPrincipal);
  btnCloseCadastro.addEventListener('click', fecharModal);

  // Fecha ao clicar fora da janela
  modalCadastro.addEventListener('click', (e) => {
    if (e.target === modalCadastro) fecharModal();
  });

  // Fechar com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCadastro.classList.contains('ativo')) fecharModal();
  });

  // ---------------------------------------------------------
  // 6. MÁSCARA AUTOMÁTICA DE TELEFONE
  // ---------------------------------------------------------
  function formatarTelefone(valor) {
    let val = String(valor).replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    if (val.length > 6) {
      val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
    } else if (val.length > 2) {
      val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    } else if (val.length > 0) {
      val = `(${val}`;
    }
    return val;
  }

  ['telefone', 'p-telefone'].forEach((id) => {
    const input = $(id);
    if (input) input.addEventListener('input', (e) => { e.target.value = formatarTelefone(e.target.value); });
  });

  // ---------------------------------------------------------
  // 7. CADASTRO, LOGIN E LOGOUT
  // ---------------------------------------------------------
  formCadastro.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErros();

    const nome = $('nome').value.trim();
    const email = $('email').value.trim().toLowerCase();
    const telefone = $('telefone').value.trim();
    const senha = $('senha').value;
    const perfil = $('perfil').value;

    if (senha.length < 6) {
      mostrarErro(erroCadastro, 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    const todos = lerUsuarios();
    if (todos[email]) {
      mostrarErro(erroCadastro, 'Este e-mail já tem cadastro. Use a aba "Entrar" para acessar sua conta.');
      return;
    }

    const sal = gerarSal();
    todos[email] = {
      nome, email, telefone, perfil,
      renda: null,          // preenchidos depois, na aba de perfil
      gastosFixos: null,
      foto: null,
      capa: null,
      tutorialVisto: false, // faz o tutorial aparecer na primeira visita ao perfil
      sal,
      senhaHash: await gerarHash(senha, sal),
      criadoEm: Date.now()
    };

    if (!gravarUsuarios(todos) || !gravarSessao(email)) {
      mostrarErro(erroCadastro, 'Não foi possível salvar seu cadastro. Verifique se o navegador permite armazenamento local.');
      return;
    }

    formCadastro.reset();
    fecharModal();
    atualizarInterface();
    window.location.href = 'chat.html'; // Após criar a conta, vai direto para a interface do Chatbot
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErros();

    const email = $('login-email').value.trim().toLowerCase();
    const senha = $('login-senha').value;
    const usuario = lerUsuarios()[email];

    // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem)
    const hash = usuario ? await gerarHash(senha, usuario.sal) : null;
    if (!usuario || hash !== usuario.senhaHash) {
      mostrarErro(erroLogin, 'E-mail ou senha incorretos. Confira os dados e tente de novo.');
      return;
    }

    gravarSessao(email);
    formLogin.reset();
    fecharModal();
    atualizarInterface();
    window.location.href = 'chat.html'; // Após entrar na conta, vai direto para a interface do Chatbot
  });

  $('btn-logout').addEventListener('click', () => {
    encerrarTutorial(false);
    gravarSessao(null);
    atualizarInterface();
    mostrarView('home');
    mostrarToast('Você saiu da conta. Até logo!');
  });

  // ---------------------------------------------------------
  // 8. CONFIGURAÇÃO DE PERFIS DE INVESTIDOR E ABA DE PERFIL
  // ---------------------------------------------------------
  const PERFIS_CONFIG = {
    conservador: {
      nome: 'Conservador',
      classeBadge: 'badge-conservador',
      subtitulo: 'Prioridade total à segurança e blindagem financeira',
      poupancaPctMargem: 0.15, // 15% da margem livre
      variavelPctMargem: 0.85, // 85% da margem livre
      alocacao: [
        { ativo: 'Tesouro Selic / Reserva de Emergência', pct: 75, cor: '#22c55e' },
        { ativo: 'CDB 100%+ CDI (Liquidez Diária)', pct: 25, cor: '#16a34a' }
      ],
      diretriz: 'Foco total em segurança e formação da Reserva de Emergência (meta de 6 a 12 meses de custos essenciais) em Tesouro Selic ou CDBs com liquidez imediata (100%+ do CDI).'
    },
    moderado: {
      nome: 'Moderado',
      classeBadge: 'badge-moderado',
      subtitulo: 'Equilíbrio entre reserva e rentabilidade',
      poupancaPctMargem: 0.25, // 25% da margem livre
      variavelPctMargem: 0.75, // 75% da margem livre
      alocacao: [
        { ativo: 'Renda Fixa / Reserva (CDI / Selic)', pct: 50, cor: '#3b82f6' },
        { ativo: 'Fundos Imobiliários (FIIs) & IPCA+', pct: 35, cor: '#8b5cf6' },
        { ativo: 'Ações / Multimercado', pct: 15, cor: '#ec4899' }
      ],
      diretriz: 'Equilíbrio entre liquidez e retorno real acima da inflação. Sugestão de manter 25% da margem para aportes divididos entre Reserva de Emergência e ativos geradores de renda passiva (FIIs e IPCA+).'
    },
    arrojado: {
      nome: 'Arrojado',
      classeBadge: 'badge-arrojado',
      subtitulo: 'Foco em valorização e potencial de longo prazo',
      poupancaPctMargem: 0.35, // 35% da margem livre
      variavelPctMargem: 0.65, // 65% da margem livre
      alocacao: [
        { ativo: 'Ações & Dividendos (Brasil)', pct: 45, cor: '#f59e0b' },
        { ativo: 'ETFs Globais & FIIs', pct: 30, cor: '#ef4444' },
        { ativo: 'Reserva Oportunidade / Renda Fixa', pct: 25, cor: '#6366f1' }
      ],
      diretriz: 'Estratégia arrojada para maximizar o efeito dos juros compostos no longo prazo. Recomendação de poupar 35% da margem livre com foco em ações de valor, ETFs globais e FIIs, com 25% em reserva de oportunidade.'
    }
  };

  function renderizarCabecalho(usuario) {
    $('perfil-nome').textContent = usuario.nome;
    $('perfil-email').textContent = usuario.email;
    preencherAvatar($('perfil-avatar'), usuario, true);
    capaImg.style.backgroundImage = usuario.capa ? `url("${usuario.capa}")` : '';
    $('btn-remover-foto').hidden = !usuario.foto;
    $('btn-remover-capa').hidden = !usuario.capa;

    // Atualiza a badge do perfil
    const badgeEl = $('perfil-badge');
    if (badgeEl) {
      const cfg = PERFIS_CONFIG[usuario.perfil] || PERFIS_CONFIG.moderado;
      badgeEl.className = `badge-perfil ${cfg.classeBadge}`;
      badgeEl.textContent = `${cfg.nome}`;
      badgeEl.title = `${cfg.nome}: ${cfg.subtitulo}`;
    }
  }

  function preencherFormDados(usuario) {
    $('p-nome').value = usuario.nome;
    $('p-email').value = usuario.email;
    $('p-telefone').value = formatarTelefone(usuario.telefone || '');
    $('p-perfil').value = usuario.perfil;
  }

  function preencherFormFinancas(usuario) {
    $('p-renda').value = usuario.renda == null ? '' : usuario.renda;
    $('p-gastos').value = usuario.gastosFixos == null ? '' : usuario.gastosFixos;
  }

  // Campo vazio => null | valor inválido => NaN | senão, o número
  function lerNumero(texto) {
    const t = String(texto).trim();
    if (t === '') return null;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  formDados.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = $('p-nome').value.trim();
    if (!nome) { mostrarToast('Informe seu nome para salvar.', 'erro'); return; }

    const ok = atualizarUsuario({
      nome,
      telefone: $('p-telefone').value.trim(),
      perfil: $('p-perfil').value
    });
    if (!ok) { mostrarToast('Não foi possível salvar. Verifique o armazenamento do navegador.', 'erro'); return; }

    const usuario = usuarioLogado();
    renderizarCabecalho(usuario);
    renderizarDiagnostico(usuario); // a diretriz e os percentuais mudam conforme o perfil de investidor
    atualizarInterface();
    mostrarToast('Dados pessoais e perfil atualizados!');
    reposicionarTutorial();
  });

  formFinancas.addEventListener('submit', (e) => {
    e.preventDefault();

    const renda = lerNumero($('p-renda').value);
    const gastosFixos = lerNumero($('p-gastos').value);
    if (Number.isNaN(renda) || Number.isNaN(gastosFixos)) {
      mostrarToast('Use apenas valores numéricos iguais ou maiores que zero.', 'erro');
      return;
    }

    if (!atualizarUsuario({ renda, gastosFixos })) {
      mostrarToast('Não foi possível salvar. Verifique o armazenamento do navegador.', 'erro');
      return;
    }

    renderizarDiagnostico(usuarioLogado());
    mostrarToast('Ganhos e gastos salvos! Diagnóstico atualizado.');
    reposicionarTutorial();
  });

  // ---------------------------------------------------------
  // 9. CÁLCULO E RENDERIZAÇÃO DO DIAGNÓSTICO INTELIGENTE
  // ---------------------------------------------------------

  function calcularDiagnostico(usuario) {
    const { renda, gastosFixos, perfil = 'moderado' } = usuario;
    if (renda == null || gastosFixos == null || renda <= 0) return null;

    const perfilKey = (perfil in PERFIS_CONFIG) ? perfil : 'moderado';
    const config = PERFIS_CONFIG[perfilKey];

    const margemLivre = Math.max(0, renda - gastosFixos);
    const sugestaoPoupar = margemLivre * config.poupancaPctMargem;
    const tetoGastosLivres = Math.max(0, margemLivre * config.variavelPctMargem);

    const comprometimento = (gastosFixos / renda) * 100;
    const poupancaPctRenda = (sugestaoPoupar / renda) * 100;
    const tetoPctRenda = (tetoGastosLivres / renda) * 100;

    return {
      renda,
      gastosFixos,
      margemLivre,
      sugestaoPoupar,
      tetoGastosLivres,
      estouro: gastosFixos > renda,
      comprometimento,
      poupancaPctRenda,
      tetoPctRenda,
      config,
      perfilKey
    };
  }

  function renderizarDiagnostico(usuario) {
    const box = $('diagnostico-conteudo');
    if (!usuario) {
      box.innerHTML = '';
      return;
    }

    const d = calcularDiagnostico(usuario);

    if (!d) {
      let dica;
      if (usuario.renda != null && usuario.renda <= 0) {
        dica = 'Informe uma renda maior que zero para calcular seu diagnóstico.';
      } else if (usuario.renda == null && usuario.gastosFixos == null) {
        dica = 'Preencha seus <strong>ganhos</strong> e seus <strong>gastos fixos</strong> no cartão ao lado e clique em salvar. Seu teto de gastos e sua meta de poupança aparecem aqui de acordo com o seu perfil de investidor.';
      } else if (usuario.renda == null) {
        dica = 'Falta informar seus <strong>ganhos</strong> (renda líquida mensal) para gerar o diagnóstico.';
      } else {
        dica = 'Falta informar seus <strong>gastos fixos</strong> para gerar o diagnóstico.';
      }
      box.innerHTML = `<p class="diag-vazio">${dica}</p>`;
      return;
    }

    const pct = (v) => Math.max(0, Math.min(100, (v / d.renda) * 100)).toFixed(2);
    const fixosPct = pct(Math.min(d.gastosFixos, d.renda));
    const variavelPct = pct(d.tetoGastosLivres);
    const poupancaPct = pct(d.sugestaoPoupar);

    const alerta = d.estouro
      ? `<p class="diag-alerta">Atenção: seus gastos fixos (${formatBRL(d.gastosFixos)}) superam sua renda (${formatBRL(d.renda)}). É crucial renegociar despesas essenciais antes de definir novos gastos variáveis ou poupança.</p>`
      : '';

    // Monta a barra de alocação de ativos sugerida
    const alocBarrasHtml = d.config.alocacao.map((item) => `
      <div class="aloc-fatia" style="width: ${item.pct}%; background: ${item.cor};" title="${item.ativo}: ${item.pct}%"></div>
    `).join('');

    const alocItensHtml = d.config.alocacao.map((item) => `
      <li class="aloc-item">
        <span class="aloc-item-rotulo">
          <i class="aloc-cor-dot" style="background: ${item.cor};"></i>
          ${esc(item.ativo)}
        </span>
        <strong class="aloc-item-pct">${item.pct}%</strong>
      </li>
    `).join('');

    const poupancaMargemPct = (d.config.poupancaPctMargem * 100).toFixed(0);
    const variavelMargemPct = (d.config.variavelPctMargem * 100).toFixed(0);

    box.innerHTML = `
      <div class="diag-header-info">
        <p class="diag-saudacao">
          Olá, <strong>${esc(primeiroNome(usuario.nome))}</strong>! Diagnóstico calibrado para o perfil:
        </p>
        <span class="badge-perfil ${d.config.classeBadge}">
          ${esc(d.config.nome)}
        </span>
      </div>

      <p class="diag-saudacao" style="margin-bottom: 0.5rem;">
        Seus gastos essenciais comprometem <strong>${d.comprometimento.toFixed(0)}%</strong> da renda mensal.
        Sobra uma margem livre de <strong>${formatBRL(d.margemLivre)}</strong>.
      </p>

      <div class="diag-cards-resumo">
        <div class="diag-mini-card card-teto">
          <span class="mini-label">Teto p/ Gastos Livres</span>
          <div class="mini-valor">${formatBRL(d.tetoGastosLivres)}</div>
          <div class="mini-sub">${variavelMargemPct}% da margem livre </div>
        </div>

        <div class="diag-mini-card card-poupanca">
          <span class="mini-label">Meta de Poupança</span>
          <div class="mini-valor">${formatBRL(d.sugestaoPoupar)}</div>
          <div class="mini-sub">${poupancaMargemPct}% da margem livre </div>
        </div>
      </div>

      <div class="diag-barra" role="img"
           aria-label="Distribuição da renda: ${fixosPct}% gastos fixos, ${variavelPct}% teto de gastos variáveis, ${poupancaPct}% meta de poupança">
        <div class="diag-seg seg-fixos" data-w="${fixosPct}" title="Gastos Fixos: ${fixosPct}%"></div>
        <div class="diag-seg seg-variavel" data-w="${variavelPct}" title="Teto Gastos Livres: ${variavelPct}%"></div>
        <div class="diag-seg seg-poupanca" data-w="${poupancaPct}" title="Meta Poupança: ${poupancaPct}%"></div>
      </div>

      <ul class="diag-legenda">
        <li>
          <span><i class="dot seg-fixos"></i>Gastos essenciais fixos</span>
          <strong>${formatBRL(d.gastosFixos)} <span class="pct-badge">(${d.comprometimento.toFixed(0)}%)</span></strong>
        </li>
        <li>
          <span><i class="dot seg-variavel"></i>Teto sugerido para gastos variáveis</span>
          <strong>${formatBRL(d.tetoGastosLivres)} <span class="pct-badge">(${variavelMargemPct}%)</span></strong>
        </li>
        <li>
          <span><i class="dot seg-poupanca"></i>Meta de poupança mensal</span>
          <strong>${formatBRL(d.sugestaoPoupar)} <span class="pct-badge">(${poupancaMargemPct}%)</span></strong>
        </li>
        <li class="diag-total">
          <span>Renda líquida total</span>
          <strong>${formatBRL(d.renda)}</strong>
        </li>
      </ul>

      ${alerta}

      <!-- Sugestão Inteligente de Alocação por Ativos -->
      <div class="diag-alocacao">
        <div class="diag-alocacao-topo">
          <h4>Alocação Recomendada (IA)</h4>
          <span>Perfil ${esc(d.config.nome)}</span>
        </div>
        <div class="aloc-barra-multi" role="img" aria-label="Alocação recomendada de ativos">
          ${alocBarrasHtml}
        </div>
        <ul class="aloc-grid">
          ${alocItensHtml}
        </ul>
      </div>

      <p class="diag-diretriz">
        <em>Diretriz da IA (${esc(d.config.nome)}):</em> ${d.config.diretriz}
      </p>
    `;

    // Anima as barras de distribuição proporcional da renda
    requestAnimationFrame(() => requestAnimationFrame(() => {
      box.querySelectorAll('.diag-seg').forEach((seg) => {
        seg.style.width = `${seg.dataset.w}%`;
      });
    }));
  }

  // ---------------------------------------------------------
  // 10. FOTO DE PERFIL E IMAGEM DE CAPA
  // ---------------------------------------------------------
  // Redimensiona/recorta a imagem no navegador antes de salvar,
  // para não estourar o limite do armazenamento local.
  function prepararImagem(arquivo, largura, altura, qualidade) {
    return new Promise((resolve, reject) => {
      if (!arquivo.type.startsWith('image/')) { reject(new Error('tipo')); return; }
      if (arquivo.size > 12 * 1024 * 1024) { reject(new Error('tamanho')); return; }

      const url = URL.createObjectURL(arquivo);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');

        // "cover": preenche todo o quadro cortando o excesso, centralizado
        const escala = Math.max(largura / img.width, altura / img.height);
        const cw = largura / escala;
        const ch = altura / escala;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(img, (img.width - cw) / 2, (img.height - ch) / 2, cw, ch, 0, 0, largura, altura);

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('leitura')); };
      img.src = url;
    });
  }

  async function trocarImagem(input, campo, largura, altura, qualidade, msgOk) {
    const arquivo = input.files && input.files[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!arquivo) return;

    try {
      const dataUrl = await prepararImagem(arquivo, largura, altura, qualidade);
      if (!atualizarUsuario({ [campo]: dataUrl })) throw new Error('armazenamento');

      const usuario = usuarioLogado();
      renderizarCabecalho(usuario);
      atualizarInterface();
      mostrarToast(msgOk);
      reposicionarTutorial();
    } catch (err) {
      const msgs = {
        tipo: 'Escolha um arquivo de imagem (JPG, PNG ou WebP).',
        tamanho: 'A imagem é muito grande. Escolha uma de até 12 MB.',
        leitura: 'Não foi possível ler essa imagem. Tente outro arquivo.',
        armazenamento: 'Não foi possível salvar a imagem: o armazenamento do navegador está cheio.'
      };
      mostrarToast(msgs[err.message] || msgs.leitura, 'erro');
    }
  }

  function removerImagem(campo, msg) {
    atualizarUsuario({ [campo]: null });
    renderizarCabecalho(usuarioLogado());
    atualizarInterface();
    mostrarToast(msg);
  }

  $('btn-alterar-foto').addEventListener('click', () => $('input-foto').click());
  $('btn-alterar-capa').addEventListener('click', () => $('input-capa').click());
  $('input-foto').addEventListener('change', (e) => trocarImagem(e.target, 'foto', 320, 320, 0.86, 'Foto de perfil atualizada!'));
  $('input-capa').addEventListener('change', (e) => trocarImagem(e.target, 'capa', 1400, 440, 0.8, 'Imagem de capa atualizada!'));
  $('btn-remover-foto').addEventListener('click', () => removerImagem('foto', 'Foto removida.'));
  $('btn-remover-capa').addEventListener('click', () => removerImagem('capa', 'Capa removida.'));

  // ---------------------------------------------------------
  // 11. TUTORIAL GUIADO (pop-ups apontando onde preencher cada informação)
  // ---------------------------------------------------------
  const overlay = $('tour-overlay');
  const ring = $('tour-ring');
  const pop = $('tour-popover');

  let tourAtivo = false;
  let tourPasso = 0;
  let tourPassos = [];
  let tourFrame = null;

  function montarPassos(usuario) {
    return [
      {
        alvo: null,
        titulo: `Bem-vindo(a), ${primeiroNome(usuario.nome)}!`,
        texto: 'Seu cadastro foi criado. Agora vamos completar o seu perfil para a Organiza+ calcular seu teto de gastos e sua meta de poupança. Leva menos de um minuto.'
      },
      {
        alvo: '[data-tour="avatar"]',
        titulo: 'Sua foto de perfil',
        texto: 'Clique no ícone da câmera para escolher uma foto. Ela aparece aqui e também no topo do site.'
      },
      {
        alvo: '[data-tour="capa"]',
        titulo: 'Imagem de capa',
        texto: 'Quer deixar o perfil com a sua cara? Use "Alterar capa" para enviar uma imagem de fundo.'
      },
      {
        alvo: '[data-tour="dados"]',
        titulo: 'Seus dados pessoais',
        texto: 'Confira seu nome, telefone e perfil de investidor. Você pode editar tudo quando quiser. O e-mail fica bloqueado porque é com ele que você entra.'
      },
      {
        alvo: '[data-tour="renda"]',
        titulo: 'Ganhos: informe sua renda',
        texto: 'Digite aqui o valor líquido que você recebe por mês, já com os descontos. Se tiver mais de uma fonte de renda, some tudo.'
      },
      {
        alvo: '[data-tour="gastos"]',
        titulo: 'Gastos: informe suas despesas fixas',
        texto: 'Coloque aqui o total das contas que se repetem todo mês, como aluguel, luz, água, internet e alimentação básica.'
      },
      {
        alvo: '[data-tour="salvar-financas"]',
        titulo: 'Salve para gerar o diagnóstico',
        texto: 'Depois de preencher ganhos e gastos, clique aqui. Quando os valores mudarem, é só editar e salvar de novo.'
      },
      {
        alvo: '[data-tour="diagnostico"]',
        titulo: 'Seu diagnóstico',
        texto: 'Aqui aparecem o teto para gastos variáveis, a meta de poupança mensal e a diretriz de investimento para o seu perfil. Tudo atualiza a cada vez que você salva.'
      },
      {
        alvo: '[data-tour="acoes"]',
        titulo: 'Tutorial e saída',
        texto: 'Use "Ver tutorial" para rever este guia e "Sair" para encerrar sua sessão. Pronto, agora é com você!'
      }
    ];
  }

  function iniciarTutorial() {
    const usuario = usuarioLogado();
    if (!usuario || tourAtivo || viewPerfil.hidden) return;

    tourPassos = montarPassos(usuario);
    tourAtivo = true;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    overlay.hidden = false;
    pop.hidden = false;
    irParaPasso(0);
  }

  function encerrarTutorial(marcarComoVisto) {
    if (!tourAtivo) return;
    tourAtivo = false;
    overlay.hidden = true;
    overlay.style.clipPath = 'none';
    ring.hidden = true;
    pop.hidden = true;
    pop.classList.add('oculto');
    if (marcarComoVisto) atualizarUsuario({ tutorialVisto: true });
  }

  function finalizarTutorial() {
    encerrarTutorial(true);
    mostrarToast('Tutorial concluído! Você pode revê-lo quando quiser em "Ver tutorial".');
  }

  // Espera a rolagem suave terminar antes de mostrar o pop-up
  function aguardarRolagem(callback) {
    let ultimo = window.scrollY;
    let parado = 0;
    let tentativas = 0;
    const timer = setInterval(() => {
      const atual = window.scrollY;
      parado = Math.abs(atual - ultimo) < 1 ? parado + 1 : 0;
      ultimo = atual;
      if (parado >= 3 || ++tentativas > 40) {
        clearInterval(timer);
        callback();
      }
    }, 50);
  }

  // Rola a página só se o elemento não estiver totalmente visível
  function trazerParaVista(alvo, callback) {
    const r = alvo.getBoundingClientRect();
    const altura = window.innerHeight;
    const movel = window.innerWidth < 700;
    const topoMin = 92;                                   // abaixo da barra superior
    const baseMax = movel ? altura - 250 : altura - 24;   // no celular, o pop-up fica embaixo

    if (r.top >= topoMin && r.bottom <= baseMax) { callback(); return; }

    const util = baseMax - topoMin;
    const desejado = r.height >= util ? topoMin : topoMin + (util - r.height) / 2;
    const delta = r.top - desejado;
    if (Math.abs(delta) < 4) { callback(); return; }

    window.scrollTo({ top: window.scrollY + delta, behavior: 'smooth' });
    aguardarRolagem(callback);
  }

  function irParaPasso(i) {
    tourPasso = i;
    const passo = tourPassos[i];
    const alvo = passo.alvo ? document.querySelector(passo.alvo) : null;

    pop.classList.add('oculto');
    posicionar();

    const mostrar = () => {
      if (!tourAtivo || tourPasso !== i) return;
      renderizarPopover(passo, i);
      posicionar();
      requestAnimationFrame(() => {
        pop.classList.remove('oculto');
        const principal = pop.querySelector('.btn-destaque');
        if (principal) principal.focus({ preventScroll: true });
      });
    };

    if (alvo) trazerParaVista(alvo, mostrar);
    else setTimeout(mostrar, 120);
  }

  function renderizarPopover(passo, i) {
    const total = tourPassos.length;
    const ultimo = i === total - 1;
    pop.textContent = '';

    const topo = criar('div', 'tour-topo');
    topo.appendChild(criar('span', 'tour-passo', `Passo ${i + 1} de ${total}`));
    if (!ultimo) {
      const pular = criar('button', 'tour-pular', 'Pular tutorial');
      pular.type = 'button';
      pular.addEventListener('click', () => encerrarTutorial(true));
      topo.appendChild(pular);
    }

    const titulo = criar('h4', null, passo.titulo);
    titulo.id = 'tour-titulo';

    const rodape = criar('div', 'tour-rodape');
    const pontos = criar('div', 'tour-pontos');
    for (let p = 0; p < total; p++) {
      const ponto = criar('button', p === i ? 'tour-ponto ativo' : 'tour-ponto');
      ponto.type = 'button';
      ponto.setAttribute('aria-label', `Ir para o passo ${p + 1}: ${tourPassos[p].titulo}`);
      ponto.setAttribute('title', `Passo ${p + 1}: ${tourPassos[p].titulo}`);
      ponto.addEventListener('click', () => irParaPasso(p));
      pontos.appendChild(ponto);
    }

    const botoes = criar('div', 'tour-botoes');
    if (i > 0) {
      const voltar = criar('button', 'btn-arredondado btn-outline btn-sm', 'Voltar');
      voltar.type = 'button';
      voltar.addEventListener('click', () => irParaPasso(i - 1));
      botoes.appendChild(voltar);
    }
    const proximo = criar('button', 'btn-arredondado btn-destaque btn-sm', ultimo ? 'Concluir' : (i === 0 ? 'Começar' : 'Próximo'));
    proximo.type = 'button';
    proximo.addEventListener('click', () => (ultimo ? finalizarTutorial() : irParaPasso(i + 1)));
    botoes.appendChild(proximo);

    rodape.append(pontos, botoes);
    pop.append(topo, titulo, criar('p', null, passo.texto), rodape);
  }

  // Monta o caminho do fundo escuro: retângulo da tela inteira com um "buraco" arredondado
  function caminhoComBuraco(W, H, x, y, w, h, raio) {
    const r = Math.max(0, Math.min(raio, w / 2, h / 2));
    return [
      `M0 0H${W}V${H}H0Z`,
      `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
      `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
      `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
      `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
    ].join('');
  }

  function posicionar() {
    if (!tourAtivo) return;
    const passo = tourPassos[tourPasso];
    const alvo = passo.alvo ? document.querySelector(passo.alvo) : null;
    const W = overlay.clientWidth || window.innerWidth;
    const H = overlay.clientHeight || window.innerHeight;
    let rect = null;

    if (alvo) {
      const r = alvo.getBoundingClientRect();
      const folga = 8;
      const raioAlvo = parseFloat(getComputedStyle(alvo).borderTopLeftRadius) || 0;
      const raio = Math.max(10, Math.min(raioAlvo, r.width / 2, r.height / 2) + folga);
      rect = { x: r.left - folga, y: r.top - folga, w: r.width + folga * 2, h: r.height + folga * 2, raio };

      overlay.style.clipPath = `path(evenodd, '${caminhoComBuraco(W, H, rect.x, rect.y, rect.w, rect.h, rect.raio)}')`;
      ring.hidden = false;
      Object.assign(ring.style, {
        left: `${rect.x}px`, top: `${rect.y}px`,
        width: `${rect.w}px`, height: `${rect.h}px`,
        borderRadius: `${rect.raio}px`
      });
    } else {
      overlay.style.clipPath = 'none';
      ring.hidden = true;
    }

    posicionarPopover(rect, W, H);
  }

  function posicionarPopover(rect, W, H) {
    const margem = 16;
    const topoMin = 84; // não cobre a barra superior
    const movel = W < 700;
    pop.classList.toggle('modo-movel', movel);

    // Celular: o pop-up vira uma "folha" fixa na parte de baixo da tela
    if (movel) {
      Object.assign(pop.style, { left: '1rem', right: '1rem', top: 'auto', bottom: '1rem' });
      return;
    }

    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const limitarX = (x) => Math.max(margem, Math.min(x, W - pw - margem));
    const limitarY = (y) => Math.max(topoMin, Math.min(y, H - ph - margem));
    let pos = null;

    if (!rect) {
      pos = { x: (W - pw) / 2, y: (H - ph) / 2 };
    } else {
      // Tenta abaixo, acima, à direita e à esquerda do elemento destacado
      const candidatos = [
        { x: limitarX(rect.x + rect.w / 2 - pw / 2), y: rect.y + rect.h + margem },
        { x: limitarX(rect.x + rect.w / 2 - pw / 2), y: rect.y - ph - margem },
        { x: rect.x + rect.w + margem, y: limitarY(rect.y + rect.h / 2 - ph / 2) },
        { x: rect.x - pw - margem, y: limitarY(rect.y + rect.h / 2 - ph / 2) }
      ];
      pos = candidatos.find((c) =>
        c.x >= margem && c.x + pw <= W - margem && c.y >= topoMin && c.y + ph <= H - margem
      ) || { x: (W - pw) / 2, y: H - ph - margem }; // sem espaço: fica embaixo, centralizado
    }

    Object.assign(pop.style, { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' });
  }

  // Reposiciona (uma vez por quadro) quando a página rola, muda de tamanho ou o conteúdo se altera
  function reposicionarTutorial() {
    if (!tourAtivo || tourFrame) return;
    tourFrame = requestAnimationFrame(() => { tourFrame = null; posicionar(); });
  }

  window.addEventListener('scroll', reposicionarTutorial, { passive: true });
  window.addEventListener('resize', reposicionarTutorial);

  // Atalhos do teclado durante o tutorial
  document.addEventListener('keydown', (e) => {
    if (!tourAtivo) return;
    const emCampo = /^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || ''));

    if (e.key === 'Escape') {
      e.preventDefault();
      encerrarTutorial(true);
    } else if (!emCampo && e.key === 'ArrowRight' && tourPasso < tourPassos.length - 1) {
      irParaPasso(tourPasso + 1);
    } else if (!emCampo && e.key === 'ArrowLeft' && tourPasso > 0) {
      irParaPasso(tourPasso - 1);
    }
  });

  $('btn-tutorial').addEventListener('click', iniciarTutorial);

  // ---------------------------------------------------------
  // 12. INICIALIZAÇÃO E ROTAS
  // ---------------------------------------------------------
  function verificarRotaInicial() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // Se vier do Chatbot clicando em "Editar Perfil" (#perfil ou ?view=perfil)
    if (hash === '#perfil' || params.get('view') === 'perfil') {
      if (usuarioLogado()) {
        abrirPerfil();
      } else {
        abrirModal('login');
      }
    }
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#perfil') {
      if (usuarioLogado()) abrirPerfil();
    } else if (!window.location.hash || window.location.hash === '#home') {
      mostrarView('home');
    }
  });

  atualizarInterface();
  verificarRotaInicial();
});
