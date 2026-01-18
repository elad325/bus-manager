// ===================================
// מערכת ניהול אוטובוסים - ניהול מסלולים
// ===================================

class RouteManager {
    constructor() {
        this.currentRoute = null;
        this.selectedBusId = null;
    }

    // Initialize
    async init() {
        this.setupEventListeners();
    }

    // Setup event listeners
    setupEventListeners() {
        // Calculate route button
        const calculateBtn = document.getElementById('calculate-route-btn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.calculateRoute());
        }

        // Bus select change
        const busSelect = document.getElementById('route-bus-select');
        if (busSelect) {
            busSelect.addEventListener('change', (e) => {
                this.selectedBusId = e.target.value;
                this.clearRoute();
            });
        }

        // Print button
        const printBtn = document.getElementById('print-route-btn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printRoute());
        }

        // Waze button
        const wazeBtn = document.getElementById('waze-route-btn');
        if (wazeBtn) {
            wazeBtn.addEventListener('click', () => this.openWaze());
        }

        // Google Maps button
        const gmapsBtn = document.getElementById('gmaps-route-btn');
        if (gmapsBtn) {
            gmapsBtn.addEventListener('click', () => this.openGoogleMaps());
        }
    }

    // Calculate route for selected bus
    async calculateRoute() {
        const busId = this.selectedBusId || document.getElementById('route-bus-select')?.value;

        if (!busId) {
            window.app.showToast('אנא בחר אוטובוס', 'warning');
            return;
        }

        // Check if Google Maps is configured
        if (!window.mapsService.isReady()) {
            const apiKey = getGoogleMapsKey();
            if (!apiKey) {
                window.app.showToast('יש להגדיר Google Maps API Key בהגדרות', 'error');
                return;
            }

            // Try to initialize maps
            await window.mapsService.init();

            if (!window.mapsService.isReady()) {
                window.app.showToast('שגיאה בטעינת Google Maps', 'error');
                return;
            }
        }

        // Get bus data
        const bus = window.busManager.getBus(busId);
        if (!bus) {
            window.app.showToast('האוטובוס לא נמצא', 'error');
            return;
        }

        if (!bus.startLocation || !bus.endLocation) {
            window.app.showToast('יש להגדיר נקודות התחלה וסיום לאוטובוס', 'warning');
            return;
        }

        // Get students for this bus
        const students = window.studentManager.getStudentsByBus(busId);

        if (students.length === 0) {
            window.app.showToast('אין תלמידים משויכים לאוטובוס זה', 'warning');
            return;
        }

        // Show loading
        const routeInfo = document.getElementById('route-info');
        routeInfo.innerHTML = '<p class="empty-state">מחשב מסלול...</p>';

        // Prepare waypoints from students
        const waypoints = students.map(student => ({
            name: `${student.firstName} ${student.lastName}`,
            address: student.address
        }));

        try {
            // Create map if not exists
            const mapContainer = document.getElementById('route-map');
            if (mapContainer.querySelector('.map-message')) {
                mapContainer.innerHTML = '<div id="map"></div>';
                window.mapsService.createMap('map');
            }

            // Calculate optimized route
            const result = await window.mapsService.calculateRoute(
                bus.startLocation,
                bus.endLocation,
                waypoints
            );

            this.currentRoute = result;
            this.renderRouteDetails(bus, result);

            // Show route actions
            document.getElementById('route-actions').classList.remove('hidden');

            window.app.showToast('המסלול חושב בהצלחה', 'success');

        } catch (error) {
            console.error('Error calculating route:', error);
            window.app.showToast(error.message || 'שגיאה בחישוב המסלול', 'error');
            routeInfo.innerHTML = `<p class="empty-state" style="color: var(--danger);">${this.escapeHtml(error.message || 'שגיאה בחישוב המסלול')}</p>`;
        }
    }

