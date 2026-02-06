// Background service worker - handles extension lifecycle

// Install event
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Smart Dark Mode installed!');
        
        // Initialize default settings
        chrome.storage.local.set({
            sitePreferences: {},
            globalSettings: {
                aiAnalysisEnabled: true,
                autoLearnEnabled: true
            }
        });
        
        // Optional: Open welcome page or instructions
        // chrome.tabs.create({ url: 'welcome.html' });
    } else if (details.reason === 'update') {
        console.log('Smart Dark Mode updated!');
    }
});

// Listen for tab updates to apply dark mode automatically
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only proceed when page is fully loaded
    if (changeInfo.status !== 'complete') return;
    
    // Skip chrome:// and extension pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
    }
    
    try {
        const hostname = new URL(tab.url).hostname;
        
        // Load preferences for this site
        const result = await chrome.storage.local.get(['sitePreferences']);
        const prefs = result.sitePreferences || {};
        const sitePrefs = prefs[hostname] || { mode: 'auto' };
        
        // Auto-apply based on preferences
        const shouldApply = shouldApplyDarkMode(sitePrefs);
        
        if (shouldApply) {
            // Send message to content script to enable dark mode
            chrome.tabs.sendMessage(tabId, {
                action: 'enableDarkMode'
            }).catch(err => {
                // Content script might not be ready yet, that's okay
                console.log('Content script not ready:', err);
            });
        }
    } catch (error) {
        console.error('Error in tab update handler:', error);
    }
});

// Helper function to determine if dark mode should be applied
function shouldApplyDarkMode(prefs) {
    switch (prefs.mode) {
        case 'always-dark':
            return true;
        case 'never-dark':
            return false;
        case 'auto':
        default:
            // For auto mode, we could check time of day or system preference
            // For now, let content script handle it
            return false; // Content script will check system preference
    }
}

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getGlobalSettings') {
        chrome.storage.local.get(['globalSettings'], (result) => {
            sendResponse(result.globalSettings || {});
        });
        return true;
    }
});

// Optional: Listen for keyboard shortcuts (if you add them to manifest)
chrome.commands?.onCommand.addListener((command) => {
    if (command === 'toggle-dark-mode') {
        // Toggle dark mode for current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleDarkMode'
                });
            }
        });
    }
});