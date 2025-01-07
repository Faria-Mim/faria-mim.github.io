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
        const responses = await Promise.all(playlists.map(url => fetch(url)));
        const contents = await Promise.all(responses.map(res => res.text()));
        return contents;
    } catch (error) {
        console.error('Error fetching playlists:', error);
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
    const card = document.createElement('div');
    card.className = 'channel-card';

    const logo = document.createElement('img');
    logo.src = channel.logo;
    logo.alt = `${channel.name} logo`;
    logo.className = 'channel-logo';
    logo.loading = 'lazy';

    const name = document.createElement('div');
    name.textContent = channel.name;
    name.className = 'channel-name';

    const playButton = document.createElement('button');
    playButton.textContent = 'Play';
    playButton.className = 'play-button';
    playButton.addEventListener('click', () => playChannel(channel));

    card.appendChild(logo);
    card.appendChild(name);
    card.appendChild(playButton);

    return card;
}

function renderChannels(channels) {
    channelGrid.innerHTML = '';
    channels.forEach(channel => {
        const card = createChannelCard(channel);
        channelGrid.appendChild(card);
    });
}

function renderCategories(channels) {
    const categories = [...new Set(channels.map(channel => channel.category))];
    categoryNav.innerHTML = '';

    const allButton = document.createElement('button');
    allButton.textContent = 'All';
    allButton.addEventListener('click', () => filterChannels('All'));
    categoryNav.appendChild(allButton);

    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.addEventListener('click', () => filterChannels(category));
        categoryNav.appendChild(button);
    });
}

function filterChannels(category) {
    const filteredChannels = category === 'All' 
        ? allChannels 
        : allChannels.filter(channel => channel.category === category);
    renderChannels(filteredChannels);

    // Update active category
    categoryNav.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.textContent === category);
    });
}

function searchChannels(query) {
    const filteredChannels = allChannels.filter(channel => 
        channel.name.toLowerCase().includes(query.toLowerCase())
    );
    renderChannels(filteredChannels);
}

searchButton.addEventListener('click', () => searchChannels(searchInput.value));
searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        searchChannels(searchInput.value);
    }
});

async function init() {
    const playlistContents = await fetchPlaylists();
    allChannels = [
        ...parseM3U(playlistContents[0]),
        ...parseJSON(playlistContents[1])
    ];

    renderChannels(allChannels);
    renderCategories(allChannels);
    initializePlayer();
}

init();

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}
