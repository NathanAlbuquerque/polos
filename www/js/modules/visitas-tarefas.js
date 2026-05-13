let visitCalendarInstance = null;
let visitPersonChoices = [];
function toIsoDate(dateObj) {
    const d = new Date(dateObj);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
}
function formatDateBr(isoDate) {
    if (!isoDate) return '';
    const parts = String(isoDate).split('-');
    if (parts.length !== 3) return isoDate;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}
function carregarPessoasVisitadas(listId, selectedValue) {
    const datalist = document.getElementById(listId);
    if (!datalist) return Promise.resolve();
    return runSql(
        'SELECT "POLOS" AS tipo, id, nome FROM polos ' +
        'UNION ALL ' +
        'SELECT "AMIGOS" AS tipo, id, nome FROM amigos'
    ).then(function(result) {
        visitPersonChoices = [];
        const rows = [];
        for (let i = 0; i < result.rows.length; i += 1) {
            rows.push(result.rows.item(i));
        }
        rows.sort(function(a, b) {
            const typeOrder = (a.tipo === 'POLOS' ? 0 : 1) - (b.tipo === 'POLOS' ? 0 : 1);
            if (typeOrder !== 0) return typeOrder;
            return String(a.nome || '').localeCompare(String(b.nome || ''));
        });
        let options = '';
        rows.forEach(function(row) {
            const label = escapeHtml(row.nome) + ' - ' + (row.tipo === 'POLOS' ? 'Polo' : 'Amigo');
            const value = row.tipo + ':' + row.id;
            visitPersonChoices.push({ display: row.nome + ' - ' + (row.tipo === 'POLOS' ? 'Polo' : 'Amigo'), value: value });
            options += '<option value="' + label + '"></option>';
        });
        datalist.innerHTML = options;
        if (selectedValue) {
            const match = visitPersonChoices.find(function(item) { return item.value === selectedValue; });
            const input = document.getElementById('visitaPessoaBusca');
            const hidden = document.getElementById('visitaPessoa');
            if (match && input && hidden) {
                input.value = match.display;
                hidden.value = match.value;
            }
        }
        return result;
    });
}
function abrirCadastroVisitaDoDia(targetDate) {
    selectedVisitDate = targetDate || selectedVisitDate || getCurrentDate();
    selectedVisitPerson = null;
    navigateTo('screen-cadastro-visita-dia', { force: true });
}
function selecionarDataVisita(targetDate) {
    selectedVisitDate = targetDate || getCurrentDate();
    navigateTo('screen-visitas-dia', { force: true });
    renderVisitasDoDia(selectedVisitDate);
}
function initializeVisitCalendar() {
    const input = document.getElementById('visitasCalendar');
    if (!input || typeof flatpickr !== 'function') return;
    const dateForCalendar = selectedVisitDate || getCurrentDate();
    if (!visitCalendarInstance) {
        visitCalendarInstance = flatpickr(input, {
            inline: true,
            dateFormat: 'Y-m-d',
            defaultDate: dateForCalendar,
            locale: FLATPICKR_PT_BR,
            onReady: function(selectedDates, dateStr, instance) {
                markVisitDates(instance);
            },
            onMonthChange: function(selectedDates, dateStr, instance) {
                markVisitDates(instance);
            },
            onYearChange: function(selectedDates, dateStr, instance) {
                markVisitDates(instance);
            },
            onChange: function(selectedDates) {
                if (!selectedDates || !selectedDates.length) return;
                selecionarDataVisita(toIsoDate(selectedDates[0]));
            }
        });
    } else {
        visitCalendarInstance.setDate(dateForCalendar, false);
        markVisitDates(visitCalendarInstance);
    }
}
function markVisitDates(instance) {
    if (!instance || !instance.daysContainer) return;
    runSql('SELECT DISTINCT data_visita FROM visitas').then(function(result) {
        const visitDates = new Set();
        for (let i = 0; i < result.rows.length; i += 1) {
            const item = result.rows.item(i);
            if (item.data_visita) visitDates.add(String(item.data_visita));
        }
        const dayNodes = instance.daysContainer.querySelectorAll('.flatpickr-day');
        dayNodes.forEach(function(node) {
            node.classList.remove('has-visit');
            if (!node.dateObj) return;
            const iso = toIsoDate(node.dateObj);
            if (visitDates.has(iso)) {
                node.classList.add('has-visit');
            }
        });
    }).catch(function(err) {
        console.error('Erro ao marcar dias com visita', err);
    });
}
function initializeVisitForm(selectedValue) {
    selectedVisitDate = selectedVisitDate || getCurrentDate();
    const dateView = document.getElementById('visitaDataExibicao');
    if (dateView) dateView.value = formatDateBr(selectedVisitDate);
    const title = document.getElementById('cadastroVisitaTitulo');
    if (title) title.textContent = 'Nova visita em ' + formatDateBr(selectedVisitDate);
    carregarPessoasVisitadas('visitaPessoaLista', selectedValue || selectedVisitPerson);
    const searchInput = document.getElementById('visitaPessoaBusca');
    const hiddenValue = document.getElementById('visitaPessoa');
    if (searchInput && hiddenValue && !searchInput.dataset.bound) {
        searchInput.dataset.bound = 'true';
        searchInput.addEventListener('input', function() {
            const typed = String(searchInput.value || '').trim().toLowerCase();
            const exact = visitPersonChoices.find(function(item) {
                return item.display.toLowerCase() === typed;
            });
            hiddenValue.value = exact ? exact.value : '';
        });
        searchInput.addEventListener('blur', function() {
            if (hiddenValue.value) return;
            const typed = String(searchInput.value || '').trim().toLowerCase();
            const partial = visitPersonChoices.find(function(item) {
                return item.display.toLowerCase().indexOf(typed) >= 0;
            });
            if (partial) {
                searchInput.value = partial.display;
                hiddenValue.value = partial.value;
            }
        });
    }
    const form = document.getElementById('formNovoVisita');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', function(ev) {
            ev.preventDefault();
            salvarNovaVisita();
        });
    }
}
function salvarNovaVisita() {
    const person = (document.getElementById('visitaPessoa') || {}).value || '';
    const motivo = (document.getElementById('visitaMotivo') || {}).value || '';
    const observacoes = (document.getElementById('visitaObs') || {}).value || '';
    const data_visita = selectedVisitDate || getCurrentDate();
    if (!person) {
        alert('Selecione a pessoa visitada na lista');
        return;
    }
    if (!motivo.trim()) {
        alert('Informe o motivo da visita');
        return;
    }
    const parts = String(person).split(':');
    const tipo_pessoa = parts[0] || '';
    const pessoa_id = parts[1] || '';
    runSql('INSERT INTO visitas (pessoa_id, tipo_pessoa, motivo, data_visita, observacoes) VALUES (?, ?, ?, ?, ?)', [pessoa_id, tipo_pessoa, motivo, data_visita, observacoes])
        .then(function() {
            return atualizarUltimaVisita(tipo_pessoa, pessoa_id, data_visita);
        })
        .then(function() {
            const form = document.getElementById('formNovoVisita');
            if (form) form.reset();
            const hidden = document.getElementById('visitaPessoa');
            if (hidden) hidden.value = '';
            atualizarDashboard();
            showToast('Visita salva com sucesso!');
            navigateTo('screen-visitas-dia', { force: true, replace: true });
            renderVisitasDoDia(data_visita);
            if (visitCalendarInstance) markVisitDates(visitCalendarInstance);
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
function renderVisitasDoDia(targetDate) {
    const date = targetDate || selectedVisitDate || getCurrentDate();
    selectedVisitDate = date;
    const title = document.getElementById('visitasDiaTitulo');
    if (title) title.textContent = 'Visitas do dia ' + formatDateBr(date);
    const container = document.getElementById('visitasDiaList');
    if (!container) return;
    showSpinner();
    runSql(
        'SELECT v.id, v.tipo_pessoa, v.pessoa_id, v.motivo, v.data_visita, v.observacoes, COALESCE(p.nome, a.nome) AS pessoa_nome ' +
        'FROM visitas v ' +
        'LEFT JOIN polos p ON v.tipo_pessoa = "POLOS" AND p.id = v.pessoa_id ' +
        'LEFT JOIN amigos a ON v.tipo_pessoa = "AMIGOS" AND a.id = v.pessoa_id ' +
        'WHERE v.data_visita = ? ' +
        'ORDER BY v.id DESC',
        [date]
    ).then(function(result) {
        let html = '';
        for (let i = 0; i < result.rows.length; i += 1) {
            const row = result.rows.item(i);
            html += '<div class="friend-list-item visit-day-item">';
            html += '<div class="friend-list-main">';
            html += '<div class="friend-name">' + escapeHtml(row.motivo || 'Visita sem titulo') + '</div>';
            html += '<div class="friend-meta">Pessoa: ' + escapeHtml(row.pessoa_nome || 'Sem vinculo') + '</div>';
            html += '<div class="friend-secondary">' + escapeHtml(row.tipo_pessoa === 'POLOS' ? 'Polo' : 'Amigo') + '</div>';
            if (row.observacoes) {
                html += '<div class="friend-secondary">' + escapeHtml(row.observacoes) + '</div>';
            }
            html += '</div>';
            html += '<div class="friend-actions">';
            html += '<button type="button" class="btn btn-sm btn-outline-primary" onclick="verDetalhesVisita(' + row.id + ')">Detalhes</button>';
            html += '</div></div>';
        }
        container.innerHTML = html || '<div class="friend-list-item text-muted">Nenhuma visita registrada nesta data.</div>';
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar visitas do dia', err);
        container.innerHTML = '<div class="friend-list-item text-danger">Erro ao carregar visitas.</div>';
        hideSpinner();
    });
}
function renderVisitas() {
    initializeVisitCalendar();
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
            container.innerHTML = '<div class="alert alert-warning mb-0">Visita nao encontrada.</div>';
            hideSpinner();
            return;
        }
        const row = result.rows.item(0);
        const html = [];
        html.push('<div class="detail-panel">');
        html.push('<div class="detail-row"><span class="detail-label">Pessoa</span><span class="detail-value">' + escapeHtml(row.pessoa_nome || 'Sem vinculo') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Tipo</span><span class="detail-value">' + escapeHtml(row.tipo_pessoa === 'POLOS' ? 'Polo' : 'Amigo') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Data</span><span class="detail-value">' + escapeHtml(formatDateBr(row.data_visita || '')) + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Ultima Visita</span><span class="detail-value">' + escapeHtml(formatDateBr(row.ultima_visita || row.data_visita || '')) + '</span></div>');
        html.push('</div>');
        if (row.motivo) {
            html.push('<div class="detail-panel mb-3"><div class="detail-row detail-row-stack"><span class="detail-label">Motivo</span><span class="detail-value">' + escapeHtml(row.motivo) + '</span></div></div>');
        }
        if (row.observacoes) {
            html.push('<div class="detail-panel mb-3"><div class="detail-row detail-row-stack"><span class="detail-label">Observacoes</span><span class="detail-value">' + escapeHtml(row.observacoes) + '</span></div></div>');
        }
        html.push('<button type="button" class="btn btn-info w-100 mb-2" onclick="abrirTarefaDaVisita(' + row.id + ')">Criar Tarefa</button>');
        html.push('<button type="button" class="btn btn-outline-secondary w-100" onclick="navigateTo(\'screen-visitas-dia\', { force: true, replace: true })">Voltar</button>');
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
    runSql(
        'SELECT "POLOS" AS tipo, id, nome FROM polos ' +
        'UNION ALL ' +
        'SELECT "AMIGOS" AS tipo, id, nome FROM amigos'
    ).then(function(result) {
        const rows = [];
        for (let i = 0; i < result.rows.length; i += 1) {
            rows.push(result.rows.item(i));
        }

        rows.sort(function(a, b) {
            const typeOrder = (a.tipo === 'POLOS' ? 0 : 1) - (b.tipo === 'POLOS' ? 0 : 1);
            if (typeOrder !== 0) return typeOrder;
            return String(a.nome || '').localeCompare(String(b.nome || ''));
        });

        const select = document.getElementById('tarefaPessoa');
        if (!select) return;

        let options = '<option value="">Selecione a pessoa</option>';
        rows.forEach(function(row) {
            const value = row.tipo + ':' + row.id;
            const display = row.nome + ' - ' + (row.tipo === 'POLOS' ? 'Polo' : 'Amigo');
            const selected = value === (selectedValue || selectedTaskPerson) ? ' selected' : '';
            options += '<option value="' + value + '"' + selected + '>' + escapeHtml(display) + '</option>';
        });
        select.innerHTML = options;
    });
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
    }
}
function salvarNovaTarefa() {
    const person = (document.getElementById('tarefaPessoa') || {}).value || '';
    const titulo = (document.getElementById('tarefaTitulo') || {}).value || '';
    const descricao = (document.getElementById('tarefaDescricao') || {}).value || '';
    const data_prazo = (document.getElementById('tarefaPrazo') || {}).value || '';
    if (!person) {
        alert('Selecione a pessoa envolvida');
        return;
    }
    if (!titulo.trim()) {
        alert('Titulo da tarefa e obrigatorio');
        return;
    }
    if (!data_prazo) {
        alert('Selecione o prazo da tarefa');
        return;
    }
    const parts = String(person).split(':');
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
    runSql('UPDATE tarefas SET status = ? WHERE id = ?', ['Concluido', tarefaId])
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
            html += '<div class="fw-semibold">' + escapeHtml(row.titulo || 'Tarefa sem titulo') + '</div>';
            if (row.descricao) html += '<div class="small text-muted">' + escapeHtml(row.descricao) + '</div>';
            html += '<div class="small text-muted">Prazo: ' + escapeHtml(formatDateBr(row.data_prazo || '')) + '</div>';
            html += '</div>';
            html += '<div class="d-flex flex-column align-items-end gap-2">';
            html += '<span class="badge ' + (isPending ? (isOverdue ? 'text-bg-danger' : 'text-bg-warning') : 'text-bg-success') + '">' + escapeHtml(row.status || 'Pendente') + '</span>';
            if (isPending) {
                html += '<button type="button" class="btn btn-sm btn-outline-success task-action" onclick="concluirTarefa(' + row.id + ')">Concluir</button>';
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
