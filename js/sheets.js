// ===================================
// מערכת ניהול אוטובוסים - Google Sheets Storage
// ===================================

class GoogleSheetsStorage {
    constructor() {
        this.CLIENT_ID = '';
        this.API_KEY = '';
        this.SPREADSHEET_ID = '';
        this.DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4'];
        this.SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

        this.isInitialized = false;
        this.isSignedIn = false;
        this.tokenClient = null;
    }

    // Get stored config
    getConfig() {
        const stored = localStorage.getItem(APP_CONFIG.localStoragePrefix + 'google_sheets_config');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return {};
            }
        }
        return {};
    }

    // Save config
    saveConfig(config) {
        localStorage.setItem(
            APP_CONFIG.localStoragePrefix + 'google_sheets_config',
            JSON.stringify(config)
        );

        this.CLIENT_ID = config.clientId || '';
        this.API_KEY = config.apiKey || '';
        this.SPREADSHEET_ID = config.spreadsheetId || '';
    }

    // Initialize Google API
    async init() {
        const config = this.getConfig();
        this.CLIENT_ID = config.clientId || '';
        this.API_KEY = config.apiKey || '';
        this.SPREADSHEET_ID = config.spreadsheetId || '';

        if (!this.CLIENT_ID || !this.API_KEY) {
            console.log('Google Sheets not configured');
            return false;
        }

        return new Promise((resolve) => {
            // Load Google API script
            if (!document.getElementById('google-api-script')) {
                const script = document.createElement('script');
                script.id = 'google-api-script';
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = () => this.loadGapiClient(resolve);
                script.onerror = () => resolve(false);
                document.head.appendChild(script);
            } else {
                this.loadGapiClient(resolve);
            }
        });
    }

    loadGapiClient(resolve) {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: this.API_KEY,
                    discoveryDocs: this.DISCOVERY_DOCS
                });

                // Load Google Identity Services
                if (!document.getElementById('gis-script')) {
                    const script = document.createElement('script');
                    script.id = 'gis-script';
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.onload = () => this.initTokenClient(resolve);
                    script.onerror = () => resolve(false);
                    document.head.appendChild(script);
                } else {
                    this.initTokenClient(resolve);
                }
            } catch (error) {
                console.error('Error initializing gapi client:', error);
                resolve(false);
            }
        });
    }

    initTokenClient(resolve) {
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('Token error:', response.error);
                        return;
                    }
                    this.isSignedIn = true;
                    this.onSignInChange(true);
                }
            });

            this.isInitialized = true;
            resolve(true);
        } catch (error) {
            console.error('Error initializing token client:', error);
            resolve(false);
        }
    }

    // Sign in callback
    onSignInChange(isSignedIn) {
        this.isSignedIn = isSignedIn;

        // Update UI
        const statusDot = document.querySelector('#sheets-status .status-dot');
        const statusText = document.querySelector('#sheets-status .status-text');

        if (statusDot && statusText) {
            if (isSignedIn) {
                statusDot.classList.add('connected');
                statusText.textContent = 'מחובר ל-Google Sheets';
            } else {
                statusDot.classList.remove('connected');
                statusText.textContent = 'לא מחובר';
            }
        }
    }

    // Request sign in
    async signIn() {
        // Auto-init if not initialized
        if (!this.isInitialized) {
            const config = this.getConfig();
            if (!config.clientId || !config.apiKey || !config.spreadsheetId) {
                window.app.showToast('יש למלא ולשמור את כל הפרטים בהגדרות תחילה', 'warning');
                return;
            }

            window.app.showToast('מאתחל חיבור ל-Google...', 'info');
            const success = await this.init();
            if (!success) {
                window.app.showToast('שגיאה באתחול - בדוק את הפרטים', 'error');
                return;
            }
        }

        if (!this.tokenClient) {
            window.app.showToast('שגיאה בטעינת Google API', 'error');
            return;
        }

        // Request access token
        try {
            if (typeof gapi === 'undefined' || gapi.client.getToken() === null) {
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                this.tokenClient.requestAccessToken({ prompt: '' });
            }
        } catch (error) {
            console.error('Sign in error:', error);
            window.app.showToast('שגיאה בהתחברות - נסה שוב', 'error');
        }
    }

    // Sign out
    signOut() {
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
        }
        this.isSignedIn = false;
        this.onSignInChange(false);
    }

    // Check if configured and signed in
    isReady() {
        return this.isInitialized && this.isSignedIn && this.SPREADSHEET_ID;
    }

    // Ensure sheet exists (create if not)
    async ensureSheet(sheetName) {
        if (!this.isReady()) return false;

        try {
            // Check if sheet exists
            const response = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.SPREADSHEET_ID
            });

            const sheets = response.result.sheets || [];
            const sheetExists = sheets.some(s => s.properties.title === sheetName);

            if (!sheetExists) {
                // Create sheet
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: { title: sheetName }
                            }
                        }]
                    }
                });

                // Add headers based on sheet type
                const headers = this.getHeadersForSheet(sheetName);
                if (headers.length > 0) {
                    await this.writeRow(sheetName, 1, headers);
                }
            }

            return true;
        } catch (error) {
            console.error('Error ensuring sheet:', error);
            return false;
        }
    }

    getHeadersForSheet(sheetName) {
        const headers = {
            'buses': ['id', 'name', 'startLocation', 'endLocation', 'notes', 'createdAt'],
            'students': ['id', 'firstName', 'lastName', 'address', 'busId', 'createdAt'],
            'users': ['uid', 'email', 'role', 'createdAt']
        };
        return headers[sheetName] || [];
    }

    // Read all data from sheet
    async readSheet(sheetName) {
        if (!this.isReady()) {
            console.log('Google Sheets not ready, falling back to local');
            return null;
        }

        try {
            await this.ensureSheet(sheetName);

            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${sheetName}!A:Z`
            });

            const values = response.result.values || [];
            if (values.length <= 1) return []; // Only headers or empty

            const headers = values[0];
            const data = values.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                return obj;
            });

            return data;
        } catch (error) {
            console.error('Error reading sheet:', error);
            return null;
        }
    }

    // Write row to sheet
    async writeRow(sheetName, rowIndex, values) {
        if (!this.isReady()) return false;

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${sheetName}!A${rowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [values]
                }
            });
            return true;
        } catch (error) {
            console.error('Error writing row:', error);
            return false;
        }
    }

    // Append row to sheet
    async appendRow(sheetName, data) {
        if (!this.isReady()) return false;

        try {
            await this.ensureSheet(sheetName);

            const headers = this.getHeadersForSheet(sheetName);
            const values = headers.map(h => data[h] || '');

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${sheetName}!A:Z`,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [values]
                }
            });
            return true;
        } catch (error) {
            console.error('Error appending row:', error);
            return false;
        }
    }

    // Update row in sheet
    async updateRow(sheetName, id, data) {
        if (!this.isReady()) return false;

        try {
            // Read all data to find row index
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${sheetName}!A:A`
            });

            const values = response.result.values || [];
            let rowIndex = -1;

            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === id) {
                    rowIndex = i + 1; // +1 because sheets are 1-indexed
                    break;
                }
            }

            if (rowIndex === -1) {
                // Not found, append instead
                return this.appendRow(sheetName, data);
            }

            const headers = this.getHeadersForSheet(sheetName);
            const rowValues = headers.map(h => data[h] || '');

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${sheetName}!A${rowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [rowValues]
                }
            });

            return true;
        } catch (error) {
            console.error('Error updating row:', error);
            return false;
        }
    }

    // Delete row from sheet
    async deleteRow(sheetName, id) {
        if (!this.isReady()) return false;

        try {
            // Get sheet ID
            const spreadsheet = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.SPREADSHEET_ID
            });

            const sheet = spreadsheet.result.sheets.find(s => s.properties.title === sheetName);
            if (!sheet) return false;

            const sheetId = sheet.properties.sheetId;

            // Find row index
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${sheetName}!A:A`
            });

            const values = response.result.values || [];
            let rowIndex = -1;

            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === id) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) return false;

            // Delete row
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                }
            });

            return true;
        } catch (error) {
            console.error('Error deleting row:', error);
            return false;
        }
    }

    // ===== BUSES =====
    async getBuses() {
        const data = await this.readSheet('buses');
        if (data === null) {
            return window.storage.getLocalBuses();
        }
        return data;
    }

    async saveBus(bus) {
        if (!bus.id) {
            bus.id = 'bus_' + Date.now();
            bus.createdAt = new Date().toISOString();
        }

        if (this.isReady()) {
            await this.updateRow('buses', bus.id, bus);
        }

        // Always save locally as backup
        window.storage.saveLocalBus(bus);
        return bus;
    }

    async deleteBus(busId) {
        if (this.isReady()) {
            await this.deleteRow('buses', busId);
        }
        window.storage.deleteLocalBus(busId);
        return true;
    }

    // ===== STUDENTS =====
    async getStudents() {
        const data = await this.readSheet('students');
        if (data === null) {
            return window.storage.getLocalStudents();
        }
        return data;
    }

    async saveStudent(student) {
        if (!student.id) {
            student.id = 'student_' + Date.now();
            student.createdAt = new Date().toISOString();
        }

        if (this.isReady()) {
            await this.updateRow('students', student.id, student);
        }

        window.storage.saveLocalStudent(student);
        return student;
    }

    async deleteStudent(studentId) {
        if (this.isReady()) {
            await this.deleteRow('students', studentId);
        }
        window.storage.deleteLocalStudent(studentId);
        return true;
    }

    // ===== USERS =====
    async getUsers() {
        const data = await this.readSheet('users');
        if (data === null) {
            return window.storage.getLocalUsers();
        }
        return data;
    }

    async saveUser(user) {
        if (this.isReady()) {
            await this.updateRow('users', user.uid, user);
        }
        window.storage.saveLocalUser(user);
        return user;
    }

    // Sync local data to sheets
    async syncToSheets() {
        if (!this.isReady()) {
            window.app.showToast('יש להתחבר ל-Google Sheets תחילה', 'warning');
            return false;
        }

        try {
            window.app.showToast('מסנכרן נתונים...', 'info');

            // Sync buses
            const buses = window.storage.getLocalBuses();
            for (const bus of buses) {
                await this.updateRow('buses', bus.id, bus);
            }

            // Sync students
            const students = window.storage.getLocalStudents();
            for (const student of students) {
                await this.updateRow('students', student.id, student);
            }

            // Sync users
            const users = window.storage.getLocalUsers();
            for (const user of users) {
                await this.updateRow('users', user.uid, user);
            }

            window.app.showToast('הסנכרון הושלם בהצלחה!', 'success');
            return true;
        } catch (error) {
            console.error('Sync error:', error);
            window.app.showToast('שגיאה בסנכרון', 'error');
            return false;
        }
    }

    // Import from sheets to local
    async syncFromSheets() {
        if (!this.isReady()) {
            window.app.showToast('יש להתחבר ל-Google Sheets תחילה', 'warning');
            return false;
        }

        try {
            window.app.showToast('מייבא נתונים...', 'info');

            // Import buses
            const buses = await this.readSheet('buses');
            if (buses) {
                buses.forEach(bus => window.storage.saveLocalBus(bus));
            }

            // Import students
            const students = await this.readSheet('students');
            if (students) {
                students.forEach(student => window.storage.saveLocalStudent(student));
            }

            window.app.showToast('הייבוא הושלם בהצלחה!', 'success');

            // Reload data
            await window.busManager.loadBuses();
            await window.studentManager.loadStudents();
            window.app.updateDashboardStats();

            return true;
        } catch (error) {
            console.error('Import error:', error);
            window.app.showToast('שגיאה בייבוא', 'error');
            return false;
        }
    }
}

// Create global instance
window.sheetsStorage = new GoogleSheetsStorage();
