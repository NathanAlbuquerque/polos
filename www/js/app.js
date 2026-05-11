// Gestor de Polos & Amigos - Aplicativo Offline-First
// App.js - Controlador principal (SPA)

document.addEventListener('deviceready', onDeviceReady, false);

let navigationHistory = ['screen-home'];
let currentScreen = 'screen-home';
let amigoListFilterPoloId = null;

function onDeviceReady() {
    console.log('App ready');
    try { console.log('Platform: ' + device.platform); console.log('OS Version: ' + device.version); } catch (e) {}

    applyNativeChrome();

    // Inicializar banco de dados SQLite
    initializeDatabase();

    // Ajustes da tela de cadastro (mascara e flatpickr)
    initializePoloForm();

    // Formulário de novo polo
    const form = document.getElementById('formNovoPolo');
    if (form) {
        form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            inserirNovoPolo();
        });
    }

    // Hardware backbutton (Android)
    document.addEventListener('backbutton', function (ev) {
        ev.preventDefault();
        if (navigationHistory.length > 1) {
            goBack();
        }
    }, false);

    // Mostrar tela inicial
    navigateTo('screen-home', { replace: true });
}

// ===== GERENCIAMENTO DE TELAS (SPA) =====
function navigateTo(screenId, opts) {
    opts = opts || {};

    if (!screenId) return;
    if (screenId === currentScreen && !opts.force) return;

    const prevId = currentScreen;
    const prev = document.getElementById(prevId);
    const next = document.getElementById(screenId);

    // Transição simples
    if (prev) {
        prev.style.display = 'none';
    }

    if (next) {
        next.style.display = '';

        // Atualizar título dinâmico
        const screenTitle = next.getAttribute('data-title') || 'Gestor de Polos';
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = screenTitle;

        // Mostrar/ocultar botão voltar
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.style.display = (screenId === 'screen-home') ? 'none' : '';
        }

        // Carregar dados quando necessário
        if (screenId === 'screen-polos-grid') {
            renderPolos();
        }
        if (screenId === 'screen-polo-detalhes') {
            renderPoloDetails();
        }
        if (screenId === 'screen-cadastro-amigo') {
            initializeAmigoForm();
        }
        if (screenId === 'screen-amigos-list') {
            carregarAmigos();
        }
        if (screenId === 'visitas') {
            renderVisitas();
        }
        if (screenId === 'tarefas') {
            renderTarefas();
        }
        if (screenId === 'screen-home') {
            updateCounts();
        }
    }

    // Histórico de navegação
    if (!opts.replace) {
        navigationHistory.push(screenId);
    }

    currentScreen = screenId;
}

function goBack() {
    // Remover a tela atual do histórico
    navigationHistory.pop();
    const previous = navigationHistory[navigationHistory.length - 1] || 'screen-home';
    navigateTo(previous, { replace: true });
}

// Compatibilidade: adapter para chamadas antigas showScreen('dashboard'|'newVisita'...)
function showScreen(oldId) {
    const map = {
        'dashboard': 'screen-home',
        'polos': 'screen-polos-grid',
        'newPolo': 'screen-cadastro-polo',
        'screen-polo-detalhes': 'screen-polo-detalhes',
        'screen-cadastro-amigo': 'screen-cadastro-amigo',
        'screen-amigos-list': 'screen-amigos-list',
        'newVisita': 'visitas',
        'newTarefa': 'tarefas'
    };
    const target = map[oldId] || oldId;
    navigateTo(target);
}

function MapsTo(screenId, area) {
    if (area === 'POLOS') {
        navigateTo(screenId, { force: true });
        return;
    }

    if (area === 'AMIGOS') {
        navigateTo(screenId, { force: true });
        carregarAmigos();
        return;
    }

    if (area === 'VISITAS') {
        navigateTo(screenId, { force: true });
        renderVisitas();
        return;
    }

    if (area === 'TAREFAS') {
        navigateTo(screenId, { force: true });
        renderTarefas();
        return;
    }

    navigateTo(screenId, { force: true });
}

// ===== BANCO DE DADOS =====
let db;

