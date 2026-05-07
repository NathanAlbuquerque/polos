// Gestor de Polos & Amigos - Aplicativo Offline-First
// App.js - Controlador principal (SPA)

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('Cordova ready');
    console.log('Platform: ' + device.platform);
    console.log('OS Version: ' + device.version);

    // Inicializar banco de dados SQLite
    initializeDatabase();

    // Ajustes da tela de cadastro
    initializePoloForm();

    // Renderizar dashboard inicial
    showScreen('dashboard');
}

// ===== GERENCIAMENTO DE TELAS (SPA) =====
function showScreen(screenId) {
    // Ocultar todas as telas
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('d-none');
    });

    // Mostrar tela solicitada
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('d-none');

        // Atualizar título da navbar
        const screenTitle = screen.getAttribute('data-title') || 'Gestor de Polos';
        document.getElementById('navbarTitle').textContent = screenTitle;

        // Mostrar/ocultar botão voltar conforme apropriado
        const backBtn = document.getElementById('backBtn');
        backBtn.classList.toggle('d-none', screenId === 'dashboard');
    }
}

function goBack() {
    showScreen('dashboard');
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
