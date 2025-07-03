// src/App.js
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Form from './components/Form';
import Output from './components/Output';
import DashboardPage from './pages/DashboardPage';
import KpisPage from './pages/KpisPage'; // Importe a nova página de KPIs

function App() {
  const [formData, setFormData] = useState(null);

  return (
    <Router>
      <div className="App">
        {/* Header com os links de navegação visíveis no lado direito */}
        <header className="app-header">
          <h1 className="app-title"> Perfomind THE</h1>
            {/* <h2 className="subtitle">Performance com inteligência</h2>*/}
          <nav className="main-nav">
            <ul>
              <li>
                <Link to="/">Início</Link>
              </li>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                {/*<Link to="/kpis">KPIs</Link>   */}
              </li>
            </ul>
          </nav>
        </header>

        {/* Conteúdo principal */}
        <div className="main-content">
          <Routes>
            <Route path="/" element={
              <>
                <Form setFormData={setFormData} />
                {formData && <Output data={formData} />}
              </>
            } />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/kpis" element={<KpisPage />} /> {/* Nova rota para a página de KPIs */}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;