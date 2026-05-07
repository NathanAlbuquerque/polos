// Gestor de Polos & Amigos - Aplicativo Offline-First
// App.js - Controlador principal (SPA)

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('Cordova ready');
    console.log('Platform: ' + device.platform);
    console.log('OS Version: ' + device.version);

    // Inicializar banco de dados SQLite
    initializeDatabase();

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
    if (window.openDatabase) {
        // Usar WebSQL (compatível com Cordova SQLite)
        db = openDatabase('polos.db', '1.0', 'Gestor de Polos', 5 * 1024 * 1024);

        db.transaction(function(tx) {
            // Tabela: Polos
            tx.executeSql('CREATE TABLE IF NOT EXISTS polos (' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                'nome TEXT NOT NULL,' +
                'telefone TEXT,' +
                'endereco TEXT,' +
                'data_nascimento TEXT,' +
                'observacoes TEXT,' +
                'foto_url TEXT,' +
                'criado_em TEXT DEFAULT CURRENT_TIMESTAMP' +
                ')'
            );

            // Tabela: Amigos
            tx.executeSql('CREATE TABLE IF NOT EXISTS amigos (' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                'polo_id INTEGER NOT NULL,' +
                'nome TEXT NOT NULL,' +
                'telefone TEXT,' +
                'endereco TEXT,' +
                'data_nascimento TEXT,' +
                'observacoes TEXT,' +
                'foto_url TEXT,' +
                'criado_em TEXT DEFAULT CURRENT_TIMESTAMP,' +
                'FOREIGN KEY(polo_id) REFERENCES polos(id)' +
                ')'
            );

            // Tabela: Visitas
            tx.executeSql('CREATE TABLE IF NOT EXISTS visitas (' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                'pessoa_id INTEGER NOT NULL,' +
                'tipo_pessoa TEXT NOT NULL,' + // 'polo' ou 'amigo'
                'motivo TEXT,' +
                'data_visita TEXT NOT NULL,' +
                'observacoes TEXT,' +
                'criado_em TEXT DEFAULT CURRENT_TIMESTAMP' +
                ')'
            );

            // Tabela: Tarefas
            tx.executeSql('CREATE TABLE IF NOT EXISTS tarefas (' +
                'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
                'pessoa_id INTEGER,' +
                'tipo_pessoa TEXT,' + // 'polo', 'amigo' ou NULL para tarefas autônomas
                'titulo TEXT NOT NULL,' +
                'descricao TEXT,' +
                'data_prazo TEXT,' +
                'status TEXT DEFAULT "Pendente",' + // 'Pendente' ou 'Concluído'
                'criado_em TEXT DEFAULT CURRENT_TIMESTAMP' +
                ')'
            );

            console.log('Banco de dados inicializado com sucesso');
        });
    }
}

// ===== HELPERS =====
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

console.log('app.js carregado');
