// Gestor de Polos & Amigos - Aplicativo Offline-First
// Core do SPA: estado, navegacao, banco e utilitarios compartilhados.

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
    try {
        console.log('Platform: ' + device.platform);
        console.log('OS Version: ' + device.version);
    } catch (e) {
        console.warn('Device plugin indisponivel no contexto atual');
    }

    applyNativeChrome();
    initializeDatabase();
    initializePoloForm();

    const form = document.getElementById('formNovoPolo');
    if (form) {
        form.addEventListener('submit', function(ev) {
            ev.preventDefault();
            inserirNovoPolo();
        });
    }

    document.addEventListener('backbutton', function(ev) {
        ev.preventDefault();
        if (navigationHistory.length > 1) {
            goBack();
        }
    }, false);

    navigateTo('screen-home', { replace: true });
}

function applyNativeChrome() {
    try {
        if (window.StatusBar) {
            StatusBar.styleLightContent();
            StatusBar.backgroundColorByHexString('#0a5ecf');
            StatusBar.overlaysWebView(false);
        }
    } catch (error) {
        console.warn('Nao foi possivel aplicar StatusBar nativa', error);
    }
}

function navigateTo(screenId, opts) {
    opts = opts || {};

    if (!screenId) return;
    if (screenId === currentScreen && !opts.force) return;

    const prevId = currentScreen;
    const prev = document.getElementById(prevId);
    const next = document.getElementById(screenId);

    if (prev) prev.style.display = 'none';

    if (next) {
        next.style.display = '';

        const screenTitle = next.getAttribute('data-title') || 'Gestor de Polos';
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = screenTitle;

        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.style.display = (screenId === 'screen-home') ? 'none' : '';
        }

        if (screenId === 'screen-polos-grid') renderPolos();
        if (screenId === 'screen-polo-detalhes') renderPoloDetails();
        if (screenId === 'screen-cadastro-amigo') initializeAmigoForm();
        if (screenId === 'screen-amigos-list') carregarAmigos();
        if (screenId === 'visitas') {
            initializeVisitForm(selectedVisitPerson);
            renderVisitas();
        }
        if (screenId === 'tarefas') {
            initializeTaskForm(selectedTaskPerson);
            renderTarefas();
        }
        if (screenId === 'screen-home') updateCounts();
    }

    if (!opts.replace) {
        navigationHistory.push(screenId);
    }

    currentScreen = screenId;
}

function goBack() {
    navigationHistory.pop();
    const previous = navigationHistory[navigationHistory.length - 1] || 'screen-home';
    navigateTo(previous, { replace: true });
}

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

let db;

function initializeDatabase() {
    if (window.sqlitePlugin) {
        db = window.sqlitePlugin.openDatabase({ name: 'polos.db', location: 'default' });
    } else if (window.openDatabase) {
        db = openDatabase('polos.db', '1.0', 'Gestor de Polos', 5 * 1024 * 1024);
    } else {
        console.warn('Banco de dados indisponivel neste ambiente');
        return;
    }

    runSql('PRAGMA foreign_keys = ON;')
        .then(function() { return createSchema(); })
        .then(function() { return ensurePoloPhotoColumn(); })
        .then(function() { return ensureAmigoPhotoColumn(); })
        .then(function() { return ensureLastVisitColumns(); })
        .then(function() { return inserirDadosTeste(); })
        .then(function() {
            console.log('Banco de dados inicializado com sucesso');
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

        if (hasFoto) return null;
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

        if (hasFoto) return null;
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

                if (hasColumn) return null;
                return runSql('ALTER TABLE ' + migration[0] + ' ADD COLUMN ' + migration[1] + ' TEXT');
            });
        });
    }, Promise.resolve());
}

function runSql(sql, params) {
    const bindings = params || [];

    return new Promise(function(resolve, reject) {
        if (!db) {
            reject(new Error('Banco nao inicializado'));
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
                nome: 'Maria Silva',
                telefone: '(11) 91234-5678',
                endereco: 'Rua das Flores, 100',
                data_nascimento: '1975-03-15',
                observacoes: 'Líder da rede de contatos'
            },
            {
                nome: 'João Santos',
                telefone: '(11) 99876-5432',
                endereco: 'Avenida Principal, 250',
                data_nascimento: '1980-07-22',
                observacoes: 'Coordenador regional'
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
        }).then(function(idsResult) {
            const poloIds = [];

            for (let index = 0; index < idsResult.rows.length; index += 1) {
                poloIds.push(idsResult.rows.item(index).id);
            }

            if (poloIds.length < 2) {
                throw new Error('Seeder de polos nao retornou IDs suficientes');
            }

            const amigosTeste = [
                { poloIndex: 0, nome: 'Ana Souza', telefone: '(11) 98888-1111', data_nascimento: '1985-05-10', observacoes: 'Amiga de longa data' },
                { poloIndex: 0, nome: 'Bruno Lima', telefone: '(11) 97777-2222', data_nascimento: '1982-08-20', observacoes: 'Colega de trabalho' },
                { poloIndex: 0, nome: 'Carla Mendes', telefone: '(11) 96666-3333', data_nascimento: '1988-11-15', observacoes: 'Vizinha próxima' },
                { poloIndex: 1, nome: 'Diego Alves', telefone: '(11) 95555-4444', data_nascimento: '1979-02-28', observacoes: 'Amigo desde a faculdade' },
                { poloIndex: 1, nome: 'Eva Rocha', telefone: '(11) 94444-5555', data_nascimento: '1986-09-03', observacoes: 'Membro do grupo de vol' }
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
    return String(str).replace(/[&<>"']/g, function(m) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
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

    if (showToast._timer) clearTimeout(showToast._timer);

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

console.log('app core carregado');
