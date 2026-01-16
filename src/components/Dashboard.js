// src/components/Dashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, orderBy, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine, Label, Cell, ComposedChart, ReferenceArea } from 'recharts';

// --- ESTILOS CSS GLOBAIS ---
const globalStyles = `
  /* Variáveis de Cor */
  :root {
    --theme-color: #00C49F;
    --theme-bg: #222;
    --theme-input-bg: #333;
  }

  /* --- CORREÇÃO DO LAYOUT (IMPEDE QUEBRA DA TELA) --- */
  .dashboard-container {
    width: 100%;
    max-width: 100vw; /* Garante que não ultrapasse a largura da janela */
    overflow-x: hidden; /* Esconde qualquer estouro horizontal */
    box-sizing: border-box;
    padding-bottom: 50px; /* Espaço extra no final */
  }

  .dashboard-section {
    width: 100%;
    box-sizing: border-box; /* Garante que o padding não aumente a largura */
  }

  /* Tooltip Style */
  .info-icon-container {
    display: inline-block;
    position: relative;
    margin-left: 8px;
    cursor: help;
  }
  .info-icon {
    font-size: 0.8em;
    color: #888;
    border: 1px solid #888;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tooltip-text {
    visibility: hidden;
    width: 220px;
    background-color: #000;
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 8px;
    position: absolute;
    z-index: 10; /* Z-index alto para ficar acima de tudo */
    bottom: 125%;
    left: 50%;
    margin-left: -110px;
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.7em;
    text-transform: none;
    font-weight: normal;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .tooltip-text::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #000 transparent transparent transparent;
  }
  .info-icon-container:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }

  /* Scrollbar Minimalista */
  .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #2a2a2a; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #777; }
  .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #555 #2a2a2a; }

  /* --- LAYOUT DE FILTROS COMPACTO E RESPONSIVO --- */
  .filter-container {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: flex-end;
    justify-content: center;
    background: #333;
    padding: 15px;
    border-radius: 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    min-width: 150px;
  }

  .filter-label {
    color: #ccc;
    margin-bottom: 5px;
    font-size: 0.9em;
  }

  .filter-input {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #555;
    background: #222;
    color: #fff;
    outline: none;
    transition: border-color 0.3s;
    width: 100%; /* Ocupa 100% do grupo */
    box-sizing: border-box;
  }

  .filter-input:focus {
    border-color: var(--theme-color);
  }

  .filter-btn-container {
    align-self: flex-end;
  }

  .filter-btn {
    padding: 8px 25px;
    background: var(--theme-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.9em;
    height: 35px;
  }

  /* Layout Mobile: Aproximar itens e ajustar margens */
  @media (max-width: 768px) {
    .dashboard-section {
        margin-top: 10px !important;
        padding: 10px !important;
        width: 100%;
        overflow: hidden; /* Evita que o conteúdo interno estoure */
    }

    .filter-container {
      gap: 8px; 
      padding: 10px;
      justify-content: space-between; 
    }
    
    .filter-group {
      width: 48%; /* 2 por linha */
      min-width: 0; 
      margin-bottom: 5px;
    }

    .filter-label {
      margin-bottom: 2px;
      font-size: 0.75em;
    }

    .filter-input {
      padding: 4px;
      font-size: 0.8em;
      height: 32px;
    }

    .filter-btn-container {
      width: 100%;
      margin-top: 5px;
    }
    
    .filter-btn {
      width: 100%;
      height: 35px;
      font-size: 0.85em;
    }
  }

  /* --- CARDS DE RESUMO --- */
  .summary-container {
    display: flex;
    justify-content: space-around;
    margin: 30px 0;
    gap: 15px;
    width: 100%;
    box-sizing: border-box;
  }
  
  .summary-card {
    text-align: center;
    padding: 15px;
    background: #333;
    border-radius: 8px;
    min-width: 150px;
    flex: 1;
  }

  .summary-title {
    margin: 0;
    color: #ccc;
    font-size: 0.9em;
    text-transform: uppercase;
  }

  .summary-value {
    font-size: 24px;
    font-weight: bold;
    margin: 5px 0;
  }

  @media (max-width: 768px) {
    .summary-container { margin: 10px 0; gap: 8px; }
    .summary-card { padding: 8px; min-width: 0; }
    .summary-title { font-size: 0.65em; }
    .summary-value { font-size: 16px; margin: 2px 0; }
  }
  
  /* Ajuste no container do gráfico para não estourar */
  .chart-wrapper {
    width: 100%;
    height: 350px;
    overflow: hidden; /* Essencial para gráficos responsivos */
  }
`;

// --- DEFINIÇÕES DE TEXTO E TOOLTIP POR MÉTRICA ---
const METRIC_DEFINITIONS = {
  productivity: {
    title: "MÉDIA DIÁRIA",
    tooltip: "Total de OSs / Intervalo",
    prefix: "",
    suffix: ""
  },
  adjustedProductivity: {
    title: "APROVAÇÃO PERCENTUAL",
    tooltip: "Percentual de orçamentos aprovados",
    prefix: "",
    suffix: "%"
  },
  totalApprovedBudget: {
    title: "ORÇAMENTO APROVADO",
    tooltip: "Soma de todos os valores do intervalo",
    prefix: "R$ ",
    suffix: ""
  },
  avgApprovedRevenue: {
    title: "RECEITA MÉDIA POR OS",
    tooltip: "Somatória de aprovações / Quantidade de aprovações",
    prefix: "R$ ",
    suffix: ""
  },
  revenuePerOrder: {
    title: "APROVAÇÃO MÉDIA",
    tooltip: "Receita total / Total de OSs",
    prefix: "R$ ",
    suffix: ""
  }
};

