// ==================== ESTADO DE LA APLICACIÓN ====================
const AppState = {
    currentSection: 'inicio',
    currentSubject: null,
    scheduleAutoSaveTimeout: null
};

// ==================== CLASES Y ESTRUCTURAS ====================

/**
 * Gestiona el almacenamiento de datos en localStorage
 */
class StorageManager {
    static KEYS = {
        SCHEDULE: 'schedule',
        SUBJECTS: 'subjects',
        TASKS: 'tasks'
    };

    static get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    }

    static set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error writing to storage:', error);
            if (error.name === 'QuotaExceededError') {
                alert('Storage limit exceeded. Please delete some images or content.');
            }
        }
    }

    static remove(key) {
        localStorage.removeItem(key);
    }

    static getOrDefault(key, defaultValue) {
        return this.get(key) ?? defaultValue;
    }
}

/**
 * Gestiona las asignaturas y apuntes
 */
class SubjectManager {
    static createSubject(name) {
        return {
            id: Date.now(),
            name: name,
            notes: '',
            images: [] // Array de base64 strings
        };
    }

    static getAllSubjects() {
        return StorageManager.getOrDefault(StorageManager.KEYS.SUBJECTS, []);
    }

    static addSubject(subject) {
        const subjects = this.getAllSubjects();
        subjects.push(subject);
        StorageManager.set(StorageManager.KEYS.SUBJECTS, subjects);
        return subject;
    }

    static updateSubject(subjectId, updates) {
        const subjects = this.getAllSubjects();
        const index = subjects.findIndex(s => s.id === subjectId);
        if (index !== -1) {
            subjects[index] = { ...subjects[index], ...updates };
            StorageManager.set(StorageManager.KEYS.SUBJECTS, subjects);
            return subjects[index];
        }
        return null;
    }

    static deleteSubject(subjectId) {
        const subjects = this.getAllSubjects();
        const filtered = subjects.filter(s => s.id !== subjectId);
        StorageManager.set(StorageManager.KEYS.SUBJECTS, filtered);
    }

    static getSubject(subjectId) {
        const subjects = this.getAllSubjects();
        return subjects.find(s => s.id === subjectId);
    }

    static addImageToSubject(subjectId, base64Image) {
        const subject = this.getSubject(subjectId);
        if (subject) {
            subject.images.push({
                id: Date.now(),
                data: base64Image
            });
            this.updateSubject(subjectId, subject);
            return true;
        }
        return false;
    }

    static removeImageFromSubject(subjectId, imageId) {
        const subject = this.getSubject(subjectId);
        if (subject) {
            subject.images = subject.images.filter(img => img.id !== imageId);
            this.updateSubject(subjectId, subject);
            return true;
        }
        return false;
    }
}

/**
 * Gestiona las tareas
 */
class TaskManager {
    static createTask(text) {
        return {
            id: Date.now(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };
    }

    static getAllTasks() {
        return StorageManager.getOrDefault(StorageManager.KEYS.TASKS, []);
    }

    static addTask(task) {
        const tasks = this.getAllTasks();
        tasks.push(task);
        StorageManager.set(StorageManager.KEYS.TASKS, tasks);
        return task;
    }

    static toggleTask(taskId) {
        const tasks = this.getAllTasks();
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            StorageManager.set(StorageManager.KEYS.TASKS, tasks);
        }
    }

    static deleteTask(taskId) {
        const tasks = this.getAllTasks();
        const filtered = tasks.filter(t => t.id !== taskId);
        StorageManager.set(StorageManager.KEYS.TASKS, filtered);
    }
}

// ==================== FUNCIONES DE NAVEGACIÓN ====================

/**
 * Cambia entre secciones
 */
function navigateToSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Actualizar estado de navegación
    AppState.currentSection = sectionId;

    // Actualizar links activos
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });
}

/**
 * Inicializa los listeners de navegación
 */
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            navigateToSection(sectionId);
        });
    });
}

// ==================== FUNCIONES DE HORARIOS ====================

