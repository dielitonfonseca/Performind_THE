import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; 
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration'; // <--- IMPORTANTE

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Alterar de unregister() para register() para permitir funcionamento offline
serviceWorkerRegistration.register();