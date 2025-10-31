const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const getPort = require('get-port');
const fetch = require('node-fetch');

let pythonProcess = null;
let serverPort = 5001;  // Changed from 5000 to avoid AirPlay Receiver conflict

// Determine the path to the Python executable
const getPythonExecutablePath = () => {
    // During development, use the virtual environment python
    if (!app.isPackaged) {
        // Use the virtual environment's Python interpreter
        const venvPython = path.join(__dirname, '.venv', 'bin', 'python3');
        const fs = require('fs');
        if (fs.existsSync(venvPython)) {
            return venvPython;
        }
        // Fallback to system python if venv doesn't exist
        return process.platform === 'win32' ? 'python' : 'python3';
    }
    // After packaging, use the PyInstaller-built executable
    // Electron Forge puts extraResources directly in the Resources folder
    const executableName = process.platform === 'win32' ? 'LearnIT-backend.exe' : 'LearnIT-backend';
    return path.join(process.resourcesPath, executableName);
};

// Create and manage the main window
const createWindow = async () => {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webviewTag: false,
            sandbox: false,
            webSecurity: false, // Disable web security to allow YouTube embeds from file://
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
        },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    });

    // Set CSP to allow YouTube iframes and HLS blob URLs
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; " +
                    "frame-src https://www.youtube.com https://www.youtube-nocookie.com; " +
                    "media-src * blob: data:; " +
                    "img-src 'self' data: https:; " +
                    "connect-src *;"
                ]
            }
        });
    });

    mainWindow.loadFile('index.html');

    // Set User Agent to regular Chrome to bypass Electron detection
    mainWindow.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');



    // Start the Python backend in the background so the UI can show immediately
    startPythonBackend().catch((error) => {
        console.error('Python backend failed to start:', error);
    });

    // Open DevTools in development
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('close', () => {
        // Kill the Python process when the app closes
        if (pythonProcess) {
            pythonProcess.kill();
        }
    });
};

const startPythonBackend = async () => {
    serverPort = await getPort({ port: 5001 });
    const pythonExecutable = getPythonExecutablePath();

    console.log('Starting Python backend...');
    console.log('Python executable:', pythonExecutable);
    console.log('Port:', serverPort);

    // PyInstaller executable takes port as argument, not script path
    const args = app.isPackaged 
        ? [serverPort.toString()]  // Packaged: just pass port
        : [path.join(__dirname, 'backend', 'main.py'), serverPort.toString()];  // Dev: pass script + port

    pythonProcess = spawn(pythonExecutable, args, {
        stdio: 'pipe',
    });

    // Handle Python output
    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
    });

    // Handle Python errors
    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
    });

    // Check if the server is ready
    const checkServerReady = async (retries = 20) => {
        try {
            const response = await fetch(`http://127.0.0.1:${serverPort}/`);
            const data = await response.json();
            console.log('Python backend ready:', data);
            return true;
        } catch (e) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                return checkServerReady(retries - 1);
            } else {
                console.error('Failed to connect to Python backend after multiple attempts');
                return false;
            }
        }
    };
    
    await checkServerReady();
};

// Helper function to make API calls to Python backend
async function callPythonAPI(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`http://127.0.0.1:${serverPort}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}


// Legacy handler for compatibility
ipcMain.handle('send-to-python', async (event, data) => {
    return await callPythonAPI('/process', 'POST', data);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});