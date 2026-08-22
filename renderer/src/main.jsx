import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { ExecutionWindow } from './app.jsx';
import { setExecutionMounter } from './platform/index.js';
import './styles.css';

/* Im Browser kann die Durchführungsansicht in ein Picture-in-Picture-
   Fenster gehängt werden. Der Plattform-Adapter kennt React nicht – er
   ruft diese Funktion, sobald das Fenster bereitsteht. */
setExecutionMounter((wurzel, fenster)=>{
  const root = createRoot(wurzel);
  root.render(<ExecutionWindow />);
  fenster?.addEventListener?.('pagehide', ()=>{ try { root.unmount(); } catch {} });
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
