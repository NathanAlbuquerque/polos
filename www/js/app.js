// Gestor de Polos & Amigos - Aplicativo Offline-First
// App.js - Controlador principal (SPA)

document.addEventListener('deviceready', onDeviceReady, false);

let navigationHistory = ['screen-home'];
let currentScreen = 'screen-home';
let amigoListFilterPoloId = null;
let selectedVisitPerson = null;
let selectedTaskPerson = null;
let selectedVisitId = null;
let taskPrefill = null;

const FLATPICKR_PT_BR = {
    weekdays: {
        shorthand: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'],
        longhand: ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado']
    },
    months: {
        shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        longhand: ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    },
    firstDayOfWeek: 1,
    rangeSeparator: ' a ',
    time_24hr: true
};

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
            initializeVisitForm(selectedVisitPerson);
            renderVisitas();
        }
        if (screenId === 'tarefas') {
            initializeTaskForm(selectedTaskPerson);
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
        'screen-visita-detalhes': 'screen-visita-detalhes',
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
        selectedVisitPerson = null;
        navigateTo(screenId, { force: true });
        initializeVisitForm();
        renderVisitas();
        return;
    }

    if (area === 'TAREFAS') {
        selectedTaskPerson = null;
        taskPrefill = null;
        navigateTo(screenId, { force: true });
        initializeTaskForm();
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
            return ensureLastVisitColumns();
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
            'ultima_visita TEXT,' +
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
            'ultima_visita TEXT,' +
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

function ensureLastVisitColumns() {
    const migrations = [
        ['polos', 'ultima_visita'],
        ['amigos', 'ultima_visita']
    ];

    return migrations.reduce(function(chain, migration) {
        return chain.then(function() {
            return runSql('PRAGMA table_info(' + migration[0] + ')').then(function(result) {
                let hasColumn = false;

                for (let i = 0; i < result.rows.length; i += 1) {
                    const column = result.rows.item(i);
                    if (column.name === migration[1]) {
                        hasColumn = true;
                        break;
                    }
                }

                if (hasColumn) {
                    return null;
                }

                return runSql('ALTER TABLE ' + migration[0] + ' ADD COLUMN ' + migration[1] + ' TEXT');
            });
        });
    }, Promise.resolve());
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
            sql: "SELECT COUNT(*) AS total FROM visitas WHERE data_visita > date('now')",
            targetIds: ['dash-visitas-pendentes-count']
        },
        {
            sql: "SELECT COUNT(*) AS total FROM tarefas WHERE status = 'Pendente'",
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
            hint.textContent = 'Polos: ' + values[0] + ' | Amigos: ' + values[1] + ' | Visitas realizadas: ' + values[2] + ' | Visitas pendentes: ' + values[3] + ' | Tarefas pendentes: ' + values[4];
        }
        return values;
    });
}

function renderPoloPhoto(nome, foto) {
    if (foto) {
        return '<img class="polo-photo-circle" src="' + escapeHtml(foto) + '" alt="Foto de ' + escapeHtml(nome) + '" loading="lazy" decoding="async">';
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
        'p.ultima_visita AS ultima_visita ' +
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

        html.push('<button type="button" class="btn btn-primary w-100 mb-2" onclick="abrirAmigosDoPolo(' + row.id + ')">Listar Amigos</button>');
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
            locale: FLATPICKR_PT_BR,
            position: 'auto bottom',
            maxDate: 'today'
        });
    }
}

function abrirCadastroAmigo(poloId) {
    navigateTo('screen-cadastro-amigo', { force: true });
    initializeAmigoForm(poloId);
}

function abrirAmigosDoPolo(poloId) {
    amigoListFilterPoloId = poloId || null;
    navigateTo('screen-amigos-list', { force: true });
    carregarAmigos(poloId);
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
            showToast('Salvo com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao inserir amigo', err);
            showFriendlyError('salvar-amigo');
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
            showToast('Amigo removido com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao remover amigo', err);
            showFriendlyError('remover-amigo');
        });
}

