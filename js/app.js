import { initializePlayer, playChannel } from './player.js';

const channelGrid = document.getElementById('channel-grid');
const categoryContainer = document.getElementById('category-container');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const PLAYLISTS = [
    'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_OTT_Navigator.m3u',
    'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_NS_Player.m3u'
];

let allChannels = [];
let currentCategory = 'All';

const showLoader = () => {
    channelGrid.innerHTML = '<div class="loader"></div>';
};

const hideLoader = () => {
    const loader = channelGrid.querySelector('.loader');
    if (loader) {
        loader.remove();
    }
};

const fetchWithRetry = async (url, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.text();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
};

async function fetchPlaylists() {
    showLoader();
    try {
        const contents = await Promise.all(PLAYLISTS.map(url => 
            fetchWithRetry(CORS_PROXY + encodeURIComponent(url))
        ));
        return contents;
    } catch (error) {
        console.error('Error fetching playlists:', error);
        showAlert('Failed to fetch channel list. Please try again later.', 'danger');
        return [];
    } finally {
        hideLoader();
    }
}

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = {};

    for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
            const metadataStr = line.split(',')[0].slice(8, -1);
            const metadata = Object.fromEntries(
                metadataStr.split(' ').map(item => item.split('=').map(s => s.replace(/"/g, '')))
            );
            currentChannel = {
                name: line.split(',')[1].trim(),
                logo: metadata['tvg-logo'],
                category: metadata['group-title'] || 'Uncategorized'
            };
        } else if (line.startsWith('#EXTVLCOPT:http-user-agent')) {
            currentChannel.userAgent = line.split('=')[1];
        } else if (line.startsWith('#EXTHTTP:')) {
            try {
                const httpOptions = JSON.parse(line.slice(9));
                currentChannel.cookie = httpOptions.cookie;
            } catch (error) {
                console.error('Error parsing HTTP options:', error);
            }
        } else if (line.trim() && !line.startsWith('#')) {
            currentChannel.link = line.trim();
            channels.push(currentChannel);
            currentChannel = {};
        }
    }

    return channels;
}

function createChannelCard(channel) {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3 fade-in';

    const card = document.createElement('div');
    card.className = 'card channel-card shadow-sm';

    const img = document.createElement('img');
    img.src = channel.logo || 'images/placeholder.png';
    img.alt = `${channel.name} logo`;
    img.className = 'card-img-top channel-logo';
    img.loading = 'lazy';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    const title = document.createElement('h5');
    title.className = 'card-title text-truncate';
    title.textContent = channel.name;

    const playButton = document.createElement('button');
    playButton.className = 'btn btn-primary mt-auto btn-play';
    playButton.textContent = 'Play';
    playButton.addEventListener('click', () => playChannel(channel));

    cardBody.appendChild(title);
    cardBody.appendChild(playButton);

    card.appendChild(img);
    card.appendChild(cardBody);
    col.appendChild(card);

    return col;
}

function renderChannels(channels) {
    channelGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    channels.forEach(channel => {
        const card = createChannelCard(channel);
        fragment.appendChild(card);
    });
    channelGrid.appendChild(fragment);
}

function renderCategories(channels) {
    const categories = ['All', ...new Set(channels.map(channel => channel.category))].sort();
    categoryContainer.innerHTML = '';

    const fragment = document.createDocumentFragment();
    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.className = `btn btn-outline-primary category-btn${category === currentCategory ? ' active' : ''}`;
        button.addEventListener('click', () => filterChannels(category));
        fragment.appendChild(button);
    });
    categoryContainer.appendChild(fragment);
}

function filterChannels(category) {
    currentCategory = category;
    const filteredChannels = category === 'All' 
        ? allChannels 
        : allChannels.filter(channel => channel.category === category);
    renderChannels(filteredChannels);
    updateActiveCategory();
}

function updateActiveCategory() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === currentCategory);
    });
}

function searchChannels(query) {
    const filteredChannels = allChannels.filter(channel => 
        channel.name.toLowerCase().includes(query.toLowerCase())
    );
    renderChannels(filteredChannels);
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

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    searchChannels(searchInput.value);
});

async function init() {
    const playlistContents = await fetchPlaylists();
    if (playlistContents.length === 0) return;

    allChannels = playlistContents.flatMap(content => parseM3U(content));
    allChannels.sort((a, b) => a.name.localeCompare(b.name));

    renderChannels(allChannels);
    renderCategories(allChannels);
    initializePlayer();

    // Add event listener for dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Check for saved dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

init();

