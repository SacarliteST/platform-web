import { readStandaloneConfig } from './app/config/read-standalone-config';
import { setRuntimeConfig } from './app/config/runtime-config-registry';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found');
}

const config = await readStandaloneConfig();
setRuntimeConfig(config);

// TODO(PLT-002): mount <AppProviders><App /></AppProviders> here.
rootElement.textContent = 'platform-web scaffold — Phase 1 pending';