function initializeDatabase() {
    if (window.sqlitePlugin) {
        db = window.sqlitePlugin.openDatabase({ name: 'polos.db', location: 'default' });
    } else if (window.openDatabase) {
        db = openDatabase('polos.db', '1.0', 'Gestor de Polos', 5 * 1024 * 1024);
    } else {
        console.warn('Banco de dados indisponível neste ambiente');
        return;
    }

    runSql('PRAGMA foreign_keys = ON;')
        .then(function() {
            return createSchema();
        })
        .then(function() {
            return ensurePoloPhotoColumn();
        })
        .then(function() {
            return ensureAmigoPhotoColumn();
        })
        .then(function() {
            return inserirDadosTeste();
        })
        .then(function() {
            console.log('Banco de dados inicializado com sucesso');
            // Atualizar contadores e telas iniciais
            renderPolos();
            atualizarDashboard();
        })
        .catch(function(error) {
            console.error('Erro ao inicializar banco de dados', error);
        });
}

function createSchema() {
    const statements = [
        'CREATE TABLE IF NOT EXISTS polos (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
            'nome TEXT NOT NULL,' +
            'telefone TEXT,' +
            'endereco TEXT,' +
            'data_nascimento TEXT,' +
            'observacoes TEXT,' +
            'foto TEXT,' +
            'criado_em TEXT DEFAULT CURRENT_TIMESTAMP' +
        ')',
        'CREATE TABLE IF NOT EXISTS amigos (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
            'polo_id INTEGER NOT NULL,' +
            'nome TEXT NOT NULL,' +
            'telefone TEXT,' +
            'endereco TEXT,' +
            'data_nascimento TEXT,' +
            'observacoes TEXT,' +
            'foto TEXT,' +
            'criado_em TEXT DEFAULT CURRENT_TIMESTAMP,' +
            'FOREIGN KEY(polo_id) REFERENCES polos(id) ON DELETE CASCADE' +
        ')',
        'CREATE TABLE IF NOT EXISTS visitas (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
            'pessoa_id INTEGER NOT NULL,' +
            'tipo_pessoa TEXT NOT NULL,' +
            'motivo TEXT,' +
            'data_visita TEXT NOT NULL,' +
            'observacoes TEXT,' +
            'criado_em TEXT DEFAULT CURRENT_TIMESTAMP' +
        ')',
        'CREATE TABLE IF NOT EXISTS tarefas (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
            'pessoa_id INTEGER,' +
            'tipo_pessoa TEXT,' +
            'titulo TEXT NOT NULL,' +
            'descricao TEXT,' +
            'data_prazo TEXT,' +
            'status TEXT DEFAULT "Pendente",' +
            'criado_em TEXT DEFAULT CURRENT_TIMESTAMP' +
        ')',
        'CREATE INDEX IF NOT EXISTS idx_amigos_polo_id ON amigos(polo_id)',
        'CREATE INDEX IF NOT EXISTS idx_visitas_data_visita ON visitas(data_visita)'
    ];

    return executeStatements(statements);
}

function ensurePoloPhotoColumn() {
    return runSql('PRAGMA table_info(polos)').then(function(result) {
        let hasFoto = false;

        for (let i = 0; i < result.rows.length; i += 1) {
            const column = result.rows.item(i);
            if (column.name === 'foto') {
                hasFoto = true;
                break;
            }
        }

        if (hasFoto) {
            return null;
        }

        return runSql('ALTER TABLE polos ADD COLUMN foto TEXT');
    });
}

function ensureAmigoPhotoColumn() {
    return runSql('PRAGMA table_info(amigos)').then(function(result) {
        let hasFoto = false;

        for (let i = 0; i < result.rows.length; i += 1) {
            const column = result.rows.item(i);
            if (column.name === 'foto') {
                hasFoto = true;
                break;
            }
        }

        if (hasFoto) {
            return null;
        }

        return runSql('ALTER TABLE amigos ADD COLUMN foto TEXT');
    });
}

function runSql(sql, params) {
    const bindings = params || [];

    return new Promise(function(resolve, reject) {
        if (!db) {
            reject(new Error('Banco não inicializado'));
            return;
        }

        if (typeof db.executeSql === 'function') {
            db.executeSql(sql, bindings, function(result) {
                resolve(result);
            }, function(error) {
                reject(error);
            });
            return;
        }

        db.transaction(function(tx) {
            tx.executeSql(sql, bindings, function(transaction, result) {
                resolve(result);
            }, function(transaction, error) {
                reject(error);
                return false;
            });
        }, function(error) {
            reject(error);
        });
    });
}

