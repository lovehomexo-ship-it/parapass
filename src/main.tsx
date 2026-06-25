import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Apply saved theme immediately to prevent flash of unstyled content
const savedTheme = localStorage.getItem('parapass_theme');
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
