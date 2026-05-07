// Gestor de Polos & Amigos - Aplicativo Offline-First
// App.js - Controlador principal (SPA)

document.addEventListener('deviceready', onDeviceReady, false);

let navigationHistory = ['screen-home'];
let currentScreen = 'screen-home';

function onDeviceReady() {
    console.log('Cordova ready');
    try { console.log('Platform: ' + device.platform); console.log('OS Version: ' + device.version); } catch (e) {}

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
        'newVisita': 'visitas',
        'newTarefa': 'tarefas'
    };
    const target = map[oldId] || oldId;
    navigateTo(target);
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
            return inserirDadosTeste();
        })
        .then(function() {
            console.log('Banco de dados inicializado com sucesso');
            // Atualizar contadores e telas iniciais
            renderPolos();
            updateCounts();
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
            'foto_url TEXT,' +
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
            'foto_url TEXT,' +
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

    runSql('SELECT id, nome, telefone, endereco, data_nascimento FROM polos ORDER BY id DESC').then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            html += '<div class="col-12 col-md-6">';
            html += '<div class="card" style="cursor:pointer;" onclick="navigateTo(\'screen-amigos-list\');">';
            html += '<div class="card-body">';
            html += '<h5 class="card-title">' + escapeHtml(row.nome) + '</h5>';
            if (row.telefone) html += '<p class="card-text small text-muted">' + escapeHtml(row.telefone) + '</p>';
            html += '</div></div></div>';
        }

        container.innerHTML = html || '<div class="col-12"><p class="text-muted">Nenhum polo cadastrado.</p></div>';
        hideSpinner();
        updateCounts();
    }).catch(function(err) {
        console.error('Erro ao carregar polos', err);
        container.innerHTML = '<div class="col-12"><p class="text-danger">Erro ao carregar polos.</p></div>';
        hideSpinner();
    });
}

function updateCounts() {
    runSql('SELECT COUNT(*) AS total FROM polos').then(function(res) {
        const total = (res.rows && res.rows.length) ? res.rows.item(0).total : 0;
        const el = document.getElementById('countPolos');
        if (el) el.textContent = total;
    });

    runSql('SELECT COUNT(*) AS total FROM amigos').then(function(res) {
        const total = (res.rows && res.rows.length) ? res.rows.item(0).total : 0;
        const el = document.getElementById('countAmigos');
        if (el) el.textContent = total;
    });

    runSql('SELECT COUNT(*) AS total FROM visitas').then(function(res) {
        const total = (res.rows && res.rows.length) ? res.rows.item(0).total : 0;
        const el = document.getElementById('countVisitas');
        if (el) el.textContent = total;
    });

    runSql('SELECT COUNT(*) AS total FROM tarefas').then(function(res) {
        const total = (res.rows && res.rows.length) ? res.rows.item(0).total : 0;
        const el = document.getElementById('countTarefas');
        if (el) el.textContent = total;
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

    if (!nome.trim()) {
        alert('Nome do polo é obrigatório');
        return;
    }

    runSql('INSERT INTO polos (nome, telefone, endereco, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?)', [nome, telefone, endereco, data_nascimento, observacoes])
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
