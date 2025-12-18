import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine, Label, Cell } from 'recharts';

// Paleta de cores para o gráfico de barras
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919', '#19B2FF', '#FFC719'];

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
          <p>Estamos há <strong>{ltpVdWeeks}</strong> semanas dentro do LTP VD (&lt;= 12.8%)</p>
          <p>Estamos há <strong>{ltpDaWeeks}</strong> semanas dentro do LTP DA (&lt;= 17.4%)</p>
          <p>Estamos há <strong>{rrrVdWeeks}</strong> semanas dentro do C-RRR VD (&lt;= 2.8%)</p>
          <p>Estamos há <strong>{ihD1Weeks}</strong> semanas dentro do IH D+1 (&gt;= 20%)</p>
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
    return <p className="no-data-message">Nenhum dado de "{title}" encontrado para as últimas 8 semanas.</p>;
  }

  return (
    <div className="kpi-chart-container">
      <h3>{title} </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 80, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="name" stroke="#e0e0e0" tick={{ fill: '#e0e0e0' }} />
            <YAxis stroke="#e0e0e0" tick={{ fill: '#e0e0e0' }} domain={yAxisDomain} />
            <Tooltip content={tooltipContent} />
            <Legend wrapperStyle={{ color: '#e0e0e0', textAlign: 'center' }} />
            {dataKeys.map((key, index) => (
              <Line
                key={key.dataKey}
                type="monotone"
                dataKey={key.dataKey}
                stroke={key.stroke}
                activeDot={{ r: 8 }}
                name={key.name}
              />
            ))}
            {meta && Array.isArray(meta) ? (
              meta.map((m, idx) => (
                <ReferenceLine key={idx} y={m.value} stroke={m.stroke} strokeDasharray="3 3">
                  <Label
                    value={m.label}
                    position="right"
                    fill={m.stroke}
                    style={{ fontSize: '0.8em', textAnchor: 'start' }}
                  />
                </ReferenceLine>
              ))
            ) : (
              meta && (
                <ReferenceLine y={meta.value} stroke={meta.stroke} strokeDasharray="3 3">
                  <Label
                    value={meta.label}
                    position="right"
                    fill={meta.stroke}
                    style={{ fontSize: '0.8em', textAnchor: 'start' }}
                  />
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

          if (name.includes('%') || name.includes('FTC') || name.includes('NPS') || name.includes('VISIT') || name.includes('IN HOME') || name.includes('REPAIR')) {
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
          }

          return <p key={`item-${index}`}>{`${name}: ${displayValue}`}</p>;
        })}
      </div>
    );
  }
  return null;
};

const META_ORC_IH = 75000;

