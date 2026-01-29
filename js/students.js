// ===================================
// מערכת ניהול אוטובוסים - ניהול תלמידים
// ===================================

class StudentManager {
    constructor() {
        this.students = [];
        this.editingStudentId = null;
        this.selectedStudentIds = new Set(); // Track selected students
    }

    // Initialize
    async init() {
        await this.loadStudents();
        this.setupEventListeners();
    }

    // Load students from storage
    async loadStudents() {
        this.students = await window.storage.getStudents();
        this.renderStudentsTable();
    }

    // Setup event listeners
    setupEventListeners() {
        // Add student button
        const addStudentBtn = document.getElementById('add-student-btn');
        if (addStudentBtn) {
            addStudentBtn.addEventListener('click', () => this.openStudentModal());
        }

        // Reassign all students button
        const reassignAllBtn = document.getElementById('reassign-all-students-btn');
        if (reassignAllBtn) {
            reassignAllBtn.addEventListener('click', () => this.reassignAllStudents());
        }

        // Smart reassign button (batch assignment)
        const smartReassignBtn = document.getElementById('smart-reassign-btn');
        if (smartReassignBtn) {
            smartReassignBtn.addEventListener('click', () => this.smartReassignAllStudents());
        }


        // Import Excel button
        const importExcelBtn = document.getElementById('import-excel-btn');
        if (importExcelBtn) {
            importExcelBtn.addEventListener('click', () => this.openExcelImportModal());
        }


        // Student form submit
        const studentForm = document.getElementById('student-form');
        if (studentForm) {
            studentForm.addEventListener('submit', (e) => this.handleStudentSubmit(e));
        }

        // Student search
        const studentSearch = document.getElementById('student-search');
        if (studentSearch) {
            studentSearch.addEventListener('input', (e) => this.filterStudents());
        }

        // Bus filter
        const busFilter = document.getElementById('bus-filter');
        if (busFilter) {
            busFilter.addEventListener('change', () => this.filterStudents());
        }

        // Modal close buttons
        document.querySelectorAll('[data-close="student-modal"]').forEach(btn => {
            btn.addEventListener('click', () => this.closeStudentModal());
        });

        // Selection controls
        const selectAllCheckbox = document.getElementById('select-all-students');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
        }

