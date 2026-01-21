// ===================================
// מערכת ניהול אוטובוסים - קונפיגורציה
// ===================================

// App Configuration
const APP_CONFIG = {
    appName: 'מערכת ניהול אוטובוסים',
    version: '1.0.0',
    localStoragePrefix: 'bus_manager_',

    // Keys for localStorage
    keys: {
        googleMapsKey: 'google_maps_key',
        buses: 'buses',
        students: 'students',
        settings: 'settings'
    }
};

// ===== GOOGLE MAPS API =====

// Get Google Maps API Key
async function getGoogleMapsKey() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.googleMaps && window.LOCAL_CONFIG.googleMaps.apiKey) {
        console.log('Using Google Maps API key from config.local.js');
        return window.LOCAL_CONFIG.googleMaps.apiKey;
    }

    // 2. Try to get from GitHub if configured
    if (window.storage && window.storage.isGitHubConfigured()) {
        try {
            const settings = await window.storage.getSettings();
            if (settings && settings.googleMapsKey) {
                return settings.googleMapsKey;
            }
        } catch (e) {
            console.log('Could not load Maps key from GitHub, using localStorage');
        }
    }

    // 3. Fall back to localStorage
    return localStorage.getItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.googleMapsKey) || '';
}

// Save Google Maps API Key
async function saveGoogleMapsKey(key) {
    localStorage.setItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.googleMapsKey, key);

    // Also save to GitHub if configured
    if (window.storage && window.storage.isGitHubConfigured()) {
        await window.storage.saveSettings({ googleMapsKey: key });
    }
}

// ===== GOOGLE SHEETS API =====

// Get Google Sheets config
async function getGoogleSheetsConfig() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.googleSheets) {
        console.log('Using Google Sheets config from config.local.js');
        return window.LOCAL_CONFIG.googleSheets;
    }

    // 2. Try to get from GitHub if configured
    if (window.storage && window.storage.isGitHubConfigured()) {
        try {
            const settings = await window.storage.getSettings();
            if (settings && settings.googleSheetsConfig) {
                return settings.googleSheetsConfig;
            }
        } catch (e) {
            console.log('Could not load Sheets config from GitHub, using localStorage');
        }
    }

    // 3. Fall back to localStorage
    const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + 'google_sheets_config');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return null;
        }
    }

    return null;
}

// Save Google Sheets config
async function saveGoogleSheetsConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + 'google_sheets_config',
        JSON.stringify(config)
    );

    // Also save to GitHub if configured
    if (window.storage && window.storage.isGitHubConfigured()) {
        await window.storage.saveSettings({ googleSheetsConfig: config });
    }
}

// Export for use in other modules
window.APP_CONFIG = APP_CONFIG;
window.getGoogleMapsKey = getGoogleMapsKey;
window.saveGoogleMapsKey = saveGoogleMapsKey;
window.getGoogleSheetsConfig = getGoogleSheetsConfig;
window.saveGoogleSheetsConfig = saveGoogleSheetsConfig;