/**
 * Inicializa la sección de horarios
 */
function initSchedule() {
    const scheduleInput = document.getElementById('scheduleText');

    // Cargar horario guardado
    const savedSchedule = StorageManager.get(StorageManager.KEYS.SCHEDULE);
    if (savedSchedule) {
        scheduleInput.value = savedSchedule;
    }

    // Guardar automáticamente cada 2 segundos
    scheduleInput.addEventListener('input', () => {
        clearTimeout(AppState.scheduleAutoSaveTimeout);
        AppState.scheduleAutoSaveTimeout = setTimeout(() => {
            StorageManager.set(StorageManager.KEYS.SCHEDULE, scheduleInput.value);
        }, 2000);
    });
}

// ==================== FUNCIONES DE APUNTES ====================

/**
 * Renderiza las tarjetas de asignaturas
 */
function renderSubjects() {
    const grid = document.getElementById('subjectsGrid');
    grid.innerHTML = '';

    const subjects = SubjectManager.getAllSubjects();

    if (subjects.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No hay asignaturas aún. ¡Crea una para empezar!</p>';
        return;
    }

    subjects.forEach(subject => {
        const card = createSubjectCard(subject);
        grid.appendChild(card);
    });
}

/**
 * Crea una tarjeta de asignatura
 */
function createSubjectCard(subject) {
    const card = document.createElement('div');
    card.className = 'subject-card';

    // Preview del contenido
    let preview = '';
    if (subject.notes) {
        preview = subject.notes.substring(0, 100) + (subject.notes.length > 100 ? '...' : '');
    } else if (subject.images.length > 0) {
        preview = `${subject.images.length} imagen(es)`;
    } else {
        preview = 'Sin contenido aún';
    }

    card.innerHTML = `
        <div class="subject-card-header">
            <h3>${escapeHtml(subject.name)}</h3>
            <div class="subject-card-actions">
                <button class="btn-icon delete" data-id="${subject.id}" title="Eliminar">🗑️</button>
            </div>
        </div>
        <div class="subject-preview">${escapeHtml(preview)}</div>
    `;

    // Click en la tarjeta para editar (excepto en el botón delete)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-icon')) {
            openNotesModal(subject.id);
        }
    });

    // Botón eliminar
    card.querySelector('.btn-icon.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar la asignatura "${subject.name}"?`)) {
            SubjectManager.deleteSubject(subject.id);
            renderSubjects();
        }
    });

    return card;
}

/**
 * Abre el modal de edición de apuntes
 */
function openNotesModal(subjectId) {
    const subject = SubjectManager.getSubject(subjectId);
    if (!subject) return;

    AppState.currentSubject = subjectId;

    // Actualizar UI del modal
    document.getElementById('modalTitle').textContent = `Apuntes de ${subject.name}`;
    document.getElementById('notesText').value = subject.notes;

    // Cargar imágenes
    renderImagesInModal(subject.images);

    // Mostrar modal
    document.getElementById('notesModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

/**
 * Cierra el modal
 */
function closeNotesModal() {
    const subjectId = AppState.currentSubject;
    if (subjectId) {
        const notes = document.getElementById('notesText').value;
        SubjectManager.updateSubject(subjectId, { notes });
        renderSubjects();
    }

    document.getElementById('notesModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    AppState.currentSubject = null;
}

/**
 * Renderiza las imágenes en el modal
 */
function renderImagesInModal(images) {
    const list = document.getElementById('imagesList');
    list.innerHTML = '';

    if (images.length === 0) {
        list.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 1rem;">Sin imágenes aún</p>';
        return;
    }

    images.forEach(image => {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.innerHTML = `
            <img src="${image.data}" alt="Apunte">
            <button class="image-delete-btn" data-id="${image.id}">×</button>
        `;

        item.querySelector('.image-delete-btn').addEventListener('click', () => {
            if (AppState.currentSubject) {
                SubjectManager.removeImageFromSubject(AppState.currentSubject, image.id);
                renderImagesInModal(SubjectManager.getSubject(AppState.currentSubject).images);
            }
        });

        list.appendChild(item);
    });
}

/**
 * Maneja la subida de imágenes
 */
function handleImageUpload(files) {
    if (!AppState.currentSubject) return;

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            alert('Solo se permiten archivos de imagen');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            SubjectManager.addImageToSubject(AppState.currentSubject, base64);
            renderImagesInModal(SubjectManager.getSubject(AppState.currentSubject).images);
        };
        reader.readAsDataURL(file);
    });

    // Limpiar input
    document.getElementById('imageInput').value = '';
}

