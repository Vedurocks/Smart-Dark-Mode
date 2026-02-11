// Global state
let currentHostname = null;
let currentTabId = null;
let currentPrefs = null;
let authManager = null;

// Load auth script and initialize
async function loadAuthAndInit() {
    try {
        // Import auth script
        const authScript = document.createElement('script');
        authScript.src = chrome.runtime.getURL('auth/auth.js');
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
            authScript.onload = resolve;
            authScript.onerror = () => reject(new Error('Failed to load auth script'));
            document.head.appendChild(authScript);
        });

        // Small delay to ensure AuthManager class is available
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if AuthManager is available
        if (typeof AuthManager === 'undefined') {
            throw new Error('AuthManager not loaded');
        }

        // Create auth manager instance
        authManager = new AuthManager();
        
        // Check session validity
        const isValid = await authManager.isSessionValid();
        
        if (!isValid) {
            // Not logged in - redirect to login
            chrome.tabs.create({ url: chrome.runtime.getURL('auth/login.html') });
            window.close();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth initialization error:', error);
        // Fallback - open login page
        chrome.tabs.create({ url: chrome.runtime.getURL('auth/login.html') });
        window.close();
        return false;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const isLoggedIn = await loadAuthAndInit();
    if (isLoggedIn) {
        init();
    }
});

// Helper function to get root domain
function getRootDomain(hostname) {
    let domain = hostname.replace(/^www\./, '');
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    return parts.slice(-2).join('.');
}

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
    const rootDomain = getRootDomain(hostname);
    const result = await chrome.storage.local.get(['blacklist']);
    const blacklist = result.blacklist || [];
    return blacklist.some(domain => 
        getRootDomain(domain) === rootDomain || domain === hostname
    );
}