function executeStatements(statements) {
    return statements.reduce(function(chain, statement) {
        return chain.then(function() {
            return runSql(statement);
        });
    }, Promise.resolve());
}

function inserirDadosTeste() {
    return runSql('SELECT COUNT(*) AS total FROM polos').then(function(result) {
        const total = result.rows && result.rows.length ? result.rows.item(0).total : 0;

        if (Number(total) > 0) {
            return;
        }

        const polosTeste = [
            {
                nome: 'Polo Central',
                telefone: '(11) 91234-5678',
                endereco: 'Rua Central, 100',
                data_nascimento: '2026-05-06',
                observacoes: 'Polo principal de teste'
            },
            {
                nome: 'Polo Norte',
                telefone: '(11) 99876-5432',
                endereco: 'Avenida Norte, 250',
                data_nascimento: '2026-05-06',
                observacoes: 'Segundo polo de validação'
            }
        ];

        return runSql('INSERT INTO polos (nome, telefone, endereco, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?)', [
            polosTeste[0].nome,
            polosTeste[0].telefone,
            polosTeste[0].endereco,
            polosTeste[0].data_nascimento,
            polosTeste[0].observacoes
        ]).then(function() {
            return runSql('INSERT INTO polos (nome, telefone, endereco, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?)', [
                polosTeste[1].nome,
                polosTeste[1].telefone,
                polosTeste[1].endereco,
                polosTeste[1].data_nascimento,
                polosTeste[1].observacoes
            ]);
        }).then(function() {
            return runSql('SELECT id FROM polos ORDER BY id ASC LIMIT 2');
        }).then(function(result) {
            const poloIds = [];

            for (let index = 0; index < result.rows.length; index += 1) {
                poloIds.push(result.rows.item(index).id);
            }

            const amigosTeste = [
                { poloIndex: 0, nome: 'Ana Souza', telefone: '(11) 98888-1111', data_nascimento: '2026-05-06', observacoes: 'Contato de referência' },
                { poloIndex: 0, nome: 'Bruno Lima', telefone: '(11) 97777-2222', data_nascimento: '2026-05-06', observacoes: 'Primeiro amigo vinculado' },
                { poloIndex: 0, nome: 'Carla Mendes', telefone: '(11) 96666-3333', data_nascimento: '2026-05-06', observacoes: 'Testando relacionamento' },
                { poloIndex: 1, nome: 'Diego Alves', telefone: '(11) 95555-4444', data_nascimento: '2026-05-06', observacoes: 'Amigo do segundo polo' },
                { poloIndex: 1, nome: 'Eva Rocha', telefone: '(11) 94444-5555', data_nascimento: '2026-05-06', observacoes: 'Amigo de validação' }
            ];

            return amigosTeste.reduce(function(chain, amigo) {
                return chain.then(function() {
                    return runSql(
                        'INSERT INTO amigos (polo_id, nome, telefone, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?)',
                        [poloIds[amigo.poloIndex], amigo.nome, amigo.telefone, amigo.data_nascimento, amigo.observacoes]
                    );
                });
            }, Promise.resolve());
        });
    });
}

// Renderização de lista de polos
function renderPolos() {
    const container = document.getElementById('polosGrid');
    if (!container) return;

    showSpinner();

    runSql(
        'SELECT p.id, p.nome, p.telefone, p.endereco, p.data_nascimento, p.foto, COUNT(a.id) AS total_amigos ' +
        'FROM polos p LEFT JOIN amigos a ON p.id = a.polo_id GROUP BY p.id ORDER BY p.nome ASC'
    ).then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            const photoMarkup = renderPoloPhoto(row.nome, row.foto);
            html += '<div class="col-6">';
            html += '<button type="button" class="polo-card w-100 text-start" onclick="verDetalhesPolo(' + row.id + ')">';
            html += '<div class="polo-card-photo">' + photoMarkup + '</div>';
            html += '<div class="polo-card-body">';
            html += '<div class="polo-card-name">' + escapeHtml(row.nome) + '</div>';
            html += '<div class="polo-card-meta">' + escapeHtml(String(row.total_amigos || 0)) + ' amigos</div>';
            html += '</div></button></div>';
        }

        container.innerHTML = html || '<div class="col-12"><p class="text-muted">Nenhum polo cadastrado.</p></div>';
        hideSpinner();
        atualizarDashboard();
    }).catch(function(err) {
        console.error('Erro ao carregar polos', err);
        container.innerHTML = '<div class="col-12"><p class="text-danger">Erro ao carregar polos.</p></div>';
        hideSpinner();
    });
}

