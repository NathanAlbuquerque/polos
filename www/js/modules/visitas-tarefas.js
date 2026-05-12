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
