import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ensureTemporal } from './infra/temporalBootstrap';
import { App } from './App';
import './styles.css';

async function bootstrap(): Promise<void> {
  await ensureTemporal();
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root mount element #root not found.');
  }

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