// Load site preferences
async function loadSitePreferences(hostname) {
    const rootDomain = getRootDomain(hostname);
    const result = await chrome.storage.local.get(['sitePreferences']);
    const prefs = result.sitePreferences || {};
    
    const exactPrefs = prefs[hostname];
    const rootPrefs = prefs[rootDomain];
    
    return exactPrefs || rootPrefs || { 
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
    const rootDomain = getRootDomain(hostname);
    const result = await chrome.storage.local.get(['sitePreferences']);
    const prefs = result.sitePreferences || {};
    
    prefs[rootDomain] = preferences;
    await chrome.storage.local.set({ sitePreferences: prefs });
    
    chrome.runtime.sendMessage({ action: 'updateIcon' });
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
    return new Promise(resolve => setTimeout(resolve, 8000));
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
    
    const blacklisted = await isBlacklisted(hostname);
    if (blacklisted) {
        loadingContainer.classList.remove('active');
        mainContainer.classList.remove('hidden');
        document.getElementById('mode-text').textContent = 'Blacklisted';
        document.getElementById('main-toggle').disabled = true;
        setupEventListeners(hostname, { enabled: false, mode: 'auto' }, tab.id);
        return;
    }
    
    const showLoader = await shouldShowLoader(hostname);
    
    if (showLoader) {
        await simulateAnalysis();
        await markSiteAsLoaded(hostname);
    }
    
    const prefs = await loadSitePreferences(hostname);
    currentPrefs = prefs;
    
    loadingContainer.classList.remove('active');
    mainContainer.classList.remove('hidden');
    
    updateUI(prefs.enabled || false, prefs.mode);
    
    const result = await chrome.storage.local.get(['sitePreferences']);
    const sitesCount = Object.keys(result.sitePreferences || {}).length;
    document.getElementById('sites-count').textContent = sitesCount;
    
    setupEventListeners(hostname, prefs, tab.id);
}

// Set up all event listeners
function setupEventListeners(hostname, currentPrefs, tabId) {
    document.getElementById('main-toggle').addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        currentPrefs.enabled = enabled;
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(enabled, currentPrefs.mode);
        
        chrome.runtime.sendMessage({ action: 'updateIcon' });
        
        if (enabled) {
            const shouldApply = currentPrefs.mode === 'always-dark' || 
                              (currentPrefs.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            await applyDarkMode(tabId, shouldApply);
        } else {
            await applyDarkMode(tabId, false);
        }
    });
    
    document.getElementById('btn-always-dark').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        currentPrefs.mode = 'always-dark';
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(true, 'always-dark');
        chrome.runtime.sendMessage({ action: 'updateIcon' });
        await applyDarkMode(tabId, true);
    });
    
    document.getElementById('btn-never-dark').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        currentPrefs.mode = 'never-dark';
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(true, 'never-dark');
        chrome.runtime.sendMessage({ action: 'updateIcon' });
        await applyDarkMode(tabId, false);
    });
    
    document.getElementById('btn-auto').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        currentPrefs.mode = 'auto';
        await saveSitePreferences(hostname, currentPrefs);
        updateUI(true, 'auto');
        chrome.runtime.sendMessage({ action: 'updateIcon' });
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        await applyDarkMode(tabId, prefersDark);
    });
    
    document.getElementById('btn-remove-elements').addEventListener('click', async () => {
        if (!currentPrefs.enabled) return;
        
        try {
            await chrome.tabs.sendMessage(tabId, {
                action: 'startElementSelector'
            });
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
    
    document.getElementById('btn-reset-site').addEventListener('click', async () => {
        if (confirm(`Reset all preferences for ${hostname}?\n\nThis will remove all saved settings for this site.`)) {
            const result = await chrome.storage.local.get(['sitePreferences']);
            const prefs = result.sitePreferences || {};
            delete prefs[hostname];
            await chrome.storage.local.set({ sitePreferences: prefs });
            location.reload();
        }
    });
    
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
    
    document.getElementById('btn-settings').addEventListener('click', () => {
        openSettingsModal();
    });
    
    document.getElementById('btn-credits').addEventListener('click', () => {
        chrome.tabs.create({ 
            url: 'https://yourwebsite.com/credits'
        });
    });
    
    setupSettingsModal();
    setupCustomRulesModal();
    setupLearnedSitesList();
    setupUserMenu();
}

// Setup user menu
function setupUserMenu() {
    const userMenuBtn = document.getElementById('btn-user-menu');
    const userMenuModal = document.getElementById('user-menu-modal');
    const closeUserMenu = document.getElementById('close-user-menu');
    
    userMenuBtn.addEventListener('click', async () => {
        await loadUserInfo();
        userMenuModal.classList.remove('hidden');
    });
    
    closeUserMenu.addEventListener('click', () => {
        userMenuModal.classList.add('hidden');
    });
    
    userMenuModal.addEventListener('click', (e) => {
        if (e.target === userMenuModal) {
            userMenuModal.classList.add('hidden');
        }
    });
    
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            await authManager.logout();
            chrome.tabs.create({ url: chrome.runtime.getURL('auth/login.html') });
            window.close();
        }
    });
    
    document.getElementById('btn-change-password').addEventListener('click', () => {
        userMenuModal.classList.add('hidden');
        openChangePasswordModal();
    });
    
    document.getElementById('btn-delete-account').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete your account?\n\nThis action cannot be undone and all your data will be lost.')) {
            const password = prompt('Enter your password to confirm:');
            if (password) {
                const user = await authManager.getCurrentUser();
                const result = await authManager.deleteAccount(user.email, password);
                if (result.success) {
                    alert('Account deleted successfully');
                    chrome.tabs.create({ url: chrome.runtime.getURL('auth/login.html') });
                    window.close();
                } else {
                    alert(result.error);
                }
            }
        }
    });
}

// Load user info
async function loadUserInfo() {
    const user = await authManager.getCurrentUser();
    const session = await chrome.storage.local.get(['currentSession']);
    
    document.getElementById('user-email').textContent = user.email;
    
    if (session.currentSession) {
        const expiryDate = new Date(session.currentSession.expiresAt);
        const daysLeft = Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
        document.getElementById('session-expiry').textContent = `${daysLeft} days`;
    }
}

// Open change password modal
function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    const closeBtn = document.getElementById('close-change-password');
    const saveBtn = document.getElementById('save-new-password');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const errorDiv = document.getElementById('change-password-error');
    const successDiv = document.getElementById('change-password-success');
    
    modal.classList.remove('hidden');
    
    closeBtn.onclick = () => {
        modal.classList.add('hidden');
        clearPasswordFields();
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            clearPasswordFields();
        }
    };
    
    saveBtn.onclick = async () => {
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
        
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        
        if (!currentPassword || !newPassword) {
            errorDiv.textContent = 'Please fill in all fields';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        const user = await authManager.getCurrentUser();
        const result = await authManager.changePassword(user.email, currentPassword, newPassword);
        
        if (result.success) {
            successDiv.textContent = result.message;
            successDiv.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.add('hidden');
                clearPasswordFields();
            }, 2000);
        } else {
            errorDiv.textContent = result.error;
            errorDiv.classList.remove('hidden');
        }
    };
    
    function clearPasswordFields() {
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
    }
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
    
    const settings = await loadGlobalSettings();
    showLoaderToggle.checked = settings.showLoader;
    
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
        
        blacklistContainer.querySelectorAll('.remove-blacklist-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const domain = btn.dataset.domain;
                const result = await chrome.storage.local.get(['blacklist']);
                const blacklist = result.blacklist || [];
                const newBlacklist = blacklist.filter(d => d !== domain);
                await chrome.storage.local.set({ blacklist: newBlacklist });
                openSettingsModal();
            });
        });
    }
    
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

