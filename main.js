const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const util = require('util');
const xlsx = require('xlsx');

const CONCURRENT_DOWNLOADS = 6;
const execPromise = util.promisify(exec);
const isPackaged = app.isPackaged;

// --- Global State ---
let mainWindow;
let generatedExcelBuffer = null;
let generatedJsonData = null;
let channelName = 'canal'; // Default channel name

const ytDlpDir = isPackaged 
    ? path.join(process.resourcesPath, 'bin') 
    : path.join(__dirname, 'bin');
const ytDlpPath = path.join(ytDlpDir, 'yt-dlp.exe');
const ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1050, height: 850,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false
        }
    });
    mainWindow.loadFile('index.html');
}

function sendStatus(message) {
    console.log(message);
    if (mainWindow) {
        mainWindow.webContents.send('status-update', message);
    }
}

async function setupYtDlp() { 
    sendStatus('Verificando a existência do yt-dlp.exe...');

    if (isPackaged) {
        if (fs.existsSync(ytDlpPath)) {
            sendStatus('yt-dlp.exe encontrado no pacote.');
            return true;
        } else {
            sendStatus(`ERRO: yt-dlp.exe não foi encontrado no pacote em ${ytDlpPath}.`);
            return false;
        }
    }

    // Development-only logic below
    if (!fs.existsSync(ytDlpDir)) fs.mkdirSync(ytDlpDir, { recursive: true });

    if (!fs.existsSync(ytDlpPath)) {
        sendStatus('yt-dlp.exe não encontrado. Baixando...');
        try {
            const response = await axios({ url: ytDlpUrl, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(ytDlpPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
            sendStatus('Download do yt-dlp.exe concluído.');
        } catch (error) { sendStatus(`ERRO: Falha ao baixar o yt-dlp.exe. Detalhes: ${error.message}`); return false; }
    } else { sendStatus('yt-dlp.exe encontrado.'); }
    
    sendStatus('Tentando atualizar o yt-dlp...');
    try {
        const { stdout } = await execPromise(`"${ytDlpPath}" -U`);
        sendStatus(`Resultado da atualização: ${stdout.trim()}`);
    } catch (error) { sendStatus(`Aviso ao tentar atualizar o yt-dlp: ${error.message.split('\n')[0]}`); }
    return true;
}

function parseVtt(vttContent) { 
    return vttContent.split('\n').filter(line => !line.startsWith('WEBVTT') && !line.startsWith('Kind:') && !line.startsWith('Language:') && !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3} -->/)).map(line => line.trim()).join(' ').replace(/<[^>]*>/g, '');
}

function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9\s-]/gi, '_').replace(/\s+/g, '-');
}

// --- IPC Handlers ---

ipcMain.on('fetch-video-list', async (event, channelUrl) => {
    const ytDlpReady = await setupYtDlp();
    if (!ytDlpReady) return;

    const args = ['-j', '--flat-playlist', channelUrl];
    const ytDlpProcess = spawn(ytDlpPath, args);

    let videoCount = 0;
    let buffer = '';
    let isChannelNameSet = false;

    ytDlpProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); 

        for (const line of lines) {
            if (line) {
                try {
                    const video = JSON.parse(line);
                    if (!isChannelNameSet && video.channel) {
                        channelName = sanitizeFilename(video.channel);
                        isChannelNameSet = true;
                    }
                    videoCount++;
                    mainWindow.webContents.send('video-chunk', video);
                } catch (e) {
                    sendStatus(`Aviso: não foi possível processar uma linha do yt-dlp: ${e.message}`);
                }
            }
        }
    });

    ytDlpProcess.stderr.on('data', (data) => sendStatus(`Aviso do yt-dlp: ${data.toString()}`));

    ytDlpProcess.on('close', (code) => {
        if (code !== 0) sendStatus(`ERRO: O processo yt-dlp terminou com o código ${code}`);
        mainWindow.webContents.send('video-fetch-complete', videoCount);
    });

    ytDlpProcess.on('error', (err) => {
        sendStatus(`ERRO GERAL AO BUSCAR VÍDEOS: ${err.message}`);
        mainWindow.webContents.send('video-fetch-complete', videoCount);
    });
});

