
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query';
import App from './App';
import './style.css';
import { logError } from '@/utils/logger'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if (import.meta?.env?.DEV && typeof window !== 'undefined') {
  const w = window as any
  if (!w.__sf_global_error_hooks_installed) {
    w.__sf_global_error_hooks_installed = true
    window.addEventListener('error', (ev) => {
      logError('window', 'Unhandled error event', { message: (ev as any)?.message, error: (ev as any)?.error })
    })
    window.addEventListener('unhandledrejection', (ev) => {
      logError('window', 'Unhandled promise rejection', { reason: (ev as any)?.reason })
    })
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
