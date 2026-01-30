// ===================================
// מערכת ניהול אוטובוסים - Smart Route Manager
// ===================================
// גרסה משופרת עם: State Management, Drag & Drop, Caching, Map Interaction

class SmartRouteManager {
    constructor() {
        // State מרוכז - האמת היחידה של האפליקציה
        this.state = {
            selectedBusId: null,
            routeData: null,
            isLoading: false,
            waypoints: [], // רשימה דינמית שניתנת לשינוי (Drag & Drop)
            cache: new Map(), // שמירת מסלולים שחושבו כדי לחסוך קריאות API
            highlightedStopIndex: null
        };

        this.sortable = null; // עבור Drag & Drop
        this.mapMarkers = []; // שמירת רפרנס למרקרים לאינטראקציה
        this.debounceTimer = null; // למניעת חישובים כפולים
    }

    // Initialize
    async init() {
        this.cacheDOM();
        this.bindEvents();
        console.log('Smart Route Manager Initialized');
    }

    // שמירת אלמנטים בזיכרון לביצועים
    cacheDOM() {
        this.dom = {
            select: document.getElementById('route-bus-select'),
            calculateBtn: document.getElementById('calculate-route-btn'),
            infoContainer: document.getElementById('route-info'),
            stopsContainer: document.getElementById('route-stops'),
            actionsContainer: document.getElementById('route-actions'),
            mapContainer: document.getElementById('route-map'),
            wazeBtn: document.getElementById('waze-route-btn'),
            gmapsBtn: document.getElementById('gmaps-route-btn'),
            printBtn: document.getElementById('print-route-btn')
        };
    }

    // Setup event listeners
    bindEvents() {
        // בחירת אוטובוס
        if (this.dom.select) {
            this.dom.select.addEventListener('change', (e) => this.handleBusSelect(e.target.value));
        }

        // חישוב מסלול
        if (this.dom.calculateBtn) {
            this.dom.calculateBtn.addEventListener('click', () => this.calculateRoute(true));
        }

        // ייצוא וניווט
        if (this.dom.wazeBtn) this.dom.wazeBtn.addEventListener('click', () => this.openWaze());
        if (this.dom.gmapsBtn) this.dom.gmapsBtn.addEventListener('click', () => this.openGoogleMaps());
        if (this.dom.printBtn) this.dom.printBtn.addEventListener('click', () => this.generatePDF());
    }

    // ========================================================
    // Logic & State Handling
    // ========================================================

    handleBusSelect(busId) {
        this.state.selectedBusId = busId;
        this.state.routeData = null;
        this.state.waypoints = [];

        // בדיקה אם קיים בקאש
        if (busId && this.state.cache.has(busId)) {
            console.log('Loading from cache...');
            const cached = this.state.cache.get(busId);
            this.state.routeData = cached.route;
            this.state.waypoints = [...cached.waypoints]; // Clone to allow modifications
            this.render();
            window.app.showToast('המסלול נטען מהזיכרון', 'info');
        } else {
            this.clearUI();
            if (busId) {
                this.dom.infoContainer.innerHTML = '<p class="empty-state">לחץ על "חשב מסלול" כדי לטעון נתונים</p>';
            } else {
                this.dom.infoContainer.innerHTML = '<p class="empty-state">בחר אוטובוס לצפייה במסלול</p>';
            }
        }
    }

