function renderPolos() {
    const container = document.getElementById('polosGrid');
    if (!container) return;

    showSpinner();

    runSql(
        'SELECT p.id, p.nome, p.telefone, p.endereco, p.data_nascimento, p.foto, COUNT(a.id) AS total_amigos ' +
        'FROM polos p LEFT JOIN amigos a ON p.id = a.polo_id GROUP BY p.id ORDER BY p.nome ASC'
    ).then(function(result) {
        let html = '';

        for (let i = 0; i < result.rows.length; i += 1) {
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
            container.innerHTML = '<div class="alert alert-warning mb-0">Polo nao encontrado.</div>';
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
        html.push('<div class="detail-row"><span class="detail-label">Telefone</span><span class="detail-value">' + escapeHtml(row.telefone || 'Nao informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Endereco</span><span class="detail-value">' + escapeHtml(row.endereco || 'Nao informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Ultima Visita</span><span class="detail-value">' + escapeHtml(row.ultima_visita || 'Sem registros') + '</span></div>');
        if (row.observacoes) {
            html.push('<div class="detail-row detail-row-stack"><span class="detail-label">Observacoes</span><span class="detail-value">' + escapeHtml(row.observacoes) + '</span></div>');
        }
        html.push('</div>');
        html.push('<button type="button" class="btn btn-primary w-100 mb-2" onclick="abrirAmigosDoPolo(' + row.id + ')">Listar Amigos</button>');
        html.push('<button type="button" class="btn btn-outline-primary w-100 mb-2" onclick="abrirCadastroAmigo(' + row.id + ')">Adicionar Amigo</button>');
        html.push('<button type="button" class="btn btn-outline-info w-100 mb-2" onclick="editarPolo(' + row.id + ')">Editar Polo</button>');
        html.push('<button type="button" class="btn btn-outline-danger w-100 mb-2" onclick="deletarPolo(' + row.id + ', \'' + escapeHtml(row.nome).replace(/'/g, "\\'") + '\')">Deletar Polo</button>');
        html.push('<button type="button" class="btn btn-outline-secondary w-100" onclick="navigateTo(\'screen-polos-grid\', { replace: true })">Voltar para Polos</button>');
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
            html += '<div class="friend-list-item" role="button" tabindex="0" onclick="verDetalhesAmigo(' + row.id + ')" onkeydown="if(event.key===\'Enter\' || event.key===\' \' ){ verDetalhesAmigo(' + row.id + '); }">';
            html += '<div class="friend-list-main">';
            html += '<div class="friend-name">' + escapeHtml(row.nome) + '</div>';
            html += '<div class="friend-meta">Apresentado por: ' + escapeHtml(row.nome_polo || 'Sem vinculo') + '</div>';
            if (row.telefone) {
                html += '<div class="friend-secondary">' + escapeHtml(row.telefone) + '</div>';
            }
            html += '</div>';
            html += '<div class="friend-actions">';
            html += '<button type="button" class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); editarAmigo(' + row.id + ')">Editar</button>';
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
    const form = document.getElementById('formNovoAmigo');
    if (form) {
        delete form.dataset.editingId;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Salvar Amigo';
    }
}
function abrirAmigosDoPolo(poloId) {
    amigoListFilterPoloId = poloId || null;
    navigateTo('screen-amigos-list', { force: true });
    carregarAmigos(poloId);
}
function editarAmigo(amigoId) {
    if (!amigoId) return;
    runSql('SELECT id, polo_id, nome, telefone, endereco, data_nascimento, observacoes FROM amigos WHERE id = ? LIMIT 1', [amigoId]).then(function(result) {
        if (!result.rows || !result.rows.length) {
            showToast('Amigo nao encontrado');
            return;
        }
        const amigo = result.rows.item(0);
        navigateTo('screen-cadastro-amigo', { force: true });
        initializeAmigoForm(amigo.polo_id);
        const form = document.getElementById('formNovoAmigo');
        if (form) {
            form.dataset.editingId = String(amigo.id);
        }
        const nomeInput = document.getElementById('amigoNome');
        const telefoneInput = document.getElementById('amigoTelefone');
        const obsInput = document.getElementById('amigoObs');
        if (nomeInput) nomeInput.value = amigo.nome || '';
        if (telefoneInput) telefoneInput.value = amigo.telefone || '';
        if (obsInput) obsInput.value = amigo.observacoes || '';
        const submitBtn = document.querySelector('#formNovoAmigo button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Salvar Alteracoes do Amigo';
    }).catch(function(err) {
        console.error('Erro ao carregar amigo para edicao', err);
        showFriendlyError('salvar-amigo');
    });
}
function verDetalhesAmigo(amigoId) {
    if (!amigoId) return;
    const target = document.getElementById('screen-amigo-detalhes');
    if (target) {
        target.setAttribute('data-amigo-id', String(amigoId));
    }
    navigateTo('screen-amigo-detalhes', { force: true });
    renderAmigoDetails();
}
function renderAmigoDetails() {
    const container = document.getElementById('amigoDetalhesContent');
    if (!container) return;
    const screen = document.getElementById('screen-amigo-detalhes');
    const amigoId = screen ? screen.getAttribute('data-amigo-id') : '';
    if (!amigoId) {
        container.innerHTML = '<div class="alert alert-warning mb-0">Selecione um amigo primeiro.</div>';
        return;
    }
    showSpinner();
    runSql(
        'SELECT a.id, a.nome, a.telefone, a.endereco, a.data_nascimento, a.observacoes, a.ultima_visita, p.nome AS nome_polo ' +
        'FROM amigos a LEFT JOIN polos p ON a.polo_id = p.id WHERE a.id = ? LIMIT 1',
        [amigoId]
    ).then(function(result) {
        if (!result.rows || !result.rows.length) {
            container.innerHTML = '<div class="alert alert-warning mb-0">Amigo nao encontrado.</div>';
            hideSpinner();
            return;
        }
        const row = result.rows.item(0);
        const html = [];
        html.push('<div class="detail-panel">');
        html.push('<div class="detail-row"><span class="detail-label">Nome</span><span class="detail-value">' + escapeHtml(row.nome || '') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Polo de Origem</span><span class="detail-value">' + escapeHtml(row.nome_polo || 'Sem vinculo') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Telefone</span><span class="detail-value">' + escapeHtml(row.telefone || 'Nao informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Endereco</span><span class="detail-value">' + escapeHtml(row.endereco || 'Nao informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Data de Nascimento</span><span class="detail-value">' + escapeHtml(row.data_nascimento || 'Nao informado') + '</span></div>');
        html.push('<div class="detail-row"><span class="detail-label">Ultima Visita</span><span class="detail-value-inline-action">');
        html.push('<span class="detail-value">' + escapeHtml(row.ultima_visita || 'Sem registros') + '</span>');
        html.push('<button type="button" class="btn btn-sm btn-outline-primary" onclick="abrirCadastroVisitaDoDia(null, \"AMIGOS:' + row.id + '\")">Agendar Visita</button>');
        html.push('</span></div>');
        if (row.observacoes) {
            html.push('<div class="detail-row detail-row-stack"><span class="detail-label">Observacoes</span><span class="detail-value">' + escapeHtml(row.observacoes) + '</span></div>');
        }
        html.push('</div>');
        html.push('<button type="button" class="btn btn-primary w-100 mb-2" onclick="editarAmigo(' + row.id + ')">Editar Amigo</button>');
        html.push('<button type="button" class="btn btn-outline-secondary w-100" onclick="navigateTo(\'screen-amigos-list\', { force: true, replace: true })">Voltar para Amigos</button>');
        container.innerHTML = html.join('');
        hideSpinner();
    }).catch(function(err) {
        console.error('Erro ao carregar detalhes do amigo', err);
        container.innerHTML = '<div class="alert alert-danger mb-0">Erro ao carregar detalhes do amigo.</div>';
        hideSpinner();
    });
}
function salvarNovoAmigo() {
    const form = document.getElementById('formNovoAmigo');
    const editingId = form ? form.dataset.editingId : '';
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
        alert('Nome do amigo e obrigatorio');
        return;
    }
    const op = editingId
        ? runSql('UPDATE amigos SET polo_id = ?, nome = ?, telefone = ?, endereco = ?, data_nascimento = ?, observacoes = ? WHERE id = ?', [poloId, nome, telefone, endereco, data_nascimento, observacoes, editingId])
        : runSql('INSERT INTO amigos (polo_id, nome, telefone, endereco, data_nascimento, observacoes) VALUES (?, ?, ?, ?, ?, ?)', [poloId, nome, telefone, endereco, data_nascimento, observacoes]);
    op.then(function() {
        if (form) {
            form.reset();
            delete form.dataset.editingId;
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Salvar Amigo';
        }
        atualizarDashboard();
        showToast(editingId ? 'Amigo atualizado com sucesso!' : 'Salvo com sucesso!');
        navigateTo('screen-amigos-list', { force: true, replace: true });
        carregarAmigos(poloId);
    }).catch(function(err) {
        console.error('Erro ao salvar amigo', err);
        showFriendlyError('salvar-amigo');
    });
}
function removerAmigo(amigoId, nomeAmigo) {
    if (!amigoId) return;
    const confirmation = confirm('Deseja remover ' + nomeAmigo + '? As visitas e tarefas vinculadas tambem serao removidas.');
    if (!confirmation) return;
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
function abrirCadastroPolo() {
    navigateTo('screen-cadastro-polo', { force: true });
    const form = document.getElementById('formNovoPolo');
    if (form) {
        form.reset();
        delete form.dataset.editingId;
    }
    togglePoloEditFields(false);
    const submitBtn = document.querySelector('#formNovoPolo button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Salvar Polo';
    setPoloPhotoPreview('');
}
function editarPolo(poloId) {
    if (!poloId) return;
    runSql('SELECT id, nome, telefone, endereco, data_nascimento, observacoes, foto FROM polos WHERE id = ? LIMIT 1', [poloId]).then(function(result) {
        if (!result.rows || !result.rows.length) {
            showToast('Polo nao encontrado');
            return;
        }
        const polo = result.rows.item(0);
        navigateTo('screen-cadastro-polo', { force: true });
        const form = document.getElementById('formNovoPolo');
        if (form) {
            form.dataset.editingId = String(polo.id);
        }
        togglePoloEditFields(true);
        document.getElementById('poloNome').value = polo.nome || '';
        document.getElementById('poloTelefone').value = polo.telefone || '';
        const enderecoInput = document.getElementById('poloEndereco');
        if (enderecoInput) enderecoInput.value = polo.endereco || '';
        const dataNascimentoInput = document.getElementById('poloDataNascimento');
        if (dataNascimentoInput) {
            if (dataNascimentoInput._flatpickr) {
                dataNascimentoInput._flatpickr.setDate(polo.data_nascimento || '', false, 'Y-m-d');
            } else {
                dataNascimentoInput.value = polo.data_nascimento || '';
            }
        }
        document.getElementById('poloObs').value = polo.observacoes || '';
        document.getElementById('poloFoto').value = polo.foto || '';
        setPoloPhotoPreview(polo.foto || '');
        const submitBtn = document.querySelector('#formNovoPolo button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Salvar Alteracoes do Polo';
    }).catch(function(err) {
        console.error('Erro ao carregar polo para edicao', err);
        showFriendlyError('salvar-polo');
    });
}
function inserirNovoPolo() {
    const form = document.getElementById('formNovoPolo');
    const editingId = form ? form.dataset.editingId : '';
    const nome = (document.getElementById('poloNome') || {}).value || '';
    const telefone = (document.getElementById('poloTelefone') || {}).value || '';
    const endereco = (document.getElementById('poloEndereco') || {}).value || '';
    const data_nascimento = (document.getElementById('poloDataNascimento') || {}).value || '';
    const observacoes = (document.getElementById('poloObs') || {}).value || '';
    const foto = (document.getElementById('poloFoto') || {}).value || '';
    if (!nome.trim()) {
        alert('Nome do polo e obrigatorio');
        return;
    }
    const op = editingId
        ? runSql('UPDATE polos SET nome = ?, telefone = ?, endereco = ?, data_nascimento = ?, observacoes = ?, foto = ? WHERE id = ?', [nome, telefone, endereco, data_nascimento, observacoes, foto, editingId])
        : runSql('INSERT INTO polos (nome, telefone, endereco, data_nascimento, observacoes, foto) VALUES (?, ?, ?, ?, ?, ?)', [nome, telefone, endereco, data_nascimento, observacoes, foto]);
    op.then(function() {
        if (form) {
            form.reset();
            delete form.dataset.editingId;
        }
        togglePoloEditFields(false);
        setPoloPhotoPreview('');
        showToast(editingId ? 'Polo atualizado com sucesso!' : 'Salvo com sucesso!');
        navigateTo('screen-polos-grid', { force: true, replace: true });
        renderPolos();
        atualizarDashboard();
    }).catch(function(err) {
        console.error('Erro ao salvar polo', err);
        showFriendlyError('salvar-polo');
    });
}
function deletarPolo(poloId, nomePolo) {
    if (!poloId) return;
    const confirmation = confirm('Deseja remover o Polo "' + nomePolo + '"? Todos os amigos vinculados e seus registros de visitas e tarefas tambem serao removidos.');
    if (!confirmation) return;
    runSql('DELETE FROM polos WHERE id = ?', [poloId])
        .then(function() {
            navigateTo('screen-polos-grid', { force: true, replace: true });
            renderPolos();
            atualizarDashboard();
            showToast('Polo removido com sucesso!');
        })
        .catch(function(err) {
            console.error('Erro ao remover polo', err);
            showFriendlyError('deletar-polo');
        });
}
function triggerPoloPhotoPicker() {
    const fileInput = document.getElementById('poloFotoFile');
    if (fileInput) fileInput.click();
}
function setPoloPhotoPreview(src) {
    const wrap = document.getElementById('poloFotoPreviewWrap');
    const img = document.getElementById('poloFotoPreview');
    if (!wrap || !img) return;
    if (src) {
        img.src = src;
        wrap.style.display = '';
    } else {
        img.removeAttribute('src');
        wrap.style.display = 'none';
    }
}
function togglePoloEditFields(show) {
    const fields = document.querySelectorAll('.polo-edit-only');
    for (let i = 0; i < fields.length; i += 1) {
        if (show) {
            fields[i].classList.remove('d-none');
        } else {
            fields[i].classList.add('d-none');
        }
    }
    const screen = document.getElementById('screen-cadastro-polo');
    if (screen) {
        screen.setAttribute('data-title', show ? 'Editar Polo' : 'Novo Polo');
    }
    const title = document.getElementById('page-title');
    if (show && title && currentScreen === 'screen-cadastro-polo') {
        title.textContent = 'Editar Polo';
    }
}
function initializePoloForm() {
    const telefoneInput = document.getElementById('poloTelefone');
    if (telefoneInput && !telefoneInput.dataset.bound) {
        telefoneInput.dataset.bound = 'true';
        telefoneInput.addEventListener('input', formatPhoneInput);
    }
    const dataNascimentoInput = document.getElementById('poloDataNascimento');
    if (dataNascimentoInput && typeof flatpickr === 'function' && !dataNascimentoInput.dataset.flatpickrReady) {
        dataNascimentoInput.dataset.flatpickrReady = 'true';
        flatpickr(dataNascimentoInput, {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true,
            locale: FLATPICKR_PT_BR,
            position: 'auto bottom'
        });
    }
    const photoInput = document.getElementById('poloFotoFile');
    if (photoInput && !photoInput.dataset.bound) {
        photoInput.dataset.bound = 'true';
        photoInput.addEventListener('change', function(ev) {
            const file = ev.target.files && ev.target.files[0];
            if (!file) {
                document.getElementById('poloFoto').value = '';
                setPoloPhotoPreview('');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(loadEv) {
                const base64 = loadEv.target && loadEv.target.result ? String(loadEv.target.result) : '';
                document.getElementById('poloFoto').value = base64;
                setPoloPhotoPreview(base64);
            };
            reader.readAsDataURL(file);
        });
    }
}
