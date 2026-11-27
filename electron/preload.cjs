// Preload em CJS (obrigatório com sandbox ligado). Expõe o mínimo ao renderer:
// o resto da comunicação é só HTTP com o servidor local via fetch.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('tpbDesktop', {
  platform: process.platform,
  electron: process.versions.electron
});
