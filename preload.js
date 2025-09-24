const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // --- Send to Main ---
    fetchVideoList: (channelUrl) => ipcRenderer.send('fetch-video-list', channelUrl),
    processSelectedVideos: (selectedVideos) => ipcRenderer.send('process-selected-videos', selectedVideos),
    saveExcelFile: () => ipcRenderer.send('save-excel-file'),
    saveJsonFile: () => ipcRenderer.send('save-json-file'),

    // --- Receive from Main ---
    onStatusUpdate: (callback) => ipcRenderer.on('status-update', callback),
    onVideoChunk: (callback) => ipcRenderer.on('video-chunk', callback),
    onVideoFetchComplete: (callback) => ipcRenderer.on('video-fetch-complete', callback),
    onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),
    onProcessingComplete: (callback) => ipcRenderer.on('processing-complete', callback)
});