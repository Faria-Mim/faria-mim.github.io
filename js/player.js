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
            videoPlayer.play();
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = channel.link;
        videoPlayer.addEventListener('loadedmetadata', () => {
            videoPlayer.play();
        });
    }

    currentChannelTitle.textContent = channel.name;
    playerContainer.classList.remove('hidden');
}

function closePlayer() {
    videoPlayer.pause();
    videoPlayer.src = '';
    playerContainer.classList.add('hidden');
}
