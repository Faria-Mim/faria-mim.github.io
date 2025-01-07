import { initializePlayer, playChannel } from './player.js';

const channelGrid = document.getElementById('channel-grid');
const categoryNav = document.getElementById('category-nav');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

const playlists = [
    'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_OTT_Navigator.m3u',
    'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_NS_Player.m3u'
];

let allChannels = [];

async function fetchPlaylists() {
    try {
        const responses = await Promise.all(playlists.map(url => 
            fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
        ));
        const contents = await Promise.all(responses.map(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.text();
        }));
        return contents;
    } catch (error) {
        console.error('Error fetching playlists:', error);
        showAlert('Failed to fetch channel list. Please try again later.', 'danger');
        return [];
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
                category: metadata['group-title']
            };
        } else if (line.startsWith('#EXTVLCOPT:http-user-agent')) {
            currentChannel.userAgent = line.split('=')[1];
        } else if (line.startsWith('#EXTHTTP:')) {
            const httpOptions = JSON.parse(line.slice(9));
            currentChannel.cookie = httpOptions.cookie;
        } else if (line.trim() && !line.startsWith('#')) {
            currentChannel.link = line.trim();
            channels.push(currentChannel);
            currentChannel = {};
        }
    }

    return channels;
}

function parseJSON(content) {
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return [];
    }
}

function createChannelCard(channel) {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';

    const card = document.createElement('div');
    card.className = 'channel-card h-100';

    const logo = document.createElement('img');
    logo.src = channel.logo || 'placeholder.png';
    logo.alt = `${channel.name} logo`;
    logo.className = 'channel-logo';
    logo.loading = 'lazy';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    const name = document.createElement('h5');
    name.textContent = channel.name;
    name.className = 'channel-name text-center mb-3';

    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.className = 'btn btn-primary mt-auto';
    playButton.addEventListener('click', () => playChannel(channel));

    cardBody.appendChild(name);
    cardBody.appendChild(playButton);

    card.appendChild(logo);
    card.appendChild(cardBody);
    col.appendChild(card);

    return col;
}

function renderChannels(channels) {
    channelGrid.innerHTML = '';
    channels.forEach(channel => {
        const card = createChannelCard(channel);
        channelGrid.appendChild(card);
    });
}

function renderCategories(channels) {
    const categories = ['All', ...new Set(channels.map(channel => channel.category))];
    categoryNav.innerHTML = '';

    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.className = 'nav-link';
        button.addEventListener('click', () => filterChannels(category));
        categoryNav.appendChild(button);
    });

    categoryNav.firstChild.classList.add('active');
}

function filterChannels(category) {
    const filteredChannels = category === 'All' 
        ? allChannels 
        : allChannels.filter(channel => channel.category === category);
    renderChannels(filteredChannels);

    // Update active category
    categoryNav.querySelectorAll('.nav-link').forEach(button => {
        button.classList.toggle('active', button.textContent === category);
    });
}

function searchChannels(query) {
    const filteredChannels = allChannels.filter(channel => 
        channel.name.toLowerCase().includes(query.toLowerCase())
    );
    renderChannels(filteredChannels);
}

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

searchButton.addEventListener('click', () => searchChannels(searchInput.value));
searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        searchChannels(searchInput.value);
    }
});

async function init() {
    const playlistContents = await fetchPlaylists();
    if (playlistContents.length === 0) return;

    allChannels = [
        ...parseM3U(playlistContents[0]),
        ...parseJSON(playlistContents[1])
    ];

    renderChannels(allChannels);
    renderCategories(allChannels);
    initializePlayer();
}

init();