    // Render route details
    renderRouteDetails(bus, routeData) {
        // Render info
        const routeInfo = document.getElementById('route-info');
        routeInfo.innerHTML = `
            <div class="route-info-item">
                <span class="label">אוטובוס:</span>
                <span class="value">${this.escapeHtml(bus.name)}</span>
            </div>
            <div class="route-info-item">
                <span class="label">מרחק כולל:</span>
                <span class="value">${routeData.summary.totalDistance}</span>
            </div>
            <div class="route-info-item">
                <span class="label">זמן נסיעה:</span>
                <span class="value">${routeData.summary.totalDuration}</span>
            </div>
            <div class="route-info-item">
                <span class="label">תחנות:</span>
                <span class="value">${routeData.summary.stopsCount}</span>
            </div>
        `;

        // Render stops
        const routeStops = document.getElementById('route-stops');
        routeStops.innerHTML = routeData.stops.map(stop => `
            <div class="route-stop">
                <div class="stop-number">${stop.order + 1}</div>
                <div class="stop-info">
                    <div class="stop-name">${this.escapeHtml(stop.name)}</div>
                    <div class="stop-address">${this.escapeHtml(stop.address)}</div>
                    <div class="stop-time">
                        ${stop.estimatedArrival ? `🕐 הגעה משוערת: ${stop.estimatedArrival}` : ''}
                        ${stop.duration ? ` | ⏱️ ${stop.duration}` : ''}
                        ${stop.distance ? ` | 📏 ${stop.distance}` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Clear route
    clearRoute() {
        this.currentRoute = null;

        const routeInfo = document.getElementById('route-info');
        if (routeInfo) {
            routeInfo.innerHTML = '<p class="empty-state">בחר אוטובוס לצפייה במסלול</p>';
        }

        const routeStops = document.getElementById('route-stops');
        if (routeStops) {
            routeStops.innerHTML = '';
        }

        const routeActions = document.getElementById('route-actions');
        if (routeActions) {
            routeActions.classList.add('hidden');
        }

        const mapContainer = document.getElementById('route-map');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="map-message">
                    <span>🗺️</span>
                    <p>בחר אוטובוס וחשב מסלול להצגת המפה</p>
                </div>
            `;
        }
    }

    // Print route
    printRoute() {
        if (!this.currentRoute) {
            window.app.showToast('אין מסלול להדפסה', 'warning');
            return;
        }

        const bus = window.busManager.getBus(this.selectedBusId);
        if (!bus) return;

        // Populate print template
        const printBusInfo = document.getElementById('print-bus-info');
        const printDate = document.getElementById('print-date');
        const printRouteDetails = document.getElementById('print-route-details');
        const printStopsList = document.getElementById('print-stops-list');

        printBusInfo.innerHTML = `<h2>${this.escapeHtml(bus.name)}</h2>`;
        printDate.innerHTML = `<p>תאריך: ${new Date().toLocaleDateString('he-IL')}</p>`;

        printRouteDetails.innerHTML = `
            <p><strong>מרחק כולל:</strong> ${this.currentRoute.summary.totalDistance}</p>
            <p><strong>זמן נסיעה:</strong> ${this.currentRoute.summary.totalDuration}</p>
            <p><strong>מספר תחנות:</strong> ${this.currentRoute.summary.stopsCount}</p>
        `;

        printStopsList.innerHTML = `
            <h3>רשימת תחנות:</h3>
            ${this.currentRoute.stops.map(stop => `
                <div class="print-stop">
                    <strong>${stop.order + 1}. ${this.escapeHtml(stop.name)}</strong>
                    <p>${this.escapeHtml(stop.address)}</p>
                    <p>הגעה משוערת: ${stop.estimatedArrival || 'לא ידוע'}</p>
                </div>
            `).join('')}
        `;

        window.print();
    }

    // Open Waze
    openWaze() {
        if (!this.currentRoute) {
            window.app.showToast('אין מסלול', 'warning');
            return;
        }

        const link = window.mapsService.generateWazeLink(this.currentRoute.stops);
        if (link) {
            window.open(link, '_blank');
        } else {
            window.app.showToast('לא ניתן ליצור קישור', 'error');
        }
    }

    // Open Google Maps
    openGoogleMaps() {
        if (!this.currentRoute) {
            window.app.showToast('אין מסלול', 'warning');
            return;
        }

        const link = window.mapsService.generateGoogleMapsLink(this.currentRoute.stops);
        if (link) {
            window.open(link, '_blank');
        } else {
            window.app.showToast('לא ניתן ליצור קישור', 'error');
        }
    }

    // Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
window.routeManager = new RouteManager();
