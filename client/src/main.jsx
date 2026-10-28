import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider, PrintProvider, ToastProvider } from './context.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <PrintProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </PrintProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
