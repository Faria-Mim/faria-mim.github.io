const playerModal = new bootstrap.Modal(document.getElementById('player-container'));
const videoPlayer = document.getElementById('video-player');
const currentChannelTitle = document.getElementById('current-channel');

export function initializePlayer() {
    document.getElementById('player-container').addEventListener('hidden.bs.modal', () => {
        videoPlayer.pause();
        videoPlayer.src = '';
    });
}

export function playChannel(channel) {
    if (Hls.isSupported()) {
        const hls = new Hls({
            xhrSetup: (xhr, url) => {
                xhr.withCredentials = true; // Enable passing cookies for CORS requests
            }
        });
        hls.loadSource(channel.link);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoPlayer.play().catch(error => {
                console.error('Error attempting to play:', error);
                showAlert('Failed to play the video. Please try again.', 'danger');
            });
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('Fatal HLS error:', data);
                showAlert('An error occurred while playing the video. Please try again later.', 'danger');
                playerModal.hide();
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.link;
        videoPlayer.addEventListener('loadedmetadata', () => {
            videoPlayer.play().catch(error => {
                console.error('Error attempting to play:', error);
                showAlert('Failed to play the video. Please try again.', 'danger');
            });
        });
    } else {
        console.error('HLS is not supported on this browser.');
        showAlert('Sorry, your browser does not support the required video format.', 'warning');
        return;
    }

    currentChannelTitle.textContent = channel.name;
    playerModal.show();
}

videoPlayer.addEventListener('error', (e) => {
    console.error('Video player error:', e);
    showAlert('An error occurred while playing the video. Please try again later.', 'danger');
    playerModal.hide();
});

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.insertBefore(alertDiv, document.body.firstChild);
}
