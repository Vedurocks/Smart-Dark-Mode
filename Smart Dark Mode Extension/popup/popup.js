// Global state
let currentHostname = null;
let currentTabId = null;
let currentPrefs = null;

// Get current tab info
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

// Get hostname from URL
function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

// Check if site is blacklisted
async function isBlacklisted(hostname) {
    const result = await chrome.storage.local.get(['blacklist']);
    const blacklist = result.blacklist || [];
    return blacklist.includes(hostname);
}

// Load site preferences
async function loadSitePreferences(hostname) {
    const result = await chrome.storage.local.get(['sitePreferences']);
    const prefs = result.sitePreferences || {};
    return prefs[hostname] || { 
        enabled: false,
        mode: 'auto', 
        customRules: [], 
        removedElements: [],
        aiLayoutEnabled: false,
        customCSS: ''
    };
}

// Save site preferences
async function saveSitePreferences(hostname, preferences) {
    const result = await chrome.storage.local.get(['sitePreferences']);
    const prefs = result.sitePreferences || {};
    prefs[hostname] = preferences;
    await chrome.storage.local.set({ sitePreferences: prefs });
}

// Load global settings
async function loadGlobalSettings() {
    const result = await chrome.storage.local.get(['globalSettings']);
    return result.globalSettings || {
        showLoader: true
    };
}

// Save global settings
async function saveGlobalSettings(settings) {
    await chrome.storage.local.set({ globalSettings: settings });
}

// Check if we should show loader
async function shouldShowLoader(hostname) {
    const settings = await loadGlobalSettings();
    if (!settings.showLoader) return false;
    
    // Check if we've shown loader for this site in this session
    const result = await chrome.storage.session.get(['loadedSites']);
    const loadedSites = result.loadedSites || [];
    return !loadedSites.includes(hostname);
}

// Mark site as loaded
async function markSiteAsLoaded(hostname) {
    const result = await chrome.storage.session.get(['loadedSites']);
    const loadedSites = result.loadedSites || [];
    if (!loadedSites.includes(hostname)) {
        loadedSites.push(hostname);
        await chrome.storage.session.set({ loadedSites });
    }
}

// Simulate AI analysis
function simulateAnalysis() {
    return new Promise(resolve => setTimeout(resolve, 8000)); // Fixed 8 seconds
}

// Update UI theme based on system preference
function updateTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
    }
}

// Update UI based on current state
function updateUI(enabled, mode) {
    const mainToggle = document.getElementById('main-toggle');
    const modeIndicator = document.getElementById('mode-indicator');
    const modeText = document.getElementById('mode-text');
    const controlButtons = document.querySelectorAll('.control-btn');
    const featureButtons = document.querySelectorAll('.feature-btn:not(.danger)');
    
    mainToggle.checked = enabled;
    
    if (enabled) {
        modeIndicator.classList.add('active');
    } else {
        modeIndicator.classList.remove('active');
    }
    
    if (!enabled) {
        modeText.textContent = 'Disabled';
    } else {
        const modeTexts = {
            'always-dark': 'Always Dark Mode',
            'never-dark': 'Never Dark Mode',
            'auto': 'Auto Mode'
        };
        modeText.textContent = modeTexts[mode] || 'Auto Mode';
    }
    
    const buttons = {
        'always-dark': document.getElementById('btn-always-dark'),
        'never-dark': document.getElementById('btn-never-dark'),
        'auto': document.getElementById('btn-auto')
    };
    
    Object.values(buttons).forEach(btn => btn.classList.remove('active'));
    if (enabled && buttons[mode]) {
        buttons[mode].classList.add('active');
    }
    
    controlButtons.forEach(btn => {
        btn.disabled = !enabled;
    });
    
    featureButtons.forEach(btn => {
        btn.disabled = !enabled;
    });
}

// Apply dark mode to current tab
async function applyDarkMode(tabId, shouldApply) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            action: shouldApply ? 'enableDarkMode' : 'disableDarkMode'
        });
    } catch (error) {
        console.log('Could not send message to tab:', error);
    }
}