function carregarPessoasVisitadas(selectId, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return Promise.resolve();

    return runSql(
        'SELECT "POLOS" AS tipo, id, nome FROM polos ' +
        'UNION ALL ' +
        'SELECT "AMIGOS" AS tipo, id, nome FROM amigos ' +
        'ORDER BY nome ASC'
    ).then(function(result) {
        let options = '<option value="">Selecione a pessoa</option>';

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            const value = row.tipo + ':' + row.id;
            const selected = String(value) === String(selectedValue) ? ' selected' : '';
            options += '<option value="' + value + '"' + selected + '>' + escapeHtml(row.nome) + ' (' + escapeHtml(row.tipo === 'POLOS' ? 'Polo' : 'Amigo') + ')</option>';
        }

        select.innerHTML = options;
        if (selectedValue) {
            select.value = String(selectedValue);
        }
        return result;
    });
}

function initializeVisitForm(selectedValue) {
    carregarPessoasVisitadas('visitaPessoa', selectedValue || selectedVisitPerson);

    const form = document.getElementById('formNovoVisita');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', function(ev) {
            ev.preventDefault();
            salvarNovaVisita();
        });
    }

    const dataInput = document.getElementById('visitaData');
    if (dataInput && typeof flatpickr === 'function' && !dataInput.dataset.flatpickrReady) {
        dataInput.dataset.flatpickrReady = 'true';
        flatpickr(dataInput, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            locale: FLATPICKR_PT_BR,
            position: 'auto bottom',
            maxDate: 'today'
        });
    }
}

function salvarNovaVisita() {
    const pessoa = (document.getElementById('visitaPessoa') || {}).value || '';
    const motivo = (document.getElementById('visitaMotivo') || {}).value || '';
    const data_visita = (document.getElementById('visitaData') || {}).value || '';
    const observacoes = (document.getElementById('visitaObs') || {}).value || '';

    if (!pessoa) {
        alert('Selecione a pessoa visitada');
        return;
    }

    if (!data_visita) {
        alert('Selecione a data da visita');
        return;
    }

    const parts = String(pessoa).split(':');
    const tipo_pessoa = parts[0] || '';
    const pessoa_id = parts[1] || '';

    runSql('INSERT INTO visitas (pessoa_id, tipo_pessoa, motivo, data_visita, observacoes) VALUES (?, ?, ?, ?, ?)', [pessoa_id, tipo_pessoa, motivo, data_visita, observacoes])
        .then(function() {
            return atualizarUltimaVisita(tipo_pessoa, pessoa_id, data_visita);
        })
        .then(function() {
            const form = document.getElementById('formNovoVisita');
            if (form) form.reset();
            selectedVisitPerson = null;
            navigateTo('visitas', { force: true });
            atualizarDashboard();
            showToast('Salvo com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao salvar visita', err);
            showFriendlyError('salvar-visita');
        });
}

function atualizarUltimaVisita(tipoPessoa, pessoaId, dataVisita) {
    if (String(tipoPessoa) === 'POLOS') {
        return runSql('UPDATE polos SET ultima_visita = ? WHERE id = ?', [dataVisita, pessoaId]);
    }

    if (String(tipoPessoa) === 'AMIGOS') {
        return runSql('UPDATE amigos SET ultima_visita = ? WHERE id = ?', [dataVisita, pessoaId]);
    }

    return Promise.resolve();
}

