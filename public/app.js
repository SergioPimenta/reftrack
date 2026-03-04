// ---------------- UTILS ----------------
const $ = selector => document.querySelector(selector);
const formatMoney = val => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = dateStr => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Cores dos avatares e dots
const IND_COLORS = [
  ['#00e5a0', '#00a070', '#000'],
  ['#7c6fff', '#5040cc', '#fff'],
  ['#ffb830', '#e08800', '#000'],
  ['#ff4d6d', '#cc2040', '#fff'],
  ['#00c8e5', '#0088aa', '#000']
];

function getIndColor(index) {
  return IND_COLORS[index % IND_COLORS.length];
}

function getInitials(name) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// ---------------- TOAST ----------------
function showToast(msg, isError = false) {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  itemColor = isError ? 'var(--danger)' : 'var(--accent)';
  icon = isError ? '✕' : '✓';

  toast.innerHTML = `
    <div class="toast-icon" style="color: ${itemColor}">${icon}</div>
    <div class="toast-msg">${msg}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------------- API WRAPPER ----------------
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = { method, headers: {} };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, options);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || res.status === 403) {
    showLogin();
    // Repassamos a mensagem específica do backend, se houver
    throw new Error(data.error || 'Não autorizado');
  }

  if (!res.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data;
}

// ---------------- AUTH ----------------
function checkAuth() {
  // Vamos tentar carregar algo protegido para ver se tem token
  return apiCall('/api/stats')
    .then(() => true)
    .catch(() => false);
}

function showLogin() {
  $('#app-container').classList.add('hidden');
  $('#login-container').classList.remove('hidden');
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = $('#login-user').value;
  const senha = $('#login-pass').value;

  try {
    await apiCall('/api/login', 'POST', { usuario, senha });
    $('#login-container').classList.add('hidden');
    $('#app-container').classList.remove('hidden');
    window.location.hash = '#dashboard';
    initApp();
  } catch (err) {
    $('#login-error').innerText = err.message;
  }
});

async function logout() {
  try {
    await apiCall('/api/logout', 'POST');
    showLogin();
    window.location.hash = '';
  } catch (err) {
    showToast('Erro ao sair', true);
  }
}

// ---------------- ROUTER & STATE ----------------
const state = {
  indicadores: [],
  usuarios: [],
  vendas: [],
  stats: {},
  config: { hotmartProductUrl: '' },
  currentView: 'dashboard'
};

async function initApp() {
  const isAuth = await checkAuth();
  if (!isAuth) return;

  $('#login-container').classList.add('hidden');
  $('#app-container').classList.remove('hidden');

  await loadData();

  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  // Polling de webhook badge
  setInterval(checkNewWebhooks, 5000);
}

async function loadData() {
  try {
    const [ind, stats, usrs, config] = await Promise.all([
      apiCall('/api/indicadores'),
      apiCall('/api/stats'),
      apiCall('/api/usuarios'),
      apiCall('/api/config')
    ]);
    state.indicadores = ind;
    state.stats = stats;
    state.usuarios = usrs;
    state.config = config;
  } catch (err) {
    console.error(err);
  }
}

function handleRoute() {
  const hash = window.location.hash.substring(1) || 'dashboard';
  state.currentView = hash;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-view="${hash}"]`);
  if (activeNav) activeNav.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'indicadores': 'Indicadores',
    'usuarios': 'Gerenciar Usuários (Admin)',
    'vendas': 'Registro de Vendas',
    'webhook': 'Integração & Webhook'
  };
  $('#page-title').innerText = titles[hash] || 'Dashboard';
  $('#topbar-action-container').innerHTML = '';

  renderView(hash);
}

function renderView(view) {
  const container = $('#view-container');
  container.innerHTML = '';

  if (view === 'dashboard') renderDashboard(container);
  else if (view === 'indicadores') renderIndicadores(container);
  else if (view === 'usuarios') renderUsuarios(container);
  else if (view === 'vendas') renderVendas(container);
  else if (view === 'webhook') renderWebhook(container);
}

