import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, doc, setDoc, serverTimestamp, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { ScanLine } from 'lucide-react';
import ScannerDialog from './ScannerDialog';
import SignatureDialog from './SignatureDialog';

function Form({ setFormData }) {
    // Estados existentes
    const [numero, setNumero] = useState('');
    const [cliente, setCliente] = useState('');
    const [tecnicoSelect, setTecnicoSelect] = useState('');
    const [tecnicoManual, setTecnicoManual] = useState('');
    const [defeitoSelect, setDefeitoSelect] = useState('');
    const [defeitoManual, setDefeitoManual] = useState('');
    const [reparoSelect, setReparoSelect] = useState('');
    const [reparoManual, setReparoManual] = useState('');
    const [peca, setPeca] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [isSamsung, setIsSamsung] = useState(true);
    const [modelo, setModelo] = useState('');
    const [serial, setSerial] = useState('');
    const [dataVisita, setDataVisita] = useState(new Date().toISOString().split("T")[0]);
    const [tipoAparelho, setTipoAparelho] = useState('VD');
    const [tipoChecklist, setTipoChecklist] = useState('PREENCHIDO');
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [isSignatureDialogOpen, setSignatureDialogOpen] = useState(false);
    const [signature, setSignature] = useState(null);
    const [ppidPecaUsada, setPpidPecaUsada] = useState('');
    const [ppidPecaNova, setPpidPecaNova] = useState('');
    const [scannerTarget, setScannerTarget] = useState('');

    // Estados para Orçamento e Limpeza
    const [orcamentoAprovado, setOrcamentoAprovado] = useState(false);
    const [orcamentoValor, setOrcamentoValor] = useState('');
    const [limpezaAprovada, setLimpezaAprovada] = useState(false);


    useEffect(() => {
        const tecnicoSalvo = localStorage.getItem('tecnico');
        if (tecnicoSalvo) {
            if (
                ['Pedro', 'Jeová', 'Cassio', 'Wanderley', 'Daniel', 'Leo', 'Francisco', 'Evandro', 'Dieliton'].includes(tecnicoSalvo)
            ) {
                setTecnicoSelect(tecnicoSalvo);
                setTecnicoManual('');
            } else {
                setTecnicoSelect('nao_achei');
                setTecnicoManual(tecnicoSalvo);
            }
        }
    }, []);

    useEffect(() => {
        if (tecnicoSelect === 'nao_achei') {
            localStorage.setItem('tecnico', tecnicoManual);
        } else {
            localStorage.setItem('tecnico', tecnicoSelect);
        }
    }, [tecnicoSelect, tecnicoManual]);

    // NOVO: useEffect para limpar os campos de orçamento/limpeza ao trocar para Assurant
    useEffect(() => {
        if (!isSamsung) {
            setOrcamentoAprovado(false);
            setOrcamentoValor('');
            setLimpezaAprovada(false);
        }
    }, [isSamsung]);

    const validarNumero = (num, tipo) => {
        const padraoSamsung = /^417\d{7}$/;
        const padraoAssurant = /^\d{8}$/;
        if (tipo === 'samsung') return padraoSamsung.test(num);
        if (tipo === 'assurant') return padraoAssurant.test(num);
        return false;
    };

    const gerarTextoResultado = (data) => {
        const { numero, cliente, tecnico, defeito, reparo, peca, ppidPecaNova, ppidPecaUsada, observacoes, tipo, orcamentoAprovado, orcamentoValor, limpezaAprovada } = data;
        const linhaDefeito = tipo === 'samsung' ? `Código de defeito: ${defeito}` : `Defeito: ${defeito}`;
        const linhaReparo = tipo === 'samsung' ? `Código de reparo: ${reparo}` : `Solicitação de peça: ${reparo}`;
        
        const linhaPecaUsada = peca ? `Peça usada: ${peca}` : '';
        const linhaPpidNova = ppidPecaNova ? `PPID peça NOVA: ${ppidPecaNova}` : '';
        const linhaPpidUsada = ppidPecaUsada ? `PPID peça USADA: ${ppidPecaUsada}` : '';
        
        const detalhesPecas = [linhaPecaUsada, linhaPpidNova, linhaPpidUsada].filter(Boolean).join('\n');

        let obsText = '';
        if (orcamentoAprovado && orcamentoValor) {
            obsText += `Orçamento aprovado: ${orcamentoValor}\n`;
        }
        if (limpezaAprovada) {
            obsText += 'Limpeza realizada\n';
        }
        obsText += observacoes;


        return `
OS: ${numero}
Cliente: ${cliente}
Técnico: ${tecnico}
${linhaDefeito}
${linhaReparo}
${detalhesPecas}
Observações: 
${obsText}
. . . . .`;
    };

    const limparFormulario = () => {
        setNumero('');
        setCliente('');
        setDefeitoSelect('');
        setDefeitoManual('');
        setReparoSelect('');
        setReparoManual('');
        setPeca('');
        setObservacoes('');
        setModelo('');
        setSerial('');
        setDataVisita(new Date().toISOString().split("T")[0]);
        setTipoAparelho('VD');
        setTipoChecklist('PREENCHIDO');
        setSignature(null);
        setPpidPecaNova('');
        setPpidPecaUsada('');
        setOrcamentoAprovado(false);
        setOrcamentoValor('');
        setLimpezaAprovada(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const tipoOS = isSamsung ? 'samsung' : 'assurant';
        const tecnicoFinal = (tecnicoSelect === 'nao_achei' ? tecnicoManual : tecnicoSelect).trim();
        const numeroOS = numero.trim();
        const clienteNome = cliente.trim();

        if (!validarNumero(numeroOS, tipoOS)) {
            alert(`Número inválido. Para OS ${tipoOS === 'samsung' ? 'Samsung (417XXXXXXX)' : 'Assurant (8 dígitos)'}.`);
            return;
        }

        if (!clienteNome || !tecnicoFinal) {
            alert("Preencha os campos obrigatórios: Cliente e Técnico.");
            return;
        }

        if (orcamentoAprovado && (!orcamentoValor || parseFloat(orcamentoValor) <= 0)) {
            alert("Por favor, insira um valor válido para o orçamento aprovado.");
            return;
        }

        let defeitoFinal;
        let reparoFinal;

        if (isSamsung) {
            const defeitoElement = document.getElementById('defeitoSelect');
            defeitoFinal = defeitoElement.options[defeitoElement.selectedIndex].text;
            const reparoElement = document.getElementById('reparoSelect');
            reparoFinal = reparoElement.options[reparoElement.selectedIndex].text;
        } else {
            defeitoFinal = defeitoManual;
            reparoFinal = reparoManual;
        }

        const pecaFinal = isSamsung ? peca : '';

        const resultadoTexto = gerarTextoResultado({
            numero: numeroOS,
            cliente: clienteNome,
            tecnico: tecnicoFinal,
            defeito: defeitoFinal,
            reparo: reparoFinal,
            peca: pecaFinal,
            ppidPecaNova: ppidPecaNova,
            ppidPecaUsada: ppidPecaUsada,
            observacoes,
            tipo: tipoOS,
            orcamentoAprovado,
            orcamentoValor,
            limpezaAprovada,
        });

        setFormData(resultadoTexto);

        try {
            // --- SALVAR DADOS DA OS ---
            const today = new Date();
            const dateString = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0');

            const tecnicoDocRef = doc(db, 'ordensDeServico', tecnicoFinal);
            await setDoc(tecnicoDocRef, { nome: tecnicoFinal }, { merge: true });

            const osPorDataCollectionRef = collection(tecnicoDocRef, 'osPorData');
            const dataDocRef = doc(osPorDataCollectionRef, dateString);
            await setDoc(dataDocRef, { data: dateString }, { merge: true });

            const targetCollectionName = isSamsung ? 'Samsung' : 'Assurant';
            const targetCollectionRef = collection(dataDocRef, targetCollectionName);
            const osDocRef = doc(targetCollectionRef, numeroOS);

            await setDoc(osDocRef, {
                numeroOS: numeroOS,
                cliente: clienteNome,
                tecnico: tecnicoFinal,
                tipoOS: tipoOS,
                defeito: defeitoFinal,
                reparo: reparoFinal,
                pecaSubstituida: pecaFinal,
                ppidPecaNova: ppidPecaNova,
                ppidPecaUsada: ppidPecaUsada,
                observacoes: observacoes,
                dataGeracao: serverTimestamp(),
                dataGeracaoLocal: new Date().toISOString()
            });

            // --- ATUALIZAR ESTATÍSTICAS DO TÉCNICO (LÓGICA INTEGRADA) ---
            const statsDocRef = doc(db, 'technicianStats', tecnicoFinal);
            const statsDoc = await getDoc(statsDocRef);

            const statsUpdateData = {
                totalOS: increment(1),
                lastUpdate: serverTimestamp(),
                samsungOS: increment(tipoOS === 'samsung' ? 1 : 0),
                assurantOS: increment(tipoOS === 'assurant' ? 1 : 0),
            };

            if (orcamentoAprovado && orcamentoValor) {
                const valorNumerico = parseFloat(orcamentoValor);
                if (!isNaN(valorNumerico)) {
                    statsUpdateData.orc_aprovado = increment(valorNumerico);
                    statsUpdateData.lista_orcamentos_aprovados = arrayUnion(numeroOS);
                }
            }

            if (limpezaAprovada) {
                statsUpdateData.limpezas_realizadas = increment(1);
                statsUpdateData.lista_limpezas = arrayUnion(numeroOS);
            }
            
            if (statsDoc.exists()) {
                await updateDoc(statsDocRef, statsUpdateData);
            } else {
                const initialStatsData = {
                    totalOS: 1,
                    samsungOS: tipoOS === 'samsung' ? 1 : 0,
                    assurantOS: tipoOS === 'assurant' ? 1 : 0,
                    orc_aprovado: 0,
                    limpezas_realizadas: 0,
                    lista_orcamentos_aprovados: [],
                    lista_limpezas: [],
                    ...statsUpdateData, 
                };
                await setDoc(statsDocRef, initialStatsData);
            }

            console.log('Ordem de serviço e estatísticas atualizadas com sucesso!');
            alert('Resumo gerado e dados salvos com sucesso!');

        } catch (e) {
            console.error("Erro ao adicionar documento: ", e);
            alert('Erro ao cadastrar dados no Firebase. Verifique o console para mais detalhes.');
        }
    };

    const preencherPDF = async () => {
        let baseFileName = '';

        switch (tipoAparelho) {
            case 'VD':
                baseFileName = `/Checklist DTV_IH41_${tipoChecklist}.pdf`;
                break;
            case 'WSM':
                baseFileName = `/checklist_WSM_${tipoChecklist}.pdf`;
                break;
            case 'REF':
                baseFileName = `/checklist_REF_${tipoChecklist}.pdf`;
                break;
            case 'RAC':
                baseFileName = `/checklist_RAC_${tipoChecklist}.pdf`;
                break;
            default:
                alert('Tipo de aparelho inválido.');
                return;
        }

        try {
            const existingPdfBytes = await fetch(baseFileName).then(res => res.arrayBuffer());
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const page = pdfDoc.getPages()[0];
            const { width, height } = page.getSize();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            const drawText = (text, x, y, size = 10) => {
                page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
            };

            let pngImage = null;
            if (signature) {
                pngImage = await pdfDoc.embedPng(signature);
            } else {
                console.log("Nenhuma assinatura capturada para adicionar ao PDF.");
            }

            const tecnicoFinal = (tecnicoSelect === 'nao_achei' ? tecnicoManual : tecnicoSelect).trim();
            
            // Lógica para obter o texto do defeito/reparo selecionado
            let defeitoFinalText = defeitoManual;
            let reparoFinalText = reparoManual;
            if(isSamsung) {
                const defeitoElement = document.getElementById('defeitoSelect');
                if (defeitoElement.selectedIndex > 0) {
                    defeitoFinalText = defeitoElement.options[defeitoElement.selectedIndex].text;
                }
                const reparoElement = document.getElementById('reparoSelect');
                if(reparoElement.selectedIndex > 0) {
                    reparoFinalText = reparoElement.options[reparoElement.selectedIndex].text;
                }
            }
            
            const textoObservacoes = `Observações: ${observacoes}`;
            const textoDefeito = isSamsung ? `Código de Defeito: ${defeitoFinalText}` : `Defeito: ${defeitoFinalText}`;
            const textoReparo = isSamsung ? `Código de Reparo: ${reparoFinalText}` : `Peça necessária: ${reparoFinalText}`;

            const offset = 10;
            let dataFormatada = '';
            if (dataVisita) {
                const [ano, mes, dia] = dataVisita.split('-');
                dataFormatada = `${dia}/${mes}/${ano}`;
            }

            // *** INÍCIO DA LÓGICA CORRIGIDA ***
            if (tipoAparelho === 'VD') {
                drawText("FERNANDES E MESQUITA 3886546", 119, height - 72);
                drawText(cliente, 90, height - 85);
                drawText(modelo, 90, height - 100);
                drawText(serial, 420, height - 87);
                drawText(numero, 420, height - 72);
                drawText(dataFormatada, 450, height - 100);
                drawText(tecnicoFinal, 120, height - 800);

                drawText(textoDefeito, 70, height - 750);
                drawText(textoReparo, 70, height - 750 - offset);
                drawText(textoObservacoes, 70, height - 750 - (offset * 2));

                if (pngImage) {
                    page.drawImage(pngImage, {
                        x: 390,
                        y: height - 820,
                        width: 165,
                        height: 55
                    });
                }
            } else if (tipoAparelho === 'WSM') {
                drawText("FERNANDES E MESQUITA 3886546", 100, height - 0);
                drawText(`${cliente}`, 77, height - 125);
                drawText(`${modelo}`, 77, height - 137);
                drawText(`${serial}`, 590, height - 125);
                drawText(`${numero}`, 590, height - 110);
                drawText(`${dataFormatada}`, 605, height - 137);
                drawText(`${tecnicoFinal}`, 110, height - 534);

                drawText(textoDefeito, 65, height - 470);
                drawText(textoReparo, 65, height - 470 - offset);
                drawText(textoObservacoes, 65, height - 470 - (offset * 2));

                if (pngImage) {
                    page.drawImage(pngImage, {
                        x: 550,
                        y: height - 550,
                        width: 150,
                        height: 40
                    });
                }
            } else if (tipoAparelho === 'REF') {
                drawText("FERNANDES E MESQUITA 3886546", 100, height - 0);
                drawText(`${cliente}`, 87, height - 130);
                drawText(`${modelo}`, 87, height - 147);
                drawText(`${serial}`, 660, height - 132);
                drawText(`${numero}`, 660, height - 115);
                drawText(`${dataFormatada}`, 665, height - 147);
                drawText(`${tecnicoFinal}`, 114, height - 538);

                drawText(textoDefeito, 65, height - 465);
                drawText(textoReparo, 65, height - 465 - offset);
                drawText(textoObservacoes, 65, height - 465 - (offset * 2));

                if (pngImage) {
                    page.drawImage(pngImage, {
                        x: 600,
                        y: height - 550,
                        width: 150,
                        height: 40
                    });
                }
            } else if (tipoAparelho === 'RAC') {
                drawText("FERNANDES E MESQUITA 3886546", 140, height - 0);
                drawText(`${cliente}`, 87, height - 116);
                drawText(`${modelo}`, 87, height - 127);
                drawText(`${serial}`, 532, height - 116);
                drawText(`${numero}`, 537, height - 105);
                drawText(`${dataFormatada}`, 552, height - 128);
                drawText(`${tecnicoFinal}`, 114, height - 533);

                drawText(textoDefeito, 65, height - 470);
                drawText(textoReparo, 65, height - 470 - offset);
                drawText(textoObservacoes, 65, height - 470 - (offset * 2));

                if (pngImage) {
                    page.drawImage(pngImage, {
                        x: 540,
                        y: height - 550,
                        width: 150,
                        height: 40
                    });
                }
            }
            // *** FIM DA LÓGICA CORRIGIDA ***

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const nomeArquivo = numero?.trim() || 'Checklist';
            saveAs(blob, `${nomeArquivo}.pdf`);
            alert("PDF gerado com sucesso!");
        } catch (error) {
            console.error("Erro ao carregar ou preencher o PDF:", error);
            alert("Erro ao gerar o PDF. Verifique se o arquivo base está disponível.");
        }
    };
    
    const handleScanSuccess = useCallback((decodedText) => {
        if (scannerTarget === 'serial') {
            setSerial(decodedText);
        } else if (scannerTarget === 'ppidNova') {
            setPpidPecaNova(decodedText);
        } else if (scannerTarget === 'ppidUsada') {
            setPpidPecaUsada(decodedText);
        }
        setScannerOpen(false);
    }, [scannerTarget]);

    const openScanner = (target) => {
        setScannerTarget(target);
        setScannerOpen(true);
    };

    const handleSaveSignature = (signatureData) => {
        setSignature(signatureData);
        setSignatureDialogOpen(false);
    };

    return (
        <>
            {isScannerOpen && (
                <ScannerDialog
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setScannerOpen(false)}
                />
            )}
            {isSignatureDialogOpen && (
                <SignatureDialog
                    onSave={handleSaveSignature}
                    onClose={() => setSignatureDialogOpen(false)}
                />
            )}
            <div className="checkbox-container">
                <label>
                    <input
                        type="checkbox"
                        id="samsungCheckbox"
                        checked={isSamsung}
                        onChange={() => setIsSamsung(true)}
                    />{' '}
                    Reparo Samsung
                </label>
                <label>
                    <input
                        type="checkbox"
                        id="assurantCheckbox"
                        checked={!isSamsung}
                        onChange={() => setIsSamsung(false)}
                    />{' '}
                    Visita Assurant
                </label>
            </div>

            <form id="osForm" onSubmit={handleSubmit}>
                <label htmlFor="numero">Número de Ordem de Serviço:</label>
                <input
                    type="text"
                    id="numero"
                    placeholder={isSamsung ? 'Ex: 4171234567' : 'Ex: 45111729'}
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    required
                />

                <label htmlFor="cliente">Nome do cliente:</label>
                <input
                    type="text"
                    id="cliente"
                    placeholder="Ex: Fulano de tal"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    required
                />

                <label htmlFor="tecnicoSelect">Nome do técnico:</label>
                <select
                    id="tecnicoSelect"
                    value={tecnicoSelect}
                    onChange={(e) => setTecnicoSelect(e.target.value)}
                >
                    <option value="">Selecione um técnico</option>
                    <option value="Dieliton Fonseca">Dieliton 😎</option>
                    <option value="Daniel">Daniel</option>
                    <option value="Pedro">Pedro</option>
                    <option value="Conrado">Conrado</option>
                    <option value="Jeová">Jeová</option>
                    <option value="Francisco">Francisco</option>
                    <option value="Leo">Leo</option>
                    <option value="Cassio">Cassio</option>
                    <option value="Evandro">Evandro</option>
                    <option value="Wanderley">Wanderley</option>
                    <option value="nao_achei">Não achei a opção certa</option>
                </select>

                <label
                    htmlFor="tecnicoManual"
                    className={tecnicoSelect === 'nao_achei' ? '' : 'hidden'}
                >
                    Ou digite o nome do técnico:
                </label>
                <input
                    type="text"
                    id="tecnicoManual"
                    placeholder="Ex: Fulano de Tal"
                    className={tecnicoSelect === 'nao_achei' ? '' : 'hidden'}
                    value={tecnicoManual}
                    onChange={(e) => setTecnicoManual(e.target.value)}
                />

                {isSamsung && (
                    <>
                        <label htmlFor="defeitoSelect">Código de Defeito:</label>
                        <select
                            id="defeitoSelect"
                            value={defeitoSelect}
                            onChange={(e) => setDefeitoSelect(e.target.value)}
                        >
                                <option value="">Selecione o defeito</option>
                                <option value="AXP">AXP - Uso inadequado do consumidor (VD)</option>
                                <option value="HXX">HXX - Uso inadequado do consumidor (DA)</option>
                                <option value="AXX">AXX - Outro problema</option>
                                <option value="CMK">CMK - Tela danificada pelo consumidor</option>
                                <option value="AA1">AA1 - Não Liga</option>
                                <option value="AA2">AA2 - Desliga sozinho</option>
                                <option value="AA3">AA3 - Liga/Desliga aleatoriamente</option>
                                <option value="AA4">AA4 - Desliga intermitente</option>
                                <option value="AA5">AA5 - Fonte de alimentação instável</option>
                                <option value="AB1">AB1 - Não indica funções no painel</option>
                                <option value="AB8">AB8 - Lampada/LED não funciona</option>
                                <option value="AM3">AM3 - Controle remoto não funciona</option>
                                <option value="AN4">AN4 - Wi-Fi não funciona</option>
                                <option value="AB2">AB2 - Display intermitente</option>
                                <option value="AB3">AB3 - Sujeira no display</option>
                                <option value="AE1">AE1 - Sem imagem</option>
                                <option value="AE2">AE2 - Imagem intermitente</option>
                                <option value="AE3">AE3 - Linhas horizontais</option>
                                <option value="AE4">AE4 - Linhas verticais</option>
                                <option value="AEN">AEN - Imagem distorcida</option>
                                <option value="AG1">AG1 - Sem som</option>
                                <option value="AG2">AG2 - Som intermitente</option>
                                <option value="AG4">AG4 - Som distorcido</option>
                                <option value="AM3">AM3 - Controle remoto não funciona</option>
                                <option value="TLA">AG2 - WiFi não funciona</option>
                                <option value="HE1">HE1 - Não Refrigera</option>
                                <option value="HE3">HE3 - Refrigeração excessiva</option>
                                <option value="HE7">HE7 - Dreno bloqueado</option>
                                <option value="HE9">HE9 - Vazamento de fluido refrigerante</option>
                                <option value="HF3">HF3 - Não sai água do dispenser</option>
                                <option value="HF6">HF6 - Não produz gelo</option>
                                <option value="HG2">HG2 - Não entra água</option>
                                <option value="HG4">HG4 - Não centrifuga</option>
                                <option value="HG5">HG4 - Não seca</option>
                                <option value="HG6">HG6 - Transborda água</option>
                                <option value="HG7">HG7 - Fornecimento de sabão/amaciante com defeito</option>
                                <option value="HKF">HKF - Ruído mecânico</option>
                                <option value="HK9">HK9 - Barulho excessivo</option>
                                <option value="HK2">HK2 - Barulho no ventilador</option>
                                <option value="HK3">HK3 - Barulho no compressor</option>
                                <option value="HK4">HK4 - Barulho nos tubos</option>
                                <option value="HLC">HLC - Compressor não funciona</option>
                                <option value="HLN">HLN - Porta não abre</option>
                                <option value="HA1">HA1 - Não Liga (DA)</option>
                                <option value="HG1">HG1 - Não Lava</option>
                                <option value="nao_achei">Não achei a opção certa</option>
                        </select>

                        <label htmlFor="reparoSelect">Código de Reparo:</label>
                        <select
                            id="reparoSelect"
                            value={reparoSelect}
                            onChange={(e) => setReparoSelect(e.target.value)}
                        >
                                <option value="">Selecione o reparo</option>
                                <option value="X09">X09 - Orçamento recusado!</option>
                                <option value="A04">A04 - Troca de PCB</option>
                                <option value="A10">A10 - Troca do LCD</option>
                                <option value="A01">A01 - Componente Elétrico</option>
                                <option value="A02">A02 - Componente Mecânico</option>
                                <option value="A03">A03 - Substituição de item cosmético</option>
                                <option value="A17">A17 - Substituição do sensor</option>
                                <option value="X01">X01 - NDF Nenhum defeito encontrado</option>
                                <option value="A15">A15 - Troca de compressor</option>
                                <option value="A17">A17 - Troca do sensor</option>
                                <option value="A20">A20 - Troca de acessório (ex. controle)</option>
                                <option value="nao_achei">Não achei a opção certa</option>
                        </select>

                        <label htmlFor="peca">Peça substituída:</label>
                        <input
                            type="text"
                            id="peca"
                            placeholder="Ex: Placa principal"
                            value={peca}
                            onChange={(e) => setPeca(e.target.value)}
                        />
                        
                        <label htmlFor="ppidPecaNova">PPID Peça NOVA:</label>
                        <div className="input-with-button">
                            <input
                                name="ppidPecaNova"
                                placeholder="Escaneie o código da peça nova"
                                onChange={(e) => setPpidPecaNova(e.target.value)}
                                value={ppidPecaNova}
                            />
                            <button type="button" className="scan-button" onClick={() => openScanner('ppidNova')}>
                                <ScanLine size={20} />
                            </button>
                        </div>

                        <label htmlFor="ppidPecaUsada">PPID Peça USADA:</label>
                        <div className="input-with-button">
                            <input
                                name="ppidPecaUsada"
                                placeholder="Escaneie o código da peça usada"
                                onChange={(e) => setPpidPecaUsada(e.target.value)}
                                value={ppidPecaUsada}
                            />
                            <button type="button" className="scan-button" onClick={() => openScanner('ppidUsada')}>
                                <ScanLine size={20} />
                            </button>
                        </div>
                    </>
                )}

                {!isSamsung && (
                    <>
                        <label htmlFor="defeitoManual">Qual o defeito do aparelho?</label>
                        <input
                            type="text"
                            id="defeitoManual"
                            placeholder="Descreva o defeito"
                            value={defeitoManual}
                            onChange={(e) => setDefeitoManual(e.target.value)}
                        />

                        <label htmlFor="reparoManual">Quais as peças necessárias?</label>
                        <input
                            type="text"
                            id="reparoManual"
                            placeholder="Liste as peças"
                            value={reparoManual}
                            onChange={(e) => setReparoManual(e.target.value)}
                        />
                    </>
                )}
                
                {/* MODIFICAÇÃO: Este bloco só será exibido se for Reparo Samsung */}
                {isSamsung && (
                    <div className="checkbox-container extra-options">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={orcamentoAprovado}
                                    onChange={() => setOrcamentoAprovado(!orcamentoAprovado)}
                                />{' '}
                                Orçamento aprovado e pago 
                            </label>
                            {orcamentoAprovado && (
                                <div className="valor-container">
                                    <label htmlFor="orcamentoValor">Valor (R$):</label>
                                    <input
                                        type="number"
                                        id="orcamentoValor"
                                        value={orcamentoValor}
                                        onChange={(e) => setOrcamentoValor(e.target.value)}
                                        onWheel={(e) => e.target.blur()} 
                                        placeholder="Ex: 550.00"
                                        step="0.01"
                                    />
                                </div>
                            )}
                            <label>
                                <input
                                    type="checkbox"
                                    checked={limpezaAprovada}
                                    onChange={() => setLimpezaAprovada(!limpezaAprovada)}
                                />{' '}
                                Higienização aprovada e feita
                            </label>
                    </div>
                )}

                <label htmlFor="observacoes">Observações:</label>
                <textarea
                    id="observacoes"
                    rows="4"
                    placeholder="Ex: Pagamento pendente, PPID de outras peças etc..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                ></textarea>

                {isSamsung && (
                    <>
                        <h2>Dados para o Checklist</h2>
                        <label htmlFor="tipoAparelho">Tipo de Aparelho:</label>
                        <select name="tipoAparelho" onChange={(e) => setTipoAparelho(e.target.value)} value={tipoAparelho}>
                            <option value="VD">VD</option>
                            <option value="WSM">WSM</option>
                            <option value="REF">REF</option>
                            <option value="RAC">RAC</option>
                        </select>

                        <label htmlFor="tipoChecklist">Tipo de Checklist:</label>
                        <select name="tipoChecklist" onChange={(e) => setTipoChecklist(e.target.value)} value={tipoChecklist}>
                            <option value="PREENCHIDO">Reparo Normal</option>
                            <option value="EXCLUSAO">Exclusão de Garantia</option>
                            <option value="NDF">Sem Defeito (NDF)</option>
                        </select>

                        <label htmlFor="modelo">Modelo:</label>
                        <input name="modelo" placeholder="Modelo do Aparelho" onChange={(e) => setModelo(e.target.value)} value={modelo} />

                        <label htmlFor="serial">Serial:</label>
                        <div className="input-with-button">
                            <input
                                name="serial"
                                placeholder="Número de Série"
                                onChange={(e) => setSerial(e.target.value)}
                                value={serial}
                            />
                            <button type="button" className="scan-button" onClick={() => openScanner('serial')}>
                                <ScanLine size={20} />
                            </button>
                        </div>

                        <label htmlFor="dataVisita">Data da Visita:</label>
                        <input name="dataVisita" type="date" onChange={(e) => setDataVisita(e.target.value)} value={dataVisita} />

                        <div className="signature-section-container">
                                <button type="button" onClick={() => setSignatureDialogOpen(true)}>
                                    Coletar Assinatura ✍️
                                </button>
                                {signature && (
                                    <img 
                                        src={signature} 
                                        alt="Assinatura do cliente" 
                                        style={{ 
                                            border: '1px solid #e0dbdbff', 
                                            borderRadius: '4px', 
                                            marginTop: '10px',
                                            width: '50%' 
                                        }} 
                                    />
                                )}
                        </div>
                        <button type="button" onClick={preencherPDF} style={{ marginTop: '10px' }}>Gerar Checklist PDF 📋</button>
                    </>
                )}

                <button type="submit">Gerar Resumo da OS✅</button>
                <button type="button" onClick={limparFormulario} style={{ marginTop: '10px' }}>Limpar Formulário 🧹</button>
            </form>
        </>
    );
}

export default Form;