// Initialize popup
async function init() {
    const loadingContainer = document.getElementById('loading-container');
    const mainContainer = document.getElementById('main-container');
    const currentSiteEl = document.getElementById('current-site');
    
    // Update theme
    updateTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    
    const tab = await getCurrentTab();
    const hostname = getHostname(tab.url);
    
    if (!hostname) {
        loadingContainer.classList.remove('active');
        mainContainer.classList.remove('hidden');
        currentSiteEl.textContent = 'Invalid URL';
        return;
    }
    
    currentHostname = hostname;
    currentTabId = tab.id;
    currentSiteEl.textContent = hostname;
    
    // Check if blacklisted
    const blacklisted = await isBlacklisted(hostname);
    if (blacklisted) {
        loadingContainer.classList.remove('active');
        mainContainer.classList.remove('hidden');
        document.getElementById('mode-text').textContent = 'Blacklisted';
        document.getElementById('main-toggle').disabled = true;
        setupEventListeners(hostname, { enabled: false, mode: 'auto' }, tab.id);
        return;
    }
    
    // Check if we should show loader
    const showLoader = await shouldShowLoader(hostname);
    
    if (showLoader) {
        await simulateAnalysis();
        await markSiteAsLoaded(hostname);
    }
    
    // Load preferences
    const prefs = await loadSitePreferences(hostname);
    currentPrefs = prefs;
    
    // Show main UI
    loadingContainer.classList.remove('active');
    mainContainer.classList.remove('hidden');
    
    // Update UI
    updateUI(prefs.enabled || false, prefs.mode);
    
    // Update stats
    const result = await chrome.storage.local.get(['sitePreferences']);
    const sitesCount = Object.keys(result.sitePreferences || {}).length;
    document.getElementById('sites-count').textContent = sitesCount;
    
    // Set up event listeners
    setupEventListeners(hostname, prefs, tab.id);
}

// Set up all event listeners
function setupEventListeners(hostname, currentPrefs, tabId) {
    // Main toggle
    document.getElementById('main-toggle').addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        currentPrefs.enabled = enabled;
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(enabled, currentPrefs.mode);
        
        if (enabled) {
            const shouldApply = currentPrefs.mode === 'always-dark' || 
                              (currentPrefs.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            await applyDarkMode(tabId, shouldApply);
        } else {
            await applyDarkMode(tabId, false);
        }
    });
    
    // Mode buttons
    document.getElementById('btn-always-dark').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        currentPrefs.mode = 'always-dark';
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(true, 'always-dark');
        await applyDarkMode(tabId, true);
    });
    
    document.getElementById('btn-never-dark').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        currentPrefs.mode = 'never-dark';
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(true, 'never-dark');
        await applyDarkMode(tabId, false);
    });
    
    document.getElementById('btn-auto').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        currentPrefs.mode = 'auto';
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(true, 'auto');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        await applyDarkMode(tabId, prefersDark);
    });
    
    // Feature buttons
    document.getElementById('btn-remove-elements').addEventListener('click', async () => {
    if (!currentPrefs.enabled) return;
    
    // Enable element selector mode
    try {
        await chrome.tabs.sendMessage(tabId, {
            action: 'startElementSelector'
        });
        
        // Close popup to show the page
        window.close();
    } catch (error) {
        alert('Error: Please refresh the page and try again.');
    }
    });
    
    document.getElementById('btn-ai-layout').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        
        currentPrefs.aiLayoutEnabled = !currentPrefs.aiLayoutEnabled;
        await saveSitePreferences(hostname, currentPrefs);
        
        await chrome.tabs.sendMessage(tabId, {
            action: 'toggleAILayout',
            enabled: currentPrefs.aiLayoutEnabled
        });
        
        alert(currentPrefs.aiLayoutEnabled ? 
            'AI Layout Fix Enabled!\n\nThe extension will now automatically fix:\n• Color contrast issues\n• Unreadable text\n• Broken layouts' :
            'AI Layout Fix Disabled');
    });
    
    document.getElementById('btn-custom-rules').addEventListener('click', () => {
        if (!currentPrefs.enabled) return;
        openCustomRulesModal();
    });
    
    // Reset site button
    document.getElementById('btn-reset-site').addEventListener('click', async () => {
        if (confirm(`Reset all preferences for ${hostname}?\n\nThis will remove all saved settings for this site.`)) {
            const result = await chrome.storage.local.get(['sitePreferences']);
            const prefs = result.sitePreferences || {};
            delete prefs[hostname];
            await chrome.storage.local.set({ sitePreferences: prefs });
            location.reload();
        }
    });
    
    // Blacklist button
    document.getElementById('btn-blacklist').addEventListener('click', async () => {
        if (confirm(`Add ${hostname} to blacklist?\n\nThe extension will be completely disabled on this site.`)) {
            const result = await chrome.storage.local.get(['blacklist']);
            const blacklist = result.blacklist || [];
            if (!blacklist.includes(hostname)) {
                blacklist.push(hostname);
                await chrome.storage.local.set({ blacklist });
            }
            location.reload();
        }
    });
    
    // Settings button
    document.getElementById('btn-settings').addEventListener('click', () => {
        openSettingsModal();
    });
    
    // Settings modal
    setupSettingsModal();
    setupCustomRulesModal();
}

