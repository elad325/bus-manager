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
        // Re-assign all students to best buses
        async reassignAllStudents() {
                    if (!window.mapsService.isReady()) {
                                    window
    
    getStudentsByBus(busId) {
        return this.students.filter(s => s.busId === busId);
    }


    
        // Re-assign all students to best buses
    async reassignAllStudents() {
        if (!window.mapsService.isReady()) {
            window.app.showToast('יש להגדיר Google Maps API תחילה', 'warning');
            return;
        }

        const buses = window.busManager ? window.busManager.getAllBuses() : [];
        if (buses.length === 0) {
            window.app.showToast('אין אוטובוסים במערכת', 'warning');
            return;
        }

        window.app.showToast('ממיין תלמידים מחדש...', 'info');

        let reassignedCount = 0;
        for (const student of this.students) {
            if (!student.address) continue;

            try {
                const bestBus = await window.mapsService.findBestBusForAddress(student.address);
                if (bestBus && bestBus.id !== student.busId) {
                    student.busId = bestBus.id;
                    await window.storage.saveStudent(student);
                    reassignedCount++;
                }
            } catch (error) {
                console.error('Error reassigning student:', error);
            }
        }

        await this.loadStudents();
        window.app.showToast(`${reassignedCount} תלמידים שויכו מחדש`, 'success');

        if (window.busManager) {
            window.busManager.renderBusesList();
        }
        window.app.updateDashboardStats();
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