// Setup learned sites list
function setupLearnedSitesList() {
    const toggleBtn = document.getElementById('toggle-learned-sites');
    const sitesList = document.getElementById('learned-sites-list');
    
    toggleBtn.addEventListener('click', async () => {
        const isHidden = sitesList.classList.contains('hidden');
        
        if (isHidden) {
            await loadLearnedSites();
            sitesList.classList.remove('hidden');
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = 'View Learned Sites ▲';
        } else {
            sitesList.classList.add('hidden');
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = 'View Learned Sites ▼';
        }
    });
}

// Load and display learned sites
async function loadLearnedSites() {
    const sitesList = document.getElementById('learned-sites-list');
    const result = await chrome.storage.local.get(['sitePreferences', 'siteVisits']);
    const prefs = result.sitePreferences || {};
    const visits = result.siteVisits || {};
    
    const learnedSites = Object.keys(prefs).filter(hostname => {
        const pref = prefs[hostname];
        return pref.enabled || pref.mode !== 'auto' || 
               (pref.removedElements && pref.removedElements.length > 0) ||
               (pref.customCSS && pref.customCSS.trim() !== '');
    });
    
    if (learnedSites.length === 0) {
        sitesList.innerHTML = '<div class="empty-learned-sites">No sites learned yet</div>';
        return;
    }
    
    learnedSites.sort((a, b) => {
        const aVisit = visits[a]?.lastVisit || 0;
        const bVisit = visits[b]?.lastVisit || 0;
        return bVisit - aVisit;
    });
    
    sitesList.innerHTML = learnedSites.map(hostname => {
        const pref = prefs[hostname];
        const visit = visits[hostname];
        
        const modeClass = pref.mode || 'auto';
        const modeText = {
            'always-dark': 'Always Dark',
            'never-dark': 'Never Dark',
            'auto': 'Auto'
        }[pref.mode] || 'Auto';
        
        const lastVisit = visit ? formatLastVisit(visit.lastVisit) : 'Never';
        const status = pref.enabled ? '🟢' : '⚫';
        
        return `
            <div class="learned-site-item" data-hostname="${hostname}">
                <div class="learned-site-info">
                    <div class="learned-site-domain">${status} ${hostname}</div>
                    <div class="learned-site-meta">
                        <span class="learned-site-mode">
                            <span class="mode-badge ${modeClass}">${modeText}</span>
                        </span>
                        <span>Last: ${lastVisit}</span>
                    </div>
                </div>
                <div class="learned-site-actions">
                    <button class="mini-btn visit-site-btn" data-hostname="${hostname}">Visit</button>
                    <button class="mini-btn danger forget-site-btn" data-hostname="${hostname}">Forget</button>
                </div>
            </div>
        `;
    }).join('');
    
    sitesList.querySelectorAll('.visit-site-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hostname = e.target.dataset.hostname;
            chrome.tabs.create({ url: `https://${hostname}` });
        });
    });
    
    sitesList.querySelectorAll('.forget-site-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const hostname = e.target.dataset.hostname;
            if (confirm(`Forget all settings for ${hostname}?`)) {
                await forgetSite(hostname);
                await loadLearnedSites();
            }
        });
    });
}

// Format last visit time
function formatLastVisit(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
}

// Forget a site
async function forgetSite(hostname) {
    const result = await chrome.storage.local.get(['sitePreferences']);
    const prefs = result.sitePreferences || {};
    delete prefs[hostname];
    await chrome.storage.local.set({ sitePreferences: prefs });
    
    const sitesCount = Object.keys(prefs).length;
    document.getElementById('sites-count').textContent = sitesCount;
    
    showToast(`Forgot all settings for ${hostname}`);
}

// Show toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(78, 205, 196, 0.95);
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 10000;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
