import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './components/ui/button.css';
import './components/ui/forms.css';
import './components/ui/display.css';
import './components/ui/overlay.css';
import './components/layout/shell.css';
import './components/domain/domain.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
