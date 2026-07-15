import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const container = document.getElementById('root');

if (container === null) {
  // Fail loudly. A silent no-op here would look like a rendering bug later.
  throw new Error('Renderer bootstrap failed: #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