    /**
     * חישוב מסלול חכם
     * @param {boolean} forceRecalculate - האם לכפות חישוב מחדש (למשל אחרי שינוי ידני)
     */
    async calculateRoute(forceRecalculate = false) {
        const busId = this.state.selectedBusId || this.dom.select?.value;

        if (!busId) {
            return window.app.showToast('אנא בחר אוטובוס', 'warning');
        }

        // מניעת לחיצות כפולות (debounce)
        if (this.state.isLoading) return;

        // Check if Google Maps is configured
        if (!window.mapsService.isReady()) {
            const apiKey = await getGoogleMapsKey();
            if (!apiKey) {
                window.app.showToast('יש להגדיר Google Maps API Key בהגדרות', 'error');
                return;
            }

            await window.mapsService.init();

            if (!window.mapsService.isReady()) {
                window.app.showToast('שגיאה בטעינת Google Maps', 'error');
                return;
            }
        }

        this.setLoading(true);

        try {
            // 1. השגת נתונים
            const bus = window.busManager.getBus(busId);
            const students = window.studentManager.getStudentsByBus(busId);

            if (!bus) {
                throw new Error('האוטובוס לא נמצא');
            }

            if (!bus.startLocation || !bus.endLocation) {
                throw new Error('יש להגדיר נקודות התחלה וסיום לאוטובוס');
            }

            if (students.length === 0) {
                throw new Error('אין תלמידים משויכים לאוטובוס זה');
            }

            // 2. הכנת נקודות ציון (Waypoints)
            // אם המשתמש סידר ידנית ואנחנו לא מכפים חישוב מחדש, נשתמש בסדר שלו
            let waypoints;
            let shouldOptimize = forceRecalculate;

            if (this.state.waypoints.length > 0 && !forceRecalculate) {
                // Use user's manual order
                waypoints = this.state.waypoints;
                shouldOptimize = false; // Don't let Google reorder
            } else {
                // Fresh calculation from students
                waypoints = students.map(s => ({
                    name: `${s.firstName} ${s.lastName}`,
                    address: s.address,
                    id: s.id
                }));
                shouldOptimize = true; // Let Google optimize
            }

            // 3. יצירת מפה אם לא קיימת
            const mapContainer = this.dom.mapContainer;
            if (mapContainer.querySelector('.map-message')) {
                mapContainer.innerHTML = '<div id="map"></div>';
                window.mapsService.createMap('map');
            }

            // 4. קריאה ל-Service
            const result = await window.mapsService.calculateRoute(
                bus.startLocation,
                bus.endLocation,
                waypoints,
                { optimize: shouldOptimize }
            );

            // 5. עדכון State
            this.state.routeData = result;
            this.state.selectedBusId = busId;

            // עדכון סדר ה-Waypoints לפי התוצאה
            // הסרת נקודת התחלה וסיום מהרשימה (הם לא ניתנים לגרירה)
            this.state.waypoints = result.stops.slice(1, -1).map((stop, index) => ({
                name: stop.name,
                address: stop.address,
                id: stop.id || `stop-${index}`,
                location: stop.location
            }));

            // 6. שמירה בקאש
            this.state.cache.set(busId, {
                route: result,
                waypoints: [...this.state.waypoints]
            });

            this.render();
            window.app.showToast('המסלול חושב והוצג בהצלחה', 'success');

        } catch (error) {
            console.error('Error calculating route:', error);
            window.app.showToast(error.message || 'שגיאה בחישוב המסלול', 'error');
            this.dom.infoContainer.innerHTML = `<p class="empty-state" style="color: var(--danger);">${this.escapeHtml(error.message || 'שגיאה בחישוב המסלול')}</p>`;
        } finally {
            this.setLoading(false);
        }
    }

    // ========================================================
    // UI & Rendering
    // ========================================================

    setLoading(loading) {
        this.state.isLoading = loading;
        if (loading) {
            this.dom.calculateBtn.classList.add('loading');
            this.dom.calculateBtn.innerHTML = '<span class="spinner"></span> מחשב...';
            this.dom.infoContainer.innerHTML = `
                <div class="skeleton-loader">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line"></div>
                </div>
            `;
        } else {
            this.dom.calculateBtn.classList.remove('loading');
            this.dom.calculateBtn.innerText = 'חשב מסלול';
        }
    }

