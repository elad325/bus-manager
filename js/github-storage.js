// ===================================
// GitHub Storage - כתיבה ישירות ל-Git
// ===================================
// כל שינוי = commit אוטומטי ב-GitHub!
// ===================================

class GitHubStorage {
    constructor() {
        this.token = null;
        this.owner = null;  // Username/org
        this.repo = null;   // Repository name
        this.branch = 'main'; // או 'master'
        this.apiUrl = 'https://api.github.com';

        // Cache for file SHAs (needed for updates)
        this.fileCache = {};

        this.loadConfig();
    }

    // Load GitHub config from localStorage
    loadConfig() {
        const config = localStorage.getItem('github_config');
        if (config) {
            try {
                const parsed = JSON.parse(config);
                this.token = parsed.token;
                this.owner = parsed.owner;
                this.repo = parsed.repo;
                this.branch = parsed.branch || 'main';
                console.log(`📂 GitHub: ${this.owner}/${this.repo}@${this.branch}`);
            } catch (e) {
                console.error('Error loading GitHub config:', e);
            }
        }
    }

    // Save GitHub config to localStorage
    saveConfig(owner, repo, token, branch = 'main') {
        const config = { owner, repo, token, branch };
        localStorage.setItem('github_config', JSON.stringify(config));
        this.owner = owner;
        this.repo = repo;
        this.token = token;
        this.branch = branch;
    }

    // Check if GitHub is configured
    isConfigured() {
        return !!(this.token && this.owner && this.repo);
    }

    // Auto-detect owner/repo from current URL (GitHub Pages)
    static autoDetectRepo() {
        const url = window.location.href;

        // Pattern: https://username.github.io/repo-name/
        const githubPagesPattern = /https?:\/\/([^.]+)\.github\.io\/([^\/]+)/;
        const match = url.match(githubPagesPattern);

        if (match) {
            return {
                owner: match[1],
                repo: match[2],
                detected: true
            };
        }

        // If not GitHub Pages, return null
        return {
            owner: null,
            repo: null,
            detected: false
        };
    }

    // Get file from GitHub
    async getFile(path) {
        if (!this.isConfigured()) {
            throw new Error('GitHub not configured');
        }

        try {
            const url = `${this.apiUrl}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // File doesn't exist yet
                    return null;
                }
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();

            // Cache the SHA for later updates
            this.fileCache[path] = data.sha;

            // Decode content from base64 (with proper UTF-8 support for Hebrew)
            const content = decodeURIComponent(escape(atob(data.content)));
            return JSON.parse(content);

        } catch (error) {
            console.error(`Error getting file ${path}:`, error);
            throw error;
        }
    }

    // Save file to GitHub (creates a commit!)
    async saveFile(path, content, message) {
        if (!this.isConfigured()) {
            throw new Error('GitHub not configured');
        }

        try {
            const url = `${this.apiUrl}/repos/${this.owner}/${this.repo}/contents/${path}`;

            // Convert content to JSON and encode to base64
            const jsonContent = JSON.stringify(content, null, 2);
            const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));

            const body = {
                message: message || `Update ${path}`,
                content: base64Content,
                branch: this.branch
            };

            // If file exists, include its SHA
            if (this.fileCache[path]) {
                body.sha = this.fileCache[path];
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`GitHub API error: ${error.message}`);
            }

            const data = await response.json();

            // Update cached SHA
            this.fileCache[path] = data.content.sha;

            console.log(`✅ Committed to GitHub: ${path}`);
            return data;

        } catch (error) {
            console.error(`Error saving file ${path}:`, error);
            throw error;
        }
    }

    // Get repository info
    async getRepoInfo() {
        if (!this.isConfigured()) {
            throw new Error('GitHub not configured');
        }

        try {
            const url = `${this.apiUrl}/repos/${this.owner}/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting repo info:', error);
            throw error;
        }
    }

    // Test GitHub connection
    async testConnection() {
        try {
            const info = await this.getRepoInfo();
            console.log(`✅ Connected to GitHub: ${info.full_name}`);
            return { success: true, repo: info };
        } catch (error) {
            console.error('❌ GitHub connection failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.githubStorage = new GitHubStorage();
