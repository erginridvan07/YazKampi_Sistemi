let systemData = null;
let db = null;
let auth = null;
let firestoreUnsubscribe = null;
let isDataReady = false;
let isSaving = false;
let currentUser = null;
let teacherSearchQuery = '';
let classSearchQuery = '';

let currentEditState = {
    classId: null,
    studentId: null,
    isEditingStudent: false,
    isEditingClass: false
};

// ===== Yardımcı Fonksiyonlar =====

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast toast-${type} show`;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function confirmAction(message) {
    return window.confirm(message);
}

function normalizeData(data) {
    const normalized = {
        teachers: Array.isArray(data?.teachers) ? data.teachers : [],
        classes: Array.isArray(data?.classes) ? data.classes : []
    };

    normalized.classes = normalized.classes.map(classItem => ({
        ...classItem,
        courses: Array.isArray(classItem.courses) ? classItem.courses : [],
        students: Array.isArray(classItem.students) ? classItem.students : []
    }));

    return normalized;
}

function getNextId(items) {
    return items.reduce((maxId, item) => Math.max(maxId, item.id || 0), 0) + 1;
}

function getNextStudentId(classItem) {
    return classItem.students.reduce((maxId, student) => Math.max(maxId, student.id || 0), 0) + 1;
}

function getNextCourseId(classItem) {
    if (!classItem.courses.length) return 1;
    return Math.max(...classItem.courses.map(course => course.id || 0)) + 1;
}

function parseCoursesInput(inputValue) {
    return inputValue.split(',').map(item => item.trim()).filter(Boolean);
}

function setLoading(isLoading) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('hidden', !isLoading);
    }
}

function onDataReady() {
    isDataReady = true;
    setLoading(false);
    showAppShell();
    refreshActiveScreen();
}

function showAppShell() {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('configErrorScreen')?.classList.add('hidden');
    document.getElementById('appShell')?.classList.remove('hidden');
}

function showLoginScreen() {
    isDataReady = false;
    setLoading(false);
    document.getElementById('appShell')?.classList.add('hidden');
    document.getElementById('configErrorScreen')?.classList.add('hidden');
    document.getElementById('loginScreen')?.classList.remove('hidden');
}

function showConfigError(message) {
    isDataReady = false;
    setLoading(false);
    document.getElementById('appShell')?.classList.add('hidden');
    document.getElementById('loginScreen')?.classList.add('hidden');
    const screen = document.getElementById('configErrorScreen');
    const messageEl = document.getElementById('configErrorMessage');
    if (messageEl) messageEl.textContent = message;
    screen?.classList.remove('hidden');
}

function updateSyncStatus(status) {
    const badge = document.getElementById('syncStatus');
    if (!badge) return;

    badge.className = `sync-status sync-${status}`;
    const labels = {
        loading: 'Yükleniyor...',
        synced: 'Bulut ile senkron',
        saving: 'Kaydediliyor...',
        error: 'Senkron hatası'
    };
    badge.textContent = labels[status] || status;
}

function refreshActiveScreen() {
    if (!isDataReady || !systemData) return;

    if (document.getElementById('teachersScreen')?.classList.contains('active')) {
        renderTeachers();
    } else if (document.getElementById('classesScreen')?.classList.contains('active')) {
        renderClasses();
    } else if (document.getElementById('classDetailsScreen')?.classList.contains('active') && currentEditState.classId) {
        showClassDetails(currentEditState.classId);
    } else if (document.getElementById('homeScreen')?.classList.contains('active')) {
        showHome();
    }
}

// ===== Firebase =====

function isPlaceholderConfig(config) {
    if (!config?.apiKey) return true;
    const placeholders = ['YOUR_API_KEY', 'YOUR_PROJECT_ID', 'YOUR_APP_ID'];
    return placeholders.some(value =>
        Object.values(config).some(entry => String(entry).includes(value))
    );
}

function getFirebaseConfig() {
    if (window.firebaseConfig?.apiKey && !isPlaceholderConfig(window.firebaseConfig)) {
        return window.firebaseConfig;
    }

    if (window.env?.FIREBASE_API_KEY) {
        return {
            apiKey: window.env.FIREBASE_API_KEY,
            authDomain: window.env.FIREBASE_AUTH_DOMAIN,
            projectId: window.env.FIREBASE_PROJECT_ID,
            storageBucket: window.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: window.env.FIREBASE_APP_ID
        };
    }

    return window.firebaseConfig || null;
}

function getFirebaseConfigError() {
    if (typeof firebase === 'undefined') {
        return 'Firebase SDK yüklenemedi. İnternet bağlantınızı kontrol edin.';
    }

    const config = getFirebaseConfig();
    if (!config) {
        return 'firebase-config.js dosyası bulunamadı. GitHub Actions deploy işleminin tamamlandığından emin olun.';
    }

    if (isPlaceholderConfig(config)) {
        return 'Firebase ayarları eksik. GitHub Repository Secrets değerlerini kontrol edip siteyi yeniden deploy edin.';
    }

    return 'Firebase başlatılamadı. Tarayıcı konsolundaki hatayı kontrol edin.';
}

function initFirebase() {
    const config = getFirebaseConfig();
    if (isPlaceholderConfig(config) || typeof firebase === 'undefined') {
        return false;
    }

    window.firebaseConfig = config;

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        return true;
    } catch (error) {
        console.error('Firebase başlatılamadı:', error);
        db = null;
        auth = null;
        return false;
    }
}

function subscribeToFirestore() {
    if (!db) return;

    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }

    updateSyncStatus('loading');

    firestoreUnsubscribe = db.collection('appData').doc('system').onSnapshot(async (doc) => {
        if (doc.exists) {
            systemData = normalizeData(doc.data());
            updateSyncStatus('synced');
            if (!isDataReady) {
                onDataReady();
            } else {
                refreshActiveScreen();
            }
            return;
        }

        try {
            systemData = await loadFromJsonFile();
            await db.collection('appData').doc('system').set({
                ...systemData,
                seededAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('İlk veriler buluta aktarıldı.', 'success');
        } catch (error) {
            console.error('İlk veri aktarım hatası:', error);
            systemData = normalizeData({ teachers: [], classes: [] });
            showToast('Başlangıç verileri yüklenemedi.', 'warning');
            if (!isDataReady) onDataReady();
        }
    }, (error) => {
        console.error('Firestore dinleme hatası:', error);
        updateSyncStatus('error');
        showToast('Veriler yüklenemedi. İnternet bağlantınızı kontrol edin.', 'error');
        setLoading(false);
    });
}

async function saveSystemData() {
    if (!db || !systemData || isSaving) return;

    isSaving = true;
    updateSyncStatus('saving');

    try {
        await db.collection('appData').doc('system').set({
            ...systemData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateSyncStatus('synced');
    } catch (error) {
        console.error('Firestore kaydetme hatası:', error);
        updateSyncStatus('error');
        showToast('Kaydetme başarısız: ' + error.message, 'error');
    } finally {
        isSaving = false;
    }
}

async function loadFromJsonFile() {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('data.json yüklenemedi');
    const data = await response.json();
    return normalizeData(data);
}

function initAuth() {
    if (!auth) return;

    auth.onAuthStateChanged((user) => {
        currentUser = user;

        if (!user) {
            if (firestoreUnsubscribe) {
                firestoreUnsubscribe();
                firestoreUnsubscribe = null;
            }
            systemData = null;
            isDataReady = false;
            showLoginScreen();
            return;
        }

        setLoading(true);
        showAppShell();
        subscribeToFirestore();
    });
}

async function signIn() {
    if (!auth) return;

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('E-posta ve şifre zorunludur.', 'error');
        return;
    }

    setLoading(true);

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Giriş başarılı.');
    } catch (error) {
        setLoading(false);
        const messages = {
            'auth/invalid-credential': 'E-posta veya şifre hatalı.',
            'auth/user-not-found': 'Bu e-posta ile kayıtlı kullanıcı yok.',
            'auth/wrong-password': 'Şifre hatalı.',
            'auth/too-many-requests': 'Çok fazla deneme. Lütfen biraz bekleyin.'
        };
        showToast(messages[error.code] || 'Giriş yapılamadı.', 'error');
    }
}

async function signOutUser() {
    if (!auth) return;
    if (!confirmAction('Çıkış yapmak istediğinize emin misiniz?')) return;

    try {
        await auth.signOut();
        showHome();
        showToast('Çıkış yapıldı.');
    } catch (error) {
        showToast('Çıkış yapılamadı.', 'error');
    }
}

function bootstrapApp() {
    if (!initFirebase()) {
        showConfigError(getFirebaseConfigError());
        return;
    }

    initAuth();
}

document.addEventListener('DOMContentLoaded', () => {
    bootstrapApp();
});

// ===== Arama =====

function filterTeachers(teachers) {
    const query = teacherSearchQuery.trim().toLowerCase();
    if (!query) return teachers;

    return teachers.filter(teacher => {
        const haystack = [
            teacher.name,
            teacher.subject,
            ...(teacher.courses || [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
}

function filterClasses(classes) {
    const query = classSearchQuery.trim().toLowerCase();
    if (!query) return classes;

    return classes.filter(classItem => {
        const haystack = [
            classItem.name,
            classItem.code,
            ...classItem.students.map(student => `${student.name} ${student.room}`)
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
}

function onTeacherSearch(value) {
    teacherSearchQuery = value;
    renderTeachers();
}

function onClassSearch(value) {
    classSearchQuery = value;
    renderClasses();
}

// ===== Hoca İşlemleri =====

function toggleTeacherAddForm() {
    document.getElementById('teacherAddForm').classList.toggle('hidden');
}

function saveNewTeacher() {
    if (!systemData) return;

    const name = document.getElementById('newTeacherName').value.trim();
    const subject = document.getElementById('newTeacherSubject').value.trim();
    const courses = parseCoursesInput(document.getElementById('newTeacherCourses').value);

    if (!name || !subject) {
        showToast('Ad soyad ve bölüm alanları zorunludur.', 'error');
        return;
    }

    systemData.teachers.push({
        id: getNextId(systemData.teachers),
        name,
        subject,
        courses
    });

    renderTeachers();
    cancelTeacherAdd();
    saveSystemData();
    showToast('Ders hocası başarıyla eklendi.');
}

function cancelTeacherAdd() {
    document.getElementById('teacherAddForm').classList.add('hidden');
    document.getElementById('newTeacherName').value = '';
    document.getElementById('newTeacherSubject').value = '';
    document.getElementById('newTeacherCourses').value = '';
}

function deleteTeacher(teacherId) {
    if (!systemData) return;
    const teacher = systemData.teachers.find(item => item.id === teacherId);
    if (!teacher) return;

    if (!confirmAction(`"${teacher.name}" ders hocasını silmek istediğinize emin misiniz?`)) return;

    systemData.teachers = systemData.teachers.filter(item => item.id !== teacherId);
    renderTeachers();
    saveSystemData();
    showToast('Ders hocası silindi.');
}

function toggleTeacherEdit(teacherId) {
    const form = document.getElementById(`teacherEditForm-${teacherId}`);
    const button = document.getElementById(`teacherEditBtn-${teacherId}`);
    if (!form || !button) return;

    const isHidden = form.classList.contains('hidden');
    form.classList.toggle('hidden', !isHidden);
    button.textContent = isHidden ? '✖️ İptal' : '✏️ Düzenle';
}

function saveTeacherChanges(teacherId) {
    const teacher = systemData?.teachers.find(item => item.id === teacherId);
    if (!teacher) return;

    const nameInput = document.getElementById(`teacherNameInput-${teacherId}`);
    const subjectInput = document.getElementById(`teacherSubjectInput-${teacherId}`);
    const coursesInput = document.getElementById(`teacherCoursesInput-${teacherId}`);
    if (!nameInput || !subjectInput || !coursesInput) return;

    const name = nameInput.value.trim();
    const subject = subjectInput.value.trim();
    if (!name || !subject) {
        showToast('Ad soyad ve bölüm alanları boş bırakılamaz.', 'error');
        return;
    }

    teacher.name = name;
    teacher.subject = subject;
    teacher.courses = parseCoursesInput(coursesInput.value);

    renderTeachers();
    saveSystemData();
    showToast('Ders hocası bilgileri güncellendi.');
}

function cancelTeacherEdit(teacherId) {
    const form = document.getElementById(`teacherEditForm-${teacherId}`);
    const button = document.getElementById(`teacherEditBtn-${teacherId}`);
    if (!form || !button) return;

    form.classList.add('hidden');
    button.textContent = '✏️ Düzenle';
}

// ===== Sınıf İşlemleri =====

function toggleClassAddForm() {
    document.getElementById('classAddForm').classList.toggle('hidden');
}

function saveNewClass() {
    if (!systemData) return;

    const name = document.getElementById('newClassName').value.trim();
    const code = document.getElementById('newClassCode').value.trim();

    if (!name || !code) {
        showToast('Sınıf adı ve kodu zorunludur.', 'error');
        return;
    }

    if (systemData.classes.some(item => item.code.toLowerCase() === code.toLowerCase())) {
        showToast('Bu sınıf kodu zaten kullanılıyor.', 'error');
        return;
    }

    systemData.classes.push({
        id: getNextId(systemData.classes),
        name,
        code,
        courses: [],
        students: []
    });

    renderClasses();
    cancelClassAdd();
    saveSystemData();
    showToast('Sınıf başarıyla eklendi.');
}

function cancelClassAdd() {
    document.getElementById('classAddForm').classList.add('hidden');
    document.getElementById('newClassName').value = '';
    document.getElementById('newClassCode').value = '';
}

function deleteClass(classId) {
    if (!systemData) return;
    const classItem = systemData.classes.find(item => item.id === classId);
    if (!classItem) return;

    if (!confirmAction(`"${classItem.name}" sınıfını ve tüm öğrenci/ders kayıtlarını silmek istediğinize emin misiniz?`)) return;

    systemData.classes = systemData.classes.filter(item => item.id !== classId);
    renderClasses();
    saveSystemData();
    showToast('Sınıf silindi.');
}

function toggleClassEditMode() {
    const form = document.getElementById('classEditForm');
    const btn = document.getElementById('editClassBtn');
    if (!form || !btn) return;

    if (form.classList.contains('hidden')) {
        startClassEdit();
        btn.textContent = '✖️ İptal';
    } else {
        cancelClassEdit();
    }
}

function startClassEdit() {
    if (!systemData || !currentEditState.classId) return;
    const classItem = systemData.classes.find(item => item.id === currentEditState.classId);
    if (!classItem) return;

    document.getElementById('editClassName').value = classItem.name;
    document.getElementById('editClassCode').value = classItem.code;
    document.getElementById('classEditForm').classList.remove('hidden');
    currentEditState.isEditingClass = true;
}

function saveClassChanges() {
    if (!systemData || !currentEditState.classId) return;
    const classItem = systemData.classes.find(item => item.id === currentEditState.classId);
    if (!classItem) return;

    const name = document.getElementById('editClassName').value.trim();
    const code = document.getElementById('editClassCode').value.trim();

    if (!name || !code) {
        showToast('Sınıf adı ve kodu boş bırakılamaz.', 'error');
        return;
    }

    const duplicate = systemData.classes.find(
        item => item.id !== classItem.id && item.code.toLowerCase() === code.toLowerCase()
    );
    if (duplicate) {
        showToast('Bu sınıf kodu başka bir sınıfta kullanılıyor.', 'error');
        return;
    }

    classItem.name = name;
    classItem.code = code;

    renderClasses();
    saveSystemData();
    showClassDetails(currentEditState.classId);
    showToast('Sınıf bilgileri güncellendi.');
}

function cancelClassEdit() {
    document.getElementById('classEditForm').classList.add('hidden');
    const btn = document.getElementById('editClassBtn');
    if (btn) btn.textContent = '✏️ Sınıfı Düzenle';
    currentEditState.isEditingClass = false;
}

// ===== Ders İşlemleri =====

function toggleCourseAddForm() {
    document.getElementById('courseAddForm')?.classList.toggle('hidden');
}

function saveNewCourse() {
    if (!systemData || !currentEditState.classId) return;
    const classItem = systemData.classes.find(item => item.id === currentEditState.classId);
    if (!classItem) return;

    const name = document.getElementById('newCourseName').value.trim();
    const teacher = document.getElementById('newCourseTeacher').value.trim();
    const book = document.getElementById('newCourseBook').value.trim();
    const totalPages = parseInt(document.getElementById('newCoursePages').value, 10);
    const description = document.getElementById('newCourseDescription').value.trim();

    if (!name || !teacher || !book || !totalPages || totalPages <= 0) {
        showToast('Ders adı, öğretmen, kitap ve geçerli sayfa sayısı zorunludur.', 'error');
        return;
    }

    classItem.courses.push({
        id: getNextCourseId(classItem),
        name,
        teacher,
        book,
        totalPages,
        currentPage: 0,
        description
    });

    cancelCourseAdd();
    saveSystemData();
    showClassDetails(classItem.id);
    showToast('Ders eklendi.');
}

function cancelCourseAdd() {
    const form = document.getElementById('courseAddForm');
    if (!form) return;

    form.classList.add('hidden');
    document.getElementById('newCourseName').value = '';
    document.getElementById('newCourseTeacher').value = '';
    document.getElementById('newCourseBook').value = '';
    document.getElementById('newCoursePages').value = '';
    document.getElementById('newCourseDescription').value = '';
}

function deleteCourse(classId, courseId) {
    if (!systemData) return;
    const classItem = systemData.classes.find(item => item.id === classId);
    const course = classItem?.courses.find(item => item.id === courseId);
    if (!classItem || !course) return;

    if (!confirmAction(`"${course.name}" dersini silmek istediğinize emin misiniz?`)) return;

    classItem.courses = classItem.courses.filter(item => item.id !== courseId);
    saveSystemData();
    showClassDetails(classId);
    showToast('Ders silindi.');
}

function toggleCourseEditMode(courseId) {
    document.getElementById(`courseEditForm-${courseId}`)?.classList.toggle('hidden');
}

function saveCourseProg(classId, courseId) {
    if (!systemData) return;
    const classItem = systemData.classes.find(item => item.id === classId);
    const course = classItem?.courses.find(item => item.id === courseId);
    if (!course) return;

    const currentPageInput = document.getElementById(`courseCurrentPage-${courseId}`);
    const descriptionInput = document.getElementById(`courseDescription-${courseId}`);

    const currentPage = parseInt(currentPageInput?.value, 10);
    if (Number.isNaN(currentPage) || currentPage < 0 || currentPage > course.totalPages) {
        showToast(`Sayfa 0 ile ${course.totalPages} arasında olmalıdır.`, 'error');
        return;
    }

    course.currentPage = currentPage;
    if (descriptionInput) {
        course.description = descriptionInput.value.trim();
    }

    saveSystemData();
    showClassDetails(classId);
    showToast('Ders ilerlemesi güncellendi.');
}

// ===== Öğrenci İşlemleri =====

function toggleStudentAddForm() {
    document.getElementById('studentAddForm')?.classList.toggle('hidden');
}

function saveNewStudent() {
    if (!systemData || !currentEditState.classId) return;
    const classItem = systemData.classes.find(item => item.id === currentEditState.classId);
    if (!classItem) return;

    const name = document.getElementById('newStudentName').value.trim();
    const room = document.getElementById('newStudentRoom').value.trim();

    if (!name || !room) {
        showToast('Öğrenci adı ve oda bilgisi zorunludur.', 'error');
        return;
    }

    classItem.students.push({
        id: getNextStudentId(classItem),
        name,
        room
    });

    cancelStudentAdd();
    saveSystemData();
    showClassDetails(classItem.id);
    showToast('Öğrenci eklendi.');
}

function cancelStudentAdd() {
    const form = document.getElementById('studentAddForm');
    if (!form) return;

    form.classList.add('hidden');
    document.getElementById('newStudentName').value = '';
    document.getElementById('newStudentRoom').value = '';
}

function deleteStudent(classId, studentId) {
    if (!systemData) return;
    const classItem = systemData.classes.find(item => item.id === classId);
    const student = classItem?.students.find(item => item.id === studentId);
    if (!classItem || !student) return;

    if (!confirmAction(`"${student.name}" öğrencisini silmek istediğinize emin misiniz?`)) return;

    classItem.students = classItem.students.filter(item => item.id !== studentId);
    closeModal();
    saveSystemData();
    showClassDetails(classId);
    showToast('Öğrenci silindi.');
}

function toggleEditMode() {
    if (currentEditState.isEditingStudent) {
        cancelEditMode();
    } else {
        startStudentEdit();
    }
}

function startStudentEdit() {
    if (!systemData || !currentEditState.studentId || !currentEditState.classId) return;

    const classItem = systemData.classes.find(item => item.id === currentEditState.classId);
    const student = classItem?.students.find(item => item.id === currentEditState.studentId);
    if (!student) return;

    document.getElementById('studentNameInput').value = student.name;
    document.getElementById('studentRoomInput').value = student.room;
    document.getElementById('studentEditForm').classList.remove('hidden');
    document.getElementById('studentModal').querySelector('.edit-btn').textContent = '✖️ İptal';
    currentEditState.isEditingStudent = true;
}

function saveStudentChanges() {
    if (!systemData || !currentEditState.studentId || !currentEditState.classId) return;

    const classItem = systemData.classes.find(item => item.id === currentEditState.classId);
    const student = classItem?.students.find(item => item.id === currentEditState.studentId);
    if (!student) return;

    const name = document.getElementById('studentNameInput').value.trim();
    const room = document.getElementById('studentRoomInput').value.trim();

    if (!name || !room) {
        showToast('Öğrenci adı ve oda bilgisi boş bırakılamaz.', 'error');
        return;
    }

    student.name = name;
    student.room = room;

    saveSystemData();
    showStudentDetails(student, classItem.name, classItem.id);
    showClassDetails(classItem.id);
    showToast('Öğrenci bilgileri güncellendi.');
}

function cancelEditMode() {
    document.getElementById('studentEditForm').classList.add('hidden');
    document.getElementById('studentModal').querySelector('.edit-btn').textContent = '✏️ Düzenle';
    currentEditState.isEditingStudent = false;
}

// ===== Navigasyon =====

function showHome() {
    if (!isDataReady) return;
    hideAllScreens();
    document.getElementById('homeScreen').classList.add('active');
}

function showTeachers() {
    if (!systemData) return;
    hideAllScreens();
    renderTeachers();
    document.getElementById('teachersScreen').classList.add('active');
}

function showClasses() {
    if (!systemData) return;
    hideAllScreens();
    renderClasses();
    document.getElementById('classesScreen').classList.add('active');
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
}

// ===== Render =====

function renderTeachers() {
    if (!systemData) return;

    const teachersList = document.getElementById('teachersList');
    teachersList.innerHTML = '';

    const teachers = filterTeachers(systemData.teachers);
    if (!teachers.length) {
        teachersList.innerHTML = '<p class="empty-message">Kayıtlı ders hocası bulunamadı.</p>';
        return;
    }

    teachers.forEach(teacher => {
        const card = document.createElement('div');
        card.className = 'teacher-card';

        const coursesHTML = (teacher.courses || [])
            .map(course => `<span class="course-item">${escapeHtml(course)}</span>`)
            .join('');

        card.innerHTML = `
            <div class="teacher-card-header">
                <h3>👨‍🏫 ${escapeHtml(teacher.name)}</h3>
                <div class="card-actions">
                    <button id="teacherEditBtn-${teacher.id}" class="edit-btn small" onclick="toggleTeacherEdit(${teacher.id})">✏️ Düzenle</button>
                    <button class="delete-btn small" onclick="deleteTeacher(${teacher.id})">🗑️ Sil</button>
                </div>
            </div>
            <p><strong>Bölüm:</strong> ${escapeHtml(teacher.subject)}</p>
            <div class="info-group">
                <p><strong>Verdiği Dersler:</strong></p>
                <div class="courses-list">${coursesHTML || '<span class="empty-inline">Ders eklenmemiş</span>'}</div>
            </div>
            <div id="teacherEditForm-${teacher.id}" class="edit-form hidden">
                <div class="form-row">
                    <label for="teacherNameInput-${teacher.id}">Ad Soyad</label>
                    <input id="teacherNameInput-${teacher.id}" type="text" value="${escapeHtml(teacher.name)}" />
                </div>
                <div class="form-row">
                    <label for="teacherSubjectInput-${teacher.id}">Bölüm</label>
                    <input id="teacherSubjectInput-${teacher.id}" type="text" value="${escapeHtml(teacher.subject)}" />
                </div>
                <div class="form-row">
                    <label for="teacherCoursesInput-${teacher.id}">Dersler</label>
                    <input id="teacherCoursesInput-${teacher.id}" type="text" value="${escapeHtml((teacher.courses || []).join(', '))}" />
                    <small>Dersleri virgülle ayırın.</small>
                </div>
                <div class="button-row">
                    <button class="save-btn" onclick="saveTeacherChanges(${teacher.id})">Kaydet</button>
                    <button class="cancel-btn" onclick="cancelTeacherEdit(${teacher.id})">Vazgeç</button>
                </div>
            </div>
        `;

        teachersList.appendChild(card);
    });
}

function renderClasses() {
    if (!systemData) return;

    const classesList = document.getElementById('classesList');
    classesList.innerHTML = '';

    const classes = filterClasses(systemData.classes);
    if (!classes.length) {
        classesList.innerHTML = '<p class="empty-message">Kayıtlı sınıf bulunamadı.</p>';
        return;
    }

    classes.forEach(classItem => {
        const card = document.createElement('div');
        card.className = 'class-card';
        const studentCount = classItem.students.length;
        const courseCount = classItem.courses.length;

        card.innerHTML = `
            <div class="class-card-top">
                <h3>${escapeHtml(classItem.name)}</h3>
                <button class="delete-btn small icon-only" title="Sınıfı sil" onclick="event.stopPropagation(); deleteClass(${classItem.id})">🗑️</button>
            </div>
            <p class="class-code">${escapeHtml(classItem.code)}</p>
            <div class="class-stats">
                <span>${studentCount} öğrenci</span>
                <span>${courseCount} ders</span>
            </div>
        `;

        card.onclick = () => showClassDetails(classItem.id);
        classesList.appendChild(card);
    });
}

function renderCourseCard(course, classId) {
    const progress = course.totalPages > 0
        ? Math.round((course.currentPage / course.totalPages) * 100)
        : 0;

    const card = document.createElement('div');
    card.className = 'course-card';
    card.innerHTML = `
        <div class="course-card-header">
            <div class="course-card-main">
                <h4>📖 ${escapeHtml(course.name)}</h4>
                <div class="course-meta">
                    <p><strong>👨‍🏫 Hoca:</strong> ${escapeHtml(course.teacher)}</p>
                    <p><strong>📕 Kitap:</strong> ${escapeHtml(course.book)}</p>
                    <p><strong>📄 İlerleme:</strong> ${course.currentPage} / ${course.totalPages} sayfa (%${progress})</p>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <p class="course-description"><strong>📝 Açıklama:</strong> ${escapeHtml(course.description || '—')}</p>
            </div>
            <div class="card-actions vertical">
                <button class="edit-btn small" onclick="toggleCourseEditMode(${course.id})">✏️ Düzenle</button>
                <button class="delete-btn small" onclick="deleteCourse(${classId}, ${course.id})">🗑️ Sil</button>
            </div>
        </div>
        <div id="courseEditForm-${course.id}" class="edit-form hidden">
            <div class="form-row">
                <label for="courseCurrentPage-${course.id}">Şu anki Sayfa</label>
                <input id="courseCurrentPage-${course.id}" type="number" value="${course.currentPage}" min="0" max="${course.totalPages}" />
            </div>
            <div class="form-row">
                <label for="courseDescription-${course.id}">Açıklama</label>
                <textarea id="courseDescription-${course.id}">${escapeHtml(course.description || '')}</textarea>
            </div>
            <div class="button-row">
                <button class="save-btn" onclick="saveCourseProg(${classId}, ${course.id})">Kaydet</button>
                <button class="cancel-btn" onclick="toggleCourseEditMode(${course.id})">Vazgeç</button>
            </div>
        </div>
    `;
    return card;
}

function showClassDetails(classId) {
    if (!systemData) return;

    const classItem = systemData.classes.find(item => item.id === classId);
    if (!classItem) return;

    currentEditState.classId = classId;
    currentEditState.studentId = null;

    hideAllScreens();

    document.getElementById('classDetailsTitle').textContent = `${classItem.name} Sınıfı`;
    document.getElementById('classEditForm').classList.add('hidden');
    const classEditBtn = document.getElementById('editClassBtn');
    if (classEditBtn) classEditBtn.textContent = '✏️ Sınıfı Düzenle';
    currentEditState.isEditingClass = false;

    const studentsList = document.getElementById('studentsList');
    studentsList.innerHTML = '';

    const coursesSection = document.createElement('section');
    coursesSection.className = 'detail-section';
    coursesSection.innerHTML = `
        <h3>📚 Sınıf Dersleri</h3>
        <div class="section-actions">
            <button class="edit-btn small" onclick="toggleCourseAddForm()">+ Yeni Ders Ekle</button>
        </div>
        <div id="courseAddForm" class="edit-form hidden">
            <div class="form-row">
                <label for="newCourseName">Ders Adı</label>
                <input id="newCourseName" type="text" />
            </div>
            <div class="form-row">
                <label for="newCourseTeacher">Öğretmen Adı</label>
                <input id="newCourseTeacher" type="text" list="teacherSuggestions" />
            </div>
            <div class="form-row">
                <label for="newCourseBook">Ders Kitabı</label>
                <input id="newCourseBook" type="text" />
            </div>
            <div class="form-row">
                <label for="newCoursePages">Toplam Sayfa Sayısı</label>
                <input id="newCoursePages" type="number" min="1" />
            </div>
            <div class="form-row">
                <label for="newCourseDescription">Açıklama</label>
                <textarea id="newCourseDescription"></textarea>
            </div>
            <div class="button-row">
                <button class="save-btn" onclick="saveNewCourse()">Kaydet</button>
                <button class="cancel-btn" onclick="cancelCourseAdd()">Vazgeç</button>
            </div>
        </div>
    `;

    const courseList = document.createElement('div');
    courseList.className = 'course-list';

    if (classItem.courses.length) {
        classItem.courses.forEach(course => {
            courseList.appendChild(renderCourseCard(course, classId));
        });
    } else {
        courseList.innerHTML = '<p class="empty-message">Henüz ders eklenmemiş.</p>';
    }

    coursesSection.appendChild(courseList);
    studentsList.appendChild(coursesSection);

    const studentsSection = document.createElement('section');
    studentsSection.className = 'detail-section';
    studentsSection.innerHTML = `
        <h3>👥 Sınıf Öğrencileri</h3>
        <div class="section-actions">
            <button class="edit-btn small" onclick="toggleStudentAddForm()">+ Yeni Öğrenci Ekle</button>
        </div>
        <div id="studentAddForm" class="edit-form hidden">
            <div class="form-row">
                <label for="newStudentName">Öğrenci Adı</label>
                <input id="newStudentName" type="text" />
            </div>
            <div class="form-row">
                <label for="newStudentRoom">Koğuş / Oda</label>
                <input id="newStudentRoom" type="text" />
            </div>
            <div class="button-row">
                <button class="save-btn" onclick="saveNewStudent()">Kaydet</button>
                <button class="cancel-btn" onclick="toggleStudentAddForm()">Vazgeç</button>
            </div>
        </div>
    `;

    const studentsGrid = document.createElement('div');
    studentsGrid.className = 'students-grid';

    if (classItem.students.length) {
        classItem.students.forEach(student => {
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <h4>👤 ${escapeHtml(student.name)}</h4>
                <p>📍 ${escapeHtml(student.room)}</p>
            `;
            card.onclick = () => showStudentDetails(student, classItem.name, classItem.id);
            studentsGrid.appendChild(card);
        });
    } else {
        studentsGrid.innerHTML = '<p class="empty-message">Henüz öğrenci eklenmemiş.</p>';
    }

    studentsSection.appendChild(studentsGrid);
    studentsList.appendChild(studentsSection);

    updateTeacherSuggestions();
    document.getElementById('classDetailsScreen').classList.add('active');
}

