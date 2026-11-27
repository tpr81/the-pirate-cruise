// Processo principal do Electron (ESM, suportado a partir do Electron 28).
// Sobe o servidor Express dentro do próprio app, apenas no loopback, em porta aleatória,
// e abre a interface nele. Nada fica exposto na rede local.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let server = null;

async function createWindow() {
  server = await startServer({ port: 0, host: '127.0.0.1' });
  const { port } = server.address();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#12161c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setMenu(null);
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('will-quit', () => {
  if (server) server.close();
});
