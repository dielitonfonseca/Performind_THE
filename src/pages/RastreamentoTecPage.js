import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs, where, Timestamp, doc, getDoc, limit } from 'firebase/firestore';
import '../App.css';

const styles = {
  container: { padding: '20px', background: '#222', borderRadius: '8px', maxWidth: '100%', overflowX: 'auto', marginTop: '20px', color: '#fff' },
  filterContainer: { display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', justifyContent: 'center', background: '#333', padding: '15px', borderRadius: '10px', marginBottom: '20px' },
  filterGroup: { display: 'flex', flexDirection: 'column', minWidth: '150px' },
  label: { color: '#ccc', marginBottom: '5px', fontSize: '0.9em' },
  input: { padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff', outline: 'none' },
  btn: { padding: '8px 25px', background: '#00C49F', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', height: '35px', textTransform: 'uppercase' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', marginTop: '10px' },
  th: { padding: '12px', textAlign: 'center', background: '#444', color: '#fff', borderBottom: '2px solid #555' },
  td: { padding: '10px', textAlign: 'center', borderBottom: '1px solid #444', color: '#ddd' }
};

function RastreamentoTecPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  
  const [filterTech, setFilterTech] = useState('Todos');
  const [filterType, setFilterType] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchTechs = async () => {
      try {
        const statsRef = collection(db, 'technicianStats');
        const snap = await getDocs(statsRef);
        setTechnicians(snap.docs.map(d => d.id));
      } catch (e) { console.error(e); }
    };
    fetchTechs();
  }, []);

  useEffect(() => {
    if (filterTech === 'Todos' && technicians.length === 0) return;
    handleSearch();
    // eslint-disable-next-line
  }, [filterTech, filterType, technicians]); 

  const formatDevice = (userAgent) => {
      if (!userAgent) return 'Desconhecido';
      
      let os = '';
      let model = '';

      if (/android/i.test(userAgent)) {
          os = 'Android';
          const match = userAgent.match(/Android.*?;(.*?)(?:Build|\))/i);
          if (match && match[1]) {
              model = match[1].trim();
              model = model.replace('wv', '').replace('Mobile', '').trim();
              if (model === 'K' || model.length <= 1) model = ''; 
          }
      } 
      else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
          os = 'iOS';
          if (userAgent.includes('iPhone')) model = 'iPhone';
          else if (userAgent.includes('iPad')) model = 'iPad';
      } 
      else if (/Win/.test(userAgent)) os = 'Windows PC';
      else if (/Mac/.test(userAgent)) os = 'Mac';
      else if (/Linux/.test(userAgent)) os = 'Linux';

      if (model) return `${model} (${os})`;
      if (os) return os; 
      return 'Navegador/Outro';
  };

  const filterDuplicates = (data) => {
    if (!data || data.length === 0) return [];
    const sorted = [...data].sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
    const filtered = [];
    let lastKeptTime = null;
    for (const item of sorted) {
        const currentTime = item.timestamp ? item.timestamp.toMillis() : 0;
        if (!lastKeptTime || Math.abs(lastKeptTime - currentTime) >= 60000) {
            filtered.push(item);
            lastKeptTime = currentTime;
        }
    }
    return filtered;
  };

  const handleSearch = async () => {
    setLoading(true);
    setLogs([]);

    try {
      let rawData = [];

      if (filterTech === 'Todos') {
          let techList = technicians;
          if (techList.length === 0) {
             const snap = await getDocs(collection(db, 'technicianStats'));
             techList = snap.docs.map(d => d.id);
          }

          const promises = techList.map(async (techName) => {
              try {
                  const parentSnap = await getDoc(doc(db, 'rastreamento', techName));
                  if (parentSnap.exists() && parentSnap.data().lastLocation) {
                      return { id: `last-${techName}`, tecnico: techName, ...parentSnap.data().lastLocation };
                  }
                  const q = query(collection(db, 'rastreamento', techName, 'historico'), orderBy('timestamp', 'desc'), limit(1));
                  const historySnap = await getDocs(q);
                  if (!historySnap.empty) {
                      return { id: historySnap.docs[0].id, tecnico: techName, ...historySnap.docs[0].data() };
                  }
                  return null;
              } catch (err) { return null; }
          });

          const results = await Promise.all(promises);
          rawData = results.filter(r => r !== null).sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      } 
      else {
          let start, end;
          const today = new Date();
          if (filterType === 'today') {
            start = new Date(today.setHours(0,0,0,0));
            end = new Date(today.setHours(23,59,59,999));
          } else if (filterType === 'week') {
            const day = today.getDay(); 
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
            start = new Date(today.setDate(diff));
            start.setHours(0,0,0,0);
            const endDay = new Date(start);
            endDay.setDate(start.getDate() + 6);
            endDay.setHours(23,59,59,999);
            end = endDay;
          } else {
            if (!startDate || !endDate) { setLoading(false); return; }
            start = new Date(startDate + "T00:00:00");
            end = new Date(endDate + "T23:59:59");
          }

          const q = query(collection(db, 'rastreamento', filterTech, 'historico'), where('timestamp', '>=', Timestamp.fromDate(start)), where('timestamp', '<=', Timestamp.fromDate(end)), orderBy('timestamp', 'desc'));
          const snapshot = await getDocs(q);
          const docsData = snapshot.docs.map(doc => ({ id: doc.id, tecnico: filterTech, ...doc.data() }));
          rawData = filterDuplicates(docsData);
      }

      setLogs(rawData.map(d => ({
          ...d,
          displayDate: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'Data inválida'
      })));

    } catch (error) { console.error("Erro busca:", error); } finally { setLoading(false); }
  };

  return (
    <div style={styles.container} className="output">
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Rastreamento de Técnicos 🗺️</h2>

      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Técnico:</label>
          <select style={styles.input} value={filterTech} onChange={(e) => setFilterTech(e.target.value)}>
             <option value="Todos">Todos (Última Posição)</option>
             {technicians.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {filterTech !== 'Todos' && (
            <div style={styles.filterGroup}>
            <label style={styles.label}>Período:</label>
            <select style={styles.input} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="today">Hoje</option>
                <option value="week">Semana Atual</option>
                <option value="date">Intervalo</option>
            </select>
            </div>
        )}

        {filterTech !== 'Todos' && filterType === 'date' && (
          <>
            <div style={styles.filterGroup}>
              <label style={styles.label}>De:</label>
              <input type="date" style={styles.input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.label}>Até:</label>
              <input type="date" style={styles.input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </>
        )}

        <div style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
          <button style={styles.btn} onClick={handleSearch} disabled={loading}>
            {loading ? '...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {logs.length > 0 ? (
        <div className="custom-scrollbar" style={{ overflowX: 'auto', maxHeight: '500px' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Modelo</th>
                <th style={styles.th}>Técnico</th>
                <th style={styles.th}>Data/Hora</th>
                <th style={styles.th}>OS</th> 
                <th style={styles.th}>Cidade</th>
                {/* REMOVIDO LAT/LONG */}
                <th style={styles.th}>Precisão</th>
                <th style={styles.th}>Mapa</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log.id || idx} style={{ background: idx % 2 === 0 ? '#2a2a2a' : '#333' }}>
                  <td style={{...styles.td, fontSize:'0.85em', color:'#aaa', fontWeight:'bold'}}>
                    {formatDevice(log.userAgent)}
                  </td>
                  <td style={{...styles.td, fontWeight: 'bold', color: '#00C49F'}}>{log.tecnico}</td>
                  <td style={styles.td}>{log.displayDate}</td>
                  
                  <td style={{...styles.td, fontWeight: log.osVinculada ? 'bold' : 'normal', color: log.osVinculada ? '#fff' : '#666'}}>
                      {log.osVinculada || 'N/A'}
                  </td>

                  <td style={styles.td}>{log.city || '-'}</td>

                  {/* REMOVIDO LAT/LONG DADOS */}
                  <td style={styles.td}>{log.accuracy ? `${Math.round(log.accuracy)}m` : '-'}</td>
                  
                  <td style={styles.td}>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00C49F', textDecoration: 'none', fontWeight: 'bold' }}>📍 Ver</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ textAlign: 'center', color: '#888', marginTop: '10px', fontSize: '0.8em' }}>
             {filterTech === 'Todos' ? 'Mostrando a última localização conhecida.' : 'Mostrando histórico filtrado (< 1 min).'}
          </p>
        </div>
      ) : (
        !loading && <div style={{ textAlign: 'center', padding: '20px', color: '#888', background: '#333', borderRadius: '8px' }}><p>Nenhum registro encontrado.</p></div>
      )}
    </div>
  );
}

export default RastreamentoTecPage;