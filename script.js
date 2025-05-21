// Seletores principais
const form = document.getElementById('osForm');
const resultado = document.getElementById('resultado');
const tecnicoSelect = document.getElementById('tecnicoSelect');
const tecnicoManual = document.getElementById('tecnicoManual');
const samsungCheckbox = document.getElementById('samsungCheckbox');
const assurantCheckbox = document.getElementById('assurantCheckbox');
const peca = document.getElementById('peca');
const defeitoManualLabel = document.querySelector('label[for="defeitoManual"]');
const reparoManualLabel = document.querySelector('label[for="reparoManual"]');
const defeitoSelect = document.getElementById('defeitoSelect');
const reparoSelect = document.getElementById('reparoSelect');
const observacoes = document.getElementById('observacoes');
const clienteInput = document.getElementById('cliente');
const numeroInput = document.getElementById('numero');
const defeitoSelectLabel = document.querySelector('label[for="defeitoSelect"]');
const reparoSelectLabel = document.querySelector('label[for="reparoSelect"]');

// Funções auxiliares
function exibirCampos(campos, exibir = true) {
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = exibir ? 'block' : 'none';
    });
}

function atualizarPlaceholders(defeitoLabel, reparoLabel) {
    if (defeitoSelectLabel) defeitoSelectLabel.textContent = defeitoLabel;
    if (reparoSelectLabel) reparoSelectLabel.textContent = reparoLabel;
}

function definirPlaceholderENCampos(tipo) {
    if (tipo === 'samsung') {
        numeroInput.placeholder = 'Ex: 4171234567';
        exibirCampos(['numero', 'cliente', 'tecnicoSelect', 'defeitoSelect', 'reparoSelect', 'peca', 'observacoes'], true);
        exibirCampos(['defeitoManual', 'reparoManual'], false);
        defeitoManualLabel.textContent = 'Ou descreva o defeito:';
        reparoManualLabel.textContent = 'Ou descreva o reparo:';
        atualizarPlaceholders('Código de Defeito:', 'Código de Reparo:');
    } else if (tipo === 'assurant') {
        numeroInput.placeholder = 'Ex: 45111729';
        exibirCampos(['numero', 'cliente', 'tecnicoSelect', 'observacoes'], true);
        exibirCampos(['defeitoSelect', 'reparoSelect', 'peca'], false);
        exibirCampos(['defeitoManual', 'reparoManual'], true);
        defeitoManualLabel.textContent = 'Defeito:';
        reparoManualLabel.textContent = 'Solicitação de peça:';
        atualizarPlaceholders('Defeito:', 'Solicitação de peça:');
    }
}

function atualizarFormularioPorTipoOS() {
    if (samsungCheckbox.checked) {
        definirPlaceholderENCampos('samsung');
    } else if (assurantCheckbox.checked) {
        definirPlaceholderENCampos('assurant');
    }
}

function restaurarTecnicoSalvo() {
    const tecnicoSalvo = localStorage.getItem('tecnico');
    if (tecnicoSalvo) {
        if ([...tecnicoSelect.options].some(opt => opt.value === tecnicoSalvo)) {
            tecnicoSelect.value = tecnicoSalvo;
            tecnicoManual.style.display = tecnicoSalvo === 'nao_achei' ? 'block' : 'none';
        } else {
            tecnicoSelect.value = 'nao_achei';
            tecnicoManual.style.display = 'block';
            tecnicoManual.value = tecnicoSalvo;
        }
    }
}

function validarNumero(numero, tipo) {
    const padraoSamsung = /^417\d{7}$/;
    const padraoAssurant = /^\d{8}$/;
    if (tipo === 'samsung') return padraoSamsung.test(numero);
    if (tipo === 'assurant') return padraoAssurant.test(numero);
    return false;
}

function gerarTextoResultado(data) {
    const { numero, cliente, tecnico, defeito, reparo, peca, observacoes, tipo } = data;
    const linhaDefeito = tipo === 'samsung' ? `Código de defeito: ${defeito}` : `Defeito: ${defeito}`;
    const linhaReparo = tipo === 'samsung' ? `Código de reparo: ${reparo}` : `Solicitação de peça: ${reparo}`;
    return `
OS: ${numero}
Cliente: ${cliente}
Técnico: ${tecnico}
${linhaDefeito}
${linhaReparo}
${peca ? `Peça usada: ${peca}` : ''}
Observações: ${observacoes}
. . . . .`;
}

function limparFormulario() {
    form.reset();
    tecnicoManual.style.display = 'none';
    restaurarTecnicoSalvo();
}

// Eventos
samsungCheckbox.addEventListener('click', () => {
    if (samsungCheckbox.checked) assurantCheckbox.checked = false;
    atualizarFormularioPorTipoOS();
});

assurantCheckbox.addEventListener('click', () => {
    if (assurantCheckbox.checked) samsungCheckbox.checked = false;
    atualizarFormularioPorTipoOS();
});

window.addEventListener('DOMContentLoaded', () => {
    restaurarTecnicoSalvo();
    atualizarFormularioPorTipoOS();
});

tecnicoSelect.addEventListener('change', function () {
    tecnicoManual.style.display = this.value === 'nao_achei' ? 'block' : 'none';
    if (this.value !== 'nao_achei') {
        localStorage.setItem('tecnico', this.value);
    }
});

tecnicoManual.addEventListener('input', function () {
    if (tecnicoSelect.value === 'nao_achei') {
        localStorage.setItem('tecnico', this.value);
    }
});

form.addEventListener('submit', function (event) {
    event.preventDefault();

    const numero = numeroInput.value.trim();
    const cliente = clienteInput.value.trim();
    const tecnico = tecnicoManual.value.trim() || tecnicoSelect.value;
    const tipo = samsungCheckbox.checked ? 'samsung' : 'assurant';

    if (!validarNumero(numero, tipo)) {
        alert(`Número inválido. Para OS ${tipo === 'samsung' ? 'Samsung (417XXXXXXX)' : 'Assurant (8 dígitos)'}.`);
        return;
    }

    if (!cliente || !tecnico) {
        alert("Preencha os campos obrigatórios: Cliente e Técnico.");
        return;
    }

    const defeito = document.getElementById('defeitoManual').value || defeitoSelect.value;
    const reparo = document.getElementById('reparoManual').value || reparoSelect.value;
    const observacoesTexto = observacoes.value;
    const pecaSubstituida = tipo === 'samsung' ? peca.value : '';

    const texto = gerarTextoResultado({ numero, cliente, tecnico, defeito, reparo, peca: pecaSubstituida, observacoes: observacoesTexto, tipo });
    resultado.textContent = texto;
    document.querySelector('.output').style.display = 'block';

    limparFormulario();
});

function copiarTexto() {
    navigator.clipboard.writeText(resultado.textContent).then(() => {
        alert('Texto copiado para a área de transferência!');
    });
}

function compartilharTelegram() {
    const texto = resultado.textContent;
    const url = `https://t.me/share/url?url=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    alert('Compartilhado via Telegram!');
}

//ADD ORÇAMENTOS DAY