ipcMain.on('process-selected-videos', async (event, selectedVideos) => {
    let successCount = 0;
    const tempDir = app.getPath('temp');

    try {
        generatedExcelBuffer = null; // Reset buffer
        generatedJsonData = null; // Reset JSON data
        const allVideoData = [];
        const videosToProcess = [...selectedVideos];
        let processedCount = 0;

        const worker = async () => {
            while (videosToProcess.length > 0) {
                const video = videosToProcess.shift();
                if (!video) continue;

                try {
                    sendStatus(`Iniciando: ${video.title}`);
                    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
                    
                    const metaCommand = `"${ytDlpPath}" -j "${videoUrl}"`;
                    const { stdout: metaStdout } = await execPromise(metaCommand, { maxBuffer: 1024 * 1024 * 5 });
                    const videoMeta = JSON.parse(metaStdout);

                    const subLang = 'pt';
                    const subFilename = `${videoMeta.id}.sub`;
                    const subOutputPath = path.join(tempDir, subFilename);
                    const subsCommand = `"${ytDlpPath}" --write-auto-sub --sub-lang "${subLang}" --skip-download --output "${subOutputPath}" "${videoUrl}"`;
                    await execPromise(subsCommand);
                    
                    const vttPath = path.join(tempDir, `${subFilename}.${subLang}.vtt`);
                    let transcription = 'Transcrição não encontrada.';
                    if (fs.existsSync(vttPath)) {
                        const vttContent = fs.readFileSync(vttPath, 'utf-8');
                        transcription = parseVtt(vttContent);
                        fs.unlinkSync(vttPath);
                    }
                    
                    const excelCharLimit = 32700;
                    if (transcription.length > excelCharLimit) {
                        transcription = transcription.substring(0, excelCharLimit) + '... [TRANSCRIÇÃO TRUNCADA]';
                        sendStatus(`Aviso: Transcrição de "${video.title}" foi truncada por ser muito longa.`);
                    }

                    allVideoData.push({
                        'Nome do Vídeo': videoMeta.title,
                        'Quantidade de Views': videoMeta.view_count,
                        'Data de Postagem': videoMeta.upload_date,
                        'Transcrição': transcription
                    });
                    successCount++;

                } catch (videoError) {
                    sendStatus(`ERRO em "${video.title}". Pulando. (Detalhes: ${videoError.message.split('\n')[0]})`);
                } finally {
                     processedCount++;
                     mainWindow.webContents.send('progress-update', { current: processedCount, total: selectedVideos.length });
                     sendStatus(`[${processedCount}/${selectedVideos.length}] Processado: ${video.title}`);
                }
            }
        };

        const workerPromises = Array(CONCURRENT_DOWNLOADS).fill(null).map(worker);
        await Promise.all(workerPromises);

        if (allVideoData.length > 0) {
            sendStatus('Gerando buffers dos arquivos Excel e JSON...');
            // Excel
            const worksheet = xlsx.utils.json_to_sheet(allVideoData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Dados dos Vídeos');
            generatedExcelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
            
            // JSON
            generatedJsonData = JSON.stringify(allVideoData, null, 2);

            sendStatus('Buffers prontos para download.');
        } else {
            sendStatus('Nenhum dado de vídeo pôde ser extraído.');
        }
    } catch (error) {
        console.error("ERRO CRÍTICO NO PROCESSAMENTO:", error);
        sendStatus(`ERRO CRÍTICO: O processo falhou. Detalhes: ${error.message}`);
        successCount = 0; // Ensure success count is zero on failure
    } finally {
        mainWindow.webContents.send('processing-complete', { successCount, channelName });
    }
});

ipcMain.on('save-excel-file', async () => {
    if (!generatedExcelBuffer) {
        sendStatus('ERRO: Nenhum dado de Excel para salvar.');
        return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const defaultFilename = `${channelName}_${date}.xlsx`;

    const { filePath } = await dialog.showSaveDialog({
        title: 'Salvar arquivo Excel',
        defaultPath: defaultFilename,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (filePath) {
        try {
            fs.writeFileSync(filePath, generatedExcelBuffer);
            sendStatus(`Arquivo salvo com sucesso em: ${filePath}`);
        } catch (error) {
            sendStatus(`ERRO ao salvar o arquivo: ${error.message}`);
        }
    } else {
        sendStatus('O salvamento do arquivo foi cancelado.');
    }
});

ipcMain.on('save-json-file', async () => {
    if (!generatedJsonData) {
        sendStatus('ERRO: Nenhum dado JSON para salvar.');
        return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const defaultFilename = `${channelName}_${date}.json`;

    const { filePath } = await dialog.showSaveDialog({
        title: 'Salvar arquivo JSON',
        defaultPath: defaultFilename,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (filePath) {
        try {
            fs.writeFileSync(filePath, generatedJsonData);
            sendStatus(`Arquivo salvo com sucesso em: ${filePath}`);
        } catch (error) {
            sendStatus(`ERRO ao salvar o arquivo: ${error.message}`);
        }
    } else {
        sendStatus('O salvamento do arquivo foi cancelado.');
    }
});


// --- App Lifecycle ---
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});