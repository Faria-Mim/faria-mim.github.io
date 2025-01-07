import { initializePlayer, playChannel } from './player.js';

const channelGrid = document.getElementById('channel-grid');
const categoryContainer = document.getElementById('category-container');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

// Enhanced configuration
const CONFIG = {
    CORS_PROXIES: [
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ],
    PLAYLISTS: [
        'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_OTT_Navigator.m3u',
        'https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/refs/heads/main/toffee_NS_Player.m3u'
    ],
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    ALERT_DURATION: 5000
};

let allChannels = [];
let currentCategory = 'All';
let currentCorsProxyIndex = 0;

// Enhanced loader with animation
const showLoader = () => {
    channelGrid.innerHTML = `
        <div class="loader-container">
            <div class="loader"></div>
            <p class="mt-2">Loading channels...</p>
        </div>
    `;
};

const hideLoader = () => {
    const loader = channelGrid.querySelector('.loader-container');
    if (loader) {
        loader.remove();
    }
};

// Enhanced fetch with CORS proxy rotation and retry mechanism
const fetchWithRetry = async (url, retries = CONFIG.RETRY_ATTEMPTS) => {
    for (let i = 0; i < retries; i++) {
        try {
            const proxyUrl = CONFIG.CORS_PROXIES[currentCorsProxyIndex] + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.text();
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed for proxy ${currentCorsProxyIndex}:`, error);
            // Rotate to next proxy
            currentCorsProxyIndex = (currentCorsProxyIndex + 1) % CONFIG.CORS_PROXIES.length;
            
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * Math.pow(2, i)));
        }
    }
};

// Enhanced playlist fetching with progress tracking
async function fetchPlaylists() {
    showLoader();
    const results = [];
    
    for (const url of CONFIG.PLAYLISTS) {
        try {
            const content = await fetchWithRetry(url);
            results.push(content);
        } catch (error) {
            console.error('Error fetching playlist:', url, error);
            showAlert(`Failed to fetch playlist: ${url}`, 'warning');
        }
    }
    
    hideLoader();
    return results;
}

// Enhanced M3U parser with better error handling
function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = {};

    for (const line of lines) {
        try {
            if (line.startsWith('#EXTINF:')) {
                const metadataPart = line.substring(line.indexOf(':') + 1, line.indexOf(','));
                const metadata = {};
                
                metadataPart.split(' ').forEach(item => {
                    const [key, value] = item.split('=').map(s => s.replace(/"/g, ''));
                    if (key && value) metadata[key] = value;
                });

                currentChannel = {
                    name: line.split(',')[1]?.trim() || 'Unknown Channel',
                    logo: metadata['tvg-logo'] || 'images/placeholder.png',
                    category: metadata['group-title'] || 'Uncategorized',
                    language: metadata['tvg-language'],
                    id: metadata['tvg-id']
                };
            } else if (line.startsWith('#EXTVLCOPT:http-user-agent')) {
                currentChannel.userAgent = line.split('=')[1]?.trim();
            } else if (line.startsWith('#EXTHTTP:')) {
                try {
                    const httpOptions = JSON.parse(line.slice(9));
                    currentChannel.cookie = httpOptions.cookie;
                    currentChannel.headers = httpOptions.headers;
                } catch (e) {
                    console.warn('Error parsing HTTP options:', e);
                }
            } else if (line.trim() && !line.startsWith('#')) {
                currentChannel.link = line.trim();
                if (currentChannel.name && currentChannel.link) {
                    channels.push({...currentChannel});
                }
                currentChannel = {};
            }
        } catch (error) {
            console.warn('Error parsing line:', line, error);
        }
    }

    return channels;
}

// Enhanced channel card creation with lazy loading and error handling
function createChannelCard(channel) {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3 mb-4 fade-in';

    const card = document.createElement('div');
    card.className = 'card channel-card h-100 shadow-sm';

    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-img-container';

    const img = new Image();
    img.className = 'card-img-top channel-logo';
    img.loading = 'lazy';
    img.alt = `${channel.name} logo`;

    // Image error handling
    img.onerror = () => {
        img.src = 'images/placeholder.png';
        img.onerror = null; // Prevent infinite loop
    };
    img.src = channel.logo;

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    const title = document.createElement('h5');
    title.className = 'card-title text-truncate mb-2';
    title.title = channel.name; // Add tooltip
    title.textContent = channel.name;

    const category = document.createElement('p');
    category.className = 'card-text text-muted small mb-2';
    category.textContent = channel.category;

    const playButton = document.createElement('button');
    playButton.className = 'btn btn-primary mt-auto btn-play';
    playButton.innerHTML = '<i class="fas fa-play me-2"></i>Play';
    playButton.addEventListener('click', () => playChannel(channel));

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
    cardBody.appendChild(title);
    cardBody.appendChild(category);
    cardBody.appendChild(playButton);
    card.appendChild(cardBody);
    col.appendChild(card);

    return col;
}

// Enhanced channel rendering with pagination
let currentPage = 1;
const channelsPerPage = 12;

function renderChannels(channels) {
    const startIndex = (currentPage - 1) * channelsPerPage;
    const endIndex = startIndex + channelsPerPage;
    const paginatedChannels = channels.slice(startIndex, endIndex);

    channelGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    paginatedChannels.forEach(channel => {
        const card = createChannelCard(channel);
        fragment.appendChild(card);
    });

    channelGrid.appendChild(fragment);
    renderPagination(channels.length);
}

function renderPagination(totalChannels) {
    const totalPages = Math.ceil(totalChannels / channelsPerPage);
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container d-flex justify-content-center mt-4';
    
    const pagination = document.createElement('ul');
    pagination.className = 'pagination';

    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-link';
    prevBtn.innerHTML = '&laquo;';
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            filterChannels(currentCategory);
        }
    });
    prevLi.appendChild(prevBtn);
    pagination.appendChild(prevLi);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${currentPage === i ? 'active' : ''}`;
        const btn = document.createElement('button');
        btn.className = 'page-link';
        btn.textContent = i;
        btn.addEventListener('click', () => {
            currentPage = i;
            filterChannels(currentCategory);
        });
        li.appendChild(btn);
        pagination.appendChild(li);
    }

    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-link';
    nextBtn.innerHTML = '&raquo;';
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            filterChannels(currentCategory);
        }
    });
    nextLi.appendChild(nextBtn);
    pagination.appendChild(nextLi);

    paginationContainer.appendChild(pagination);
    channelGrid.appendChild(paginationContainer);
}

