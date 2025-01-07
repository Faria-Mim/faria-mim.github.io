const playerContainer = document.getElementById('player-container');
const videoPlayer = document.getElementById('video-player');
const closePlayerButton = document.getElementById('close-player');
const currentChannelTitle = document.getElementById('current-channel');

export function initializePlayer() {
    closePlayerButton.addEventListener('click', closePlayer);
}

export function playChannel(channel) {
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(channel.link);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoPlayer.play().catch(error => {
                console.error('Error attempting to play:', error);
                alert('Failed to play the video. Please try again.');
            });
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('Fatal HLS error:', data);
                alert('An error occurred while playing the video. Please try again later.');
                closePlayer();
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.link;
        videoPlayer.addEventListener('loadedmetadata', () => {
            videoPlayer.play().catch(error => {
                console.error('Error attempting to play:', error);
                alert('Failed to play the video. Please try again.');
            });
        });
    } else {
        console.error('HLS is not supported on this browser.');
        alert('Sorry, your browser does not support the required video format.');
        return;
    }

    currentChannelTitle.textContent = channel.name;
    playerContainer.classList.remove('hidden');
}

function closePlayer() {
    videoPlayer.pause();
    videoPlayer.src = '';
    playerContainer.classList.add('hidden');
}

videoPlayer.addEventListener('error', (e) => {
    console.error('Video player error:', e);
    alert('An error occurred while playing the video. Please try again later.');
    closePlayer();
});
