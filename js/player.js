const playerModal = new bootstrap.Modal(document.getElementById('player-modal'));
const videoPlayer = document.getElementById('video-player');
const playerModalLabel = document.getElementById('playerModalLabel');

let hls;

export function initializePlayer() {
    document.getElementById('player-modal').addEventListener('hidden.bs.modal', () => {
        if (hls) {
            hls.destroy();
            hls = null;
        }
        videoPlayer.pause();
        videoPlayer.src = '';
    });

    videoPlayer.addEventListener('error', handleVideoError);
}

export function playChannel(channel) {
    if (Hls.isSupported()) {
        hls = new Hls({
            xhrSetup: (xhr, url) => {
                xhr.withCredentials = true;
                if (channel.userAgent) {
                    xhr.setRequestHeader('User-Agent', channel.userAgent);
                }
                if (channel.cookie) {
                    xhr.setRequestHeader('Cookie', channel.cookie);
                }
            }
        });
        hls.loadSource(channel.link);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            playVideo();
        });
        hls.on(Hls.Events.ERROR, handleHlsError);
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.link;
        videoPlayer.addEventListener('loadedmetadata', () => {
            playVideo();
        });
    } else {
        console.error('HLS is not supported on this browser.');
        showAlert('Sorry, your browser does not support the required video format.', 'warning');
        return;
    }

    playerModalLabel.textContent = channel.name;
    playerModal.show();
}

function playVideo() {
    videoPlayer.play().catch(error => {
        console.error('Error attempting to play:', error);
        showAlert('Failed to play the video. Please try again.', 'danger');
    });
}

function handleVideoError(e) {
    console.error('Video player error:', e);
    showAlert('An error occurred while playing the video. Please try again later.', 'danger');
    playerModal.hide();
}

function handleHlsError(event, data) {
    if (data.fatal) {
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error encountered, trying to recover:', data);
                hls.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error encountered, trying to recover:', data);
                hls.recoverMediaError();
                break;
            default:
                console.error('Fatal HLS error:', data);
                showAlert('An error occurred while playing the video. Please try again later.', 'danger');
                playerModal.hide();
                break;
        }
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