// Setup settings modal
function setupSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-settings');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

// Open settings modal
async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const showLoaderToggle = document.getElementById('show-loader-toggle');
    const blacklistContainer = document.getElementById('blacklist-container');
    
    // Load settings
    const settings = await loadGlobalSettings();
    showLoaderToggle.checked = settings.showLoader;
    
    // Load blacklist
    const result = await chrome.storage.local.get(['blacklist']);
    const blacklist = result.blacklist || [];
    
    if (blacklist.length === 0) {
        blacklistContainer.innerHTML = '<div class="empty-state">No blacklisted sites</div>';
    } else {
        blacklistContainer.innerHTML = blacklist.map(domain => `
            <div class="blacklist-item">
                <span class="blacklist-item-domain">${domain}</span>
                <button class="remove-blacklist-btn" data-domain="${domain}">Remove</button>
            </div>
        `).join('');
        
        // Add remove handlers
        blacklistContainer.querySelectorAll('.remove-blacklist-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const domain = btn.dataset.domain;
                const result = await chrome.storage.local.get(['blacklist']);
                const blacklist = result.blacklist || [];
                const newBlacklist = blacklist.filter(d => d !== domain);
                await chrome.storage.local.set({ blacklist: newBlacklist });
                openSettingsModal(); // Refresh
            });
        });
    }
    
    // Save loader setting
    showLoaderToggle.addEventListener('change', async (e) => {
        const settings = await loadGlobalSettings();
        settings.showLoader = e.target.checked;
        await saveGlobalSettings(settings);
    });
    
    modal.classList.remove('hidden');
}

// Setup custom rules modal
function setupCustomRulesModal() {
    const modal = document.getElementById('custom-rules-modal');
    const closeBtn = document.getElementById('close-custom-rules');
    const saveBtn = document.getElementById('save-custom-rules');
    const clearBtn = document.getElementById('clear-custom-rules');
    const textarea = document.getElementById('custom-css-input');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    saveBtn.addEventListener('click', async () => {
        const css = textarea.value.trim();
        currentPrefs.customCSS = css;
        await saveSitePreferences(currentHostname, currentPrefs);
        
        // Apply custom CSS
        await chrome.tabs.sendMessage(currentTabId, {
            action: 'applyCustomCSS',
            css: css
        });
        
        modal.classList.add('hidden');
        alert('Custom CSS saved and applied!');
    });
    
    clearBtn.addEventListener('click', () => {
        textarea.value = '';
    });
}

// Open custom rules modal
function openCustomRulesModal() {
    const modal = document.getElementById('custom-rules-modal');
    const textarea = document.getElementById('custom-css-input');
    
    textarea.value = currentPrefs.customCSS || '';
    modal.classList.remove('hidden');
}

// Start initialization
document.addEventListener('DOMContentLoaded', init);