function atualizarDashboard() {
    const queries = [
        {
            sql: 'SELECT COUNT(*) AS total FROM polos',
            targetIds: ['dash-polos-count', 'countPolos']
        },
        {
            sql: 'SELECT COUNT(*) AS total FROM amigos',
            targetIds: ['dash-amigos-count', 'countAmigos']
        },
        {
            sql: "SELECT COUNT(*) AS total FROM visitas WHERE data_visita <= date('now')",
            targetIds: ['dash-visitas-count', 'countVisitas']
        },
        {
            sql: "SELECT COUNT(*) AS total FROM tarefas WHERE status = 'Pendente' OR data_prazo > date('now')",
            targetIds: ['dash-alertas-count', 'countTarefas']
        }
    ];

    const formatter = function(result) {
        return (result.rows && result.rows.length) ? result.rows.item(0).total : 0;
    };

    return Promise.all(queries.map(function(query) {
        return runSql(query.sql).then(function(result) {
            const total = formatter(result);
            query.targetIds.forEach(function(targetId) {
                const el = document.getElementById(targetId);
                if (el) el.textContent = total;
            });
            return total;
        }).catch(function(error) {
            console.error('Erro ao atualizar dashboard', query.sql, error);
            query.targetIds.forEach(function(targetId) {
                const el = document.getElementById(targetId);
                if (el) el.textContent = '0';
            });
            return 0;
        });
    })).then(function(values) {
        const hint = document.getElementById('dashboard-hint');
        if (hint) {
            hint.textContent = 'Polos: ' + values[0] + ' | Amigos: ' + values[1] + ' | Visitas realizadas: ' + values[2] + ' | Pendências: ' + values[3];
        }
        return values;
    });
}

function renderPoloPhoto(nome, foto) {
    if (foto) {
        return '<img class="polo-photo-circle" src="' + escapeHtml(foto) + '" alt="Foto de ' + escapeHtml(nome) + '">';
    }

    const initial = escapeHtml((nome || '?').trim().charAt(0).toUpperCase() || '?');
    return '<div class="polo-photo-placeholder" aria-hidden="true">' + initial + '</div>';
}

function verDetalhesPolo(id) {
    if (!id) return;

    const target = document.getElementById('screen-polo-detalhes');
    if (target) {
        target.setAttribute('data-polo-id', String(id));
    }

    navigateTo('screen-polo-detalhes', { force: true });
    renderPoloDetails();
}

