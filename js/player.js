const playerModal = new bootstrap.Modal(document.getElementById('player-modal'));
const videoPlayer = document.getElementById('video-player');
const playerModalLabel = document.getElementById('playerModalLabel');
const qualitySelector = document.createElement('select');
qualitySelector.className = 'form-select mt-2';

let hls;
let currentChannel;
let currentQuality = -1; // -1 means auto
let retryCount = 0;
const MAX_RETRIES = 3;

// Configuration object for player settings
const PLAYER_CONFIG = {
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    enableWorker: true,
    debug: false,
    autoStartLoad: true,
    startFragPrefetch: true,
    lowLatencyMode: true,
    backBufferLength: 90
};

export function initializePlayer() {
    setupPlayerControls();
    setupEventListeners();
    checkBrowserSupport();
}

function setupPlayerControls() {
    // Create container for additional controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'player-controls mt-2';
    
    // Add quality selector
    const qualityLabel = document.createElement('label');
    qualityLabel.htmlFor = 'quality-selector';
    qualityLabel.textContent = 'Quality: ';
    qualityLabel.className = 'me-2';
    
    qualitySelector.id = 'quality-selector';
    
    // Add error display
    const errorDisplay = document.createElement('div');
    errorDisplay.id = 'player-error';
    errorDisplay.className = 'alert alert-danger mt-2 d-none';
    
    // Add loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-primary d-none';
    spinner.id = 'player-loader';
    
    controlsContainer.appendChild(qualityLabel);
    controlsContainer.appendChild(qualitySelector);
    controlsContainer.appendChild(errorDisplay);
    controlsContainer.appendChild(spinner);
    
    videoPlayer.parentElement.appendChild(controlsContainer);
}

function setupEventListeners() {
    // Modal events
    document.getElementById('player-modal').addEventListener('hidden.bs.modal', cleanupPlayer);
    document.getElementById('player-modal').addEventListener('shown.bs.modal', onModalShown);
    
    // Video player events
    videoPlayer.addEventListener('error', handleVideoError);
    videoPlayer.addEventListener('playing', hideError);
    videoPlayer.addEventListener('waiting', showLoader);
    videoPlayer.addEventListener('canplay', hideLoader);
    
    // Quality selector events
    qualitySelector.addEventListener('change', handleQualityChange);
}

function checkBrowserSupport() {
    if (!Hls.isSupported() && !videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        showAlert('Your browser does not support HLS playback. Please use a modern browser.', 'warning');
        return false;
    }
    return true;
}

export function playChannel(channel) {
    if (!checkBrowserSupport()) return;
    
    currentChannel = channel;
    playerModalLabel.textContent = channel.name;
    showLoader();
    
    try {
        if (Hls.isSupported()) {
            setupHlsPlayer(channel);
        } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            setupNativePlayer(channel);
        }
        playerModal.show();
    } catch (error) {
        console.error('Error setting up player:', error);
        showError('Failed to initialize player');
    }
}

function setupHlsPlayer(channel) {
    if (hls) {
        hls.destroy();
    }
    
    hls = new Hls({
        ...PLAYER_CONFIG,
        xhrSetup: function(xhr, url) {
            xhr.withCredentials = true;
            if (channel.userAgent) {
                xhr.setRequestHeader('User-Agent', channel.userAgent);
            }
            if (channel.cookie) {
                xhr.setRequestHeader('Cookie', channel.cookie);
            }
            // Add any additional custom headers
            if (channel.headers) {
                Object.entries(channel.headers).forEach(([key, value]) => {
                    xhr.setRequestHeader(key, value);
                });
            }
        }
    });

    // Setup HLS events
    hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
    hls.on(Hls.Events.ERROR, handleHlsError);
    hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);

    // Load source
    hls.loadSource(channel.link);
    hls.attachMedia(videoPlayer);
}

function setupNativePlayer(channel) {
    videoPlayer.src = channel.link;
    videoPlayer.addEventListener('loadedmetadata', () => {
        playVideo();
    });
}

function onManifestParsed(event, data) {
    updateQualityLevels(hls.levels);
    playVideo();
}

function onLevelSwitched(event, data) {
    const currentLevel = hls.levels[data.level];
    if (currentLevel) {
        console.log(`Switched to ${currentLevel.height}p`);
    }
}

function updateQualityLevels(levels) {
    qualitySelector.innerHTML = '';
    
    // Add Auto option
    const autoOption = document.createElement('option');
    autoOption.value = -1;
    autoOption.textContent = 'Auto';
    qualitySelector.appendChild(autoOption);
    
    // Add available qualities
    levels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${level.height}p`;
        qualitySelector.appendChild(option);
    });
    
    qualitySelector.value = currentQuality;
}

function handleQualityChange(event) {
    if (!hls) return;
    
    const quality = parseInt(event.target.value);
    currentQuality = quality;
    hls.currentLevel = quality;
}

function playVideo() {
    hideLoader();
    videoPlayer.play().catch(error => {
        console.error('Error playing video:', error);
        showError('Playback failed. Please try again.');
    });
}

function handleVideoError(event) {
    console.error('Video error:', event);
    showError('Video playback error. Please try again.');
    retryPlayback();
}

function handleHlsError(event, data) {
    if (data.fatal) {
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                handleNetworkError(data);
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                handleMediaError();
                break;
            default:
                handleFatalError(data);
                break;
        }
    }
}

function handleNetworkError(data) {
    console.error('Network error:', data);
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying playback (${retryCount}/${MAX_RETRIES})...`);
        setTimeout(() => {
            hls.startLoad();
        }, 1000 * retryCount);
    } else {
        showError('Network error. Please check your connection.');
    }
}

function handleMediaError() {
    console.error('Media error, attempting to recover...');
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        hls.recoverMediaError();
    } else {
        showError('Media playback error. Please try again.');
    }
}

function handleFatalError(data) {
    console.error('Fatal error:', data);
    showError('Playback error. Please try another channel.');
    cleanupPlayer();
}

function retryPlayback() {
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying playback (${retryCount}/${MAX_RETRIES})...`);
        setTimeout(() => {
            if (currentChannel) {
                playChannel(currentChannel);
            }
        }, 1000 * retryCount);
    }
}

function cleanupPlayer() {
    if (hls) {
        hls.destroy();
        hls = null;
    }
    videoPlayer.pause();
    videoPlayer.src = '';
    hideLoader();
    hideError();
    retryCount = 0;
    currentChannel = null;
}

function onModalShown() {
    if (videoPlayer.paused && currentChannel) {
        playVideo();
    }
}

function showLoader() {
    const loader = document.getElementById('player-loader');
    if (loader) loader.classList.remove('d-none');
}

function hideLoader() {
    const loader = document.getElementById('player-loader');
    if (loader) loader.classList.add('d-none');
}

function showError(message) {
    const errorDisplay = document.getElementById('player-error');
    if (errorDisplay) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('d-none');
    }
}

function hideError() {
    const errorDisplay = document.getElementById('player-error');
    if (errorDisplay) {
        errorDisplay.classList.add('d-none');
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alert-container');
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.role = 'alert';
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alertElement);

    setTimeout(() => {
        alertElement.remove();
    }, 5000);
}