function renderVisitas() {
    const container = document.getElementById('visitasList');
    if (!container) return;

    showSpinner();

    runSql(
        'SELECT v.id, v.tipo_pessoa, v.pessoa_id, v.motivo, v.data_visita, v.observacoes, COALESCE(p.nome, a.nome) AS pessoa_nome ' +
        'FROM visitas v ' +
        'LEFT JOIN polos p ON v.tipo_pessoa = "POLOS" AND p.id = v.pessoa_id ' +
        'LEFT JOIN amigos a ON v.tipo_pessoa = "AMIGOS" AND a.id = v.pessoa_id ' +
        'ORDER BY v.data_visita DESC, v.id DESC'
    ).then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            html += '<div class="list-group-item visit-card mb-2" role="button" onclick="verDetalhesVisita(' + row.id + ')">';
            html += '<div class="d-flex justify-content-between align-items-start gap-2">';
            html += '<div class="flex-grow-1">';
            html += '<div class="fw-semibold">' + escapeHtml(row.motivo || 'Visita sem título') + '</div>';
            html += '<div class="small text-muted">Pessoa: ' + escapeHtml(row.pessoa_nome || 'Sem vínculo') + '</div>';
            html += '<div class="small text-muted">' + escapeHtml(row.tipo_pessoa || '') + ' · ' + escapeHtml(row.data_visita || '') + '</div>';
            if (row.observacoes) html += '<div class="small text-muted mt-1">' + escapeHtml(row.observacoes) + '</div>';
            html += '</div>';
            html += '<span class="badge text-bg-primary align-self-start">Detalhes</span>';
            html += '</div>';
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

function verDetalhesVisita(visitaId) {
    if (!visitaId) return;

    selectedVisitId = visitaId;
    navigateTo('screen-visita-detalhes', { force: true });
    renderVisitaDetalhes(visitaId);
}

function renderVisitaDetalhes(visitaId) {
    const container = document.getElementById('visitaDetalhesContent');
    if (!container) return;

    showSpinner();

    runSql(
        'SELECT v.id, v.tipo_pessoa, v.pessoa_id, v.motivo, v.data_visita, v.observacoes, COALESCE(p.nome, a.nome) AS pessoa_nome, ' +
        'COALESCE(p.ultima_visita, a.ultima_visita) AS ultima_visita ' +
        'FROM visitas v ' +
        'LEFT JOIN polos p ON v.tipo_pessoa = "POLOS" AND p.id = v.pessoa_id ' +
        'LEFT JOIN amigos a ON v.tipo_pessoa = "AMIGOS" AND a.id = v.pessoa_id ' +
        'WHERE v.id = ? LIMIT 1',
        [visitaId]
    ).then(function(result) {
        if (!result.rows || !result.rows.length) {
            container.innerHTML = '<div class="alert alert-warning mb-0">Visita não encontrada.</div>';
            hideSpinner();
            return;
        }

        const row = result.rows.item(0);
        const html = [];

        html.push('<div class="detail-panel">');
        html.push('<div class="detail-row"><span class="detail-label">Pessoa</span><span class="detail-value">' + escapeHtml(row.pessoa_nome || 'Sem vínculo') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Tipo</span><span class="detail-value">' + escapeHtml(row.tipo_pessoa || '') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Data</span><span class="detail-value">' + escapeHtml(row.data_visita || '') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Última Visita</span><span class="detail-value">' + escapeHtml(row.ultima_visita || row.data_visita || 'Sem registros') + '</span></div>');
        html.push('</div>');

        if (row.motivo) {
            html.push('<div class="detail-panel mb-3"><div class="detail-row detail-row-stack"><span class="detail-label">Motivo</span><span class="detail-value">' + escapeHtml(row.motivo) + '</span></div></div>');
        }

        if (row.observacoes) {
            html.push('<div class="detail-panel mb-3"><div class="detail-row detail-row-stack"><span class="detail-label">Observações</span><span class="detail-value">' + escapeHtml(row.observacoes) + '</span></div></div>');
        }

        html.push('<button type="button" class="btn btn-info w-100 mb-2" onclick="abrirTarefaDaVisita(' + row.id + ')">Criar Tarefa</button>');
        html.push('<button type="button" class="btn btn-outline-secondary w-100" onclick="navigateTo(\'visitas\')">Voltar</button>');

        container.innerHTML = html.join('');
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar detalhes da visita', err);
        container.innerHTML = '<div class="alert alert-danger mb-0">Erro ao carregar detalhes da visita.</div>';
        hideSpinner();
    });
}

function abrirTarefaDaVisita(visitaId) {
    if (!visitaId) return;

    runSql(
        'SELECT v.id, v.tipo_pessoa, v.pessoa_id, v.motivo, v.data_visita, v.observacoes, COALESCE(p.nome, a.nome) AS pessoa_nome ' +
        'FROM visitas v ' +
        'LEFT JOIN polos p ON v.tipo_pessoa = "POLOS" AND p.id = v.pessoa_id ' +
        'LEFT JOIN amigos a ON v.tipo_pessoa = "AMIGOS" AND a.id = v.pessoa_id ' +
        'WHERE v.id = ? LIMIT 1',
        [visitaId]
    ).then(function(result) {
        if (!result.rows || !result.rows.length) return;

        const row = result.rows.item(0);
        selectedTaskPerson = row.tipo_pessoa + ':' + row.pessoa_id;
        taskPrefill = {
            titulo: 'Tarefa gerada a partir da visita',
            descricao: 'Tarefa gerada a partir da visita do dia ' + (row.data_visita || '') + (row.motivo ? '. Motivo: ' + row.motivo : ''),
            data_prazo: '',
            pessoa: selectedTaskPerson
        };

        navigateTo('tarefas', { force: true });
    });
}

function initializeTaskForm(selectedValue, prefill) {
    prefill = prefill || taskPrefill;
    carregarPessoasVisitadas('tarefaPessoa', selectedValue || selectedTaskPerson);

    const form = document.getElementById('formNovoTarefa');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', function(ev) {
            ev.preventDefault();
            salvarNovaTarefa();
        });
    }

    const prazoInput = document.getElementById('tarefaPrazo');
    if (prazoInput && typeof flatpickr === 'function' && !prazoInput.dataset.flatpickrReady) {
        prazoInput.dataset.flatpickrReady = 'true';
        flatpickr(prazoInput, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            locale: FLATPICKR_PT_BR,
            position: 'auto bottom',
            minDate: 'today'
        });
    }

    if (prefill) {
        const titleInput = document.getElementById('tarefaTitulo');
        const descriptionInput = document.getElementById('tarefaDescricao');
        if (titleInput && prefill.titulo) titleInput.value = prefill.titulo;
        if (descriptionInput && prefill.descricao) descriptionInput.value = prefill.descricao;
        if (selectedValue) {
            const select = document.getElementById('tarefaPessoa');
            if (select) select.value = selectedValue;
        }
    }
}

