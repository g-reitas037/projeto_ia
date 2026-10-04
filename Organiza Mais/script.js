/**
 * Organiza+ - Tema, Cadastro/Login, Perfil editável, Diagnóstico e Tutorial guiado
 * Integrado ao Supabase (Auth & Database)
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

  let temaSalvo = 'light';
  try { temaSalvo = localStorage.getItem('aurafinance_theme') || 'light'; } catch (e) { }
  htmlElement.setAttribute('data-theme', temaSalvo);

  themeToggleBtn.addEventListener('click', () => {
    const temaAtual = htmlElement.getAttribute('data-theme');
    const novoTema = temaAtual === 'dark' ? 'light' : 'dark';

    htmlElement.setAttribute('data-theme', novoTema);
    try { localStorage.setItem('aurafinance_theme', novoTema); } catch (e) { }
  });

  // ---------------------------------------------------------
  // 2. PERSISTÊNCIA: BANCO DE DADOS (SUPABASE)
  // ---------------------------------------------------------
  async function getUsuarioAtual() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session || !session.user) return null;

    const user = session.user;
    const { data: perfil, error } = await _supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !perfil) return null;

    return {
      id: user.id,
      email: user.email,
      nome: perfil.nome,
      telefone: perfil.telefone,
      perfil: perfil.perfil || 'moderado',
      renda: perfil.renda != null ? Number(perfil.renda) : null,
      gastosFixos: perfil.gastos_fixos != null ? Number(perfil.gastos_fixos) : null,
      foto: perfil.foto,
      capa: perfil.capa,
      tutorialVisto: perfil.tutorial_visto
    };
  }

  async function atualizarPerfilSupabase(dados) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return false;

    const { error } = await _supabase
      .from('perfis')
      .update({ ...dados, updated_at: new Date() })
      .eq('id', user.id);

    return !error;
  }

  function iniciais(nome) {
    const partes = String(nome).trim().split(/\s+/)
      .map((p) => (p.match(/[\p{L}\p{N}]/u) || [''])[0])
      .filter(Boolean);
    if (!partes.length) return '?';
    const primeira = partes[0];
    const ultima = partes.length > 1 ? partes[partes.length - 1] : '';
    return (primeira + ultima).toUpperCase();
  }

  const primeiroNome = (nome) => String(nome).trim().split(/\s+/)[0] || '';

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

  async function abrirPerfil() {
    const usuario = await getUsuarioAtual();
    if (!usuario) {
      mostrarView('home');
      abrirModal('login');
      return;
    }

    renderizarCabecalho(usuario);
    preencherFormDados(usuario);
    preencherFormFinancas(usuario);
    renderizarDiagnostico(usuario);
    mostrarView('perfil');

    if (!usuario.tutorialVisto) setTimeout(iniciarTutorial, 450);
  }

  async function acaoPrincipal() {
    const usuario = await getUsuarioAtual();
    if (usuario) {
      window.location.hash = 'perfil';
      await abrirPerfil();
    } else {
      abrirModal('cadastro');
    }
  }

  async function atualizarInterface() {
    const usuario = await getUsuarioAtual();
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

    heroBtn.textContent = logado ? 'Acessar Meu Perfil' : 'Criar Cadastro';
    btnCadastroInferior.textContent = logado ? 'Acessar Meu Perfil' : 'Cadastrar Perfil e Gerar Diagnóstico';
  }

  if ($('logo-link')) {
    $('logo-link').addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = 'home';
      mostrarView('home');
    });
  }

  if (btnPerfilTopo) {
    btnPerfilTopo.addEventListener('click', async () => {
      window.location.hash = 'perfil';
      await abrirPerfil();
    });
  }

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
    document.body.style.overflow = 'hidden';
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

  modalCadastro.addEventListener('click', (e) => {
    if (e.target === modalCadastro) fecharModal();
  });

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

    const { data, error } = await _supabase.auth.signUp({
      email: email,
      password: senha,
      options: { data: { nome, telefone, perfil } }
    });

    if (error) {
      mostrarErro(erroCadastro, 'Erro no cadastro: ' + error.message);
      return;
    }

    formCadastro.reset();
    fecharModal();
    window.location.hash = 'perfil';
    await atualizarInterface();
    await abrirPerfil();
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErros();

    const email = $('login-email').value.trim().toLowerCase();
    const senha = $('login-senha').value;

    const { data, error } = await _supabase.auth.signInWithPassword({
      email: email,
      password: senha
    });

    if (error) {
      mostrarErro(erroLogin, 'E-mail ou senha incorretos.');
      return;
    }

    formLogin.reset();
    fecharModal();
    window.location.hash = 'perfil';
    await atualizarInterface();
    await abrirPerfil();
  });

  $('btn-logout').addEventListener('click', async () => {
    await encerrarTutorial(false);
    await _supabase.auth.signOut();
    window.location.hash = 'home';
    await atualizarInterface();
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
      poupancaPctMargem: 0.15,
      variavelPctMargem: 0.85,
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
      poupancaPctMargem: 0.25,
      variavelPctMargem: 0.75,
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
      poupancaPctMargem: 0.35,
      variavelPctMargem: 0.65,
      alocacao: [
        { ativo: 'Ações & Dividendos (Brasil)', pct: 45, cor: '#f59e0b' },
        { ativo: 'ETFs Globais & FIIs', pct: 30, cor: '#ef4444' },
        { ativo: 'Reserva Oportunidade / Renda Fixa', pct: 25, cor: '#6366f1' }
      ],
      diretriz: 'Estratégia arrojada para maximizar o efeito dos juros compostos no longo prazo. Recomendação de poupar 35% da margem livre com foco em ações de valor, ETFs globais e FIIs, com 25% em reserva de oportunidade.'
    }
  };

  function renderizarCabecalho(usuario) {
    if (!usuario) return;
    if ($('perfil-nome')) $('perfil-nome').textContent = usuario.nome || 'Usuário';
    if ($('perfil-email')) $('perfil-email').textContent = usuario.email || '';
    if ($('perfil-avatar')) preencherAvatar($('perfil-avatar'), usuario, true);
    if (capaImg) capaImg.style.backgroundImage = usuario.capa ? `url("${usuario.capa}")` : '';
    if ($('btn-remover-foto')) $('btn-remover-foto').hidden = !usuario.foto;
    if ($('btn-remover-capa')) $('btn-remover-capa').hidden = !usuario.capa;

    const badgeEl = $('perfil-badge');
    if (badgeEl) {
      const cfg = PERFIS_CONFIG[usuario.perfil] || PERFIS_CONFIG.moderado;
      badgeEl.className = `badge-perfil ${cfg.classeBadge}`;
      badgeEl.textContent = `${cfg.nome}`;
      badgeEl.title = `${cfg.nome}: ${cfg.subtitulo}`;
    }
  }

  function preencherFormDados(usuario) {
    if (!usuario) return;
    if ($('p-nome')) $('p-nome').value = usuario.nome || '';
    if ($('p-email')) $('p-email').value = usuario.email || '';
    if ($('p-telefone')) $('p-telefone').value = formatarTelefone(usuario.telefone || '');
    if ($('p-perfil')) $('p-perfil').value = usuario.perfil || 'moderado';
  }

  function preencherFormFinancas(usuario) {
    if (!usuario) return;
    if ($('p-renda')) $('p-renda').value = usuario.renda == null ? '' : usuario.renda;
    if ($('p-gastos')) $('p-gastos').value = usuario.gastosFixos == null ? '' : usuario.gastosFixos;
  }
  function lerNumero(texto) {
    const t = String(texto).trim();
    if (t === '') return null;
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  formDados.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const nome = $('p-nome').value.trim();
    if (!nome) { mostrarToast('Informe seu nome para salvar.', 'erro'); return; }

    const ok = await atualizarPerfilSupabase({
      nome: nome,
      telefone: $('p-telefone').value.trim(),
      perfil: $('p-perfil').value
    });

    if (!ok) { mostrarToast('Erro ao salvar no banco.', 'erro'); return; }

    const usuario = await getUsuarioAtual();
    renderizarCabecalho(usuario);
    renderizarDiagnostico(usuario);
    await atualizarInterface();
    mostrarToast('Dados pessoais e perfil atualizados!');
  });

  formFinancas.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const renda = lerNumero($('p-renda').value);
    const gastosFixos = lerNumero($('p-gastos').value);

    if (Number.isNaN(renda) || Number.isNaN(gastosFixos)) {
      mostrarToast('Use apenas valores numéricos válidos.', 'erro');
      return;
    }

    const ok = await atualizarPerfilSupabase({
      renda: renda,
      gastos_fixos: gastosFixos
    });

    if (!ok) { mostrarToast('Erro ao salvar finanças no banco.', 'erro'); return; }

    const usuario = await getUsuarioAtual();
    renderizarDiagnostico(usuario);
    mostrarToast('Ganhos e gastos salvos! Diagnóstico atualizado.');
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

    requestAnimationFrame(() => requestAnimationFrame(() => {
      box.querySelectorAll('.diag-seg').forEach((seg) => {
        seg.style.width = `${seg.dataset.w}%`;
      });
    }));
  }

  // ---------------------------------------------------------
  // 10. FOTO DE PERFIL E IMAGEM DE CAPA
  // ---------------------------------------------------------
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
    input.value = '';
    if (!arquivo) return;

    try {
      const dataUrl = await prepararImagem(arquivo, largura, altura, qualidade);
      const ok = await atualizarPerfilSupabase({ [campo]: dataUrl });
      if (!ok) throw new Error('armazenamento');

      const usuario = await getUsuarioAtual();
      renderizarCabecalho(usuario);
      await atualizarInterface();
      mostrarToast(msgOk);
      reposicionarTutorial();
    } catch (err) {
      const msgs = {
        tipo: 'Escolha um arquivo de imagem (JPG, PNG ou WebP).',
        tamanho: 'A imagem é muito grande. Escolha uma de até 12 MB.',
        leitura: 'Não foi possível ler essa imagem. Tente outro arquivo.',
        armazenamento: 'Não foi possível salvar a imagem no banco.'
      };
      mostrarToast(msgs[err.message] || msgs.leitura, 'erro');
    }
  }

  async function removerImagem(campo, msg) {
    await atualizarPerfilSupabase({ [campo]: null });
    const usuario = await getUsuarioAtual();
    renderizarCabecalho(usuario);
    await atualizarInterface();
    mostrarToast(msg);
  }

  $('btn-alterar-foto').addEventListener('click', () => $('input-foto').click());
  $('btn-alterar-capa').addEventListener('click', () => $('input-capa').click());
  $('input-foto').addEventListener('change', (e) => trocarImagem(e.target, 'foto', 320, 320, 0.86, 'Foto de perfil atualizada!')); $('input-capa').addEventListener('change', (e) => trocarImagem(e.target, 'capa', 1400, 440, 0.8, 'Imagem de capa atualizada!'));
  $('btn-remover-foto').addEventListener('click', () => removerImagem('foto', 'Foto removida.')); $('btn-remover-capa').addEventListener('click', () => removerImagem('capa', 'Capa removida.'));

  // ---------------------------------------------------------
  // 11. TUTORIAL GUIADO
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

  async function iniciarTutorial() {
    const usuario = await getUsuarioAtual();
    if (!usuario || tourAtivo || viewPerfil.hidden) return;

    tourPassos = montarPassos(usuario);
    tourAtivo = true;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    overlay.hidden = false;
    pop.hidden = false;
    irParaPasso(0);
  }

  async function encerrarTutorial(marcarComoVisto) {
    if (!tourAtivo) return;
    tourAtivo = false;
    overlay.hidden = true;
    overlay.style.clipPath = 'none';
    ring.hidden = true;
    pop.hidden = true;
    pop.classList.add('oculto');
    if (marcarComoVisto) await atualizarPerfilSupabase({ tutorial_visto: true });
  }

  async function finalizarTutorial() {
    await encerrarTutorial(true);
    mostrarToast('Tutorial concluído! Você pode revê-lo quando quiser em "Ver tutorial".');
  }

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

  function trazerParaVista(alvo, callback) {
    const r = alvo.getBoundingClientRect();
    const altura = window.innerHeight;
    const movel = window.innerWidth < 700;
    const topoMin = 92;
    const baseMax = movel ? altura - 250 : altura - 24;

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
    const topoMin = 84;
    const movel = W < 700;
    pop.classList.toggle('modo-movel', movel);

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
      const candidatos = [
        { x: limitarX(rect.x + rect.w / 2 - pw / 2), y: rect.y + rect.h + margem },
        { x: limitarX(rect.x + rect.w / 2 - pw / 2), y: rect.y - ph - margem },
        { x: rect.x + rect.w + margem, y: limitarY(rect.y + rect.h / 2 - ph / 2) },
        { x: rect.x - pw - margem, y: limitarY(rect.y + rect.h / 2 - ph / 2) }
      ];
      pos = candidatos.find((c) =>
        c.x >= margem && c.x + pw <= W - margem && c.y >= topoMin && c.y + ph <= H - margem
      ) || { x: (W - pw) / 2, y: H - ph - margem };
    }

    Object.assign(pop.style, { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' });
  }

  function reposicionarTutorial() {
    if (!tourAtivo || tourFrame) return;
    tourFrame = requestAnimationFrame(() => { tourFrame = null; posicionar(); });
  }

  window.addEventListener('scroll', reposicionarTutorial, { passive: true });
  window.addEventListener('resize', reposicionarTutorial);

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
  // 12. INICIALIZAÇÃO E ROTAS (PERMITE NAVEGAR ENTRE HOME E PERFIL)
  // ---------------------------------------------------------
  async function verificarRotaInicial() {
    const hash = window.location.hash;

    if (hash === '#perfil') {
      // Exibe imediatamente o perfil visualmente para evitar o atraso de carregamento
      mostrarView('perfil');
      
      const usuario = await getUsuarioAtual();
      if (usuario) {
        renderizarCabecalho(usuario);
        preencherFormDados(usuario);
        preencherFormFinancas(usuario);
        renderizarDiagnostico(usuario);
      } else {
        // Caso não esteja autenticado, redireciona para a home e abre o login
        mostrarView('home');
        abrirModal('login');
      }
    } else {
      mostrarView('home');
    }
  }
  window.addEventListener('hashchange', async () => {
    const hash = window.location.hash;
    const usuario = await getUsuarioAtual();

    if (hash === '#perfil') {
      if (usuario) {
        await abrirPerfil();
      } else {
        mostrarView('home');
        abrirModal('login');
      }
    } else {
      mostrarView('home');
    }
  });

  // Inicializa a interface
  (async () => {
    await atualizarInterface();
    await verificarRotaInicial();
  })();

});