function renderPoloDetails() {
    const container = document.getElementById('poloDetalhesContent');
    if (!container) return;

    const screen = document.getElementById('screen-polo-detalhes');
    const poloId = screen ? screen.getAttribute('data-polo-id') : '';

    if (!poloId) {
        container.innerHTML = '<div class="alert alert-warning mb-0">Selecione um Polo primeiro.</div>';
        return;
    }

    showSpinner();

    runSql(
        'SELECT p.id, p.nome, p.telefone, p.endereco, p.data_nascimento, p.observacoes, p.foto, ' +
        '(SELECT COUNT(*) FROM amigos a WHERE a.polo_id = p.id) AS total_amigos, ' +
        '(SELECT v.data_visita FROM visitas v WHERE v.pessoa_id = p.id AND v.tipo_pessoa = "POLOS" ORDER BY v.data_visita DESC, v.id DESC LIMIT 1) AS ultima_visita ' +
        'FROM polos p WHERE p.id = ? LIMIT 1',
        [poloId]
    ).then(function(result) {
        if (!result.rows || !result.rows.length) {
            container.innerHTML = '<div class="alert alert-warning mb-0">Polo não encontrado.</div>';
            hideSpinner();
            return;
        }

        const row = result.rows.item(0);
        const html = [];

        html.push('<div class="polo-detail-hero">');
        html.push('<div class="polo-detail-photo">' + renderPoloPhoto(row.nome, row.foto) + '</div>');
        html.push('<div class="polo-detail-copy">');
        html.push('<div class="polo-detail-name">' + escapeHtml(row.nome) + '</div>');
        html.push('<div class="polo-detail-meta">' + escapeHtml(String(row.total_amigos || 0)) + ' amigos vinculados</div>');
        html.push('</div></div>');

        html.push('<div class="detail-panel">');
        html.push('<div class="detail-row"><span class="detail-label">Telefone</span><span class="detail-value">' + escapeHtml(row.telefone || 'Não informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Endereço</span><span class="detail-value">' + escapeHtml(row.endereco || 'Não informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Última Visita</span><span class="detail-value">' + escapeHtml(row.ultima_visita || 'Sem registros') + '</span></div>');
        if (row.observacoes) {
            html.push('<div class="detail-row detail-row-stack"><span class="detail-label">Observações</span><span class="detail-value">' + escapeHtml(row.observacoes) + '</span></div>');
        }
        html.push('</div>');

        html.push('<button type="button" class="btn btn-primary w-100 mb-2" onclick="carregarAmigos(' + row.id + ')">Listar Amigos</button>');
        html.push('<button type="button" class="btn btn-outline-primary w-100 mb-2" onclick="abrirCadastroAmigo(' + row.id + ')">Adicionar Amigo</button>');
        html.push('<button type="button" class="btn btn-outline-secondary w-100" onclick="navigateTo(\'screen-polos-grid\')">Voltar para Polos</button>');

        container.innerHTML = html.join('');
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar detalhes do polo', err);
        container.innerHTML = '<div class="alert alert-danger mb-0">Erro ao carregar detalhes do polo.</div>';
        hideSpinner();
    });
}

function updateCounts() {
    return atualizarDashboard();
}

function renderAmigos() {
    return carregarAmigos();
}

function carregarAmigos(poloId) {
    const container = document.getElementById('amigosList');
    if (!container) return Promise.resolve();

    amigoListFilterPoloId = poloId || null;

    const subtitle = document.getElementById('amigosListSubtitle');
    if (subtitle) {
        subtitle.textContent = poloId ? 'Amigos filtrados pelo Polo selecionado.' : 'Lista geral de contatos vinculados aos polos.';
    }

    showSpinner();

    const query = poloId
        ? {
            sql: 'SELECT a.*, p.nome AS nome_polo FROM amigos a JOIN polos p ON a.polo_id = p.id WHERE a.polo_id = ? ORDER BY a.nome ASC',
            params: [poloId]
        }
        : {
            sql: 'SELECT a.*, p.nome AS nome_polo FROM amigos a JOIN polos p ON a.polo_id = p.id ORDER BY a.nome ASC',
            params: []
        };

    return runSql(query.sql, query.params).then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            html += '<div class="friend-list-item">';
            html += '<div class="friend-list-main">';
            html += '<div class="friend-name">' + escapeHtml(row.nome) + '</div>';
            html += '<div class="friend-meta">Apresentado por: ' + escapeHtml(row.nome_polo || 'Sem vínculo') + '</div>';
            if (row.telefone) {
                html += '<div class="friend-secondary">' + escapeHtml(row.telefone) + '</div>';
            }
            html += '</div>';
            html += '<div class="friend-actions">';
            html += '<button type="button" class="btn btn-sm btn-outline-primary" onclick="abrirCadastroAmigo(' + row.polo_id + ')">Novo</button>';
            html += '<button type="button" class="btn btn-sm btn-outline-danger" data-nome="' + escapeHtml(row.nome).replace(/"/g, '&quot;') + '" onclick="removerAmigo(' + row.id + ', this.dataset.nome)">Excluir</button>';
            html += '</div></div>';
        }

        container.innerHTML = html || '<div class="friend-list-item text-muted">Nenhum amigo cadastrado.</div>';
        hideSpinner();
        return result;
    }).catch(function(err) {
        console.error('Erro ao carregar amigos', err);
        container.innerHTML = '<div class="friend-list-item text-danger">Erro ao carregar amigos.</div>';
        hideSpinner();
        return null;
    });
}

