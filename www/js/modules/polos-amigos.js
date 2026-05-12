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
    const endereco = '';
    const data_nascimento = '';
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

function inserirNovoPolo() {
    const nome = (document.getElementById('poloNome') || {}).value || '';
    const telefone = (document.getElementById('poloTelefone') || {}).value || '';
    const endereco = '';
    const data_nascimento = '';
    const observacoes = (document.getElementById('poloObs') || {}).value || '';
    const foto = (document.getElementById('poloFoto') || {}).value || '';

    if (!nome.trim()) {
        alert('Nome do polo é obrigatório');
        return;
    }

    runSql('INSERT INTO polos (nome, telefone, endereco, data_nascimento, observacoes, foto) VALUES (?, ?, ?, ?, ?, ?)', [nome, telefone, endereco, data_nascimento, observacoes, foto])
        .then(function() {
            const form = document.getElementById('formNovoPolo');
            if (form) form.reset();
            navigateTo('screen-polos-grid');
            renderPolos();
            showToast('Salvo com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao inserir polo', err);
            showFriendlyError('salvar-polo');
        });
}

function initializePoloForm() {
    const telefoneInput = document.getElementById('poloTelefone');

    if (telefoneInput) {
        telefoneInput.addEventListener('input', formatPhoneInput);
    }
}
