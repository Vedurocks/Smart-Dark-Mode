// Storage utility functions
// This file provides helper functions for managing extension storage

const StorageUtil = {
    /**
     * Get site preferences for a specific hostname
     */
    async getSitePreferences(hostname) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                resolve(prefs[hostname] || { 
                    mode: 'auto', 
                    customRules: [], 
                    removedElements: [],
                    lastVisited: Date.now()
                });
            });
        });
    },

    /**
     * Save site preferences for a specific hostname
     */
    async setSitePreferences(hostname, preferences) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                prefs[hostname] = {
                    ...preferences,
                    lastUpdated: Date.now()
                };
                chrome.storage.local.set({ sitePreferences: prefs }, () => {
                    resolve(true);
                });
            });
        });
    },

    /**
     * Get all site preferences
     */
    async getAllSitePreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                resolve(result.sitePreferences || {});
            });
        });
    },

    /**
     * Delete site preferences for a specific hostname
     */
    async deleteSitePreferences(hostname) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['sitePreferences'], (result) => {
                const prefs = result.sitePreferences || {};
                delete prefs[hostname];
                chrome.storage.local.set({ sitePreferences: prefs }, () => {
                    resolve(true);
                });
            });
        });
    },

    /**
     * Get global settings
     */
    async getGlobalSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['globalSettings'], (result) => {
                resolve(result.globalSettings || {
                    aiAnalysisEnabled: true,
                    autoLearnEnabled: true
                });
            });
        });
    },

    /**
     * Update global settings
     */
    async setGlobalSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ globalSettings: settings }, () => {
                resolve(true);
            });
        });
    },

    /**
     * Clear all data (useful for reset)
     */
    async clearAll() {
        return new Promise((resolve) => {
            chrome.storage.local.clear(() => {
                resolve(true);
            });
        });
    },

    /**
     * Export all preferences (for backup)
     */
    async exportData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (data) => {
                resolve(data);
            });
        });
    },

    /**
     * Import preferences (from backup)
     */
    async importData(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, () => {
                resolve(true);
            });
        });
    }
};

// Make it available globally in content scripts
if (typeof window !== 'undefined') {
    window.StorageUtil = StorageUtil;
}