        const bulkAssignBtn = document.getElementById('bulk-assign-btn');
        if (bulkAssignBtn) {
            bulkAssignBtn.addEventListener('click', () => this.bulkAssignStudents());
        }

        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => this.confirmBulkDelete());
        }

        const clearSelectionBtn = document.getElementById('clear-selection-btn');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => this.clearSelection());
        }
    }

    // Render students table
    renderStudentsTable() {
        const tbody = document.getElementById('students-table-body');
        if (!tbody) return;

        if (this.students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">👨‍🎓</span>
                        אין תלמידים במערכת
                    </td>
                </tr>
            `;
            return;
        }

        const isAdmin = window.auth.checkIsAdmin();
        const buses = window.busManager ? window.busManager.getAllBuses() : [];

        tbody.innerHTML = this.students.map(student => {
            const bus = buses.find(b => b.id === student.busId);
            const busName = bus ? bus.name : 'לא משויך';
            const isSelected = this.selectedStudentIds.has(student.id);

            return `
                <tr data-student-id="${student.id}" class="${isSelected ? 'selected-row' : ''}">
                    ${isAdmin ? `
                    <td>
                        <input type="checkbox" class="student-checkbox" data-id="${student.id}" ${isSelected ? 'checked' : ''}>
                    </td>
                    ` : ''}
                    <td>${this.escapeHtml(student.firstName)}</td>
                    <td>${this.escapeHtml(student.lastName)}</td>
                    <td>${this.escapeHtml(student.address)}</td>
                    <td>
                        <span class="badge">${this.escapeHtml(busName)}</span>
                    </td>
                    ${isAdmin ? `
                    <td class="table-actions">
                        <button class="btn btn-secondary edit-student-btn" data-id="${student.id}">
                            ✏️
                        </button>
                        <button class="btn btn-danger delete-student-btn" data-id="${student.id}">
                            🗑️
                        </button>
                    </td>
                    ` : ''}
                </tr>
            `;
        }).join('');

        // Add event listeners to buttons
        tbody.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', () => this.editStudent(btn.dataset.id));
        });

        tbody.querySelectorAll('.delete-student-btn').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDeleteStudent(btn.dataset.id));
        });

        // Add event listeners to checkboxes
        tbody.querySelectorAll('.student-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleStudentSelect(e.target.dataset.id, e.target.checked));
        });

        // Update selection UI
        this.updateSelectionUI();
    }

    // Open student modal
    openStudentModal(student = null) {
        const modal = document.getElementById('student-modal');
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('student-modal-title');
        const form = document.getElementById('student-form');

        if (!modal || !overlay) return;

        // Reset form
        form.reset();

        if (student) {
            // Edit mode
            title.textContent = 'ערוך תלמיד';
            document.getElementById('student-id').value = student.id;
            document.getElementById('student-first-name').value = student.firstName;
            document.getElementById('student-last-name').value = student.lastName;
            document.getElementById('student-address').value = student.address;
            document.getElementById('student-bus').value = student.busId || '';
            this.editingStudentId = student.id;
        } else {
            // Add mode
            title.textContent = 'הוסף תלמיד';
            this.editingStudentId = null;
        }

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

    // Close student modal
    closeStudentModal() {
        const modal = document.getElementById('student-modal');
        const overlay = document.getElementById('modal-overlay');

        if (modal) modal.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');

        this.editingStudentId = null;
    }

    // Handle student form submit
    async handleStudentSubmit(e) {
        e.preventDefault();

        const student = {
            firstName: document.getElementById('student-first-name').value.trim(),
            lastName: document.getElementById('student-last-name').value.trim(),
            address: document.getElementById('student-address').value.trim(),
            busId: document.getElementById('student-bus').value
        };

        if (this.editingStudentId) {
            student.id = this.editingStudentId;
        }

        // Auto-assign bus if not selected
        if (!student.busId && student.address) {
            window.app.showToast('מחפש אוטובוס מתאים...', 'info');

            try {
                const bestBus = await window.mapsService.findBestBusForAddress(student.address);
                if (bestBus) {
                    student.busId = bestBus.id;
                    window.app.showToast(`שויך אוטומטית ל: ${bestBus.name}`, 'success');
                } else {
                    window.app.showToast('לא נמצא אוטובוס מתאים - יש לבחור ידנית', 'warning');
                }
            } catch (error) {
                console.error('Error auto-assigning bus:', error);
                window.app.showToast('לא ניתן לשייך אוטומטית - יש לבחור ידנית', 'warning');
            }
        }

        try {
            await window.storage.saveStudent(student);
            await this.loadStudents();
            this.closeStudentModal();
            window.app.showToast('התלמיד נשמר בהצלחה', 'success');
            window.app.updateDashboardStats();

            // Reload buses to update student count
            if (window.busManager) {
                window.busManager.renderBusesList();
            }
        } catch (error) {
            console.error('Error saving student:', error);
            window.app.showToast('שגיאה בשמירת התלמיד', 'error');
        }
    }

    // Edit student
    editStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (student) {
            this.openStudentModal(student);
        }
    }

    // Confirm delete student
    confirmDeleteStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        window.app.showConfirmModal(
            `האם אתה בטוח שברצונך למחוק את "${student.firstName} ${student.lastName}"?`,
            async () => {
                await this.deleteStudent(studentId);
            },
            true  // This is a delete action
        );
    }

    // Delete student
    async deleteStudent(studentId) {
        try {
            await window.storage.deleteStudent(studentId);
            await this.loadStudents();
            window.app.showToast('התלמיד נמחק בהצלחה', 'success');
            window.app.updateDashboardStats();

            // Reload buses to update student count
            if (window.busManager) {
                window.busManager.renderBusesList();
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            window.app.showToast('שגיאה במחיקת התלמיד', 'error');
        }
    }

    // Filter students
    filterStudents() {
        const searchQuery = (document.getElementById('student-search')?.value || '').toLowerCase().trim();
        const busFilter = document.getElementById('bus-filter')?.value || '';

        const rows = document.querySelectorAll('#students-table-body tr[data-student-id]');

        rows.forEach(row => {
            const studentId = row.dataset.studentId;
            const student = this.students.find(s => s.id === studentId);

            if (!student) {
                row.style.display = 'none';
                return;
            }

            // Check search query
            const matchesSearch = !searchQuery ||
                student.firstName.toLowerCase().includes(searchQuery) ||
                student.lastName.toLowerCase().includes(searchQuery) ||
                student.address.toLowerCase().includes(searchQuery);

            // Check bus filter
            const matchesBus = !busFilter || student.busId === busFilter;

            row.style.display = (matchesSearch && matchesBus) ? '' : 'none';
        });
    }

    // Get students by bus ID
    getStudentsByBus(busId) {
        return this.students.filter(s => s.busId === busId);
    }

    // Get all students
    getAllStudents() {
        return this.students;
    }

    // Reassign all students to best buses
    async reassignAllStudents() {
        // Check if Maps is ready
        if (!window.mapsService.isReady()) {
            window.app.showToast('יש להגדיר Google Maps API Key בהגדרות', 'error');
            return;
        }

        // Get all students
        const students = this.getAllStudents();

        if (students.length === 0) {
            window.app.showToast('אין תלמידים במערכת', 'warning');
            return;
        }

        // Get all buses
        const buses = window.busManager ? window.busManager.getAllBuses() : [];

        if (buses.length === 0) {
            window.app.showToast('אין אוטובוסים במערכת', 'warning');
            return;
        }

        // Show confirmation dialog
        const confirmMessage = `האם אתה בטוח שברצונך לשייך מחדש את כל ${students.length} התלמידים? פעולה זו תשנה את שיוכי האוטובוסים הקיימים.`;

        window.app.showConfirmModal(confirmMessage, async () => {
            try {
                window.app.showToast('מתחיל שיוך מחדש...', 'info');

                let successCount = 0;
                let failCount = 0;
                let unchangedCount = 0;

                // Process each student
                for (let i = 0; i < students.length; i++) {
                    const student = students[i];
                    const previousBusId = student.busId;

                    // Show progress every 5 students or on last student to avoid toast flooding
                    if ((i + 1) % 5 === 0 || i === students.length - 1) {
                        window.app.showToast(`מעבד תלמיד ${i + 1} מתוך ${students.length}...`, 'info');
                    }

                    try {
                        // Skip if student has no address
                        if (!student.address || student.address.trim() === '') {
                            console.warn(`Student ${student.id} has no address, skipping`);
                            failCount++;
                            continue;
                        }

                        const bestBus = await window.mapsService.findBestBusForAddress(student.address);

                        if (bestBus) {
                            student.busId = bestBus.id;
                            await window.storage.saveStudent(student);

                            if (previousBusId !== bestBus.id) {
                                successCount++;
                            } else {
                                unchangedCount++;
                            }
                        } else {
                            failCount++;
                        }
                    } catch (error) {
                        console.error(`Error reassigning student ${student.id}:`, error);
                        failCount++;
                    }
                }


                // Reload students
                await this.loadStudents();
                window.app.updateDashboardStats();

                // Reload buses to update student count
                if (window.busManager) {
                    window.busManager.renderBusesList();
                }

                // Show summary
                let summaryMessage = `שיוך מחדש הושלם!\n`;
                if (successCount > 0) summaryMessage += `${successCount} תלמידים שויכו מחדש. `;
                if (unchangedCount > 0) summaryMessage += `${unchangedCount} נשארו באותו אוטובוס. `;
                if (failCount > 0) summaryMessage += `${failCount} נכשלו.`;

                window.app.showToast(summaryMessage, successCount > 0 ? 'success' : 'warning');

            } catch (error) {
                console.error('Error in reassignAllStudents:', error);
                window.app.showToast('שגיאה בשיוך מחדש', 'error');
            }
        });
    }

    // Smart reassign all students using batch algorithm
    async smartReassignAllStudents() {
        // Check if Maps is ready
        if (!window.mapsService.isReady()) {
            window.app.showToast('יש להגדיר Google Maps API Key בהגדרות', 'error');
            return;
        }

        // Get all students
        const students = this.getAllStudents();

        if (students.length === 0) {
            window.app.showToast('אין תלמידים במערכת', 'warning');
            return;
        }

        // Get all buses
        const buses = window.busManager ? window.busManager.getAllBuses() : [];

        if (buses.length === 0) {
            window.app.showToast('אין אוטובוסים במערכת', 'warning');
            return;
        }

        // Show confirmation dialog
        const confirmMessage = `שיוך חכם: האם לשייך את כל ${students.length} התלמידים?\n\nהאלגוריתם החכם:\n• מקבץ תלמידים לפי מיקום\n• משייך קבוצות שלמות לאוטובוסים\n• מאזן קיבולת (מקס' 50 לאוטובוס)\n• מתחשב בכיוון המסלול`;

        window.app.showConfirmModal(confirmMessage, async () => {
            try {
                // Progress callback
                const showProgress = (message) => {
                    window.app.showToast(message, 'info');
                };

                showProgress('מתחיל שיוך חכם...');

                // Run smart batch assignment
                const results = await window.mapsService.smartBatchAssignment(
                    students,
                    buses,
                    showProgress
                );

                if (!results) {
                    window.app.showToast('שגיאה בשיוך החכם', 'error');
                    return;
                }

                // Apply the results
                showProgress('מעדכן תלמידים...');
                await window.mapsService.applySmartAssignment(results);

                // Reload students
                await this.loadStudents();
                window.app.updateDashboardStats();

                // Reload buses to update student count
                if (window.busManager) {
                    window.busManager.renderBusesList();
                }

                // Show summary
                let summaryMessage = `שיוך חכם הושלם!\n`;
                summaryMessage += `${results.totalStudents} תלמידים קובצו ל-${results.locationGroups} קבוצות מיקום.\n`;
                summaryMessage += `חלוקה: `;
                summaryMessage += results.summary.map(s => `${s.busName}: ${s.count}`).join(', ');

                window.app.showToast(summaryMessage, 'success');

                // Log detailed results
                console.log('Smart assignment results:', results);

            } catch (error) {
                console.error('Error in smartReassignAllStudents:', error);
                window.app.showToast('שגיאה בשיוך החכם', 'error');
            }
        });
    }

    // Open Excel import modal
    openExcelImportModal() {
        const modal = document.getElementById('excel-import-modal');
        const overlay = document.getElementById('modal-overlay');
        const fileInput = document.getElementById('excel-file-input');
        const preview = document.getElementById('excel-preview');
        const confirmBtn = document.getElementById('import-excel-confirm-btn');

        // Reset
        fileInput.value = '';
        preview.classList.add('hidden');
        confirmBtn.classList.add('hidden');
        this.excelData = null;

        // Setup file change listener
        fileInput.onchange = (e) => this.handleExcelFile(e);

        // Setup confirm button
        confirmBtn.onclick = () => this.importExcelData();

        // Setup close buttons
        document.querySelectorAll('[data-close="excel-import-modal"]').forEach(btn => {
            btn.onclick = () => {
                modal.classList.add('hidden');
                overlay.classList.add('hidden');
            };
        });

        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');
    }

    // Handle Excel file upload
    async handleExcelFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await this.readExcelFile(file);
            this.excelData = data;
            this.showExcelPreview(data);
        } catch (error) {
            console.error('Error reading Excel file:', error);
            window.app.showToast('שגיאה בקריאת הקובץ', 'error');
        }
    }

    // Read Excel file
    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Get first sheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonData.length === 0) {
                        reject(new Error('הקובץ ריק'));
                        return;
                    }

                    // Get headers (first row)
                    const headers = jsonData[0];
                    const rows = jsonData.slice(1).filter(row => row.some(cell => cell)); // Remove empty rows

                    resolve({ headers, rows });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
            reader.readAsArrayBuffer(file);
        });
    }

    // Show Excel preview and column selection
    showExcelPreview(data) {
        const preview = document.getElementById('excel-preview');
        const firstnameCol = document.getElementById('excel-firstname-col');
        const lastnameCol = document.getElementById('excel-lastname-col');
        const addressCol = document.getElementById('excel-address-col');
        const previewText = document.getElementById('excel-preview-text');
        const confirmBtn = document.getElementById('import-excel-confirm-btn');

        // Populate column selectors
        [firstnameCol, lastnameCol, addressCol].forEach(select => {
            select.innerHTML = '<option value="">בחר עמודה...</option>';
            data.headers.forEach((header, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = header || `עמודה ${index + 1}`;
                select.appendChild(option);
            });
        });

        // Auto-detect columns
        data.headers.forEach((header, index) => {
            const headerLower = (header || '').toLowerCase();
            if (headerLower.includes('שם פרטי') || headerLower.includes('first') || headerLower.includes('name')) {
                if (firstnameCol.value === '') firstnameCol.value = index;
            }
            if (headerLower.includes('שם משפחה') || headerLower.includes('last') || headerLower.includes('surname')) {
                if (lastnameCol.value === '') lastnameCol.value = index;
            }
            if (headerLower.includes('כתובת') || headerLower.includes('address') || headerLower.includes('עיר') || headerLower.includes('city')) {
                if (addressCol.value === '') addressCol.value = index;
            }
        });

        // Update preview on column selection
        const updatePreview = () => {
            const fn = firstnameCol.value;
            const ln = lastnameCol.value;
            const addr = addressCol.value;

            if (fn !== '' && ln !== '' && addr !== '') {
                const sampleRows = data.rows.slice(0, 3);
                const preview = sampleRows.map(row =>
                    `${row[fn] || '?'} ${row[ln] || '?'} - ${row[addr] || '?'}`
                ).join('<br>');
                previewText.innerHTML = `נמצאו ${data.rows.length} תלמידים:<br>${preview}${data.rows.length > 3 ? '<br>...' : ''}`;
                confirmBtn.classList.remove('hidden');
            } else {
                previewText.textContent = 'בחר את כל השדות הנדרשים';
                confirmBtn.classList.add('hidden');
            }
        };

        firstnameCol.onchange = updatePreview;
        lastnameCol.onchange = updatePreview;
        addressCol.onchange = updatePreview;

        preview.classList.remove('hidden');
        updatePreview();
    }

    // Import Excel data
    async importExcelData() {
        if (!this.excelData) return;

        const firstnameCol = parseInt(document.getElementById('excel-firstname-col').value);
        const lastnameCol = parseInt(document.getElementById('excel-lastname-col').value);
        const addressCol = parseInt(document.getElementById('excel-address-col').value);

        if (isNaN(firstnameCol) || isNaN(lastnameCol) || isNaN(addressCol)) {
            window.app.showToast('יש לבחור את כל השדות', 'warning');
            return;
        }

        try {
            window.app.showToast('מייבא תלמידים...', 'info');

            let imported = 0;
            let failed = 0;

            for (const row of this.excelData.rows) {
                const firstName = (row[firstnameCol] || '').toString().trim();
                const lastName = (row[lastnameCol] || '').toString().trim();
                const address = (row[addressCol] || '').toString().trim();

                if (!firstName || !lastName || !address) {
                    failed++;
                    continue;
                }

                try {
                    const student = {
                        firstName,
                        lastName,
                        address,
                        busId: '' // Will be auto-assigned if Maps is configured
                    };

                    await window.storage.saveStudent(student);
                    imported++;
                } catch (error) {
                    console.error('Error saving student:', error);
                    failed++;
                }
            }

            // Close modal
            document.getElementById('excel-import-modal').classList.add('hidden');
            document.getElementById('modal-overlay').classList.add('hidden');

            // Reload students
            await this.loadStudents();
            window.app.updateDashboardStats();

            // Show result
            let message = `ייבוא הושלם! ${imported} תלמידים נוספו`;
            if (failed > 0) {
                message += `, ${failed} נכשלו`;
            }
            window.app.showToast(message, imported > 0 ? 'success' : 'warning');

            // Ask if user wants to auto-assign buses
            if (imported > 0 && window.mapsService.isReady()) {
                setTimeout(() => {
                    window.app.showConfirmModal(
                        'האם ברצונך לשייך אוטומטית את התלמידים החדשים לאוטובוסים?',
                        () => this.reassignAllStudents()
                    );
                }, 1000);
            }

        } catch (error) {
            console.error('Error importing Excel:', error);
            window.app.showToast('שגיאה בייבוא הנתונים', 'error');
        }
    }

    // ==========================================
    // Selection Management Methods
    // ==========================================

    // Handle individual student selection
    handleStudentSelect(studentId, isSelected) {
        if (isSelected) {
            this.selectedStudentIds.add(studentId);
        } else {
            this.selectedStudentIds.delete(studentId);
        }

        // Update row highlight
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (row) {
            row.classList.toggle('selected-row', isSelected);
        }

        this.updateSelectionUI();
    }

    // Handle select all checkbox
    handleSelectAll(isSelected) {
        const visibleRows = document.querySelectorAll('#students-table-body tr[data-student-id]');

        visibleRows.forEach(row => {
            // Only select visible rows (not filtered out)
            if (row.style.display !== 'none') {
                const studentId = row.dataset.studentId;
                const checkbox = row.querySelector('.student-checkbox');

                if (isSelected) {
                    this.selectedStudentIds.add(studentId);
                } else {
                    this.selectedStudentIds.delete(studentId);
                }

                if (checkbox) {
                    checkbox.checked = isSelected;
                }
                row.classList.toggle('selected-row', isSelected);
            }
        });

        this.updateSelectionUI();
    }

    // Clear all selections
    clearSelection() {
        this.selectedStudentIds.clear();

        // Uncheck all checkboxes
        document.querySelectorAll('.student-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Remove highlight from all rows
        document.querySelectorAll('.selected-row').forEach(row => {
            row.classList.remove('selected-row');
        });

        // Uncheck select all
        const selectAllCheckbox = document.getElementById('select-all-students');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }

        this.updateSelectionUI();
    }

    // Update selection UI (count, buttons, action bar visibility)
    updateSelectionUI() {
        const count = this.selectedStudentIds.size;
        const selectionCount = document.getElementById('selection-count');
        const actionsBar = document.getElementById('selection-actions-bar');
        const bulkAssignBtn = document.getElementById('bulk-assign-btn');
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const selectAllCheckbox = document.getElementById('select-all-students');

        // Update count text
        if (selectionCount) {
            selectionCount.textContent = `${count} תלמידים נבחרו`;
        }

        // Show/hide actions bar
        if (actionsBar) {
            if (count > 0) {
                actionsBar.classList.remove('hidden');
            } else {
                actionsBar.classList.add('hidden');
            }
        }

        // Enable/disable action buttons
        if (bulkAssignBtn) {
            bulkAssignBtn.disabled = count === 0;
        }
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = count === 0;
        }

        // Update select all checkbox state
        if (selectAllCheckbox) {
            const visibleRows = document.querySelectorAll('#students-table-body tr[data-student-id]:not([style*="display: none"])');
            const selectedVisibleCount = Array.from(visibleRows).filter(row =>
                this.selectedStudentIds.has(row.dataset.studentId)
            ).length;

            selectAllCheckbox.checked = visibleRows.length > 0 && selectedVisibleCount === visibleRows.length;
            selectAllCheckbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleRows.length;
        }

        // Populate bulk assign bus select
        this.populateBulkAssignBusSelect();
    }

    // Populate the bulk assign bus dropdown
    populateBulkAssignBusSelect() {
        const select = document.getElementById('bulk-assign-bus');
        if (!select) return;

        const buses = window.busManager ? window.busManager.getAllBuses() : [];
        const currentValue = select.value;

        select.innerHTML = '<option value="">בחר אוטובוס לשיוך...</option>';
        buses.forEach(bus => {
            const option = document.createElement('option');
            option.value = bus.id;
            option.textContent = bus.name;
            select.appendChild(option);
        });

        // Restore previous selection if still valid
        if (currentValue && buses.some(b => b.id === currentValue)) {
            select.value = currentValue;
        }
    }

    // Bulk assign selected students to a bus
    async bulkAssignStudents() {
        const busSelect = document.getElementById('bulk-assign-bus');
        const busId = busSelect?.value;

        if (!busId) {
            window.app.showToast('יש לבחור אוטובוס לשיוך', 'warning');
            return;
        }

        const selectedIds = Array.from(this.selectedStudentIds);
        if (selectedIds.length === 0) {
            window.app.showToast('לא נבחרו תלמידים', 'warning');
            return;
        }

        const bus = window.busManager?.getBus(busId);
        const busName = bus ? bus.name : 'אוטובוס';

        window.app.showConfirmModal(
            `האם לשייך ${selectedIds.length} תלמידים ל"${busName}"?`,
            async () => {
                try {
                    window.app.showToast('משייך תלמידים...', 'info');

                    let successCount = 0;
                    for (const studentId of selectedIds) {
                        const student = this.students.find(s => s.id === studentId);
                        if (student) {
                            student.busId = busId;
                            await window.storage.saveStudent(student);
                            successCount++;
                        }
                    }

                    await this.loadStudents();
                    this.clearSelection();
                    window.app.showToast(`${successCount} תלמידים שויכו בהצלחה`, 'success');
                    window.app.updateDashboardStats();

                    if (window.busManager) {
                        window.busManager.renderBusesList();
                    }
                } catch (error) {
                    console.error('Error bulk assigning students:', error);
                    window.app.showToast('שגיאה בשיוך התלמידים', 'error');
                }
            }
        );
    }

    // Confirm bulk delete
    confirmBulkDelete() {
        const selectedIds = Array.from(this.selectedStudentIds);
        if (selectedIds.length === 0) {
            window.app.showToast('לא נבחרו תלמידים', 'warning');
            return;
        }

        window.app.showConfirmModal(
            `האם למחוק ${selectedIds.length} תלמידים? פעולה זו אינה ניתנת לביטול.`,
            async () => {
                await this.bulkDeleteStudents(selectedIds);
            },
            true // isDelete
        );
    }

    // Bulk delete students
    async bulkDeleteStudents(studentIds) {
        try {
            window.app.showToast('מוחק תלמידים...', 'info');

            let successCount = 0;
            for (const studentId of studentIds) {
                try {
                    await window.storage.deleteStudent(studentId);
                    successCount++;
                } catch (error) {
                    console.error(`Error deleting student ${studentId}:`, error);
                }
            }

            await this.loadStudents();
            this.clearSelection();
            window.app.showToast(`${successCount} תלמידים נמחקו בהצלחה`, 'success');
            window.app.updateDashboardStats();

            if (window.busManager) {
                window.busManager.renderBusesList();
            }
        } catch (error) {
            console.error('Error bulk deleting students:', error);
            window.app.showToast('שגיאה במחיקת התלמידים', 'error');
        }
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
window.studentManager = new StudentManager();
