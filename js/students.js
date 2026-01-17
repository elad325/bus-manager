// ===================================
// מערכת ניהול אוטובוסים - ניהול תלמידים
// ===================================

class StudentManager {
    constructor() {
        this.students = [];
        this.editingStudentId = null;
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

            return `
                <tr data-student-id="${student.id}">
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
            }
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

                    window.app.showToast(`מעבד תלמיד ${i + 1} מתוך ${students.length}...`, 'info');

                    try {
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