function Dashboard({ showPopup, setShowPopup }) {
  const [technicianRanking, setTechnicianRanking] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [orcamentoData, setOrcamentoData] = useState([]);
  const [limpezaData, setLimpezaData] = useState([]);


  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribes = [];
    
    const technicianStatsCollectionRef = collection(db, 'technicianStats');
    const q = query(technicianStatsCollectionRef, orderBy('totalOS', 'desc'));

    const unsubscribeTechnicianStats = onSnapshot(q, (snapshot) => {
      const allTechnicians = snapshot.docs.map(doc => ({
        name: doc.id,
        ...doc.data(),
      }));
      
      setTechnicianRanking(allTechnicians);

      const filteredOrcamento = allTechnicians
        .filter(tech => tech.orc_aprovado && tech.orc_aprovado > 0)
        .map(tech => ({
          name: tech.name,
          'Valor Orçamento (R$)': tech.orc_aprovado // Mantendo como número para o cálculo
        }));
      setOrcamentoData(filteredOrcamento);

      const filteredLimpezas = allTechnicians
        .filter(tech => tech.limpezas_realizadas && tech.limpezas_realizadas > 0)
        .sort((a, b) => b.limpezas_realizadas - a.limpezas_realizadas);
      setLimpezaData(filteredLimpezas);

      setLoading(false);
    }, (err) => {
      console.error("Erro no listener de estatísticas de técnicos:", err);
      setError("Erro ao carregar ranking de técnicos. Verifique as permissões do Firebase.");
      setLoading(false);
    });

    unsubscribes.push(unsubscribeTechnicianStats);

    const kpisCollectionRef = collection(db, 'kpis');
    const qKpis = query(kpisCollectionRef, orderBy('week', 'asc'));

    const unsubscribeKpis = onSnapshot(qKpis, (snapshot) => {
      const fetchedKpis = snapshot.docs.map(doc => ({
        name: `W ${doc.data().week}`,
        week: doc.data().week,
        ...doc.data(),
      }));
      const sortedKpis = [...fetchedKpis].sort((a, b) => a.week - b.week);
      setKpiData(sortedKpis);
    }, (err) => {
      console.error("Erro no listener de KPIs:", err);
      setError("Erro ao carregar dados de KPIs. Verifique as permissões do Firebase.");
    });

    unsubscribes.push(unsubscribeKpis);

    return () => {
      console.log("Limpando listeners do Firebase...");
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const calculateWeeklyMetrics = (dataPoint) => {
    let score = 0;
    let accelerators = 0;
    let detractors = 0;

    const ltpVd = parseFloat(dataPoint['LTP VD %']);
    const ltpDa = parseFloat(dataPoint['LTP DA %']);
    const rrrVd = parseFloat(dataPoint['RRR VD %']);
    const rrrDa = parseFloat(dataPoint['RRR DA %']);
    const rnpsVd = parseFloat(dataPoint['R-NPS VD']);
    const rnpsDa = parseFloat(dataPoint['R-NPS DA']);
    const ssrVd = parseFloat(dataPoint['SSR VD']);
    const ssrDa = parseFloat(dataPoint['SSR DA']);
    const ecoRepairVd = parseFloat(dataPoint['ECO REPAIR VD']);
    const ftcHappyCall = parseFloat(dataPoint['FTC HAPPY CALL']);

    if (ltpVd <= 5) score += 2;
    if (ltpDa <= 7) score += 1;
    if (rrrVd <= 1.5) score += 1;
    if (rrrDa <= 3) score += 1;
    if (rnpsVd >= 80) score += 0.5;
    if (rnpsDa >= 78) score += 0.5;
    if (ssrVd <= 0.4) score += 1;
    if (ssrDa <= 1.1) score += 1;
    if (ecoRepairVd >= 60) score += 1;
    if (ftcHappyCall >= 88) score += 1;

    const vendasStorePlus = parseFloat(dataPoint['VENDAS STORE+']);
    const firstVisitVd = parseFloat(dataPoint['1ST VISIT VD']);
    const poInHomeD1 = parseFloat(dataPoint['PO IN HOME D+1']);

    if (vendasStorePlus >= 3) accelerators += 1;
    if (firstVisitVd >= 20) accelerators += 1;
    if (poInHomeD1 >= 70) accelerators += 1;

    const treinamentos = parseFloat(dataPoint['Treinamentos']);
    const inHomeD1 = parseFloat(dataPoint['IN HOME D+1']);
    const orcamento = parseFloat(dataPoint['Orçamento']);

    if (treinamentos < 100) detractors += 1;
    if (inHomeD1 < 20) detractors += 1;
    if (orcamento < META_ORC_IH) detractors += 1;

    const finalScore = score + accelerators - detractors;

    return { score, accelerators, detractors, finalScore };
  };

  const weeklyScores = useMemo(() => {
    return kpiData.map(dataPoint => ({
      name: dataPoint.name,
      week: dataPoint.week,
      ...calculateWeeklyMetrics(dataPoint),
    }));
  }, [kpiData]);

  const calculateCommission = (finalScore) => {
    if (finalScore < 5) {
      return 0;
    } else if (finalScore >= 5 && finalScore < 7) {
      return 200;
    } else if (finalScore >= 7 && finalScore < 9) {
      return 300;
    } else if (finalScore >= 9) {
      return 400;
    }
    return 0;
  };

  const lastWeekScore = weeklyScores.length > 0 ? weeklyScores[weeklyScores.length - 1].finalScore : 0;
  const lastWeekCommission = calculateCommission(lastWeekScore);

  const chartData = kpiData.slice(-8);
  const ltpvdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'LTP VD %': parseFloat(d['LTP VD %']), 'LTP VD QTD': parseFloat(d['LTP VD QTD']) })), [chartData]);
  const ltpdaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'LTP DA %': parseFloat(d['LTP DA %']), 'LTP DA QTD': parseFloat(d['LTP DA QTD']) })), [chartData]);
  const exltpvdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'EX LTP VD %': parseFloat(d['EX LTP VD %']), 'EX LTP VD QTD': parseFloat(d['EX LTP VD QTD']) })), [chartData]);
  const exltpdaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'EX LPT DA %': parseFloat(d['EX LRP DA QTD']), 'EX LRP DA QTD': parseFloat(d['EX LRP DA QTD']) })), [chartData]);
  const ecoRepairVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'ECO REPAIR VD': parseFloat(d['ECO REPAIR VD']) })), [chartData]);
  const ftcHappyCallChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'FTC HAPPY CALL': parseFloat(d['FTC HAPPY CALL']) })), [chartData]);
  const poInHomeD1ChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'PO IN HOME D+1': parseFloat(d['PO IN HOME D+1']) })), [chartData]);
  const firstVisitVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, '1ST VISIT VD': parseFloat(d['1ST VISIT VD']) })), [chartData]);
  const inHomeD1ChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'IN HOME D+1': parseFloat(d['IN HOME D+1']) })), [chartData]);
  const rrrVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'RRR VD %': parseFloat(d['RRR VD %']), 'RRR VD QTD': parseFloat(d['RRR VD QTD']) })), [chartData]);
  const rrrDaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'RRR DA %': parseFloat(d['RRR DA %']), 'RRR DA QTD': parseFloat(d['RRR DA QTD']) })), [chartData]);
  const rnpsVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-NPS VD': parseFloat(d['R-NPS VD']) })), [chartData]);
  const rnpsDaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'R-NPS DA': parseFloat(d['R-NPS DA']) })), [chartData]);
  const ssrVdChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'SSR VD': parseFloat(d['SSR VD']) })), [chartData]);
  const ssrDaChartData = useMemo(() => chartData.map(d => ({ name: d.name, 'SSR DA': parseFloat(d['SSR DA']) })), [chartData]);

  // --- ALTERAÇÃO AQUI ---
  // 1. Calculamos o valor máximo do orçamento a partir do 'orcamentoData'.
  const maxBudget = Math.max(...orcamentoData.map(item => item['Valor Orçamento (R$)']), 0);

  if (loading) {
    return <div className="no-data-message">Carregando dados do Firebase...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="output">
        <PerformancePopup
            isOpen={showPopup}
            onClose={() => setShowPopup(false)}
            kpiData={kpiData}
        />
      <h3>Ranking de Ordens de Serviço ⚡</h3>
      {technicianRanking.length === 0 ? (
        <p className="no-data-message">Nenhuma ordem de serviço encontrada para o ranking.</p>
      ) : (
        <>
          <table style={{
            width: '80%',
            borderCollapse: 'collapse',
            marginTop: '20px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            <thead>
              <tr style={{ background: '#333' }}>
                <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Técnico</th>
                <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Total OS</th>
                <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>OS Samsung</th>
                <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>OS Assurant</th>
              </tr>
            </thead>
            <tbody>
              {technicianRanking.map((tecnico, index) => (
                <tr key={tecnico.name} style={{ background: index % 2 === 0 ? '#2a2a2a' : '#3a3a3a' }}>
                  <td style={{ padding: '10px', border: '1px solid #555' }}>{tecnico.name}</td>
                  <td style={{ padding: '10px', border: '1px solid #555' }}>{tecnico.totalOS}</td>
                  <td style={{ padding: '10px', border: '1px solid #555' }}>{tecnico.samsungOS}</td>
                  <td style={{ padding: '10px', border: '1px solid #555' }}>{tecnico.assurantOS}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="dashboard-section">
          <h3>Orçamento por Técnico 💲</h3>
          {orcamentoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart
                    data={orcamentoData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} />
                    {/* --- ALTERAÇÃO AQUI --- */}
                    {/* 2. Usamos o 'maxBudget' para definir o domínio, adicionamos 30% e um valor padrão caso não haja dados. */}
                    {/* 3. Removemos a segunda linha <YAxis /> que era redundante. */}
                    <YAxis domain={[0, Math.round(maxBudget * 1.3) || 100]} />
                    <Tooltip formatter={(value) => `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} /> 
                    <Bar dataKey="Valor Orçamento (R$)">
                        {orcamentoData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="no-data-message">Nenhum dado de orçamento encontrado.</p>
          )}
      </div>

      <div className="dashboard-section">
        <h3>Ranking de Higienizações 🪥</h3>
        {limpezaData.length > 0 ? (
            <table className="dashboard-table" style={{
                width: '80%',
                borderCollapse: 'collapse',
                marginTop: '20px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}>
                <thead>
                    <tr style={{ background: '#333' }}>
                        <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Posição</th>
                        <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Técnico</th>
                        <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Limpezas Realizadas</th>
                    </tr>
                </thead>
                <tbody>
                    {limpezaData.map((tech, index) => (
                    <tr key={tech.name} style={{ background: index % 2 === 0 ? '#2a2a2a' : '#3a3a3a' }}>
                        <td style={{ padding: '10px', border: '1px solid #555' }}>{index + 1}º</td>
                        <td style={{ padding: '10px', border: '1px solid #555' }}>{tech.name}</td>
                        <td style={{ padding: '10px', border: '1px solid #555' }}>{tech.limpezas_realizadas || 0}</td>
                    </tr>
                    ))}
                </tbody>
            </table>
        ) : (
            <p className="no-data-message">Nenhum dado de limpeza encontrado.</p>
        )}
      </div>

      <h3>KPIs de Desempenho 🚀</h3>
      <div className={`kpi-grid ${isMobile ? 'mobile' : ''}`}>
        <KPIChart
          data={ltpvdChartData}
          title=" LTP VD % "
          dataKeys={[{ dataKey: 'LTP VD %', stroke: '#8884d8', name: 'LTP VD %' }]}
          meta={[
            { value: 12.8, stroke: '#ffc658', label: 'Meta: 12.8%' },
            { value: 5, stroke: '#FF0000', label: 'P4P: 5%' }
          ]}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 40]}
        />

        <KPIChart
          data={ltpdaChartData}
          title=" LTP DA % ⬇️"
          dataKeys={[{ dataKey: 'LTP DA %', stroke: '#ff7300', name: 'LTP DA %' }]}
          meta={[
            { value: 17.4, stroke: '#00C49F', label: 'Meta: 17.4%' },
            { value: 7, stroke: '#FFD700', label: 'P4P: 7%' }
          ]}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 40]}
        />
        
        <KPIChart
          data={exltpvdChartData}
          title=" EX LTP VD % ⬇️"
          dataKeys={[{ dataKey: 'EX LTP VD %', stroke: '#3366FF', name: 'EX LTP VD %' }]}
          meta={{ value: 1.44, stroke: '#FFCC00', label: 'Meta: 1.44%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 10]}
        />

        <KPIChart
          data={exltpdaChartData}
          title=" EX LTP DA % ⬇️"
          dataKeys={[{ dataKey: 'EX LPT DA %', stroke: '#CC0066', name: 'EX LTP DA %' }]}
          meta={{ value: 1.50, stroke: '#99FF00', label: 'Meta: 1.50%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 10]}
        />

        <KPIChart
          data={rrrVdChartData}
          title=" RRR VD % ⬇️"
          dataKeys={[{ dataKey: 'RRR VD %', stroke: '#8A2BE2', name: 'RRR VD %' }]}
          meta={[
            { value: 2.8, stroke: '#FFCC00', label: 'Meta: 2.8%' },
            { value: 1.5, stroke: '#008080', label: 'P4P: 1.5%' }
          ]}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 15]}
        />

        <KPIChart
          data={rrrDaChartData}
          title=" RRR DA % ⬇️"
          dataKeys={[{ dataKey: 'RRR DA %', stroke: '#A52A2A', name: 'RRR DA %' }]}
          meta={[
            { value: 5, stroke: '#FF4500', label: 'Meta: 5%' },
            { value: 3, stroke: '#FFD700', label: 'P4P: 3%' }
          ]}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 15]}
        />

        <KPIChart
          data={ssrVdChartData}
          title=" SSR VD % ⬇️"
          dataKeys={[{ dataKey: 'SSR VD', stroke: '#BA55D3', name: 'SSR VD' }]}
          meta={{ value: 0.4, stroke: '#FFD700', label: 'Meta: 0.4%' }}
          tooltipContent={<CustomTooltip />}
        />

        <KPIChart
          data={ssrDaChartData}
          title=" SSR DA % ⬇️"
          dataKeys={[{ dataKey: 'SSR DA', stroke: '#FF00FF', name: 'SSR DA' }]}
          meta={{ value: 1.1, stroke: '#FFA07A', label: 'Meta: 1.1%' }}
          tooltipContent={<CustomTooltip />}
        />

        <KPIChart
          data={ecoRepairVdChartData}
          title=" ECO REPAIR VD % ⬆️"
          dataKeys={[{ dataKey: 'ECO REPAIR VD', stroke: '#4CAF50', name: 'ECO REPAIR VD' }]}
          meta={{ value: 90, stroke: '#FF5722', label: 'Meta: 90%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 100]}
        />

        <KPIChart
          data={ftcHappyCallChartData}
          title=" FTC HAPPY CALL % ⬆️"
          dataKeys={[{ dataKey: 'FTC HAPPY CALL', stroke: '#9C27B0', name: 'FTC HAPPY CALL' }]}
          meta={{ value: 88, stroke: '#FFEB3B', label: 'Meta: 88%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 100]}
        />

        <KPIChart
          data={poInHomeD1ChartData}
          title=" PO IN HOME D+1 % ⬆️"
          dataKeys={[{ dataKey: 'PO IN HOME D+1', stroke: '#3F51B5', name: 'PO IN HOME D+1' }]}
          meta={{ value: 70, stroke: '#FFC107', label: 'Meta: 70%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 100]}
        />

        <KPIChart
          data={firstVisitVdChartData}
          title=" 1ST VISIT VD % ⬆️"
          dataKeys={[{ dataKey: '1ST VISIT VD', stroke: '#FFBB28', name: '1ST VISIT VD' }]}
          meta={{ value: 20, stroke: '#FF0000', label: 'Meta: 20%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 100]}
        />

        <KPIChart
          data={inHomeD1ChartData}
          title=" IN HOME D+1 % ⬆️"
          dataKeys={[{ dataKey: 'IN HOME D+1', stroke: '#00C49F', name: 'IN HOME D+1' }]}
          meta={{ value: 25, stroke: '#FF4081', label: 'Meta: 25%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 50]}
        />

        <KPIChart
          data={rnpsVdChartData}
          title=" R-NPS VD % ⬆️"
          dataKeys={[{ dataKey: 'R-NPS VD', stroke: '#4682B4', name: 'R-NPS VD' }]}
          meta={{ value: 80, stroke: '#9ACD32', label: 'Meta: 80%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 100]}
        />

        <KPIChart
          data={rnpsDaChartData}
          title=" R-NPS DA % ⬆️"
          dataKeys={[{ dataKey: 'R-NPS DA', stroke: '#FF4500', name: 'R-NPS DA' }]}
          meta={{ value: 78, stroke: '#ADFF2F', label: 'Meta: 78%' }}
          tooltipContent={<CustomTooltip />}
          yAxisDomain={[0, 100]}
        />
      </div>

      
      {isMobile ? (
        <>
          <h1 style={{ color: '#e0e0e0', marginTop: '30px', marginBottom: '20px', textAlign: 'center' }}>Histórico Semanal 📈</h1>
          {weeklyScores.length === 0 ? (
            <p className="no-data-message">Nenhuma pontuação semanal encontrada.</p>
          ) : (
            weeklyScores.map((dataPoint, index) => (
              <div key={dataPoint.name} style={{ marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                <h1 style={{ fontSize: '1.2em', margin: '5px 0', textAlign: 'center' }}>{dataPoint.name}</h1>
                <p style={{ textAlign: 'center' }}>Pontuação: {dataPoint.score}</p>
                <p style={{ textAlign: 'center' }}>Aceleradores: {dataPoint.accelerators}</p>
                <p style={{ textAlign: 'center' }}>Detratores: {dataPoint.detractors}</p>
                <p style={{ textAlign: 'center' }}>Resultado: {dataPoint.finalScore.toFixed(1)}</p>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <h3>Histórico Semanal 📈 </h3>
          {weeklyScores.length === 0 ? (
            <p className="no-data-message">Nenhuma pontuação semanal encontrada.</p>
          ) : (
            <table style={{
              width: '80%',
              borderCollapse: 'collapse',
              marginTop: '20px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              <thead>
                <tr style={{ background: '#333' }}>
                  <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Semana</th>
                  <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Pontuação</th>
                  <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Aceleradores</th>
                  <th style={{ padding: '10px', border: '1px solid #555', textAlign: 'left' }}>Detratores</th>
                  <th style={{ padding: '10px', border: '1px solid #555' }}>Final</th>
                </tr>
              </thead>
              <tbody>
                {weeklyScores.map((dataPoint, index) => (
                  <tr key={dataPoint.name} style={{ background: index % 2 === 0 ? '#2a2a2a' : '#3a3a3a' }}>
                    <td style={{ padding: '10px', border: '1px solid #555' }}>{dataPoint.name}</td>
                    <td style={{ padding: '10px', border: '1px solid #555' }}>{dataPoint.score}</td>
                    <td style={{ padding: '10px', border: '1px solid #555' }}>{dataPoint.accelerators}</td>
                    <td style={{ padding: '10px', border: '1px solid #555' }}>{dataPoint.detractors}</td>
                    <td style={{ padding: '10px', border: '1px solid #555' }}>{dataPoint.finalScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {weeklyScores.length > 0 && (
        <h1 style={{ color: '#9e9e9e', marginTop: '30px', marginBottom: '20px', textAlign: 'center' }}>
          Comissionamento baseado na última semana:
          R$ {lastWeekCommission.toFixed(2)}
        </h1>
      )}
    </div>
  );
}

export default Dashboard;