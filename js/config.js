// ===================================
// מערכת ניהול אוטובוסים - קונפיגורציה
// ===================================
// תומך בשלושה Firebase databases נפרדים:
// 1. Users DB - משתמשים ואימות
// 2. Data DB - תלמידים ואוטובוסים
// 3. Settings DB - הגדרות API
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

// ===== FIREBASE USERS DB (משתמשים ואימות) =====

function getFirebaseUsersConfig() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.firebaseUsers) {
        console.log('👥 Using Firebase Users DB from config.local.js');
        return window.LOCAL_CONFIG.firebaseUsers;
    }

    // 2. Try to get from localStorage
    const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + 'firebase_users_config');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return DEFAULT_FIREBASE_CONFIG;
        }
    }

    // 3. Fallback to old unified config for backward compatibility
    return getFirebaseConfigLegacy();
}

// ===== FIREBASE DATA DB (תלמידים ואוטובוסים) =====

function getFirebaseDataConfig() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.firebaseData) {
        console.log('🚌 Using Firebase Data DB from config.local.js');
        return window.LOCAL_CONFIG.firebaseData;
    }

    // 2. Try to get from localStorage
    const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + 'firebase_data_config');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return DEFAULT_FIREBASE_CONFIG;
        }
    }

    // 3. Fallback to old unified config for backward compatibility
    return getFirebaseConfigLegacy();
}

// ===== FIREBASE SETTINGS DB (הגדרות) =====

function getFirebaseSettingsConfig() {
    // 1. Try to get from local config file (config.local.js)
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.firebaseSettings) {
        console.log('⚙️ Using Firebase Settings DB from config.local.js');
        return window.LOCAL_CONFIG.firebaseSettings;
    }

    // 2. Try to get from localStorage
    const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + 'firebase_settings_config');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return DEFAULT_FIREBASE_CONFIG;
        }
    }

    // 3. Fallback to old unified config for backward compatibility
    return getFirebaseConfigLegacy();
}

// ===== LEGACY SUPPORT (תאימות לאחור) =====

function getFirebaseConfigLegacy() {
    // Support old single Firebase config
    if (window.LOCAL_CONFIG && window.LOCAL_CONFIG.firebase) {
        return window.LOCAL_CONFIG.firebase;
    }

    const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.firebaseConfig);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return DEFAULT_FIREBASE_CONFIG;
        }
    }

    return DEFAULT_FIREBASE_CONFIG;
}

// Backward compatibility - returns Users DB by default
function getFirebaseConfig() {
    return getFirebaseUsersConfig();
}

// Save Firebase configs
function saveFirebaseUsersConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + 'firebase_users_config',
        JSON.stringify(config)
    );
}

function saveFirebaseDataConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + 'firebase_data_config',
        JSON.stringify(config)
    );
}

function saveFirebaseSettingsConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + 'firebase_settings_config',
        JSON.stringify(config)
    );
}

// Backward compatibility
function saveFirebaseConfig(config) {
    saveFirebaseUsersConfig(config);
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

function isFirebaseUsersConfigured() {
    const config = getFirebaseUsersConfig();
    return config.apiKey && config.authDomain && config.projectId;
}

function isFirebaseDataConfigured() {
    const config = getFirebaseDataConfig();
    return config.apiKey && config.authDomain && config.projectId;
}

function isFirebaseSettingsConfigured() {
    const config = getFirebaseSettingsConfig();
    return config.apiKey && config.authDomain && config.projectId;
}

// Export for use in other modules
window.APP_CONFIG = APP_CONFIG;

// Firebase configs (3 separate databases)
window.getFirebaseUsersConfig = getFirebaseUsersConfig;
window.getFirebaseDataConfig = getFirebaseDataConfig;
window.getFirebaseSettingsConfig = getFirebaseSettingsConfig;
window.saveFirebaseUsersConfig = saveFirebaseUsersConfig;
window.saveFirebaseDataConfig = saveFirebaseDataConfig;
window.saveFirebaseSettingsConfig = saveFirebaseSettingsConfig;

// Backward compatibility
window.getFirebaseConfig = getFirebaseConfig;
window.saveFirebaseConfig = saveFirebaseConfig;

// Check functions
window.isFirebaseConfigured = isFirebaseConfigured;
window.isFirebaseUsersConfigured = isFirebaseUsersConfigured;
window.isFirebaseDataConfigured = isFirebaseDataConfigured;
window.isFirebaseSettingsConfigured = isFirebaseSettingsConfigured;

// Other APIs
window.getGoogleMapsKey = getGoogleMapsKey;
window.saveGoogleMapsKey = saveGoogleMapsKey;
window.getGoogleSheetsConfig = getGoogleSheetsConfig;
window.saveGoogleSheetsConfig = saveGoogleSheetsConfig;
