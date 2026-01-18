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

// Save Firebase config
function saveFirebaseConfig(config) {
    localStorage.setItem(
        APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.firebaseConfig,
        JSON.stringify(config)
    );
}

// Get Google Maps API Key
function getGoogleMapsKey() {
    return localStorage.getItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.googleMapsKey) || '';
}

// Save Google Maps API Key
function saveGoogleMapsKey(key) {
    localStorage.setItem(APP_CONFIG.localStoragePrefix + APP_CONFIG.keys.googleMapsKey, key);
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
window.isFirebaseConfigured = isFirebaseConfigured;
