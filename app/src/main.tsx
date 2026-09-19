import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root が見つかりません');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service Worker を登録しておくと、画面を配信している PC が落ちていても
// スマホのホーム画面から起動できる。対応していない環境では黙って諦める。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* file:// や非対応ブラウザでは登録できないが、動作に支障はない */
    });
  });
}