function updateTeacherSuggestions() {
    const datalist = document.getElementById('teacherSuggestions');
    if (!datalist || !systemData) return;

    datalist.innerHTML = systemData.teachers
        .map(teacher => `<option value="${escapeHtml(teacher.name)}"></option>`)
        .join('');
}

function showStudentDetails(student, className, classId) {
    if (!systemData) return;

    currentEditState.classId = classId;
    currentEditState.studentId = student.id;

    const classItem = systemData.classes.find(item => item.id === classId);

    document.getElementById('studentName').textContent = `${student.name} - ${className}`;
    document.getElementById('studentLocation').innerHTML = `
        <strong>📍 Yurt Koğuşu:</strong> ${escapeHtml(student.room)}
    `;

    const coursesContainer = document.getElementById('studentCourses');
    if (classItem?.courses?.length) {
        coursesContainer.innerHTML = `
            <div class="info-group">
                <h3>📚 Sınıf Dersleri</h3>
                ${classItem.courses.map(course => `
                    <div class="course-details">
                        <div class="course-name">${escapeHtml(course.name)}</div>
                        <div class="course-teacher">👨‍🏫 ${escapeHtml(course.teacher)} · 📕 ${escapeHtml(course.book)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        coursesContainer.innerHTML = '<p class="empty-message">Bu sınıfa henüz ders eklenmemiş.</p>';
    }

    document.getElementById('studentEditForm').classList.add('hidden');
    document.getElementById('studentModal').querySelector('.edit-btn').textContent = '✏️ Düzenle';
    document.getElementById('deleteStudentBtn').onclick = () => deleteStudent(classId, student.id);
    currentEditState.isEditingStudent = false;

    document.getElementById('studentModal').classList.add('show');
}

function closeModal() {
    document.getElementById('studentModal').classList.remove('show');
}

window.onclick = function (event) {
    const modal = document.getElementById('studentModal');
    if (event.target === modal) {
        closeModal();
    }
};
