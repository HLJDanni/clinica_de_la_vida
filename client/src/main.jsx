import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import { applyTheme, AuthProvider, initialTheme, PrintProvider, ThemeProvider, ToastProvider } from './context.jsx';
import './styles.css';

// Antes del primer render, para que no parpadee en claro
applyTheme(initialTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <BrowserRouter>
          <ToastProvider>
            <PrintProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </PrintProvider>
          </ToastProvider>
        </BrowserRouter>
      </ThemeProvider>
    </MotionConfig>
  </React.StrictMode>
);
