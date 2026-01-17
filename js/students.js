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
