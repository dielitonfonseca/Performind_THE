import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, doc, setDoc, serverTimestamp, getDoc, updateDoc, increment, arrayUnion, addDoc } from 'firebase/firestore';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { ScanLine, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import ScannerDialog from './ScannerDialog';
import SignatureDialog from './SignatureDialog';

function Form({ setFormData }) {
    // --- ESTADOS ---
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

    // Estado para localização, status e MENSAGEM DO BOTÃO
    const [userLocation, setUserLocation] = useState(null);
    const [locationStatus, setLocationStatus] = useState('idle'); // idle, loading, success, error
    const [locationMsg, setLocationMsg] = useState('Obter Localização 📍'); // Texto dinâmico do botão

    // --- SINCRONIZAÇÃO OFFLINE ---
    const syncOfflineData = async () => {
        const offlineQueue = JSON.parse(localStorage.getItem('offlineOSQueue') || '[]');
        
        if (offlineQueue.length === 0) return;

        const confirmSync = window.confirm(`Internet detectada! Existem ${offlineQueue.length} OS(s) salvas offline. Deseja sincronizar agora?`);
        if (!confirmSync) return;

        console.log(`Iniciando sincronização de ${offlineQueue.length} ordens...`);
        
        const newQueue = [];
        let successCount = 0;

        for (const item of offlineQueue) {
            try {
                const { 
                    tecnicoFinal, dateString, targetCollectionName, numeroOS, payload, 
                    valorNumerico, limpezaAprovada, tipoOS 
                } = item;

                console.log(`Sincronizando OS: ${numeroOS}...`);

                // 1. Salvar estrutura de Pastas
                const tecnicoDocRef = doc(db, 'ordensDeServico', tecnicoFinal);
                await setDoc(tecnicoDocRef, { nome: tecnicoFinal }, { merge: true });

                const osPorDataCollectionRef = collection(tecnicoDocRef, 'osPorData');
                const dataDocRef = doc(osPorDataCollectionRef, dateString);
                await setDoc(dataDocRef, { data: dateString }, { merge: true });

                const targetCollectionRef = collection(dataDocRef, targetCollectionName);
                const osDocRef = doc(targetCollectionRef, numeroOS);

                // 2. Salvar a OS
                await setDoc(osDocRef, {
                    ...payload,
                    dataGeracao: serverTimestamp(),
                    sincronizadoEm: new Date().toISOString(),
                    origem: "offline_sync"
                });

                // 3. Atualizar Estatísticas
                const statsDocRef = doc(db, 'technicianStats', tecnicoFinal);
                const statsUpdateData = {
                    totalOS: increment(1),
                    lastUpdate: serverTimestamp(),
                    samsungOS: increment(tipoOS === 'samsung' ? 1 : 0),
                    assurantOS: increment(tipoOS === 'assurant' ? 1 : 0),
                };

                if (valorNumerico > 0) {
                    statsUpdateData.orc_aprovado = increment(valorNumerico);
                    statsUpdateData.lista_orcamentos_aprovados = arrayUnion(numeroOS);
                }
                if (limpezaAprovada) {
                    statsUpdateData.limpezas_realizadas = increment(1);
                    statsUpdateData.lista_limpezas = arrayUnion(numeroOS);
                }

                await updateDoc(statsDocRef, statsUpdateData).catch(async () => {
                    const initialStats = {
                        totalOS: 1,
                        samsungOS: tipoOS === 'samsung' ? 1 : 0,
                        assurantOS: tipoOS === 'assurant' ? 1 : 0,
                        orc_aprovado: valorNumerico,
                        limpezas_realizadas: limpezaAprovada ? 1 : 0,
                        lista_orcamentos_aprovados: valorNumerico > 0 ? [numeroOS] : [],
                        lista_limpezas: limpezaAprovada ? [numeroOS] : [],
                        lastUpdate: serverTimestamp()
                    };
                    await setDoc(statsDocRef, initialStats);
                });

                // 4. Sincronizar Rastreamento (se houver localização no payload offline)
                if (payload.localizacao) {
                    const rastroData = {
                        ...payload.localizacao,
                        timestamp: serverTimestamp(),
                        dataLocal: new Date().toISOString(),
                        origem: 'sync_offline',
                        osVinculada: numeroOS
                    };
                    await addDoc(collection(db, 'rastreamento', tecnicoFinal, 'historico'), rastroData);
                    await setDoc(doc(db, 'rastreamento', tecnicoFinal), {
                        lastLocation: rastroData,
                        updatedAt: serverTimestamp(),
                        nome: tecnicoFinal
                    }, { merge: true });
                }

                successCount++;
            } catch (error) {
                console.error(`Erro ao sincronizar OS ${item.numeroOS}:`, error);
                newQueue.push(item);
            }
        }

        localStorage.setItem('offlineOSQueue', JSON.stringify(newQueue));
        
        if (successCount > 0) alert(`${successCount} OS(s) sincronizada(s) com sucesso! 🚀`);
        if (newQueue.length > 0) alert(`Atenção: ${newQueue.length} OS(s) falharam na sincronização.`);
    };

    useEffect(() => {
        const handleOnline = () => syncOfflineData();
        window.addEventListener('online', handleOnline);
        if (navigator.onLine) syncOfflineData();
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    // 🔴 LOCALIZAÇÃO COM ATUALIZAÇÃO IMEDIATA NO FIREBASE 🔴
    // Função auxiliar para salvar no Firebase imediatamente ao obter coordenadas
    const saveLocationToFirebase = async (locationData) => {
        const techName = localStorage.getItem('savedTechName') || localStorage.getItem('tecnico');
        
        // Só salva se tiver técnico identificado e internet
        if (!techName || !navigator.onLine) return;

        try {
            const rastroData = {
                ...locationData,
                timestamp: serverTimestamp(),
                dataLocal: new Date().toISOString(),
                origem: 'atualizacao_manual', // Flag indicando que não foi gerada OS, foi abertura/botão
                osVinculada: null
            };

            // 1. Atualiza Última Localização (para o mapa "Todos")
            await setDoc(doc(db, 'rastreamento', techName), {
                lastLocation: rastroData,
                updatedAt: serverTimestamp(),
                nome: techName
            }, { merge: true });

            // 2. Adiciona ao Histórico
            await addDoc(collection(db, 'rastreamento', techName, 'historico'), rastroData);
            
            console.log(`📍 Localização de ${techName} enviada para nuvem (sem OS).`);
        } catch (e) {
            console.error("Erro ao salvar localização em background:", e);
        }
    };

    const requestLocation = () => {
        if (!("geolocation" in navigator)) {
            alert("Seu navegador não suporta geolocalização.");
            setLocationStatus('error');
            setLocationMsg('Erro: Não suportado');
            return;
        }

        setLocationStatus('loading');
        setLocationMsg('Buscando...');
        
        const options = {
            enableHighAccuracy: true,
            timeout: 30000,           
            maximumAge: 600000        // Aceita cache de 10 minutos
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                };

                setUserLocation(newLocation);
                setLocationStatus('success');

                // 🔥 ENVIA PARA O FIREBASE IMEDIATAMENTE 🔥
                saveLocationToFirebase(newLocation);

                // Lógica de texto do botão
                const age = Date.now() - position.timestamp;
                if (age > 2000) {
                    setLocationMsg("Utilizando localização anterior");
                } else if (!navigator.onLine) {
                    setLocationMsg("Localização offline encontrada");
                } else {
                    setLocationMsg("Localização Obtida");
                }

                console.log("Localização obtida:", position.coords);
            },
            (error) => {
                console.error("Erro ao obter localização:", error);
                let msg = "Erro desconhecido.";
                if (error.code === 1) msg = "Permissão negada.";
                else if (error.code === 2) msg = "Sinal indisponível.";
                else if (error.code === 3) msg = "Tempo limite.";
                
                alert(`${msg}\n\nTente novamente.`);
                setLocationStatus('error');
                setLocationMsg('Tentar Novamente');
            },
            options
        );
    };

    // Solicita localização ao montar o componente (App aberto)
    useEffect(() => {
        requestLocation();
        // eslint-disable-next-line
    }, []);

    // Hooks de localStorage para técnico...
    useEffect(() => {
        const tecnicoSalvo = localStorage.getItem('tecnico');
        if (tecnicoSalvo) {
            if (['Dieliton Fonseca', 'Matheus Lindoso', 'Yago Giordanny', 'Pablo Henrique', 'Wallysson Cesar', 'Claudio Cris', 'Matheus Henrique'].includes(tecnicoSalvo)) {
                setTecnicoSelect(tecnicoSalvo);
                setTecnicoManual('');
            } else {
                setTecnicoSelect('nao_achei');
                setTecnicoManual(tecnicoSalvo);
            }
        }
    }, []);

    useEffect(() => {
        const nomeFinal = tecnicoSelect === 'nao_achei' ? tecnicoManual : tecnicoSelect;
        if(nomeFinal) {
            localStorage.setItem('tecnico', nomeFinal);
            localStorage.setItem('savedTechName', nomeFinal); 
        }
    }, [tecnicoSelect, tecnicoManual]);

    useEffect(() => {
        if (!isSamsung) {
            setOrcamentoAprovado(false);
            setOrcamentoValor('');
            setLimpezaAprovada(false);
        }
    }, [isSamsung]);

    const getISOWeek = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

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
        if (orcamentoAprovado && orcamentoValor) obsText += `Orçamento aprovado: R$ ${orcamentoValor}\n`;
        if (limpezaAprovada) obsText += 'Limpeza realizada\n';
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

        // 1. Bloqueio por falta de localização
        if (!userLocation) {
            alert("ATENÇÃO: A localização não foi capturada. Garanta que a localização está ativada e tente novamente.");
            return; 
        }

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

        try {
            const today = new Date();
            const weekNumber = getISOWeek(today);
            const year = today.getFullYear();
            const dateString = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            const dataHoraFormatada = today.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const valorNumerico = (orcamentoAprovado && orcamentoValor) ? parseFloat(orcamentoValor) : 0;
            const targetCollectionName = isSamsung ? 'Samsung' : 'Assurant';

            const payloadDoc = {
                numeroOS, cliente: clienteNome, tecnico: tecnicoFinal, tipoOS,
                defeito: defeitoFinal, reparo: reparoFinal, pecaSubstituida: pecaFinal,
                ppidPecaNova, ppidPecaUsada, observacoes,
                semana: weekNumber, ano: year, valorOrcamento: valorNumerico, isLimpeza: limpezaAprovada,
                dataHoraCriacao: dataHoraFormatada,
                localizacao: userLocation, 
                dataGeracaoLocal: new Date().toISOString()
            };

            // --- FLUXO OFFLINE ---
            if (!navigator.onLine) {
                const offlineData = {
                    tecnicoFinal, dateString, targetCollectionName, numeroOS, payload: payloadDoc,
                    valorNumerico, limpezaAprovada, tipoOS
                };
                const currentQueue = JSON.parse(localStorage.getItem('offlineOSQueue') || '[]');
                currentQueue.push(offlineData);
                localStorage.setItem('offlineOSQueue', JSON.stringify(currentQueue));

                setFormData(`[MODO OFFLINE 📡] OS ${numeroOS} salva no dispositivo.\n\n${resultadoTexto}`);
                alert("⚠️ Sem internet! Dados salvos no dispositivo. Serão enviados automaticamente quando a conexão voltar.");
                limparFormulario();
                return;
            }

            // --- FLUXO ONLINE ---
            const tecnicoDocRef = doc(db, 'ordensDeServico', tecnicoFinal);
            await setDoc(tecnicoDocRef, { nome: tecnicoFinal }, { merge: true });

            const osPorDataCollectionRef = collection(tecnicoDocRef, 'osPorData');
            const dataDocRef = doc(osPorDataCollectionRef, dateString);
            await setDoc(dataDocRef, { data: dateString }, { merge: true });

            const targetCollectionRef = collection(dataDocRef, targetCollectionName);
            const osDocRef = doc(targetCollectionRef, numeroOS);

            await setDoc(osDocRef, { ...payloadDoc, dataGeracao: serverTimestamp() });

            const statsDocRef = doc(db, 'technicianStats', tecnicoFinal);
            const statsUpdateData = {
                totalOS: increment(1),
                lastUpdate: serverTimestamp(),
                samsungOS: increment(tipoOS === 'samsung' ? 1 : 0),
                assurantOS: increment(tipoOS === 'assurant' ? 1 : 0),
            };
            if (valorNumerico > 0) {
                statsUpdateData.orc_aprovado = increment(valorNumerico);
                statsUpdateData.lista_orcamentos_aprovados = arrayUnion(numeroOS);
            }
            if (limpezaAprovada) {
                statsUpdateData.limpezas_realizadas = increment(1);
                statsUpdateData.lista_limpezas = arrayUnion(numeroOS);
            }
            
            await updateDoc(statsDocRef, statsUpdateData).catch(async () => {
                const initialStatsData = {
                    totalOS: 1,
                    samsungOS: tipoOS === 'samsung' ? 1 : 0,
                    assurantOS: tipoOS === 'assurant' ? 1 : 0,
                    orc_aprovado: valorNumerico, 
                    limpezas_realizadas: limpezaAprovada ? 1 : 0,
                    lista_orcamentos_aprovados: valorNumerico > 0 ? [numeroOS] : [],
                    lista_limpezas: limpezaAprovada ? [numeroOS] : [],
                    lastUpdate: serverTimestamp()
                };
                await setDoc(statsDocRef, initialStatsData);
            });

            // 🔴 ATUALIZAR RASTREAMENTO COM FLAG DE OS 🔴
            try {
                const rastroData = {
                    ...userLocation,
                    timestamp: serverTimestamp(),
                    dataLocal: new Date().toISOString(),
                    origem: 'geracao_os',   // FLAG DE ORDEM DE SERVIÇO
                    osVinculada: numeroOS   // VÍNCULO COM A OS
                };
                
                // Salva no Histórico
                await addDoc(collection(db, 'rastreamento', tecnicoFinal, 'historico'), rastroData);
                
                // Salva como última localização
                await setDoc(doc(db, 'rastreamento', tecnicoFinal), {
                    lastLocation: rastroData,
                    updatedAt: serverTimestamp(),
                    nome: tecnicoFinal
                }, { merge: true });
            } catch (errRastro) {
                console.error("Erro ao salvar rastreamento:", errRastro);
            }

            setFormData(resultadoTexto);
            console.log('Ordem de serviço e estatísticas atualizadas com sucesso!');
            alert(`Resumo gerado! OS registrada na Semana ${weekNumber}.`);

        } catch (e) {
            console.error("Erro ao adicionar documento: ", e);
            alert('Erro ao processar dados. Se estiver sem internet, tente novamente (o modo offline deve ativar).');
        }
    };

    const preencherPDF = async () => {
        let baseFileName = '';
        switch (tipoAparelho) {
            case 'VD': baseFileName = `/Checklist DTV_IH41_${tipoChecklist}.pdf`; break;
            case 'WSM': baseFileName = `/checklist_WSM_${tipoChecklist}.pdf`; break;
            case 'REF': baseFileName = `/checklist_REF_${tipoChecklist}.pdf`; break;
            case 'RAC': baseFileName = `/checklist_RAC_${tipoChecklist}.pdf`; break;
            default: alert('Tipo de aparelho inválido.'); return;
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
            
            let defeitoFinalText = defeitoManual;
            let reparoFinalText = reparoManual;
            if(isSamsung) {
                const defeitoElement = document.getElementById('defeitoSelect');
                if (defeitoElement.selectedIndex > 0) defeitoFinalText = defeitoElement.options[defeitoElement.selectedIndex].text;
                const reparoElement = document.getElementById('reparoSelect');
                if(reparoElement.selectedIndex > 0) reparoFinalText = reparoElement.options[reparoElement.selectedIndex].text;
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

            if (tipoAparelho === 'VD') {
                drawText("FERNANDES COMUNICAÇÕES", 119, height - 72);
                drawText(cliente, 90, height - 85);
                drawText(modelo, 90, height - 100);
                drawText(serial, 420, height - 87);
                drawText(numero, 420, height - 72);
                drawText(dataFormatada, 450, height - 100);
                drawText(tecnicoFinal, 120, height - 800);
                drawText(textoDefeito, 70, height - 750);
                drawText(textoReparo, 70, height - 750 - offset);
                drawText(textoObservacoes, 70, height - 750 - (offset * 2));

                if (pngImage) page.drawImage(pngImage, { x: 390, y: height - 820, width: 165, height: 55 });
            } else if (tipoAparelho === 'WSM') {
                drawText("FERNANDES COMUNICAÇÕES", 100, height - 0);
                drawText(`${cliente}`, 77, height - 125);
                drawText(`${modelo}`, 77, height - 137);
                drawText(`${serial}`, 590, height - 125);
                drawText(`${numero}`, 590, height - 110);
                drawText(`${dataFormatada}`, 605, height - 137);
                drawText(`${tecnicoFinal}`, 110, height - 534);
                drawText(textoDefeito, 65, height - 470);
                drawText(textoReparo, 65, height - 470 - offset);
                drawText(textoObservacoes, 65, height - 470 - (offset * 2));

                if (pngImage) page.drawImage(pngImage, { x: 550, y: height - 550, width: 150, height: 40 });
            } else if (tipoAparelho === 'REF') {
                drawText("FERNANDES COMUNICAÇÕES", 100, height - 0);
                drawText(`${cliente}`, 87, height - 130);
                drawText(`${modelo}`, 87, height - 147);
                drawText(`${serial}`, 660, height - 132);
                drawText(`${numero}`, 660, height - 115);
                drawText(`${dataFormatada}`, 665, height - 147);
                drawText(`${tecnicoFinal}`, 114, height - 538);
                drawText(textoDefeito, 65, height - 465);
                drawText(textoReparo, 65, height - 465 - offset);
                drawText(textoObservacoes, 65, height - 465 - (offset * 2));

                if (pngImage) page.drawImage(pngImage, { x: 600, y: height - 550, width: 150, height: 40 });
            } else if (tipoAparelho === 'RAC') {
                drawText("FERNANDES COMUNICAÇÕES", 140, height - 0);
                drawText(`${cliente}`, 87, height - 116);
                drawText(`${modelo}`, 87, height - 127);
                drawText(`${serial}`, 532, height - 116);
                drawText(`${numero}`, 537, height - 105);
                drawText(`${dataFormatada}`, 552, height - 128);
                drawText(`${tecnicoFinal}`, 114, height - 533);
                drawText(textoDefeito, 65, height - 470);
                drawText(textoReparo, 65, height - 470 - offset);
                drawText(textoObservacoes, 65, height - 470 - (offset * 2));

                if (pngImage) page.drawImage(pngImage, { x: 540, y: height - 550, width: 150, height: 40 });
            }

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
        if (scannerTarget === 'serial') setSerial(decodedText);
        else if (scannerTarget === 'ppidNova') setPpidPecaNova(decodedText);
        else if (scannerTarget === 'ppidUsada') setPpidPecaUsada(decodedText);
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
            {isScannerOpen && <ScannerDialog onScanSuccess={handleScanSuccess} onClose={() => setScannerOpen(false)} />}
            {isSignatureDialogOpen && <SignatureDialog onSave={handleSaveSignature} onClose={() => setSignatureDialogOpen(false)} />}
            
            <div className="checkbox-container">
                <label><input type="checkbox" id="samsungCheckbox" checked={isSamsung} onChange={() => setIsSamsung(true)} /> Reparo Samsung</label>
                <label><input type="checkbox" id="assurantCheckbox" checked={!isSamsung} onChange={() => setIsSamsung(false)} /> Visita Assurant</label>
            </div>

            <form id="osForm" onSubmit={handleSubmit}>
                <label htmlFor="numero">Número de Ordem de Serviço:</label>
                <input type="text" id="numero" placeholder={isSamsung ? 'Ex: 4171234567' : 'Ex: 45111729'} value={numero} onChange={(e) => setNumero(e.target.value)} required />

                <label htmlFor="cliente">Nome do cliente:</label>
                <input type="text" id="cliente" placeholder="Ex: Fulano de tal" value={cliente} onChange={(e) => setCliente(e.target.value)} required />

                <label htmlFor="tecnicoSelect">Nome do técnico:</label>
                <select id="tecnicoSelect" value={tecnicoSelect} onChange={(e) => setTecnicoSelect(e.target.value)}>
                    <option value="">Selecione um técnico</option>
                    <option value="Dieliton Fonseca">Dieliton 😎</option>
                    <option value="Matheus Lindoso">Matheus Lindoso</option>
                    <option value="Claudio Cris">Claudio Cris</option>
                    <option value="Wallysson Cesar">Wallysson Cesar</option>
                    <option value="Pablo Henrique">Pablo Henrique</option>
                    <option value="Matheus Henrique">Matheus Henrique</option>
                    <option value="Yago Giordanny">Yago Giordanny</option>
                    <option value="nao_achei">Não achei a opção certa</option>
                </select>

                <label htmlFor="tecnicoManual" className={tecnicoSelect === 'nao_achei' ? '' : 'hidden'}>Ou digite o nome do técnico:</label>
                <input type="text" id="tecnicoManual" placeholder="Ex: Fulano de Tal" className={tecnicoSelect === 'nao_achei' ? '' : 'hidden'} value={tecnicoManual} onChange={(e) => setTecnicoManual(e.target.value)} />
                
                {/* --- BOTÃO DE LOCALIZAÇÃO ADAPTADO --- */}
                <div className="location-control" style={{ marginBottom: '15px' }}>
                    <label>Localização:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                            type="button" 
                            onClick={requestLocation}
                            disabled={locationStatus === 'loading' || locationStatus === 'success'}
                            style={{ 
                                background: locationStatus === 'success' ? '#4CAF50' : (locationStatus === 'error' ? '#FF5722' : '#2196F3'),
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '8px 15px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: locationStatus === 'success' ? 'default' : 'pointer',
                                minWidth: '180px',
                                justifyContent: 'center'
                            }}
                        >
                            {locationStatus === 'loading' && 'Buscando...'}
                            {locationStatus === 'success' && <><CheckCircle size={16}/> {locationMsg}</>}
                            {locationStatus === 'error' && <><AlertCircle size={16}/> {locationMsg}</>}
                            {locationStatus === 'idle' && <><MapPin size={16}/> Obter Localização 📍</>}
                        </button>
                    </div>
                    {locationStatus === 'error' && <small style={{color: '#FF5722'}}>Habilite a localização no navegador ou verifique sua conexão.</small>}
                </div>

                {isSamsung && (
                    <>
                        <label htmlFor="defeitoSelect">Código de Defeito:</label>
                        <select id="defeitoSelect" value={defeitoSelect} onChange={(e) => setDefeitoSelect(e.target.value)}>
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
                        <select id="reparoSelect" value={reparoSelect} onChange={(e) => setReparoSelect(e.target.value)}>
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
                        <input type="text" id="peca" placeholder="Ex: Placa principal" value={peca} onChange={(e) => setPeca(e.target.value)} />
                        
                        <label htmlFor="ppidPecaNova">PPID Peça NOVA:</label>
                        <div className="input-with-button">
                            <input name="ppidPecaNova" placeholder="Escaneie o código da peça nova" onChange={(e) => setPpidPecaNova(e.target.value)} value={ppidPecaNova} />
                            <button type="button" className="scan-button" onClick={() => openScanner('ppidNova')}><ScanLine size={20} /></button>
                        </div>

                        <label htmlFor="ppidPecaUsada">PPID Peça USADA:</label>
                        <div className="input-with-button">
                            <input name="ppidPecaUsada" placeholder="Escaneie o código da peça usada" onChange={(e) => setPpidPecaUsada(e.target.value)} value={ppidPecaUsada} />
                            <button type="button" className="scan-button" onClick={() => openScanner('ppidUsada')}><ScanLine size={20} /></button>
                        </div>
                    </>
                )}

                {!isSamsung && (
                    <>
                        <label htmlFor="defeitoManual">Qual o defeito do aparelho?</label>
                        <input type="text" id="defeitoManual" placeholder="Descreva o defeito" value={defeitoManual} onChange={(e) => setDefeitoManual(e.target.value)} />

                        <label htmlFor="reparoManual">Quais as peças necessárias?</label>
                        <input type="text" id="reparoManual" placeholder="Liste as peças" value={reparoManual} onChange={(e) => setReparoManual(e.target.value)} />
                    </>
                )}
                
                {isSamsung && (
                    <div className="checkbox-container extra-options">
                            <label><input type="checkbox" checked={orcamentoAprovado} onChange={() => setOrcamentoAprovado(!orcamentoAprovado)} /> Orçamento aprovado e pago</label>
                            {orcamentoAprovado && (
                                <div className="valor-container">
                                    <label htmlFor="orcamentoValor">Valor (R$):</label>
                                    <input type="number" id="orcamentoValor" value={orcamentoValor} onChange={(e) => setOrcamentoValor(e.target.value)} onWheel={(e) => e.target.blur()} placeholder="Ex: 550.00" step="0.01" />
                                </div>
                            )}
                            <label><input type="checkbox" checked={limpezaAprovada} onChange={() => setLimpezaAprovada(!limpezaAprovada)} /> Higienização aprovada e feita</label>
                    </div>
                )}

                <label htmlFor="observacoes">Observações:</label>
                <textarea id="observacoes" rows="4" placeholder="Ex: Pagamento pendente, PPID de outras peças etc..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)}></textarea>

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
                            <input name="serial" placeholder="Número de Série" onChange={(e) => setSerial(e.target.value)} value={serial} />
                            <button type="button" className="scan-button" onClick={() => openScanner('serial')}><ScanLine size={20} /></button>
                        </div>

                        <label htmlFor="dataVisita">Data da Visita:</label>
                        <input name="dataVisita" type="date" onChange={(e) => setDataVisita(e.target.value)} value={dataVisita} />

                        <div className="signature-section-container">
                                <button type="button" onClick={() => setSignatureDialogOpen(true)}>Coletar Assinatura ✍️</button>
                                {signature && <img src={signature} alt="Assinatura do cliente" style={{ border: '1px solid #e0dbdbff', borderRadius: '4px', marginTop: '10px', width: '50%' }} />}
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