function carregarPolosSelect(selectedPoloId) {
    const select = document.getElementById('amigoPolo');
    if (!select) return Promise.resolve();

    return runSql('SELECT id, nome FROM polos ORDER BY nome ASC').then(function(result) {
        let options = '<option value="">Selecione o Polo</option>';

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            const selected = String(row.id) === String(selectedPoloId) ? ' selected' : '';
            options += '<option value="' + row.id + '"' + selected + '>' + escapeHtml(row.nome) + '</option>';
        }

        select.innerHTML = options;
        if (selectedPoloId) {
            select.value = String(selectedPoloId);
        }
        return result;
    });
}

function initializeAmigoForm(selectedPoloId) {
    carregarPolosSelect(selectedPoloId);

    const form = document.getElementById('formNovoAmigo');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', function(ev) {
            ev.preventDefault();
            salvarNovoAmigo();
        });
    }

    const dataInput = document.getElementById('amigoData');
    if (dataInput && typeof flatpickr === 'function' && !dataInput.dataset.flatpickrReady) {
        dataInput.dataset.flatpickrReady = 'true';
        flatpickr(dataInput, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            maxDate: 'today'
        });
    }
}

function abrirCadastroAmigo(poloId) {
    navigateTo('screen-cadastro-amigo', { force: true });
    initializeAmigoForm(poloId);
}

function salvarNovoAmigo() {
    const poloId = (document.getElementById('amigoPolo') || {}).value || '';
    const nome = (document.getElementById('amigoNome') || {}).value || '';
    const telefone = (document.getElementById('amigoTelefone') || {}).value || '';
    const endereco = (document.getElementById('amigoEndereco') || {}).value || '';
    const data_nascimento = (document.getElementById('amigoData') || {}).value || '';
    const observacoes = (document.getElementById('amigoObs') || {}).value || '';

    if (!poloId) {
        alert('Selecione o Polo de Origem');
        return;
    }

    if (!nome.trim()) {
        alert('Nome do amigo é obrigatório');
        return;
    }

    runSql('INSERT INTO amigos (polo_id, nome, telefone, endereco, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?, ?)', [poloId, nome, telefone, endereco, data_nascimento, observacoes])
        .then(function() {
            const form = document.getElementById('formNovoAmigo');
            if (form) form.reset();
            navigateTo('screen-amigos-list', { force: true });
            carregarAmigos(poloId);
            atualizarDashboard();
        })
        .catch(function(err) {
            console.error('Erro ao inserir amigo', err);
            alert('Erro ao salvar amigo');
        });
}

function removerAmigo(amigoId, nomeAmigo) {
    if (!amigoId) return;

    const confirmation = confirm('Deseja remover ' + nomeAmigo + '? As visitas e tarefas vinculadas também serão removidas.');
    if (!confirmation) {
        return;
    }

    runSql('DELETE FROM visitas WHERE pessoa_id = ? AND tipo_pessoa = "AMIGOS"', [amigoId])
        .then(function() {
            return runSql('DELETE FROM tarefas WHERE pessoa_id = ? AND tipo_pessoa = "AMIGOS"', [amigoId]);
        })
        .then(function() {
            return runSql('DELETE FROM amigos WHERE id = ?', [amigoId]);
        })
        .then(function() {
            carregarAmigos(amigoListFilterPoloId);
            atualizarDashboard();
        })
        .catch(function(err) {
            console.error('Erro ao remover amigo', err);
            alert('Erro ao remover amigo');
        });
}

function renderVisitas() {
    const container = document.getElementById('visitasList');
    if (!container) return;

    showSpinner();

    runSql('SELECT id, tipo_pessoa, motivo, data_visita, observacoes FROM visitas ORDER BY data_visita DESC, id DESC').then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            html += '<div class="list-group-item">';
            html += '<div class="fw-semibold">' + escapeHtml(row.motivo || 'Visita sem título') + '</div>';
            html += '<div class="small text-muted">' + escapeHtml(row.tipo_pessoa || '') + ' · ' + escapeHtml(row.data_visita || '') + '</div>';
            if (row.observacoes) html += '<div class="small text-muted">' + escapeHtml(row.observacoes) + '</div>';
            html += '</div>';
        }

        container.innerHTML = html || '<div class="list-group-item text-muted">Nenhuma visita registrada.</div>';
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar visitas', err);
        container.innerHTML = '<div class="list-group-item text-danger">Erro ao carregar visitas.</div>';
        hideSpinner();
    });
}

