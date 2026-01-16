import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { db } from './firebaseConfig';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import './App.css';
import Form from './components/Form';
import Output from './components/Output';
import DashboardPage from './pages/DashboardPage';
import KpisPage from './pages/KpisPage';
import RastreamentoTecPage from './pages/RastreamentoTecPage';
import ReportsConfigPage from './pages/ReportsConfigPage';

function App() {
  const [formData, setFormData] = useState(null);
  const [showDashboardPopup, setShowDashboardPopup] = useState(false);
  const [dashboardClickCount, setDashboardClickCount] = useState(0);
  const [lastDashboardClickTime, setLastDashboardClickTime] = useState(0);

  // Refs para controlar a lógica de distância/tempo sem re-renderizar
  const lastHistoryPosition = useRef(null); // { lat, long, timestamp }

  // --- FUNÇÃO AUXILIAR: CALCULAR DISTÂNCIA EM METROS (Haversine) ---
  const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Raio da terra em km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distância em km
    return d * 1000; // Retorna em metros
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  // --- NOVA FUNÇÃO: OBTER CIDADE (NOMINATIM) ---
  const getCityFromCoords = async (lat, lng) => {
    if (!lat || !lng) return 'Local não ident.';
    try {
      // Timeout simples para evitar travamento se a API demorar
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      if (data.address) {
         return data.address.city || data.address.town || data.address.village || data.address.municipality || 'Desconhecido';
      }
      return 'N/A';
    } catch (error) {
      console.warn("Erro ao buscar cidade (App.js):", error); // Warn para não poluir erro crítico
      return 'Erro API';
    }
  };

  // --- LÓGICA DE RASTREAMENTO INTELIGENTE ---
  useEffect(() => {
    const trackLocation = async () => {
      const techName = localStorage.getItem('savedTechName') || localStorage.getItem('tecnico');

      if (!techName) return;

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords;
            const now = Date.now();
            const timestamp = serverTimestamp();

            // 🔥 BUSCA A CIDADE ANTES DE SALVAR 🔥
            const city = await getCityFromCoords(latitude, longitude);
            
            const docData = {
              latitude,
              longitude,
              accuracy,
              city, // <--- CAMPO NOVO
              timestamp,
              dataLocal: new Date().toISOString(),
              userAgent: navigator.userAgent,
              origem: 'monitoramento',
              osVinculada: null
            };

            // 1. SEMPRE ATUALIZA A "ÚLTIMA LOCALIZAÇÃO" (Sobrescreve o documento pai)
            await setDoc(doc(db, 'rastreamento', techName), {
              lastLocation: docData,
              updatedAt: timestamp,
              nome: techName
            }, { merge: true });

            // 2. LÓGICA PARA SALVAR NO HISTÓRICO (Evita acúmulo)
            let shouldSaveHistory = false;
            const lastPos = lastHistoryPosition.current;

            if (!lastPos) {
                shouldSaveHistory = true;
            } else {
                const distance = getDistanceFromLatLonInMeters(lastPos.latitude, lastPos.longitude, latitude, longitude);
                const timeDiff = now - lastPos.timeMs;
                
                // Regra: Se moveu mais de 1km OU passou 30 minutos
                if (distance > 1000 || timeDiff > 1800000) {
                    shouldSaveHistory = true;
                    console.log(`[Rastreio] Moveu ${Math.round(distance)}m ou TimeOut. Salvando histórico.`);
                } else {
                    console.log(`[Rastreio] Parado (${Math.round(distance)}m). Atualizando apenas status ao vivo.`);
                }
            }

            if (shouldSaveHistory) {
                await addDoc(collection(db, 'rastreamento', techName, 'historico'), docData);
                lastHistoryPosition.current = { latitude, longitude, timeMs: now };
            }
            
          } catch (error) {
            console.error("Erro ao salvar localização automática:", error);
          }
        }, (error) => {
          console.warn("Erro geo (auto):", error);
        }, { enableHighAccuracy: true, timeout: 10000 });
      }
    };

    trackLocation();
    const intervalId = setInterval(trackLocation, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleDashboardClick = () => {
    const now = Date.now();
    if (now - lastDashboardClickTime < 5000) {
      const newCount = dashboardClickCount + 1;
      setDashboardClickCount(newCount);
      if (newCount === 3) {
        setShowDashboardPopup(true);
        setDashboardClickCount(0);
      }
    } else {
      setDashboardClickCount(1);
    }
    setLastDashboardClickTime(now);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (Date.now() - lastDashboardClickTime > 5000) {
        setDashboardClickCount(0);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [lastDashboardClickTime]);


  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <h1 className="app-title">Perfomind THE</h1>
          <nav className="main-nav">
            <ul>
              <li><Link to="/">Início</Link></li>
              <li><Link to="/dashboard" onClick={handleDashboardClick}>Dashboard</Link></li>
            </ul>
          </nav>
        </header>

        <div className="main-content">
          <Routes>
            <Route path="/" element={
              <>
                <Form setFormData={setFormData} />
                {formData && <Output data={formData} />}
              </>
            } />
            <Route path="/dashboard" element={<DashboardPage showPopup={showDashboardPopup} setShowPopup={setShowDashboardPopup} />} />
            <Route path="/kpis" element={<KpisPage />} />
            <Route path="/tec" element={<RastreamentoTecPage />} />
            <Route path="/relatorio" element={<ReportsConfigPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;