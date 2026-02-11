// Background service worker
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Smart Dark Mode installed!');
        chrome.storage.local.set({
            sitePreferences: {},
            blacklist: [],
            globalSettings: { showLoader: true, aiAnalysisEnabled: true, autoLearnEnabled: true }
        });
        // Open login page on install
        chrome.tabs.create({ url: 'auth/login.html' });
    } else if (details.reason === 'update') {
        console.log('Smart Dark Mode updated!');
        chrome.storage.local.get(['globalSettings'], (result) => {
            if (!result.globalSettings) {
                chrome.storage.local.set({
                    globalSettings: { showLoader: true, aiAnalysisEnabled: true, autoLearnEnabled: true }
                });
            }
        });
    }
});

// Auth Manager for background
class AuthManager {
    constructor() {
        this.SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
    }

    async isSessionValid() {
        const result = await chrome.storage.local.get(['currentSession', 'isLoggedIn']);
        if (!result.isLoggedIn || !result.currentSession) {
            return false;
        }
        const session = result.currentSession;
        const now = Date.now();
        if (now > session.expiresAt) {
            await this.logout();
            return false;
        }
        return true;
    }

    async logout() {
        await chrome.storage.local.remove(['currentSession', 'isLoggedIn']);
        return { success: true, message: 'Logged out successfully' };
    }
}

function getRootDomain(hostname) {
    let domain = hostname.replace(/^www\./, '');
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    return parts.slice(-2).join('.');
}

async function updateIcon(tabId, hostname) {
    chrome.action.setIcon({
        tabId: tabId,
        path: { "16": "icon.png", "32": "icon.png", "48": "icon.png", "128": "icon.png" }
    });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
    
    try {
        const url = new URL(tab.url);
        const hostname = url.hostname;
        const rootDomain = getRootDomain(hostname);
        
        await updateIcon(tabId, hostname);
        
        const blacklistResult = await chrome.storage.local.get(['blacklist']);
        const blacklist = blacklistResult.blacklist || [];
        const isBlacklisted = blacklist.some(domain => 
            getRootDomain(domain) === rootDomain || domain === hostname
        );
        
        if (isBlacklisted) return;
        
        const result = await chrome.storage.local.get(['sitePreferences']);
        const prefs = result.sitePreferences || {};
        const sitePrefs = prefs[hostname] || prefs[rootDomain];
        
        if (sitePrefs && sitePrefs.enabled) {
            const shouldApply = shouldApplyDarkMode(sitePrefs);
            if (shouldApply) {
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'enableDarkMode' }).catch(err => {
                        console.log('Content script not ready:', err);
                    });
                }, 100);
            }
        }
        trackSiteVisit(rootDomain);
    } catch (error) {
        console.error('Error in tab update handler:', error);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
        const hostname = new URL(tab.url).hostname;
        await updateIcon(activeInfo.tabId, hostname);
    } catch (error) {
        console.error('Error updating icon on tab activation:', error);
    }
});

function shouldApplyDarkMode(prefs) {
    switch (prefs.mode) {
        case 'always-dark': return true;
        case 'never-dark': return false;
        case 'auto':
        default: return true;
    }
}

async function trackSiteVisit(rootDomain) {
    const result = await chrome.storage.local.get(['siteVisits']);
    const visits = result.siteVisits || {};
    if (!visits[rootDomain]) {
        visits[rootDomain] = { firstVisit: Date.now(), lastVisit: Date.now(), visitCount: 1 };
    } else {
        visits[rootDomain].lastVisit = Date.now();
        visits[rootDomain].visitCount++;
    }
    await chrome.storage.local.set({ siteVisits: visits });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getGlobalSettings') {
        chrome.storage.local.get(['globalSettings'], (result) => {
            sendResponse(result.globalSettings || { showLoader: true, aiAnalysisEnabled: true, autoLearnEnabled: true });
        });
        return true;
    }
    if (request.action === 'getSiteVisits') {
        chrome.storage.local.get(['siteVisits'], (result) => {
            sendResponse(result.siteVisits || {});
        });
        return true;
    }
    if (request.action === 'updateIcon') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
                const hostname = new URL(tabs[0].url).hostname;
                await updateIcon(tabs[0].id, hostname);
            }
        });
        sendResponse({ success: true });
        return true;
    }
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.session.clear();
});