function renderTarefas() {
    const container = document.getElementById('tarefasList');
    if (!container) return;

    showSpinner();

    runSql('SELECT id, titulo, descricao, data_prazo, status FROM tarefas ORDER BY CASE WHEN status = "Pendente" THEN 0 ELSE 1 END, data_prazo ASC, id DESC').then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            const isPending = String(row.status || '').toLowerCase() === 'pendente';
            html += '<div class="list-group-item">';
            html += '<div class="d-flex justify-content-between align-items-start gap-2">';
            html += '<div>';
            html += '<div class="fw-semibold">' + escapeHtml(row.titulo || 'Tarefa sem título') + '</div>';
            if (row.descricao) html += '<div class="small text-muted">' + escapeHtml(row.descricao) + '</div>';
            html += '</div>';
            html += '<span class="badge ' + (isPending ? 'text-bg-danger' : 'text-bg-success') + '">' + escapeHtml(row.status || 'Pendente') + '</span>';
            html += '</div>';
            if (row.data_prazo) html += '<div class="small text-muted mt-1">Prazo: ' + escapeHtml(row.data_prazo) + '</div>';
            html += '</div>';
        }

        container.innerHTML = html || '<div class="list-group-item text-muted">Nenhuma tarefa cadastrada.</div>';
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar tarefas', err);
        container.innerHTML = '<div class="list-group-item text-danger">Erro ao carregar tarefas.</div>';
        hideSpinner();
    });
}

function applyNativeChrome() {
    if (window.StatusBar) {
        StatusBar.backgroundColorByHexString('#0a5ecf');
    }
}

function showSpinner() {
    const s = document.getElementById('loadingSpinner');
    if (s) s.style.display = '';
}

function hideSpinner() {
    const s = document.getElementById('loadingSpinner');
    if (s) s.style.display = 'none';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

function inserirNovoPolo() {
    const nome = (document.getElementById('poloNome') || {}).value || '';
    const telefone = (document.getElementById('poloTelefone') || {}).value || '';
    const endereco = (document.getElementById('poloEndereco') || {}).value || '';
    const data_nascimento = (document.getElementById('poloData') || {}).value || '';
    const observacoes = (document.getElementById('poloObs') || {}).value || '';
    const foto = (document.getElementById('poloFoto') || {}).value || '';

    if (!nome.trim()) {
        alert('Nome do polo é obrigatório');
        return;
    }

    runSql('INSERT INTO polos (nome, telefone, endereco, data_nascimento, observacoes, foto) VALUES (?, ?, ?, ?, ?, ?)', [nome, telefone, endereco, data_nascimento, observacoes, foto])
        .then(function() {
            // limpar form
            const form = document.getElementById('formNovoPolo');
            if (form) form.reset();
            // navegar para lista de polos e recarregar
            navigateTo('screen-polos-grid');
            renderPolos();
        })
        .catch(function(err) {
            console.error('Erro ao inserir polo', err);
            alert('Erro ao salvar polo');
        });
}

// ===== HELPERS =====
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

function initializePoloForm() {
    const telefoneInput = document.getElementById('poloTelefone');
    const dataInput = document.getElementById('poloData');

    if (telefoneInput) {
        telefoneInput.addEventListener('input', formatPhoneInput);
    }

    if (dataInput && typeof flatpickr === 'function') {
        flatpickr(dataInput, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            maxDate: 'today'
        });
    }
}

function formatPhoneInput(event) {
    const input = event.target;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);

    if (!digits.length) {
        input.value = '';
        return;
    }

    if (digits.length <= 10) {
        input.value = digits.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, function(_, ddd, prefixo, sufixo) {
            return '(' + ddd + ') ' + prefixo + (sufixo ? '-' + sufixo : '');
        });
        return;
    }

    input.value = digits.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, function(_, ddd, prefixo, sufixo) {
        return '(' + ddd + ') ' + prefixo + (sufixo ? '-' + sufixo : '');
    });
}

console.log('app.js carregado');
