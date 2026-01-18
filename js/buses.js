// ===================================
// מערכת ניהול אוטובוסים - ניהול אוטובוסים
// ===================================

class BusManager {
    constructor() {
        this.buses = [];
        this.editingBusId = null;
    }

    // Initialize
    async init() {
        await this.loadBuses();
        this.setupEventListeners();
    }

    // Load buses from storage
    async loadBuses() {
        this.buses = await window.storage.getBuses();
        this.renderBusesList();
        this.updateBusSelects();
    }

    // Setup event listeners
    setupEventListeners() {
        // Add bus button
        const addBusBtn = document.getElementById('add-bus-btn');
        if (addBusBtn) {
            addBusBtn.addEventListener('click', () => this.openBusModal());
        }

        // Bus form submit
        const busForm = document.getElementById('bus-form');
        if (busForm) {
            busForm.addEventListener('submit', (e) => this.handleBusSubmit(e));
        }

        // Bus search
        const busSearch = document.getElementById('bus-search');
        if (busSearch) {
            busSearch.addEventListener('input', (e) => this.filterBuses(e.target.value));
        }

        // Modal close buttons
        document.querySelectorAll('[data-close="bus-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeBusModal());
        });
    }

    // Render buses list
    renderBusesList() {
        const container = document.getElementById('buses-list');
        if (!container) return;

        if (this.buses.length === 0) {
            container.innerHTML = `
                <div class="empty-state glass-card" style="grid-column: 1/-1; padding: 3rem;">
                    <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🚌</span>
                    <p>אין אוטובוסים במערכת</p>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">לחץ על "הוסף אוטובוס" כדי להתחיל</p>
                </div>
            `;
            return;
        }

        // Performance optimization: get students once and create count map
        const students = window.storage.getLocalStudents();
        const studentCountByBus = {};
        students.forEach(student => {
            if (student.busId) {
                studentCountByBus[student.busId] = (studentCountByBus[student.busId] || 0) + 1;
            }
        });

        container.innerHTML = this.buses.map(bus => this.renderBusCard(bus, studentCountByBus[bus.id] || 0)).join('');

        // Add event listeners to cards
        this.buses.forEach(bus => {
            const editBtn = document.getElementById(`edit-bus-${bus.id}`);
            const deleteBtn = document.getElementById(`delete-bus-${bus.id}`);
            const viewBtn = document.getElementById(`view-bus-${bus.id}`);

            if (editBtn) editBtn.addEventListener('click', () => this.editBus(bus.id));
            if (deleteBtn) deleteBtn.addEventListener('click', () => this.confirmDeleteBus(bus.id));
            if (viewBtn) viewBtn.addEventListener('click', () => this.viewBusRoute(bus.id));
        });
    }

    // Render single bus card
    renderBusCard(bus, studentCount = 0) {
        const isAdmin = window.auth.checkIsAdmin();

        return `
            <div class="bus-card glass-card" data-bus-id="${bus.id}">
                <div class="bus-card-header">
                    <span class="bus-card-icon">🚌</span>
                    <span class="bus-card-title">${this.escapeHtml(bus.name)}</span>
                </div>
                <div class="bus-card-info">
                    <div class="bus-info-item">
                        <span>📍</span>
                        <span>התחלה: ${this.escapeHtml(bus.startLocation || 'לא הוגדר')}</span>
                    </div>
                    <div class="bus-info-item">
                        <span>🏁</span>
                        <span>סיום: ${this.escapeHtml(bus.endLocation || 'לא הוגדר')}</span>
                    </div>
                    <div class="bus-info-item">
                        <span>👨‍🎓</span>
                        <span>${studentCount} תלמידים</span>
                    </div>
                    ${bus.notes ? `
                    <div class="bus-info-item">
                        <span>📝</span>
                        <span>${this.escapeHtml(bus.notes)}</span>
                    </div>
                    ` : ''}
                </div>
                <div class="bus-card-actions">
                    <button id="view-bus-${bus.id}" class="btn btn-secondary">
                        <span>🗺️</span> מסלול
                    </button>
                    ${isAdmin ? `
                    <button id="edit-bus-${bus.id}" class="btn btn-secondary">
                        <span>✏️</span> עריכה
                    </button>
                    <button id="delete-bus-${bus.id}" class="btn btn-danger">
                        <span>🗑️</span>
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Update bus selects in other pages
    updateBusSelects() {
        const selects = [
            'student-bus',
            'bus-filter',
            'route-bus-select'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const currentValue = select.value;

            // Keep first option (placeholder)
            const firstOption = select.querySelector('option:first-child');
            select.innerHTML = '';
            if (firstOption) select.appendChild(firstOption);

            // Add buses
            this.buses.forEach(bus => {
                const option = document.createElement('option');
                option.value = bus.id;
                option.textContent = bus.name;
                select.appendChild(option);
            });

            // Restore value if possible
            if (currentValue && this.buses.some(b => b.id === currentValue)) {
                select.value = currentValue;
            }
        });
    }

    // Open bus modal
    openBusModal(bus = null) {
        const modal = document.getElementById('bus-modal');
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('bus-modal-title');
        const form = document.getElementById('bus-form');

        if (!modal || !overlay) return;

        // Reset form
        form.reset();

        if (bus) {
            // Edit mode
            title.textContent = 'ערוך אוטובוס';
            document.getElementById('bus-id').value = bus.id;
            document.getElementById('bus-name').value = bus.name;
            document.getElementById('bus-start').value = bus.startLocation || '';
            document.getElementById('bus-end').value = bus.endLocation || '';
            document.getElementById('bus-notes').value = bus.notes || '';
            this.editingBusId = bus.id;
        } else {
            // Add mode
            title.textContent = 'הוסף אוטובוס';
            this.editingBusId = null;
        }

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

    // Close bus modal
    closeBusModal() {
        const modal = document.getElementById('bus-modal');
        const overlay = document.getElementById('modal-overlay');

        if (modal) modal.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');

        this.editingBusId = null;
    }

    // Handle bus form submit
    async handleBusSubmit(e) {
        e.preventDefault();

        const bus = {
            name: document.getElementById('bus-name').value.trim(),
            startLocation: document.getElementById('bus-start').value.trim(),
            endLocation: document.getElementById('bus-end').value.trim(),
            notes: document.getElementById('bus-notes').value.trim()
        };

        if (this.editingBusId) {
            bus.id = this.editingBusId;
        }

        try {
            await window.storage.saveBus(bus);
            await this.loadBuses();
            this.closeBusModal();
            window.app.showToast('האוטובוס נשמר בהצלחה', 'success');
            window.app.updateDashboardStats();
        } catch (error) {
            console.error('Error saving bus:', error);
            window.app.showToast('שגיאה בשמירת האוטובוס', 'error');
        }
    }

    // Edit bus
    editBus(busId) {
        const bus = this.buses.find(b => b.id === busId);
        if (bus) {
            this.openBusModal(bus);
        }
    }

    // Confirm delete bus
    confirmDeleteBus(busId) {
        const bus = this.buses.find(b => b.id === busId);
        if (!bus) return;

        window.app.showConfirmModal(
            `האם אתה בטוח שברצונך למחוק את "${bus.name}"?`,
            async () => {
                await this.deleteBus(busId);
            }
        );
    }

    // Delete bus
    async deleteBus(busId) {
        try {
            await window.storage.deleteBus(busId);
            await this.loadBuses();
            window.app.showToast('האוטובוס נמחק בהצלחה', 'success');
            window.app.updateDashboardStats();
        } catch (error) {
            console.error('Error deleting bus:', error);
            window.app.showToast('שגיאה במחיקת האוטובוס', 'error');
        }
    }

    // View bus route
    viewBusRoute(busId) {
        // Navigate to routes page and select this bus
        window.app.navigateTo('routes');

        const select = document.getElementById('route-bus-select');
        if (select) {
            select.value = busId;
        }
    }

    // Filter buses by search
    filterBuses(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const cards = document.querySelectorAll('.bus-card');

        cards.forEach(card => {
            const busId = card.dataset.busId;
            const bus = this.buses.find(b => b.id === busId);

            if (!bus) {
                card.style.display = 'none';
                return;
            }

            const matches =
                bus.name.toLowerCase().includes(normalizedQuery) ||
                (bus.startLocation && bus.startLocation.toLowerCase().includes(normalizedQuery)) ||
                (bus.endLocation && bus.endLocation.toLowerCase().includes(normalizedQuery));

            card.style.display = matches ? '' : 'none';
        });
    }

    // Get bus by ID
    getBus(busId) {
        return this.buses.find(b => b.id === busId);
    }

    // Get all buses
    getAllBuses() {
        return this.buses;
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
window.busManager = new BusManager();