function salvarNovaTarefa() {
    const pessoa = (document.getElementById('tarefaPessoa') || {}).value || '';
    const titulo = (document.getElementById('tarefaTitulo') || {}).value || '';
    const descricao = (document.getElementById('tarefaDescricao') || {}).value || '';
    const data_prazo = (document.getElementById('tarefaPrazo') || {}).value || '';

    if (!pessoa) {
        alert('Selecione a pessoa envolvida');
        return;
    }

    if (!titulo.trim()) {
        alert('Título da tarefa é obrigatório');
        return;
    }

    if (!data_prazo) {
        alert('Selecione o prazo da tarefa');
        return;
    }

    const parts = String(pessoa).split(':');
    const tipo_pessoa = parts[0] || '';
    const pessoa_id = parts[1] || '';

    runSql('INSERT INTO tarefas (pessoa_id, tipo_pessoa, titulo, descricao, data_prazo, status) VALUES (?, ?, ?, ?, ?, ?)', [pessoa_id, tipo_pessoa, titulo, descricao, data_prazo, 'Pendente'])
        .then(function() {
            const form = document.getElementById('formNovoTarefa');
            if (form) form.reset();
            selectedTaskPerson = null;
            taskPrefill = null;
            navigateTo('tarefas', { force: true });
            atualizarDashboard();
            showToast('Salvo com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao salvar tarefa', err);
            showFriendlyError('salvar-tarefa');
        });
}

