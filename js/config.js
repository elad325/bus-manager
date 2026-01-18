// ===================================
// מערכת ניהול אוטובוסים - קונפיגורציה
// ===================================

// Default Firebase Config (will be overwritten by user settings)
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// App Configuration
const APP_CONFIG = {
    appName: 'מערכת ניהול אוטובוסים',
    version: '1.0.0',
    localStoragePrefix: 'bus_manager_',
    
    // Keys for localStorage
    keys: {
        firebaseConfig: 'firebase_config',
        googleMapsKey: 'google_maps_key',
        buses: 'buses',
        students: 'students',
        users: 'users',
        currentUser: 'current_user',
        settings: 'settings'
    }
};

// Get stored Firebase config or default
function getFirebaseConfig() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.firebase) {
        console.log('Using Firebase config from config.local.js');
        return window.LOCAL_CONFIG.firebase;
    }

    // 2. Try to get from localStorage (set via settings page)
    const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.firebaseConfig);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return DEFAULT_FIREBASE_CONFIG;
        }
    }

    // 3. Return default (empty)
    return DEFAULT_FIREBASE_CONFIG;
}

// Save Firebase config
function saveFirebaseConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.firebaseConfig,
        JSON.stringify(config)
    );
}

// Get Google Maps API Key
function getGoogleMapsKey() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.googleMaps && window.LOCAL_CONFIG.googleMaps.apiKey) {
        console.log('Using Google Maps API key from config.local.js');
        return window.LOCAL_CONFIG.googleMaps.apiKey;
    }

    // 2. Try to get from localStorage (set via settings page)
    return localStorage.getItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.googleMapsKey) || '';
}

// Save Google Maps API Key
function saveGoogleMapsKey(key) {
    localStorage.setItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.googleMapsKey, key);
}

// Get Google Sheets config
function getGoogleSheetsConfig() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.googleSheets) {
        console.log('Using Google Sheets config from config.local.js');
        return window.LOCAL_CONFIG.googleSheets;
    }

    // 2. Try to get from localStorage (set via settings page)
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
function saveGoogleSheetsConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + 'google_sheets_config',
        JSON.stringify(config)
    );
}

// Check if Firebase is configured
function isFirebaseConfigured() {
    const config = getFirebaseConfig();
    return config.apiKey && config.authDomain && config.projectId;
}

// Export for use in other modules
window.APP_CONFIG = APP_CONFIG;
window.getFirebaseConfig = getFirebaseConfig;
window.saveFirebaseConfig = saveFirebaseConfig;
window.getGoogleMapsKey = getGoogleMapsKey;
window.saveGoogleMapsKey = saveGoogleMapsKey;
window.getGoogleSheetsConfig = getGoogleSheetsConfig;
window.saveGoogleSheetsConfig = saveGoogleSheetsConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