// ---------------- VIEWS ----------------

// 1. DASHBOARD
async function renderDashboard(container) {
  await loadData(); // refresh
  const stats = state.stats;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card c-green">
        <div class="stat-label">Vendas (Mês)</div>
        <div class="stat-value">${stats.total_vendas}</div>
      </div>
      <div class="stat-card c-purple">
        <div class="stat-label">Receita Gerada</div>
        <div class="stat-value">${formatMoney(stats.total_receita)}</div>
      </div>
      <div class="stat-card c-yellow">
        <div class="stat-label">Comissões</div>
        <div class="stat-value">${formatMoney(stats.total_comissoes)}</div>
      </div>
      <div class="stat-card c-red">
        <div class="stat-label">Indicadores Ativos</div>
        <div class="stat-value">${stats.indicadores_ativos}</div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div class="table-container">
        <div class="table-header">
          <div class="table-title">Top Indicadores</div>
        </div>
        <div class="ranking-list" id="ranking-container"></div>
      </div>
      
      <div class="table-container">
        <div class="table-header">
          <div class="table-title">Vendas (Últimas 8 Semanas)</div>
        </div>
        <div class="chart-container" id="chart-container"></div>
      </div>
    </div>
    
    <div class="table-container">
      <div class="table-header">
        <div class="table-title">Últimas Vendas</div>
        <button class="btn-ghost" onclick="window.location.hash='#vendas'" style="padding: 6px 12px; font-size: 11px;">Ver Todas</button>
      </div>
      <table class="custom-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Comprador</th>
            <th>Indicador</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody id="dash-vendas-body"></tbody>
      </table>
    </div>
  `;

  // Render Ranking
  const rCont = $('#ranking-container');
  const maxVendas = stats.ranking_indicadores.length > 0 ? stats.ranking_indicadores[0].vendas_aprovadas : 1;

  stats.ranking_indicadores.forEach((ind, idx) => {
    const pc = (ind.vendas_aprovadas / maxVendas) * 100;
    rCont.innerHTML += `
      <div class="ranking-item">
        <div class="ranking-pos pos-${idx + 1}">#${idx + 1}</div>
        <div class="avatar-ind" style="background: linear-gradient(135deg, ${getIndColor(idx)[0]}, ${getIndColor(idx)[1]}); color: ${getIndColor(idx)[2]}">
          ${getInitials(ind.nome)}
        </div>
        <div class="ranking-info">
          <div class="ranking-name">${ind.nome}</div>
          <div class="ranking-stats">
            <span>${ind.vendas_aprovadas} vendas</span>
            <span>${formatMoney(ind.comissoes_geradas)} comissão</span>
          </div>
          <div class="ranking-bar-bg"><div class="ranking-bar-fill" style="width: ${pc}%"></div></div>
        </div>
      </div>
    `;
  });
  if (stats.ranking_indicadores.length === 0) {
    rCont.innerHTML = '<div style="color: var(--muted); font-family: DM Mono; font-size: 12px;">Nenhum dado este mês.</div>';
  }

  // Render Chart
  const cCont = $('#chart-container');
  const maxChart = Math.max(...stats.vendas_por_semana.map(s => s.total_vendas), 1);
  stats.vendas_por_semana.forEach((sem, idx) => {
    const isCurrent = idx === stats.vendas_por_semana.length - 1;
    const h = (sem.total_vendas / maxChart) * 100;
    cCont.innerHTML += `
      <div class="chart-col">
        <div class="chart-label" style="margin-bottom: 2px;">${sem.total_vendas}</div>
        <div class="chart-bar ${isCurrent ? 'current' : ''}" style="height: ${h}%"></div>
        <div class="chart-label">${sem.semana.split('-')[1]}</div>
      </div>
    `;
  });

  // Render Last Sales
  try {
    const ultimas = await apiCall('/api/vendas');
    const tbody = $('#dash-vendas-body');
    tbody.innerHTML = '';
    ultimas.slice(0, 5).forEach(v => {
      let bClass = 'badge-pending';
      if (v.status === 'APPROVED') bClass = 'badge-success';
      if (v.status === 'REFUNDED') bClass = 'badge-danger';

      const idx = state.indicadores.findIndex(i => i.id === v.indicador_id);
      let indHtml = '<span class="t-mono">-</span>';
      if (idx !== -1) {
        const c = getIndColor(idx)[0];
        indHtml = `<div class="td-ref"><div class="td-ref-dot" style="background: ${c}"></div>${v.indicador_nome}</div>`;
      }

      tbody.innerHTML += `
        <tr>
          <td class="t-produto">${v.produto_nome}</td>
          <td><div class="t-produto" style="font-weight: 600; font-size: 12px;">${v.comprador_nome}</div><div class="t-mono">${v.comprador_email}</div></td>
          <td>${indHtml}</td>
          <td><span class="badge ${bClass}">${v.status}</span></td>
          <td class="t-mono">${formatDate(v.data_venda)}</td>
        </tr>
      `;
    });
  } catch (err) { }
}

// 2. INDICADORES
async function renderIndicadores(container) {
  $('#topbar-action-container').innerHTML = `
    <button class="btn-primary" onclick="openModalInd()">+ Novo Indicador</button>
  `;

  let rowsHtml = '';
  state.indicadores.forEach((ind, idx) => {
    if (!ind.ativo) return;
    const c = getIndColor(idx);
    rowsHtml += `
      <tr>
        <td>
          <div class="flex-row">
            <div class="avatar-ind" style="background: linear-gradient(135deg, ${c[0]}, ${c[1]}); color: ${c[2]}">
              ${getInitials(ind.nome)}
            </div>
            <div>
              <div class="t-produto">${ind.nome}</div>
              <div class="t-mono">${ind.email}</div>
            </div>
          </div>
        </td>
        <td class="t-comissao">${ind.comissao_percentual}%</td>
        <td><span class="badge badge-success">Ativo</span></td>
        <td class="t-mono">${formatDate(ind.criado_em)}</td>
        <td>
          <button class="btn-ghost" style="padding: 4px 10px; font-size: 10px;" onclick="openModalInd(${ind.id})">Editar</button>
          <button class="btn-ghost" style="padding: 4px 10px; font-size: 10px; color: var(--danger); border-color: var(--danger);" onclick="deleteInd(${ind.id})">Desativar</button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Comissão</th>
            <th>Status</th>
            <th>Criado em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

// 3. VENDAS
async function renderVendas(container) {
  $('#topbar-action-container').innerHTML = `
    <div class="flex-row">
      <select id="filter-ind" class="form-input" style="padding: 6px 12px; font-size: 12px;" onchange="loadVendasFiltered()">
        <option value="">Todos Indicadores</option>
        ${state.indicadores.filter(i => i.ativo).map(i => `<option value="${i.id}">${i.nome}</option>`).join('')}
      </select>
      <select id="filter-status" class="form-input" style="padding: 6px 12px; font-size: 12px;" onchange="loadVendasFiltered()">
        <option value="">Todos Status</option>
        <option value="APPROVED">APPROVED</option>
        <option value="PENDING">PENDING</option>
        <option value="REFUNDED">REFUNDED</option>
      </select>
    </div>
  `;

  container.innerHTML = `
    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Transação</th>
            <th>Produto / Comprador</th>
            <th>Indicador</th>
            <th>Valor</th>
            <th>Comissão</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody id="vendas-tbody"></tbody>
      </table>
    </div>
  `;

  loadVendasFiltered();
}

window.loadVendasFiltered = async function () {
  const iId = $('#filter-ind')?.value || '';
  const st = $('#filter-status')?.value || '';
  try {
    const vendas = await apiCall(`/api/vendas?indicador_id=${iId}&status=${st}`);
    const tbody = $('#vendas-tbody');
    tbody.innerHTML = '';

    vendas.forEach(v => {
      let bClass = 'badge-pending';
      if (v.status === 'APPROVED') bClass = 'badge-success';
      if (v.status === 'REFUNDED') bClass = 'badge-danger';

      const idx = state.indicadores.findIndex(i => i.id === v.indicador_id);
      let indHtml = '<span class="t-mono">-</span>';
      if (idx !== -1) {
        const c = getIndColor(idx)[0];
        indHtml = `<div class="td-ref"><div class="td-ref-dot" style="background: ${c}"></div>${v.indicador_nome}</div>`;
      }

      tbody.innerHTML += `
        <tr>
          <td class="t-mono" style="color: var(--text)">${v.transaction_id}</td>
          <td>
            <div class="t-produto">${v.produto_nome}</div>
            <div class="t-mono">${v.comprador_nome} (${v.comprador_email})</div>
          </td>
          <td>${indHtml}</td>
          <td class="t-money">${formatMoney(v.valor)}</td>
          <td class="t-comissao">${formatMoney(v.comissao_valor || 0)}</td>
          <td><span class="badge ${bClass}">${v.status}</span></td>
          <td class="t-mono">${formatDate(v.data_venda)}</td>
        </tr>
      `;
    });
  } catch (err) {
    showToast(err.message, true);
  }
}

// 4. WEBHOOK
async function renderWebhook(container) {
  const PRODUTO_URL = window.location.origin; // Em prod viria da env, aqui usamos um fake
  let logsHtml = '';

  try {
    const logs = await apiCall('/api/webhook/hotmart/logs');
    logs.forEach(l => {
      logsHtml += `<tr>
        <td class="t-mono">${formatDate(l.data)}</td>
        <td class="t-mono" style="color: var(--accent)">${l.evento}</td>
        <td class="t-mono">${l.transaction}</td>
      </tr>`;
    });
  } catch (e) { }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div class="stat-card">
          <div class="table-title" style="margin-bottom: 12px;">URL do Webhook</div>
          <div class="t-mono" style="margin-bottom: 16px;">Configure esta URL na Hotmart para enviar eventos em JSON.</div>
          <div class="link-row">
            <div class="link-text" id="webhook-url">${PRODUTO_URL}/api/webhook/hotmart</div>
            <button class="btn-copy" onclick="copyWebhook()">COPIAR</button>
          </div>
        </div>
        
        <div class="table-container">
          <div class="table-header"><div class="table-title">Últimos Logs de Chamada</div></div>
          <table class="custom-table">
            <thead><tr><th>Data</th><th>Evento</th><th>Transação</th></tr></thead>
            <tbody>${logsHtml || '<tr><td colspan="3" class="t-mono" style="text-align:center">Nenhum log recente</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      
      <div class="table-container">
        <div class="table-header"><div class="table-title">Exemplo Payload Esperado</div></div>
        <div class="json-block">
<span class="json-comment">// O RefTrack procura "tracking.source" para achar o indicador.</span>
{
  <span class="json-key">"event"</span>: <span class="json-string">"PURCHASE_APPROVED"</span>,
  <span class="json-key">"data"</span>: {
    <span class="json-key">"purchase"</span>: {
      <span class="json-key">"transaction"</span>: <span class="json-string">"HP123456789"</span>,
      <span class="json-key">"status"</span>: <span class="json-string">"APPROVED"</span>,
      <span class="json-key">"price"</span>: { <span class="json-key">"value"</span>: <span class="json-number">100.00</span> },
      <span class="json-key">"tracking"</span>: {
        <span class="json-key">"source"</span>: <span class="json-string">"email_do@indicador.com"</span>
      }
    },
    <span class="json-key">"buyer"</span>: {
      <span class="json-key">"name"</span>: <span class="json-string">"João Silva"</span>,
      <span class="json-key">"email"</span>: <span class="json-string">"joao@mail.com"</span>
    },
    <span class="json-key">"product"</span>: { <span class="json-key">"name"</span>: <span class="json-string">"Curso Incrível"</span> }
  }
}</div>
      </div>
    
    </div>
  `;
}

window.copyWebhook = function () {
  const txt = $('#webhook-url').innerText;
  navigator.clipboard.writeText(txt);
  showToast('URL Copiada!');
}

// ---------------- MODALS & ACTIONS ----------------

window.openModalInd = function (id = null) {
  const ind = id ? state.indicadores.find(i => i.id === id) : null;
  const t = id ? 'Editar Indicador' : 'Novo Indicador';

  const h = `
    <div class="modal-header">
      <div class="modal-title">${t}</div>
      <div class="modal-close" onclick="closeModal()">✕</div>
    </div>
    <form id="form-ind">
      <input type="hidden" id="ind-id" value="${id || ''}">
      <div class="form-group">
        <label>Nome Completo</label>
        <input type="text" id="ind-nome" class="form-input" required value="${ind ? ind.nome : ''}">
      </div>
      <div class="form-group">
        <label>E-mail (Usado no ?src=)</label>
        <input type="email" id="ind-email" class="form-input" required value="${ind ? ind.email : ''}" oninput="updatePreview()">
      </div>
      <div class="form-group">
        <label>Comissão (%)</label>
        <input type="number" id="ind-comissao" class="form-input" required value="${ind ? ind.comissao_percentual : '10'}">
      </div>
      
      <div style="margin-top: 20px;">
        <label style="font-family: DM Mono; font-size: 10px; color: var(--muted); text-transform: uppercase;">Preview do Link de Venda</label>
        <div class="flex-row" style="gap: 8px;">
          <div class="link-preview" id="link-prev" style="flex: 1;"></div>
          <button type="button" class="btn-ghost" style="padding: 0 16px; border-color: var(--primary); color: var(--primary);" onclick="window.copyPreviewLink()">Copiar</button>
        </div>
      </div>
      
      <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>
  `;

  $('#modal-content').innerHTML = h;
  $('#modal-overlay').style.display = 'flex';

  $('#form-ind').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      nome: $('#ind-nome').value,
      email: $('#ind-email').value,
      comissao_percentual: $('#ind-comissao').value
    };
    try {
      if (id) await apiCall('/api/indicadores/' + id, 'PUT', data);
      else await apiCall('/api/indicadores', 'POST', data);

      showToast('Indicador salvo!');
      closeModal();
      await loadData();
      renderIndicadores($('#view-container'));
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // Mostra o preview inicial
  updatePreview();
}

window.updatePreview = function () {
  const em = $('#ind-email').value || 'email@indicador.com';
  const baseUrl = state.config?.hotmartProductUrl || 'https://pay.hotmart.com/PRODUTO';

  // Se a URL do produto já tiver ?, usamos &, senão usamos ?
  const separator = baseUrl.includes('?') ? '&' : '?';
  $('#link-prev').innerText = `${baseUrl}${separator}src=${em}`;
}

window.copyPreviewLink = function () {
  const txt = $('#link-prev').innerText;
  if (!txt || txt.includes('email@indicador.com')) {
    showToast('Preencha o e-mail antes de copiar!', true);
    return;
  }
  navigator.clipboard.writeText(txt);
  showToast('Link do Indicador copiado!');
}

window.closeModal = function () {
  $('#modal-overlay').style.display = 'none';
}

// Fechar com ESC ou clicando fora
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
$('#modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

window.deleteInd = async function (id) {
  if (!confirm('Tem certeza que deseja desativar este indicador?')) return;
  try {
    await apiCall('/api/indicadores/' + id, 'DELETE');
    showToast('Indicador desativado.');
    await loadData();
    renderIndicadores($('#view-container'));
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------- USUARIOS ADMIN ----------------
async function renderUsuarios(container) {
  $('#topbar-action-container').innerHTML = `
  <button class="btn-primary" onclick="openModalUser()">+ Novo Usuário</button>
`;

  let rowsHtml = '';
  state.usuarios.forEach((user, idx) => {
    const c = getIndColor(idx + 2); // Pick a slightly different color offset
    rowsHtml += `
    <tr>
      <td>
        <div class="flex-row">
          <div class="avatar-ind" style="background: linear-gradient(135deg, ${c[0]}, ${c[1]}); color: ${c[2]}">
            ${getInitials(user.nome)}
          </div>
          <div>
            <div class="t-produto">${user.nome}</div>
            <div class="t-mono">${user.usuario}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-success">Administrador</span></td>
      <td class="t-mono">${formatDate(user.criado_em)}</td>
      <td>
        <button class="btn-ghost" style="padding: 4px 10px; font-size: 10px;" onclick="openModalUser(${user.id})">Editar</button>
        <button class="btn-ghost" style="padding: 4px 10px; font-size: 10px; color: var(--danger); border-color: var(--danger);" onclick="deleteUser(${user.id})">Excluir</button>
      </td>
    </tr>
  `;
  });

  container.innerHTML = `
  <div class="table-container">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Usuário</th>
          <th>Nível de Acesso</th>
          <th>Criado em</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
`;
}

window.openModalUser = function (id = null) {
  const user = id ? state.usuarios.find(u => u.id === id) : null;
  const t = id ? 'Editar Usuário Admin' : 'Novo Usuário Admin';

  const h = `
  <div class="modal-header">
    <div class="modal-title">${t}</div>
    <div class="modal-close" onclick="closeModal()">✕</div>
  </div>
  <form id="form-user">
    <input type="hidden" id="user-id" value="${id || ''}">
    <div class="form-group">
      <label>Nome Completo</label>
      <input type="text" id="user-nome" class="form-input" required value="${user ? user.nome : ''}">
    </div>
    <div class="form-group">
      <label>Nome de Usuário (Login)</label>
      <input type="text" id="user-login" class="form-input" required value="${user ? user.usuario : ''}">
    </div>
    <div class="form-group">
      <label>Senha ${id ? '(Deixe em branco para não alterar)' : ''}</label>
      <input type="password" id="user-senha" class="form-input" ${id ? '' : 'required'} placeholder="******">
    </div>
    
    <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
      <button type="button" class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button type="submit" class="btn-primary">Salvar</button>
    </div>
  </form>
`;

  $('#modal-content').innerHTML = h;
  $('#modal-overlay').style.display = 'flex';

  $('#form-user').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      nome: $('#user-nome').value,
      usuario: $('#user-login').value
    };

    const pass = $('#user-senha').value;
    if (pass) payload.senha = pass;

    try {
      if (id) await apiCall('/api/usuarios/' + id, 'PUT', payload);
      else await apiCall('/api/usuarios', 'POST', payload);

      showToast('Usuário salvo!');
      closeModal();
      await loadData();
      renderUsuarios($('#view-container'));
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

window.deleteUser = async function (id) {
  if (!confirm('ATENÇÃO: Este usuário será excluído permanentemente e perderá acesso ao painel. Deseja continuar?')) return;
  try {
    await apiCall('/api/usuarios/' + id, 'DELETE');
    showToast('Usuário excluído.');
    await loadData();
    renderUsuarios($('#view-container'));
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------- POLLING ----------------
let lastLogsCount = 0;
async function checkNewWebhooks() {
  if (state.currentView !== 'webhook') return; // só dá ping visual se estiver logado
  try {
    const logs = await apiCall('/api/webhook/hotmart/logs');
    if (logs.length > lastLogsCount && lastLogsCount > 0) {
      const ping = $('#webhook-badge-top');
      ping.style.display = 'inline-flex';
      setTimeout(() => { ping.style.display = 'none'; }, 5000);
      showToast('Novo evento de Webhook recebido!');
      if (state.currentView === 'webhook') renderWebhook($('#view-container'));
    }
    lastLogsCount = logs.length;
  } catch (e) { }
}

// Inicializa checando se já tá logado via cookie
initApp();
