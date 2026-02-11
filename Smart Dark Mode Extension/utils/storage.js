// Storage utility functions
const StorageUtil = {
    async getSitePreferences(hostname) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                resolve(prefs[hostname] || { 
                    mode: 'auto', customRules: [], removedElements: [], lastVisited: Date.now()
                });
            });
        });
    },
    
    async setSitePreferences(hostname, preferences) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                prefs[hostname] = { ...preferences, lastUpdated: Date.now() };
                chrome.storage.local.set({ sitePreferences: prefs }, () => { resolve(true); });
            });
        });
    },
    
    async getAllSitePreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                resolve(result.sitePreferences || {});
            });
        });
    },
    
    async deleteSitePreferences(hostname) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                delete prefs[hostname];
                chrome.storage.local.set({ sitePreferences: prefs }, () => { resolve(true); });
            });
        });
    },
    
    async getGlobalSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['globalSettings'], (result) => {
                resolve(result.globalSettings || { aiAnalysisEnabled: true, autoLearnEnabled: true });
            });
        });
    },
    
    async setGlobalSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ globalSettings: settings }, () => { resolve(true); });
        });
    },
    
    async clearAll() {
        return new Promise((resolve) => {
            chrome.storage.local.clear(() => { resolve(true); });
        });
    },
    
    async exportData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (data) => { resolve(data); });
        });
    },
    
    async importData(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, () => { resolve(true); });
        });
    }
};

if (typeof window !== 'undefined') {
    window.StorageUtil = StorageUtil;
}