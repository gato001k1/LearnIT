const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Copy text to clipboard
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    
    // Paste from clipboard
    pasteFromClipboard: () => ipcRenderer.invoke('paste-from-clipboard'),
    
    // Get clipboard history
    getHistory: () => ipcRenderer.invoke('get-history'),
    
    // Clear clipboard history
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    
    // Process text with various operations
    processText: (data) => ipcRenderer.invoke('process-text', data),
    
    // Legacy method for compatibility
    sendToPython: (data) => ipcRenderer.invoke('send-to-python', data),
});