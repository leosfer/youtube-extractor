// ---- UI ELEMENTS ----
const channelUrlInput = document.getElementById('channelUrl');
const fetchButton = document.getElementById('fetchButton');
const downloadButton = document.getElementById('downloadButton');
const videoSelectionArea = document.getElementById('video-selection-area');
const videoListBody = document.getElementById('video-list-body');
const selectAllHeaderCheckbox = document.getElementById('selectAllHeaderCheckbox');
const selectAllColumnCheckbox = document.getElementById('selectAllColumnCheckbox');
const tableHeaders = document.querySelectorAll('th[data-sort]');
const quickSelectControls = document.querySelector('.quick-select-controls');

// Status & Progress Elements
const statusSummary = document.getElementById('status-summary');
const statusCardHeader = document.getElementById('status-card-header');
const statusLogContainer = document.querySelector('.status-log-container');
const statusLog = document.getElementById('status-log');
const progressArea = document.getElementById('progress-area');
const progressBar = document.getElementById('progress-bar');
const downloadExcelArea = document.getElementById('download-excel-area');
const downloadExcelButton = document.getElementById('downloadExcelButton');
const downloadJsonButton = document.getElementById('downloadJsonButton');

let currentVideoData = [];
let sortState = { key: 'views', order: 'desc' }; // Default sort by views

// ---- UI CONTROL FUNCTIONS ----

function showSpinner(buttonId, show) {
    document.getElementById(`${buttonId}-text`).style.display = show ? 'none' : 'inline';
    document.getElementById(`${buttonId}-spinner`).style.display = show ? 'block' : 'none';
}

function setUIState(enabled, isFetching = false, isProcessing = false) {
    fetchButton.disabled = !enabled || isProcessing;
    downloadButton.disabled = !enabled || isFetching;
    channelUrlInput.disabled = !enabled || isProcessing;
    selectAllHeaderCheckbox.disabled = !enabled || isFetching;
    selectAllColumnCheckbox.disabled = !enabled || isFetching;
}

function resetUI() {
    progressArea.style.display = 'none';
    downloadExcelArea.style.display = 'none';
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    statusSummary.textContent = 'Aguardando início do processo...';
    statusLog.textContent = '> Aguardando início...';
}

function updateStatusSummary(message) {
    statusSummary.textContent = message;
}

function updateStatusLog(message, clear = false) {
    if (clear) {
        statusLog.textContent = `> ${message}`;
    } else {
        statusLog.textContent += `\n> ${message}`;
    }
    statusLog.scrollTop = statusLog.scrollHeight;
}

// ---- TABLE SORTING LOGIC ----

function sortAndRenderTable() {
    const { key, order } = sortState;
    currentVideoData.sort((a, b) => {
        let valA = (key === 'title') ? a.title.toLowerCase() : (a.view_count || 0);
        let valB = (key === 'title') ? b.title.toLowerCase() : (b.view_count || 0);

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
    renderTable(currentVideoData);
    updateSortIndicators();
}

function updateSortIndicators() {
    tableHeaders.forEach(header => {
        const indicator = header.querySelector('.sort-indicator');
        if (header.dataset.sort === sortState.key) {
            indicator.textContent = sortState.order === 'asc' ? '▲' : '▼';
            indicator.style.opacity = '1';
        } else {
            indicator.textContent = '';
            indicator.style.opacity = '0.6';
        }
    });
}

tableHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        if (sortState.key === sortKey) {
            sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.key = sortKey;
            sortState.order = sortKey === 'views' ? 'desc' : 'asc';
        }
        sortAndRenderTable();
    });
});

// ---- RENDERING & FORMATTING ----