// Enhanced category rendering with counts
function renderCategories(channels) {
    const categories = ['All', ...new Set(channels.map(channel => channel.category))].sort();
    const categoryCounts = channels.reduce((acc, channel) => {
        acc[channel.category] = (acc[channel.category] || 0) + 1;
        return acc;
    }, {});
    categoryCounts['All'] = channels.length;

    categoryContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = `btn btn-outline-primary category-btn${category === currentCategory ? ' active' : ''} me-2 mb-2`;
        button.innerHTML = `${category} <span class="badge bg-secondary">${categoryCounts[category]}</span>`;
        button.addEventListener('click', () => {
            currentPage = 1; // Reset to first page when changing category
            filterChannels(category);
        });
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
        btn.classList.toggle('active', btn.textContent.split(' ')[0] === currentCategory);
    });
}

// Enhanced search with debounce
let searchTimeout;
function searchChannels(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1; // Reset to first page when searching
        const filteredChannels = allChannels.filter(channel => 
            channel.name.toLowerCase().includes(query.toLowerCase()) ||
            channel.category.toLowerCase().includes(query.toLowerCase())
        );
        renderChannels(filteredChannels);
        
        if (filteredChannels.length === 0) {
            channelGrid.innerHTML = `
                <div class="col-12 text-center mt-4">
                    <h3>No channels found</h3>
                    <p>Try a different search term</p>
                </div>
            `;
        }
    }, 300);
}

// Enhanced alert system
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
        alertElement.classList.remove('show');
        setTimeout(() => alertElement.remove(), 300);
    }, CONFIG.ALERT_DURATION);
}

// Event listeners
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    searchChannels(searchInput.value);
});

searchInput.addEventListener('input', (e) => {
    searchChannels(e.target.value);
});

// Initialize the application
async function init() {
    try {
        const playlistContents = await fetchPlaylists();
        if (playlistContents.length === 0) {
            showAlert('No channels available. Please try again later.', 'warning');
            return;
        }

        allChannels = playlistContents
            .flatMap(content => parseM3U(content))
            .filter(channel => channel.name && channel.link)
            .sort((a, b) => a.name.localeCompare(b.name));

        renderChannels(allChannels);
        renderCategories(allChannels);
        initializePlayer();

        // Dark mode toggle
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', toggleDarkMode);
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showAlert('Failed to initialize the application. Please refresh the page.', 'danger');
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

// Initialize the application
init();