    render() {
        const { routeData } = this.state;
        if (!routeData) return;

        const bus = window.busManager.getBus(this.state.selectedBusId);

        // 1. Render Info Summary
        this.dom.infoContainer.innerHTML = `
            <div class="route-stats-grid">
                <div class="route-stat-item">
                    <span class="route-stat-icon">🚌</span>
                    <div class="route-stat-data">
                        <span class="route-stat-value">${this.escapeHtml(bus?.name || 'לא ידוע')}</span>
                        <span class="route-stat-label">אוטובוס</span>
                    </div>
                </div>
                <div class="route-stat-item">
                    <span class="route-stat-icon">📏</span>
                    <div class="route-stat-data">
                        <span class="route-stat-value">${routeData.summary.totalDistance}</span>
                        <span class="route-stat-label">מרחק</span>
                    </div>
                </div>
                <div class="route-stat-item">
                    <span class="route-stat-icon">⏱️</span>
                    <div class="route-stat-data">
                        <span class="route-stat-value">${routeData.summary.totalDuration}</span>
                        <span class="route-stat-label">זמן נסיעה</span>
                    </div>
                </div>
                <div class="route-stat-item">
                    <span class="route-stat-icon">🛑</span>
                    <div class="route-stat-data">
                        <span class="route-stat-value">${routeData.summary.stopsCount}</span>
                        <span class="route-stat-label">תחנות</span>
                    </div>
                </div>
            </div>
        `;

        // 2. Render Draggable Stops List
        this.renderStopsList(routeData.stops);

        // 3. Show actions
        this.dom.actionsContainer.classList.remove('hidden');
    }

    renderStopsList(stops) {
        // ניקוי
        this.dom.stopsContainer.innerHTML = '';

        // כותרת עם הסבר על גרירה
        const header = document.createElement('div');
        header.className = 'stops-list-header';
        header.innerHTML = `
            <span class="stops-list-title">רשימת תחנות</span>
            <span class="stops-list-hint">גרור תחנות לשינוי הסדר</span>
        `;
        this.dom.stopsContainer.appendChild(header);

        // יצירת רשימה
        const ul = document.createElement('ul');
        ul.className = 'stops-list';
        ul.id = 'sortable-stops';

        stops.forEach((stop, index) => {
            const isStartOrEnd = index === 0 || index === stops.length - 1;
            const li = document.createElement('li');
            li.className = `stop-item ${isStartOrEnd ? 'fixed-stop' : 'draggable-stop'}`;
            li.dataset.index = index;
            li.dataset.stopId = stop.id || `stop-${index}`;

            const stopTypeLabel = index === 0 ? 'התחלה' : (index === stops.length - 1 ? 'יעד' : '');

            li.innerHTML = `
                <div class="stop-handle" title="${isStartOrEnd ? 'תחנה קבועה' : 'גרור לשינוי סדר'}">
                    ${isStartOrEnd ? '<span class="lock-icon">🔒</span>' : '<span class="drag-icon">⋮⋮</span>'}
                </div>
                <div class="stop-number-badge ${isStartOrEnd ? 'fixed' : ''}">${index + 1}</div>
                <div class="stop-details">
                    <div class="stop-name">
                        ${this.escapeHtml(stop.name)}
                        ${stopTypeLabel ? `<span class="stop-type-label">${stopTypeLabel}</span>` : ''}
                    </div>
                    <div class="stop-meta">
                        <span class="stop-address">${this.escapeHtml(stop.address)}</span>
                        ${stop.estimatedArrival ? `<span class="stop-time">🕐 ${stop.estimatedArrival}</span>` : ''}
                    </div>
                    ${stop.duration || stop.distance ? `
                        <div class="stop-route-info">
                            ${stop.duration ? `<span>⏱️ ${stop.duration}</span>` : ''}
                            ${stop.distance ? `<span>📏 ${stop.distance}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="stop-actions">
                    <button class="btn-icon focus-btn" title="הצג במפה" data-index="${index}">
                        <span>📍</span>
                    </button>
                </div>
            `;

            // אינטראקציה: הובר מדגיש במפה
            li.addEventListener('mouseenter', () => this.highlightMarker(index, true));
            li.addEventListener('mouseleave', () => this.highlightMarker(index, false));

            // לחיצה על כפתור התמקדות
            const focusBtn = li.querySelector('.focus-btn');
            if (focusBtn) {
                focusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.focusOnStop(index);
                });
            }

            ul.appendChild(li);
        });

        this.dom.stopsContainer.appendChild(ul);