function renderTable(videos) {
    videoListBody.innerHTML = ''; // Clear table
    videos.forEach(video => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="video-checkbox" data-video-id="${video.id}" data-video-title="${escapeHtml(video.title)}"></td>
            <td>${escapeHtml(video.title)}</td>
            <td>${video.view_count ? video.view_count.toLocaleString('pt-BR') : 'N/A'}</td>
        `;
        videoListBody.appendChild(row);
    });
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ---- MAIN EVENT LISTENERS ----

fetchButton.addEventListener('click', () => {
    const url = channelUrlInput.value;
    if (!url) {
        updateStatusSummary('Erro: Por favor, insira uma URL do canal.');
        updateStatusLog('Erro: Por favor, insira uma URL do canal.', true);
        return;
    }
    resetUI();
    currentVideoData = [];
    videoListBody.innerHTML = '';
    videoSelectionArea.style.display = 'block';
    
    setUIState(false, true); // Disable UI, isFetching = true
    showSpinner('fetchButton', true);
    updateStatusSummary('Buscando vídeos do canal...');
    updateStatusLog('Iniciando... Buscando vídeos em tempo real...', true);
    window.api.fetchVideoList(url);
});

downloadButton.addEventListener('click', () => {
    const selectedCheckboxes = document.querySelectorAll('.video-checkbox:checked');
    const selectedVideos = Array.from(selectedCheckboxes).map(cb => ({
        id: cb.dataset.videoId,
        title: cb.dataset.videoTitle
    }));

    if (selectedVideos.length === 0) {
        updateStatusSummary('Erro: Nenhum vídeo selecionado.');
        updateStatusLog('Erro: Nenhum vídeo selecionado.');
        return;
    }
    resetUI();
    progressArea.style.display = 'block';
    setUIState(false, false, true); // Disable UI, isProcessing = true
    showSpinner('downloadButton', true);
    const summary = `Iniciando extração para ${selectedVideos.length} vídeo(s)...`;
    updateStatusSummary(summary);
    updateStatusLog(summary, true);
    window.api.processSelectedVideos(selectedVideos);
});

quickSelectControls.addEventListener('click', (event) => {
    if (event.target.tagName !== 'BUTTON' || !event.target.dataset.count) {
        return; // Ignore clicks that are not on the count buttons
    }

    const count = parseInt(event.target.dataset.count, 10);
    if (isNaN(count)) return;

    const allCheckboxes = document.querySelectorAll('.video-checkbox');
    allCheckboxes.forEach((cb, index) => {
        cb.checked = index < count;
    });

    // After setting checkboxes, update the 'Select All' state
    const totalSelected = Array.from(allCheckboxes).filter(cb => cb.checked).length;
    const allAreSelected = allCheckboxes.length > 0 && totalSelected === allCheckboxes.length;
    selectAllHeaderCheckbox.checked = allAreSelected;
    selectAllColumnCheckbox.checked = allAreSelected;
});

statusCardHeader.addEventListener('click', () => {
    statusLogContainer.style.display = statusLogContainer.style.display === 'block' ? 'none' : 'block';
});

const handleSelectAll = (event) => {
    document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = event.target.checked);
    selectAllHeaderCheckbox.checked = event.target.checked;
    selectAllColumnCheckbox.checked = event.target.checked;
};
selectAllHeaderCheckbox.addEventListener('change', handleSelectAll);
selectAllColumnCheckbox.addEventListener('change', handleSelectAll);

downloadExcelButton.addEventListener('click', () => {
    window.api.saveExcelFile();
});

downloadJsonButton.addEventListener('click', () => {
    window.api.saveJsonFile();
});


// ---- IPC LISTENERS (from main.js) ----

window.api.onVideoChunk((_event, video) => {
    currentVideoData.push(video);
    // Add new row without re-rendering everything
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="checkbox" class="video-checkbox" data-video-id="${video.id}" data-video-title="${escapeHtml(video.title)}"></td>
        <td>${escapeHtml(video.title)}</td>
        <td>${video.view_count ? video.view_count.toLocaleString('pt-BR') : 'N/A'}</td>
    `;
    videoListBody.prepend(row); // Add to top to see newest first
    const msg = `Encontrado: ${video.title}`;
    updateStatusSummary(`${currentVideoData.length} vídeos encontrados...`);
    updateStatusLog(msg);
});

window.api.onVideoFetchComplete((_event, totalFound) => {
    setUIState(true, false); // Re-enable UI, fetch is complete
    showSpinner('fetchButton', false);
    const msg = `Busca finalizada. Total de ${totalFound} vídeos encontrados. Ordenando...`;
    updateStatusSummary(msg);
    updateStatusLog(msg);
    
    sortState = { key: 'views', order: 'desc' };
    sortAndRenderTable();
    updateStatusLog('Lista pronta para seleção.');
});

window.api.onStatusUpdate((_event, message) => {
    updateStatusLog(message);
    if (message.includes('ERRO') || message.includes('Aviso')) {
        updateStatusSummary(message);
    }
});

window.api.onProgressUpdate((_event, { current, total }) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${percentage}%`;
    updateStatusSummary(`Processando: ${current} de ${total} vídeos...`);
});

window.api.onProcessingComplete((_event, { successCount, channelName }) => {
    setUIState(true, false, false); // Re-enable UI, processing complete
    showSpinner('downloadButton', false);
    progressArea.style.display = 'none';

    if (successCount > 0) {
        updateStatusSummary(`Extração concluída! ${successCount} vídeos processados. Pronto para download.`);
        downloadExcelArea.style.display = 'flex';
    } else {
        updateStatusSummary('Extração concluída, mas nenhum dado pôde ser salvo.');
    }
    updateStatusLog(`--- PROCESSO CONCLUÍDO ---`);
});