function concluirTarefa(tarefaId) {
    if (!tarefaId) return;

    runSql('UPDATE tarefas SET status = ? WHERE id = ?', ['Concluído', tarefaId])
        .then(function() {
            renderTarefas();
            atualizarDashboard();
            showToast('Tarefa concluida com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao concluir tarefa', err);
            showFriendlyError('concluir-tarefa');
        });
}

function renderTarefas() {
    const container = document.getElementById('tarefasList');
    if (!container) return;

    showSpinner();

    runSql(
        'SELECT id, pessoa_id, tipo_pessoa, titulo, descricao, data_prazo, status ' +
        'FROM tarefas ORDER BY CASE WHEN status = "Pendente" THEN 0 ELSE 1 END, data_prazo ASC, id DESC'
    ).then(function(result) {
        let html = '';
        const today = getCurrentDate();

        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            const isPending = String(row.status || '').toLowerCase() === 'pendente';
            const isOverdue = isPending && row.data_prazo && row.data_prazo < today;
            const cardClass = 'task-card ' + (isPending ? 'is-pending' : 'is-completed') + (isOverdue ? ' is-overdue' : '');

            html += '<div class="list-group-item ' + cardClass + ' mb-2">';
            html += '<div class="d-flex justify-content-between align-items-start gap-2">';
            html += '<div class="flex-grow-1">';
            html += '<div class="fw-semibold">' + escapeHtml(row.titulo || 'Tarefa sem título') + '</div>';
            if (row.descricao) html += '<div class="small text-muted">' + escapeHtml(row.descricao) + '</div>';
            html += '<div class="small text-muted">Prazo: ' + escapeHtml(row.data_prazo || 'Sem prazo') + '</div>';
            html += '</div>';
            html += '<div class="d-flex flex-column align-items-end gap-2">';
            html += '<span class="badge ' + (isPending ? (isOverdue ? 'text-bg-danger' : 'text-bg-warning') : 'text-bg-success') + '">' + escapeHtml(row.status || 'Pendente') + '</span>';
            if (isPending) {
                html += '<button type="button" class="btn btn-sm btn-outline-success task-action" onclick="concluirTarefa(' + row.id + ')">✓</button>';
            }
            html += '</div></div></div>';
        }

        container.innerHTML = html || '<div class="list-group-item text-muted">Nenhuma tarefa cadastrada.</div>';
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar tarefas', err);
        container.innerHTML = '<div class="list-group-item text-danger">Erro ao carregar tarefas.</div>';
        hideSpinner();
    });
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
            showToast('Salvo com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao inserir polo', err);
            showFriendlyError('salvar-polo');
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
            locale: FLATPICKR_PT_BR,
            position: 'auto bottom',
            maxDate: 'today'
        });
    }
}

function showFriendlyError(context) {
    const messages = {
        'salvar-polo': 'Ops, nao conseguimos salvar o Polo agora. Verifique o espaco no celular e tente novamente.',
        'salvar-amigo': 'Ops, nao conseguimos salvar o Amigo agora. Verifique os dados e tente novamente.',
        'salvar-visita': 'Ops, nao conseguimos salvar a Visita agora. Tente novamente em instantes.',
        'salvar-tarefa': 'Ops, nao conseguimos salvar a Tarefa agora. Tente novamente em instantes.',
        'concluir-tarefa': 'Ops, nao conseguimos concluir a tarefa agora. Tente novamente.',
        'remover-amigo': 'Ops, nao conseguimos remover o Amigo agora. Tente novamente em instantes.'
    };

    alert(messages[context] || 'Ops, ocorreu um erro inesperado.');
}

function showToast(message) {
    const toast = document.getElementById('appToast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (showToast._timer) {
        clearTimeout(showToast._timer);
    }

    showToast._timer = setTimeout(function() {
        toast.classList.remove('show');
    }, 2200);
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
