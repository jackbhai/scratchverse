import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => {
    const base = document.baseURI;
    navigator.serviceWorker
      .register(new URL('sw.js', base).href, { scope: new URL('./', base).pathname })
      .catch(() => {});   // offline still works from cache; a failed registration is non-fatal
  });
}