/**
 * Inicializa la sección de apuntes
 */
function initSubjects() {
    const subjectInput = document.getElementById('subjectInput');
    const addSubjectBtn = document.getElementById('addSubjectBtn');
    const imageInput = document.getElementById('imageInput');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const modalClose = document.querySelector('.modal-close');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const modalOverlay = document.getElementById('modalOverlay');

    // Agregar nueva asignatura
    addSubjectBtn.addEventListener('click', () => {
        const name = subjectInput.value.trim();
        if (!name) {
            alert('Por favor, ingresa el nombre de la asignatura');
            return;
        }

        const subject = SubjectManager.createSubject(name);
        SubjectManager.addSubject(subject);
        subjectInput.value = '';
        renderSubjects();
    });

    subjectInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addSubjectBtn.click();
        }
    });

    // Subir imágenes
    uploadImageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        handleImageUpload(e.target.files);
    });

    // Cerrar modal
    modalClose.addEventListener('click', closeNotesModal);
    modalCloseBtn.addEventListener('click', closeNotesModal);
    modalOverlay.addEventListener('click', closeNotesModal);

    // Evitar cerrar al hacer click en el contenido del modal
    document.getElementById('notesModal').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    renderSubjects();
}

// ==================== FUNCIONES DE ACTIVIDADES ====================

/**
 * Renderiza las tareas
 */
function renderTasks() {
    const list = document.getElementById('tasksList');
    list.innerHTML = '';

    const tasks = TaskManager.getAllTasks();

    if (tasks.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay tareas. ¡Crea una para empezar!</p>';
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.completed ? 'completed' : ''}`;
        item.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
            <span class="task-text">${escapeHtml(task.text)}</span>
            <div class="task-actions">
                <button class="btn-delete" data-id="${task.id}">Eliminar</button>
            </div>
        `;

        // Marcar como completada
        item.querySelector('.task-checkbox').addEventListener('change', () => {
            TaskManager.toggleTask(task.id);
            renderTasks();
        });

        // Eliminar tarea
        item.querySelector('.btn-delete').addEventListener('click', () => {
            TaskManager.deleteTask(task.id);
            renderTasks();
        });

        list.appendChild(item);
    });
}

/**
 * Inicializa la sección de actividades
 */
function initTasks() {
    const taskInput = document.getElementById('taskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');

    addTaskBtn.addEventListener('click', () => {
        const text = taskInput.value.trim();
        if (!text) {
            alert('Por favor, ingresa el texto de la tarea');
            return;
        }

        const task = TaskManager.createTask(text);
        TaskManager.addTask(task);
        taskInput.value = '';
        renderTasks();
    });

    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTaskBtn.click();
        }
    });

    renderTasks();
}

// ==================== FUNCIONES UTILITARIAS ====================

/**
 * Escapa caracteres HTML para evitar XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Inicializa toda la aplicación
 */
function initApp() {
    // Inicializar navegación
    initNavigation();

    // Inicializar secciones
    initSchedule();
    initSubjects();
    initTasks();

    // Navegar a la sección de inicio por defecto
    navigateToSection('inicio');
}

// ==================== PUNTO DE ENTRADA ====================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);

// Manejar cambios en otras pestañas (sincronización)
window.addEventListener('storage', () => {
    if (AppState.currentSection === 'apuntes') {
        renderSubjects();
    } else if (AppState.currentSection === 'actividades') {
        renderTasks();
    }
});