const calculateConsecutiveWeeks = (kpis, key, threshold, condition) => {
  let consecutiveWeeks = 0;
  for (let i = kpis.length - 1; i >= 0; i--) {
    const kpi = kpis[i];
    if (!kpi || typeof kpi[key] === 'undefined') {
        continue;
    }
    const value = parseFloat(kpi[key]);

    let conditionMet = false;
    if (condition === 'less') {
      conditionMet = value <= threshold;
    } else if (condition === 'greater') {
      conditionMet = value >= threshold;
    }

    if (conditionMet) {
      consecutiveWeeks++;
    } else {
      break;
    }
  }
  return consecutiveWeeks;
};

const PerformancePopup = ({ isOpen, onClose, kpiData }) => {
  if (!isOpen) return null;

  const ltpVdWeeks = calculateConsecutiveWeeks(kpiData, 'LTP VD %', 12.8, 'less');
  const ltpDaWeeks = calculateConsecutiveWeeks(kpiData, 'LTP DA %', 17.4, 'less');
  const rrrVdWeeks = calculateConsecutiveWeeks(kpiData, 'RRR VD %', 2.8, 'less');
  const ihD1Weeks = calculateConsecutiveWeeks(kpiData, 'IN HOME D+1', 20, 'greater');
  const firstVisitVdWeeks = calculateConsecutiveWeeks(kpiData, '1ST VISIT VD', 20, 'greater');
  const p4pLtpVdWeeks = calculateConsecutiveWeeks(kpiData, 'LTP VD %', 5, 'less');
  const p4pLtpDaWeeks = calculateConsecutiveWeeks(kpiData, 'LTP DA %', 7, 'less');
  const p4pRrrVdWeeks = calculateConsecutiveWeeks(kpiData, 'RRR VD %', 1.5, 'less');

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-body">
          <h2>Metas Contínuas</h2>
          {/* SÍMBOLOS CORRIGIDOS PARA HTML ENTITIES */}
          <p>Estamos há <strong>{ltpVdWeeks}</strong> semanas dentro do LTP VD (&lt;= 12.8%)</p>
          <p>Estamos há <strong>{ltpDaWeeks}</strong> semanas dentro do LTP DA (&lt;= 17.4%)</p>
          <p>Estamos há <strong>{rrrVdWeeks}</strong> semanas dentro do C-RRR VD (&lt;= 2.8%)</p>
          <p>Estamos há <strong>{ihD1Weeks}</strong> semanas dentro do Perfect Agenda (&gt;= 20%)</p>
          <p>Estamos há <strong>{firstVisitVdWeeks}</strong> semanas dentro do 1ST VISIT CI (&gt;= 20%)</p>
          <hr />
          <h3>Pay For Performance (P4P)</h3>
          <p>Estamos há <strong>{p4pLtpVdWeeks}</strong> semanas dentro do LTP VD (&lt;= 5%)</p>
          <p>Estamos há <strong>{p4pLtpDaWeeks}</strong> semanas dentro do LTP DA (&lt;= 7%)</p>
          <p>Estamos há <strong>{p4pRrrVdWeeks}</strong> semanas dentro do CRRR VD (&lt;= 1.5%)</p>
        </div>
        <div className="dialog-footer">
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

const KPIChart = ({ data, title, dataKeys, meta, tooltipContent, yAxisDomain = [0, 'auto'] }) => {
  if (!data || data.length === 0) {
    return <p className="no-data-message">Nenhum dado de "{title}" encontrado para as últimas 10 semanas.</p>;
  }

  return (
    <div className="kpi-chart-container" style={{ width: '100%', overflow: 'hidden' }}>
      <h3>{title} </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {/* --- CORREÇÃO DE MARGEM AQUI --- */}
          <LineChart data={data} margin={{ top: 25, right: 80, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#e0e0e0" tick={{ fill: '#e0e0e0' }} />
            <YAxis stroke="#e0e0e0" tick={{ fill: '#e0e0e0' }} domain={yAxisDomain} />
            <Tooltip content={tooltipContent} />
            <Legend wrapperStyle={{ color: '#e0e0e0', textAlign: 'center' }} />
            {dataKeys.map((key, index) => (
              <Line key={key.dataKey} type="monotone" dataKey={key.dataKey} stroke={key.stroke} activeDot={{ r: 8 }} name={key.name} />
            ))}
            {meta && Array.isArray(meta) ? (
              meta.map((m, idx) => (
                <ReferenceLine key={idx} y={m.value} stroke={m.stroke} strokeDasharray="3 3">
                  <Label value={m.label} position="right" fill={m.stroke} style={{ fontSize: '0.8em', textAnchor: 'start' }} />
                </ReferenceLine>
              ))
            ) : (
              meta && (
                <ReferenceLine y={meta.value} stroke={meta.stroke} strokeDasharray="3 3">
                  <Label value={meta.label} position="right" fill={meta.stroke} style={{ fontSize: '0.8em', textAnchor: 'start' }} />
                </ReferenceLine>
              )
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="label">{label}</p>
        {payload.map((entry, index) => {
          const { name, value } = entry;
          let displayValue = value;
          if (name.includes('%') || name.includes('FTC') || name.includes('NPS') || name.includes('VISIT') || name.includes('AGENDA') || name.includes('REPAIR')) {
            displayValue = `${value}%`;
          }
           if (name.includes('LTP VD %') && dataPoint['LTP VD QTD'] !== undefined) {
            displayValue += ` (QTD: ${dataPoint['LTP VD QTD']})`;
          } else if (name.includes('LTP DA %') && dataPoint['LTP DA QTD'] !== undefined) {
            displayValue += ` (QTD: ${dataPoint['LTP DA QTD']})`;
          } else if (name.includes('EX LTP VD %') && dataPoint['EX LTP VD QTD'] !== undefined) {
            displayValue += ` (QTD: ${dataPoint['EX LTP VD QTD']})`;
          } else if (name.includes('EX LPT DA %') && dataPoint['EX LRP DA QTD'] !== undefined) {
            displayValue += ` (QTD: ${dataPoint['EX LRP DA QTD']})`;
          } else if (name.includes('RRR VD %') && dataPoint['RRR VD QTD'] !== undefined) {
            displayValue += ` (QTD: ${dataPoint['RRR VD QTD']})`;
          } else if (name.includes('RRR DA %') && dataPoint['RRR DA QTD'] !== undefined) {
            displayValue += ` (QTD: ${dataPoint['RRR DA QTD']})`;
          } else if (name === 'Receita Média por Ordem' || name === 'Receita Média por OS' || name === 'Orçamento Aprovado') {
            displayValue = `R$ ${value.toFixed(2)}`;
          } else if (name === 'Produtividade Ajustada') {
            displayValue = `${value.toFixed(1)}%`;
          } else if (name === 'Produtividade') {
            displayValue = value.toFixed(1);
          }
          return <p key={`item-${index}`}>{`${name}: ${displayValue}`}</p>;
        })}
      </div>
    );
  }
  return null;
};

const InfoPopup = ({ text }) => (
    <div className="info-icon-container">
        <span className="info-icon">i</span>
        <span className="tooltip-text">{text}</span>
    </div>
);

function Dashboard({ showPopup, setShowPopup }) {
  const [technicianRanking, setTechnicianRanking] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // INICIO COM 'today' (HOJE) POR PADRÃO
  const [filterType, setFilterType] = useState('today'); 
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  
  // INICIO COM 'Todos'
  const [filterTech, setFilterTech] = useState('Todos');
  const [filterMetric, setFilterMetric] = useState('productivity'); 

  const [filteredResults, setFilteredResults] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ESTADOS PARA EASTER EGG (OCULTAR COLUNAS)
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);
  const [clickBuffer, setClickBuffer] = useState([]); // Buffer para cliques temporizados

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 1. CARREGAR CACHE (MODIFICADO: NÃO CARREGA 'filterType' para manter 'today') ---
  useEffect(() => {
    const loadCachedState = async () => {
        try {
            const docRef = doc(db, 'dashboard_cache', 'last_state');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // CORREÇÃO: Não sobrescrever o filterType 'today' padrão com o cache 'week' antigo.
                // setFilterType(data.filters.filterType || 'today'); // REMOVIDO
                
                setFilterStartDate(data.filters.filterStartDate || '');
                setFilterEndDate(data.filters.filterEndDate || '');
                setSelectedWeek(data.filters.selectedWeek || '');
                setFilterTech('Todos'); // Força Todos
                setFilterMetric(data.filters.filterMetric || 'productivity');
                
                if (data.results) {
                    setFilteredResults(data.results);
                }
            }
        } catch (e) {
            console.warn("Erro ao carregar cache do dashboard:", e);
        }
    };
    loadCachedState();
  }, []);

  // --- 2. LISTENERS DO FIREBASE ---
  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribes = [];
    
    // Técnicos
    const technicianStatsCollectionRef = collection(db, 'technicianStats');
    const q = query(technicianStatsCollectionRef, orderBy('totalOS', 'desc'));
    const unsubscribeTechnicianStats = onSnapshot(q, (snapshot) => {
      const allTechnicians = snapshot.docs.map(doc => ({ name: doc.id, ...doc.data() }));
      setTechnicianRanking(allTechnicians);
      setLoading(false);
    }, (err) => {
      setError("Erro ao carregar lista de técnicos.");
      setLoading(false);
    });
    unsubscribes.push(unsubscribeTechnicianStats);

    // KPIs
    const kpisCollectionRef = collection(db, 'kpis');
    const qKpis = query(kpisCollectionRef, orderBy('week', 'asc'));
    const unsubscribeKpis = onSnapshot(qKpis, (snapshot) => {
      const fetchedKpis = snapshot.docs.map(doc => ({
        name: `W ${String(doc.data().week).padStart(2, '0')}`,
        week: doc.data().week,
        ...doc.data(),
      }));
      
      const hasEndYear = fetchedKpis.some(k => k.week >= 40);
      const hasStartYear = fetchedKpis.some(k => k.week <= 12);
      
      let sortedKpis = [];
      if (hasEndYear && hasStartYear) {
          const nextYearWeeks = fetchedKpis.filter(k => k.week <= 12);
          const currentYearWeeks = fetchedKpis.filter(k => k.week > 12);
          sortedKpis = [...currentYearWeeks, ...nextYearWeeks];
      } else {
          sortedKpis = [...fetchedKpis].sort((a, b) => a.week - b.week);
      }
      setKpiData(sortedKpis);

      if (sortedKpis.length > 0 && !initialLoadDone && selectedWeek === '') {
          setSelectedWeek('current');
      }
    }, (err) => setError("Erro ao carregar dados de KPIs."));

    unsubscribes.push(unsubscribeKpis);
    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, []); 

  // --- 3. REFRESH AUTOMÁTICO (CORRIGIDO PARA EVITAR LOOP) ---
  useEffect(() => {
      if (technicianRanking.length > 0 && kpiData.length > 0) {
          // Se o filtro for semana e não tiver selecionada, não faz
          if (filterType === 'week' && selectedWeek === '') return;
          
          // Se o filtro for 'today', roda o handleFilter sem depender do selectedWeek
          handleFilter();
          setInitialLoadDone(true);
      }
      // eslint-disable-next-line 
      // Removemos 'selectedWeek' das dependências se filterType for 'today' para evitar reload desnecessário
  }, [technicianRanking, kpiData, filterMetric, filterType, selectedWeek]);

  const getCurrentWeekNumber = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getDateRangeOfWeek = (w) => {
    let targetWeek = w;
    const today = new Date();
    let year = today.getFullYear();
    if (w === 'current') targetWeek = getCurrentWeekNumber();
    if (today.getMonth() === 0 && targetWeek > 40) year = year - 1;
    
    const simple = new Date(year, 0, 1);
    const days = (targetWeek - 1) * 7;
    simple.setDate(simple.getDate() + days);
    
    const day = simple.getDay();
    const diff = simple.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(simple.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0]
    };
  };

  const handleFilter = async () => {
    let startStr = filterStartDate;
    let endStr = filterEndDate;

    // 1. Definição do intervalo SELECIONADO pelo usuário
    if (filterType === 'week') {
        if (!selectedWeek) return;
        const range = getDateRangeOfWeek(selectedWeek);
        startStr = range.start;
        endStr = range.end;
    } else if (filterType === 'today') {
        // Lógica para HOJE - Ajuste fuso horário para garantir que 'hoje' é realmente hoje local
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        startStr = todayStr;
        endStr = todayStr;
    } else {
        if (!filterStartDate || !filterEndDate) {
            return;
        }
    }

    setIsFiltering(true);

    // 2. Cálculo do intervalo EXPANDIDO (Buffer para contexto no gráfico)
    const contextDays = 4; // Dias a mais antes e depois para mostrar contexto
    // IMPORTANTE: Criar data com "T00:00:00" para evitar problemas de fuso ao converter string->Date
    const selectedStart = new Date(startStr + "T00:00:00");
    const selectedEnd = new Date(endStr + "T00:00:00");
    
    const expandedStart = new Date(selectedStart);
    expandedStart.setDate(expandedStart.getDate() - contextDays);
    
    const expandedEnd = new Date(selectedEnd);
    expandedEnd.setDate(expandedEnd.getDate() + contextDays);

    const dates = [];
    // Gera datas para o intervalo EXPANDIDO
    for (let dt = new Date(expandedStart); dt <= expandedEnd; dt.setDate(dt.getDate() + 1)) {
        dates.push(dt.toISOString().split('T')[0]);
    }

    const techsToSearch = filterTech === 'Todos' 
        ? technicianRanking.map(t => t.name) 
        : [filterTech];

    const dailyData = {}; 
    const detailedList = []; 

    dates.forEach(date => {
        dailyData[date] = { date, osCount: 0, revenue: 0, budgetCount: 0 };
    });

    try {
        for (const tech of techsToSearch) {
            try {
                for (const date of dates) {
                    const samsungRef = collection(db, 'ordensDeServico', tech, 'osPorData', date, 'Samsung');
                    const assurantRef = collection(db, 'ordensDeServico', tech, 'osPorData', date, 'Assurant');
    
                    const [samsungSnap, assurantSnap] = await Promise.all([getDocs(samsungRef), getDocs(assurantRef)]);
    
                    const processDoc = (docSnap) => {
                        const data = docSnap.data();

                        if (!data.dataHoraCriacao) {
                            return; 
                        }

                        let osValue = 0;
                        if (data.valorOrcamento !== undefined) {
                            osValue = parseFloat(data.valorOrcamento);
                        } else {
                            const match = (data.observacoes || '').match(/Orçamento aprovado:\s*R?\$\s*([\d.,]+)/i);
                            if (match && match[1]) {
                                let valStr = match[1].replace('R$', '').trim();
                                if (valStr.includes(',') && valStr.includes('.')) {
                                    valStr = valStr.replace(/\./g, '').replace(',', '.');
                                } else if (valStr.includes(',')) {
                                    valStr = valStr.replace(',', '.');
                                }
                                osValue = parseFloat(valStr) || 0;
                            }
                        }
                        if (isNaN(osValue)) osValue = 0;
                        const hasBudget = osValue > 0;

                        if (dailyData[date]) {
                            dailyData[date].osCount += 1;
                            dailyData[date].revenue += osValue;
                            if (hasBudget) dailyData[date].budgetCount += 1;
                        }
                        
                        const typeCapitalized = data.tipoOS ? data.tipoOS.charAt(0).toUpperCase() + data.tipoOS.slice(1) : 'N/A';
                        detailedList.push({
                            id: docSnap.id,
                            date: date,
                            tech: tech,
                            client: data.cliente,
                            type: typeCapitalized, 
                            value: osValue,
                            timestampStr: data.dataHoraCriacao,
                            // NOVO: Adiciona a localização recuperada do Firebase
                            location: data.localizacao || null 
                        });
                    };
                    samsungSnap.forEach(processDoc);
                    assurantSnap.forEach(processDoc);
                }
            } catch (err) { console.warn(`Erro técnico ${tech}:`, err); }
        }

        // 3. Processamento para Exibição
        const chartData = Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        chartData.forEach(d => {
            d.revenuePerOrder = d.osCount > 0 ? d.revenue / d.osCount : 0;
            d.adjustedProductivity = d.osCount > 0 ? (d.budgetCount / d.osCount) * 100 : 0;
            d.avgApprovedRevenue = d.budgetCount > 0 ? d.revenue / d.budgetCount : 0;
        });

        const selectedItems = detailedList.filter(item => item.date >= startStr && item.date <= endStr);
        
        selectedItems.sort((a, b) => {
            const dateA = a.timestampStr ? new Date(a.timestampStr).getTime() : new Date(a.date).getTime();
            const dateB = b.timestampStr ? new Date(b.timestampStr).getTime() : new Date(b.date).getTime();
            return dateB - dateA;
        });

        const totalOS = selectedItems.length;
        const totalRevenue = selectedItems.reduce((acc, curr) => acc + curr.value, 0);
        const approvedCount = selectedItems.filter(i => i.value > 0).length;
        
        // Correção de dias no intervalo para Produtividade
        let daysCount = 1; 
        if(filterType !== 'today') {
            daysCount = (selectedEnd - selectedStart) / (1000 * 60 * 60 * 24) + 1;
        }

        let summaryValue = 0;

        switch(filterMetric) {
            case 'revenuePerOrder':
                summaryValue = totalOS > 0 ? totalRevenue / totalOS : 0;
                break;
            case 'productivity':
                summaryValue = daysCount > 0 ? totalOS / daysCount : 0;
                break;
            case 'adjustedProductivity':
                summaryValue = totalOS > 0 ? (approvedCount / totalOS) * 100 : 0;
                break;
            case 'avgApprovedRevenue':
                summaryValue = approvedCount > 0 ? totalRevenue / approvedCount : 0;
                break;
            case 'totalApprovedBudget':
                summaryValue = totalRevenue;
                break;
            default:
                summaryValue = totalRevenue;
        }

        const resultsObj = {
            totalOS: totalOS,
            summaryValue: summaryValue,
            chartData, 
            detailedList: selectedItems, 
            selectedRange: { start: startStr, end: endStr } 
        };

        setFilteredResults(resultsObj);

        // Atualiza cache, mas NÃO SALVA filterType como "today" para não bugar a lógica do cache se mudar.
        try {
            await setDoc(doc(db, 'dashboard_cache', 'last_state'), {
                updatedAt: new Date().toISOString(),
                filters: {
                    filterType,
                    filterStartDate,
                    filterEndDate,
                    selectedWeek,
                    filterTech,
                    filterMetric
                },
                results: resultsObj
            });
        } catch (cacheErr) {
            console.warn("Falha ao salvar cache:", cacheErr);
        }

    } catch (e) {
        console.error("Erro filtro:", e);
    } finally {
        setIsFiltering(false);
    }
  };

  const chartData = kpiData.slice(-10);
  
  const ltpvdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'LTP VD %': parseFloat(d['LTP VD %']), 'LTP VD QTD': parseFloat(d['LTP VD QTD']) })), [chartData]);
  const ltpdaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'LTP DA %': parseFloat(d['LTP DA %']), 'LTP DA QTD': parseFloat(d['LTP DA QTD']) })), [chartData]);
  const exltpvdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'EX LTP VD %': parseFloat(d['EX LTP VD %']), 'EX LTP VD QTD': parseFloat(d['EX LTP VD QTD']) })), [chartData]);
  const exltpdaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'EX LPT DA %': parseFloat(d['EX LPT DA %']), 'EX LRP DA QTD': parseFloat(d['EX LRP DA QTD']) })), [chartData]);
  const ecoRepairVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'ECO REPAIR VD': parseFloat(d['ECO REPAIR VD']) })), [chartData]);
  const ftcHappyCallChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'FTC HAPPY CALL': parseFloat(d['FTC HAPPY CALL']) })), [chartData]);
  const poInHomeD1ChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'PO IN HOME D+1': parseFloat(d['PO IN HOME D+1']) })), [chartData]);
  const firstVisitVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, '1ST VISIT VD': parseFloat(d['1ST VISIT VD']) })), [chartData]);
  const inHomeD1ChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'Perfect Agenda': parseFloat(d['IN HOME D+1']) })), [chartData]); 
  const rrrVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'RRR VD %': parseFloat(d['RRR VD %']), 'RRR VD QTD': parseFloat(d['RRR VD QTD']) })), [chartData]);
  const rrrDaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'RRR DA %': parseFloat(d['RRR DA %']), 'RRR DA QTD': parseFloat(d['RRR DA QTD']) })), [chartData]);
  const rnpsVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-NPS VD': parseFloat(d['R-NPS VD']) })), [chartData]);
  const rnpsDaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-NPS DA': parseFloat(d['R-NPS DA']) })), [chartData]);
  const rTatChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-TAT': parseFloat(d['R-TAT']) })), [chartData]);
  const rTatVdCiChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-TAT VD CI': parseFloat(d['R-TAT VD CI']) })), [chartData]);
  const rTatVdIhChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-TAT VD IH': parseFloat(d['R-TAT VD IH']) })), [chartData]);
  const rTatDaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-TAT DA': parseFloat(d['R-TAT DA']) })), [chartData]);

  if (loading) return <div className="no-data-message">Carregando dados do Firebase...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const detailedListDisplay = filteredResults ? (
    (filterMetric === 'avgApprovedRevenue' || filterMetric === 'adjustedProductivity' || filterMetric === 'totalApprovedBudget') 
        ? filteredResults.detailedList.filter(item => item.value > 0)
        : filteredResults.detailedList
  ) : [];

  const currentMetricInfo = METRIC_DEFINITIONS[filterMetric];

  // --- LÓGICA DE CLIQUE TRIPLO REFINADA ---
  const handleTitleClick = () => {
    const now = Date.now();
    // Filtra cliques que aconteceram há menos de 500ms
    const recentClicks = clickBuffer.filter(time => now - time < 500);
    
    // Adiciona o clique atual
    const newBuffer = [...recentClicks, now];
    setClickBuffer(newBuffer);
    
    console.log("Cliques detectados:", newBuffer.length); // DEBUG

    if (newBuffer.length >= 3) {
        setShowHiddenColumns(prev => !prev);
        setClickBuffer([]); // Reseta após ativar
        console.log("Easter Egg Ativado/Desativado!");
    }
  };

  return (
    // ADICIONADA CLASS 'dashboard-container' PARA CORRIGIR OVERFLOW
    <div className="output dashboard-container">
        <style>{globalStyles}</style>
        <PerformancePopup isOpen={showPopup} onClose={() => setShowPopup(false)} kpiData={kpiData} />
      
      <div className="dashboard-section" style={{ marginTop: '20px', padding: '20px', background: '#222', borderRadius: '8px' }}>
        <h3 onClick={handleTitleClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
            Relatórios Detalhados 📊 
            {/* Opcional: mostrar um indicador visual sutil se estiver ativado, ou deixar totalmente invisível */}
        </h3>
        
        {/* --- CONTAINER DE FILTROS COM CSS RESPONSIVO (CLASSES) --- */}
        <div className="filter-container">
             <div className="filter-group">
                <label className="filter-label">Intervalo:</label>
                <select className="filter-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="today">Hoje</option>
                    <option value="week">Semanal</option>
                    <option value="date">Por data</option>
                </select>
            </div>

            {filterType === 'date' ? (
                <>
                    <div className="filter-group">
                        <label className="filter-label">Data Início:</label>
                        <input className="filter-input" type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
                    </div>
                    <div className="filter-group">
                        <label className="filter-label">Data Fim:</label>
                        <input className="filter-input" type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
                    </div>
                </>
            ) : filterType === 'week' ? (
                <div className="filter-group">
                    <label className="filter-label">Semana:</label>
                    <select className="filter-input" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
                        {kpiData.map(kpi => (
                            <option key={kpi.week} value={kpi.week}>Semana {String(kpi.week).padStart(2, '0')}</option>
                        ))}
                        <option value="current">Semana Atual</option>
                    </select>
                </div>
            ) : null }

            <div className="filter-group">
                <label className="filter-label">Técnico:</label>
                <select className="filter-input" value={filterTech} onChange={(e) => setFilterTech(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {technicianRanking.map(tech => <option key={tech.name} value={tech.name}>{tech.name}</option>)}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">Filtro:</label>
                <select className="filter-input" value={filterMetric} onChange={(e) => setFilterMetric(e.target.value)}>
                    <option value="productivity">Produtividade</option>
                    <option value="adjustedProductivity">Produtividade Ajustada</option>
                    <option value="totalApprovedBudget">Orçamento Aprovado</option>
                    <option value="avgApprovedRevenue">Média Orçamento Aprovado</option>
                    <option value="revenuePerOrder">Receita Média por Ordem</option>
                </select>
            </div>

            <div className="filter-btn-container">
                <button className="filter-btn" onClick={handleFilter} disabled={isFiltering}>
                    {isFiltering ? '...' : 'BUSCAR'}
                </button>
            </div>
        </div>

        {filteredResults && (
            <div className="filter-results">
                <div className="summary-container">
                    <div className="summary-card">
                        <h4 className="summary-title">TOTAL OS</h4>
                        <p className="summary-value" style={{ color: '#fff' }}>{filteredResults.totalOS}</p>
                    </div>
                    
                    <div className="summary-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <h4 className="summary-title">{currentMetricInfo.title}</h4>
                            <InfoPopup text={currentMetricInfo.tooltip} />
                        </div>
                        <p className="summary-value" style={{ color: '#00C49F' }}>
                            {currentMetricInfo.prefix}
                            {(filteredResults.summaryValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {currentMetricInfo.suffix}
                        </p>
                    </div>
                </div>

                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredResults.chartData}>
                            <CartesianGrid stroke="#444" strokeDasharray="3 3" />
                            <XAxis dataKey="date" stroke="#ccc" tickFormatter={(str) => {
                                // CORREÇÃO: Parse manual da string YYYY-MM-DD
                                if (!str) return '';
                                const parts = str.split('-'); 
                                if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                                return str;
                            }} />
                            <YAxis yAxisId="left" stroke="#8884d8" />
                            <Tooltip contentStyle={{ backgroundColor: '#333', borderColor: '#555' }} labelStyle={{ color: '#fff' }} formatter={(value, name) => {
                                if(name === 'Receita Média por Ordem' || name === 'Receita Média por OS' || name === 'Orçamento Aprovado') return `R$ ${parseFloat(value).toFixed(2)}`;
                                if(name === 'Produtividade Ajustada') return `${parseFloat(value).toFixed(1)}%`;
                                return parseFloat(value).toFixed(2);
                            }} />
                            <Legend />
                            {/* Área de Destaque para o Intervalo Selecionado */}
                            {filteredResults.selectedRange && (
                                <ReferenceArea 
                                    yAxisId="left"
                                    x1={filteredResults.selectedRange.start} 
                                    x2={filteredResults.selectedRange.end} 
                                    fill="#00C49F" 
                                    fillOpacity={0.15} 
                                />
                            )}

                            {filterMetric === 'revenuePerOrder' && <Line yAxisId="left" type="monotone" dataKey="revenuePerOrder" name="Receita Média por Ordem" stroke="#00C49F" strokeWidth={3} />}
                            {filterMetric === 'productivity' && <Bar yAxisId="left" dataKey="osCount" name="Produtividade" barSize={20} fill="#00C49F" />}
                            {filterMetric === 'adjustedProductivity' && <Line yAxisId="left" type="monotone" dataKey="adjustedProductivity" name="Produtividade Ajustada" stroke="#FF8042" strokeWidth={3} />}
                            {filterMetric === 'avgApprovedRevenue' && <Line yAxisId="left" type="monotone" dataKey="avgApprovedRevenue" name="Receita Média por OS" stroke="#00C49F" strokeWidth={3} />}
                            {filterMetric === 'totalApprovedBudget' && <Bar yAxisId="left" type="monotone" dataKey="revenue" name="Orçamento Aprovado" barSize={20} fill="#00C49F" />}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                
                {detailedListDisplay.length > 0 && (
                  <div className="custom-scrollbar" style={{ marginTop: '30px', maxHeight: '300px', overflowY: 'auto', overflowX: 'auto' }}>
                    <h4 style={{ textAlign: 'center', color: '#ccc' }}>Detalhamento ({detailedListDisplay.length} registros no intervalo selecionado)</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                      <thead>
                        <tr style={{ background: '#444', color: '#fff' }}>
                          <th style={{ padding: '8px', textAlign: 'center' }}>#</th>
                          {/* --- COLUNA SO --- */}
                          <th style={{ padding: '8px', textAlign: 'center' }}>SO</th>
                          
                          {/* --- COLUNAS OCULTAS POR PADRÃO (EASTER EGG) - ORDEM ALTERADA --- */}
                          {showHiddenColumns && (
                            <>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Hora/Data</th>
                                {/* LOCALIZAÇÃO A DIREITA DE DATA/HORA */}
                                <th style={{ padding: '8px', textAlign: 'center' }}>Localização</th>
                                {/* PRECISÃO AO LADO DE LOCALIZAÇÃO */}
                                <th style={{ padding: '8px', textAlign: 'center' }}>Precisão</th>
                            </>
                          )}

                          <th style={{ padding: '8px', textAlign: 'center' }}>Técnico</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Cliente</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Tipo</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Orçamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedListDisplay.map((item, idx) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? '#2a2a2a' : '#333', borderBottom: '1px solid #444' }}>
                            <td style={{ padding: '8px', textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.id}</td>
                            
                            {/* --- EXIBIÇÃO CONDICIONAL DAS COLUNAS OCULTAS --- */}
                            {showHiddenColumns && (
                                <>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>{item.timestampStr}</td>
                                    
                                    {/* LOCALIZAÇÃO COM LINK PARA GOOGLE MAPS */}
                                    <td style={{ padding: '8px', textAlign: 'center', fontSize: '0.8em', color: '#aaa' }}>
                                        {item.location ? (
                                            <a 
                                                href={`https://www.google.com/maps?q=${item.location.latitude},${item.location.longitude}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ color: '#00C49F', textDecoration: 'underline', cursor: 'pointer' }}
                                                title="Abrir no Google Maps"
                                            >
                                                {item.location.latitude.toFixed(5)}, {item.location.longitude.toFixed(5)}
                                            </a>
                                        ) : 'N/A'}
                                    </td>

                                    {/* COLUNA DE PRECISÃO (EM METROS) */}
                                    <td style={{ padding: '8px', textAlign: 'center', fontSize: '0.8em', color: '#aaa' }}>
                                        {item.location && item.location.accuracy 
                                            ? `${Math.round(item.location.accuracy)} m` 
                                            : '-'
                                        }
                                    </td>
                                </>
                            )}

                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.tech}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.client}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.type}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.value > 0 ? `R$ ${item.value.toFixed(2)}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
        )}
    </div>

      <div className="dashboard-section" style={{ marginTop: '20px', padding: '20px', background: '#222', borderRadius: '8px' }}>
          <h3>KPIs de Desempenho 🚀</h3>
          <div className={`kpi-grid ${isMobile ? 'mobile' : ''}`}>
            {/* GRÁFICOS COM A COR #00C49F APLICADA NO LUGAR DOS AZUIS */}
            <KPIChart data={ltpvdChartData} title=" LTP VD % ⬇️" dataKeys={[{ dataKey: 'LTP VD %', stroke: '#00C49F', name: 'LTP VD %' }]} meta={[{ value: 12.8, stroke: '#ffc658', label: 'Meta: 12.8%' }, { value: 5, stroke: '#FF0000', label: 'P4P: 5%' }]} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 40]} />
            <KPIChart data={ltpdaChartData} title=" LTP DA % ⬇️" dataKeys={[{ dataKey: 'LTP DA %', stroke: '#ff7300', name: 'LTP DA %' }]} meta={[{ value: 17.4, stroke: '#00C49F', label: 'Meta: 17.4%' }, { value: 7, stroke: '#FFD700', label: 'P4P: 7%' }]} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 40]} />
            <KPIChart data={exltpvdChartData} title=" EX LTP VD % ⬇️" dataKeys={[{ dataKey: 'EX LTP VD %', stroke: '#00C49F', name: 'EX LTP VD %' }]} meta={{ value: 1.44, stroke: '#FFCC00', label: 'Meta: 1.44%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 10]} />
            <KPIChart data={exltpdaChartData} title=" EX LTP DA % ⬇️" dataKeys={[{ dataKey: 'EX LPT DA %', stroke: '#CC0066', name: 'EX LTP DA %' }]} meta={{ value: 1.50, stroke: '#99FF00', label: 'Meta: 1.50%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 10]} />
            <KPIChart data={rrrVdChartData} title=" RRR VD % ⬇️" dataKeys={[{ dataKey: 'RRR VD %', stroke: '#8A2BE2', name: 'RRR VD %' }]} meta={[{ value: 2.8, stroke: '#FFCC00', label: 'Meta: 2.8%' }, { value: 1.5, stroke: '#008080', label: 'P4P: 1.5%' }]} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 15]} />
            <KPIChart data={rrrDaChartData} title=" RRR DA % ⬇️" dataKeys={[{ dataKey: 'RRR DA %', stroke: '#A52A2A', name: 'RRR DA %' }]} meta={[{ value: 5, stroke: '#FF4500', label: 'Meta: 5%' }, { value: 3, stroke: '#FFD700', label: 'P4P: 3%' }]} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 15]} />
            <KPIChart data={ecoRepairVdChartData} title=" ECO REPAIR VD % ⬆️" dataKeys={[{ dataKey: 'ECO REPAIR VD', stroke: '#4CAF50', name: 'ECO REPAIR VD' }]} meta={{ value: 60, stroke: '#FF5722', label: 'Meta: 90%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 100]} />
            <KPIChart data={ftcHappyCallChartData} title=" FTC HAPPY CALL % ⬆️" dataKeys={[{ dataKey: 'FTC HAPPY CALL', stroke: '#9C27B0', name: 'FTC HAPPY CALL' }]} meta={{ value: 88, stroke: '#FFEB3B', label: 'Meta: 88%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 100]} />
            <KPIChart data={poInHomeD1ChartData} title=" PO IN HOME D+1 % ⬆️" dataKeys={[{ dataKey: 'PO IN HOME D+1', stroke: '#00C49F', name: 'PO IN HOME D+1' }]} meta={{ value: 70, stroke: '#FFC107', label: 'Meta: 70%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 100]} />
            <KPIChart data={firstVisitVdChartData} title=" 1ST VISIT VD % ⬆️" dataKeys={[{ dataKey: '1ST VISIT VD', stroke: '#FFBB28', name: '1ST VISIT VD' }]} meta={{ value: 20, stroke: '#FF0000', label: 'Meta: 20%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 100]} />
            <KPIChart data={inHomeD1ChartData} title=" Perfect Agenda % ⬆️"  dataKeys={[{ dataKey: 'Perfect Agenda', stroke: '#00C49F', name: 'Perfect Agenda' }]} meta={{ value: 25, stroke: '#FF4081', label: 'Meta: 25%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 50]} />
            <KPIChart data={rTatChartData} title=" R-TAT (Geral) ⬇️" dataKeys={[{ dataKey: 'R-TAT', stroke: '#E91E63', name: 'R-TAT' }]} tooltipContent={<CustomTooltip />} />
            <KPIChart data={rTatVdCiChartData} title=" R-TAT VD CI ⬇️" dataKeys={[{ dataKey: 'R-TAT VD CI', stroke: '#9C27B0', name: 'R-TAT VD CI' }]} tooltipContent={<CustomTooltip />} />
            <KPIChart data={rTatVdIhChartData} title=" R-TAT VD IH ⬇️" dataKeys={[{ dataKey: 'R-TAT VD IH', stroke: '#00C49F', name: 'R-TAT VD IH' }]} tooltipContent={<CustomTooltip />} />
            <KPIChart data={rTatDaChartData} title=" R-TAT DA ⬇️" dataKeys={[{ dataKey: 'R-TAT DA', stroke: '#00C49F', name: 'R-TAT DA' }]} tooltipContent={<CustomTooltip />} />
            <KPIChart data={rnpsVdChartData} title=" R-NPS VD % ⬆️" dataKeys={[{ dataKey: 'R-NPS VD', stroke: '#00C49F', name: 'R-NPS VD' }]} meta={{ value: 80, stroke: '#9ACD32', label: 'Meta: 80%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 100]} />
            <KPIChart data={rnpsDaChartData} title=" R-NPS DA % ⬆️" dataKeys={[{ dataKey: 'R-NPS DA', stroke: '#FF4500', name: 'R-NPS DA' }]} meta={{ value: 78, stroke: '#ADFF2F', label: 'Meta: 78%' }} tooltipContent={<CustomTooltip />} yAxisDomain={[0, 100]} />
          </div>
      </div>
    </div>
  );
}

export default Dashboard;