        // אתחול Drag & Drop (רק אם Sortable קיים)
        if (typeof Sortable !== 'undefined') {
            this.initSortable(ul);
        } else {
            console.warn('SortableJS not loaded - drag and drop disabled');
        }
    }

    // ========================================================
    // Advanced Features: Drag & Drop
    // ========================================================

    initSortable(element) {
        if (this.sortable) this.sortable.destroy();

        this.sortable = new Sortable(element, {
            animation: 150,
            handle: '.stop-handle',
            draggable: '.draggable-stop', // רק תחנות ביניים ניתנות לגרירה
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.fixed-stop', // תחנות קבועות לא ניתנות לגרירה
            onEnd: (evt) => {
                this.handleReorder(evt.oldIndex, evt.newIndex);
            }
        });
    }

    async handleReorder(oldIndex, newIndex) {
        // התאמה לאינדקסים (הראשון והאחרון הם תחנות קבועות)
        if (oldIndex === newIndex) return;
        if (oldIndex === 0 || newIndex === 0) return; // Can't move start
        if (oldIndex === this.state.routeData.stops.length - 1 ||
            newIndex === this.state.routeData.stops.length - 1) return; // Can't move end

        console.log(`Reordering stop from ${oldIndex} to ${newIndex}`);

        // עדכון המערך הפנימי (State)
        // האינדקסים כוללים את נקודת ההתחלה, אז צריך להתאים
        const arrayIndexOld = oldIndex - 1;
        const arrayIndexNew = newIndex - 1;

        if (arrayIndexOld < 0 || arrayIndexNew < 0 ||
            arrayIndexOld >= this.state.waypoints.length ||
            arrayIndexNew >= this.state.waypoints.length) return;

        const movedItem = this.state.waypoints.splice(arrayIndexOld, 1)[0];
        this.state.waypoints.splice(arrayIndexNew, 0, movedItem);

        // חישוב מחדש של המסלול לפי הסדר החדש (ללא אופטימיזציה של גוגל!)
        window.app.showToast('מחשב מסלול לפי הסדר החדש...', 'info');

        // Debounce - wait for user to finish reordering
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            // Invalidate cache for this bus
            this.state.cache.delete(this.state.selectedBusId);
            await this.calculateRoute(false); // false = don't optimize, keep user's order
        }, 500);
    }

    // ========================================================
    // Map Interaction
    // ========================================================

    focusOnStop(index) {
        const stop = this.state.routeData?.stops?.[index];
        if (!stop || !stop.location) return;

        if (window.mapsService.map) {
            window.mapsService.map.setCenter({
                lat: stop.location.lat,
                lng: stop.location.lng
            });
            window.mapsService.map.setZoom(17);

            // Highlight the marker
            this.highlightMarker(index, true);

            // Remove highlight after 3 seconds
            setTimeout(() => this.highlightMarker(index, false), 3000);

            window.app.showToast(`מתמקד בתחנה: ${stop.name}`, 'info');
        }
    }

    highlightMarker(index, isActive) {
        this.state.highlightedStopIndex = isActive ? index : null;

        // Highlight the corresponding list item
        const items = this.dom.stopsContainer.querySelectorAll('.stop-item');
        items.forEach((item, i) => {
            if (i === index && isActive) {
                item.classList.add('highlighted');
            } else {
                item.classList.remove('highlighted');
            }
        });

        // Note: For actual marker highlighting, MapsService would need to expose marker references
        // This would require additional changes to MapsService
    }

    // ========================================================
    // Export & Navigation
    // ========================================================

    openWaze() {
        if (!this.state.routeData) {
            window.app.showToast('אין מסלול', 'warning');
            return;
        }

        const link = window.mapsService.generateWazeLink(this.state.routeData.stops);
        if (link) {
            window.open(link, '_blank');
        } else {
            window.app.showToast('לא ניתן ליצור קישור', 'error');
        }
    }

    openGoogleMaps() {
        if (!this.state.routeData) {
            window.app.showToast('אין מסלול', 'warning');
            return;
        }

        const link = window.mapsService.generateGoogleMapsLink(this.state.routeData.stops);
        if (link) {
            window.open(link, '_blank');
        } else {
            window.app.showToast('לא ניתן ליצור קישור', 'error');
        }
    }

    generatePDF() {
        if (!this.state.routeData) {
            window.app.showToast('אין מסלול להדפסה', 'warning');
            return;
        }

        const bus = window.busManager.getBus(this.state.selectedBusId);
        if (!bus) return;

        const busName = bus.name;
        const date = new Date().toLocaleDateString('he-IL');
        const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8">
                <title>מסלול ${this.escapeHtml(busName)}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                        padding: 30px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .header {
                        border-bottom: 3px solid #6366f1;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #1a1d2e;
                        font-size: 24px;
                        margin-bottom: 5px;
                    }
                    .meta {
                        color: #666;
                        font-size: 14px;
                    }
                    .summary-box {
                        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
                        padding: 20px;
                        border-radius: 10px;
                        margin-bottom: 25px;
                        display: flex;
                        justify-content: space-around;
                        flex-wrap: wrap;
                        gap: 15px;
                    }
                    .summary-item {
                        text-align: center;
                    }
                    .summary-value {
                        font-size: 22px;
                        font-weight: 700;
                        color: #4338ca;
                        display: block;
                    }
                    .summary-label {
                        font-size: 13px;
                        color: #6366f1;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                        font-size: 14px;
                    }
                    th {
                        text-align: right;
                        background: #f1f5f9;
                        padding: 12px 10px;
                        border-bottom: 2px solid #cbd5e1;
                        font-weight: 600;
                        color: #475569;
                    }
                    td {
                        padding: 12px 10px;
                        border-bottom: 1px solid #e2e8f0;
                        vertical-align: top;
                    }
                    tr:nth-child(even) { background: #f8fafc; }
                    tr:hover { background: #e0e7ff; }
                    .stop-num {
                        background: #6366f1;
                        color: white;
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 600;
                        font-size: 13px;
                    }
                    .stop-name { font-weight: 500; }
                    .stop-type {
                        background: #dbeafe;
                        color: #1d4ed8;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        margin-right: 8px;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 1px solid #e2e8f0;
                        font-size: 12px;
                        color: #94a3b8;
                        text-align: center;
                    }
                    @media print {
                        body { padding: 15px; }
                        .summary-box { break-inside: avoid; }
                        tr { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚌 מסלול נסיעה: ${this.escapeHtml(busName)}</h1>
                    <div class="meta">תאריך: ${date} | שעה: ${time}</div>
                </div>

                <div class="summary-box">
                    <div class="summary-item">
                        <span class="summary-value">${this.state.routeData.summary.totalDistance}</span>
                        <span class="summary-label">מרחק כולל</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${this.state.routeData.summary.totalDuration}</span>
                        <span class="summary-label">זמן נסיעה</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${this.state.routeData.summary.stopsCount}</span>
                        <span class="summary-label">תחנות</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">#</th>
                            <th>שם תלמיד/תחנה</th>
                            <th>כתובת</th>
                            <th style="width: 80px;">שעת הגעה</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.routeData.stops.map((stop, index) => {
                            const isStart = index === 0;
                            const isEnd = index === this.state.routeData.stops.length - 1;
                            const typeLabel = isStart ? 'התחלה' : (isEnd ? 'יעד' : '');
                            return `
                                <tr>
                                    <td><span class="stop-num">${index + 1}</span></td>
                                    <td>
                                        <span class="stop-name">${this.escapeHtml(stop.name)}</span>
                                        ${typeLabel ? `<span class="stop-type">${typeLabel}</span>` : ''}
                                    </td>
                                    <td>${this.escapeHtml(stop.address)}</td>
                                    <td>${stop.estimatedArrival || '--:--'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    מערכת ניהול אוטובוסים | הופק אוטומטית
                </div>

                <script>
                    window.onload = () => {
                        setTimeout(() => window.print(), 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // ========================================================
    // Utilities
    // ========================================================

    clearUI() {
        this.dom.infoContainer.innerHTML = '';
        this.dom.stopsContainer.innerHTML = '';
        this.dom.mapContainer.innerHTML = `
            <div class="map-message">
                <span>🗺️</span>
                <p>בחר אוטובוס וחשב מסלול להצגת המפה</p>
            </div>
        `;
        this.dom.actionsContainer.classList.add('hidden');

        if (this.sortable) {
            this.sortable.destroy();
            this.sortable = null;
        }
    }

    clearCache(busId = null) {
        if (busId) {
            this.state.cache.delete(busId);
            console.log(`Cache cleared for bus: ${busId}`);
        } else {
            this.state.cache.clear();
            console.log('All route cache cleared');
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
window.routeManager = new SmartRouteManager();
