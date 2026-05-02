name=script.js
// ==================== ESTADO DE LA APLICACIÓN ====================
const AppState = {
    currentSection: 'inicio',
    currentSubject: null,
    currentFolder: null,
    scheduleAutoSaveTimeout: null,
    darkMode: false,
    imageViewerData: null
};

// ==================== CLASES Y ESTRUCTURAS ====================

/**
 * Gestiona el almacenamiento de datos en localStorage
 */
class StorageManager {
    static KEYS = {
        SCHEDULE: 'schedule',
        SUBJECTS: 'subjects',
        TASKS: 'tasks',
        DARK_MODE: 'darkMode'
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
                alert('Espacio de almacenamiento lleno. Elimina algunas imágenes.');
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
 * Utilidad para debounce en funciones
 */
class DebounceManager {
    static timers = {};

    static debounce(key, fn, delay = 1000) {
        if (this.timers[key]) {
            clearTimeout(this.timers[key]);
        }
        this.timers[key] = setTimeout(fn, delay);
    }

    static clear(key) {
        if (this.timers[key]) {
            clearTimeout(this.timers[key]);
            delete this.timers[key];
        }
    }
}

/**
 * Gestiona las asignaturas y carpetas con apuntes
 */
class SubjectManager {
    static createSubject(name) {
        return {
            id: Date.now(),
            name: name,
            folders: []
        };
    }

    static createFolder(name) {
        return {
            id: Date.now(),
            name: name,
            notes: '',
            images: []
        };
    }

    static migrateOldData() {
        const subjects = StorageManager.get(StorageManager.KEYS.SUBJECTS);
        if (subjects && subjects.length > 0) {
            const firstSubject = subjects[0];
            if (!firstSubject.folders) {
                subjects.forEach(subject => {
                    if (!subject.folders) {
                        const folder = {
                            id: Date.now() + Math.random(),
                            name: 'Apuntes',
                            notes: subject.notes || '',
                            images: subject.images || []
                        };
                        subject.folders = [folder];
                        delete subject.notes;
                        delete subject.images;
                    }
                });
                StorageManager.set(StorageManager.KEYS.SUBJECTS, subjects);
            }
        }
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

    static addFolder(subjectId, folder) {
        const subject = this.getSubject(subjectId);
        if (subject) {
            subject.folders.push(folder);
            this.updateSubject(subjectId, subject);
            return true;
        }
        return false;
    }

    static getFolder(subjectId, folderId) {
        const subject = this.getSubject(subjectId);
        if (subject) {
            return subject.folders.find(f => f.id === folderId);
        }
        return null;
    }

    static updateFolder(subjectId, folderId, updates) {
        const subject = this.getSubject(subjectId);
        if (subject) {
            const folderIndex = subject.folders.findIndex(f => f.id === folderId);
            if (folderIndex !== -1) {
                subject.folders[folderIndex] = { ...subject.folders[folderIndex], ...updates };
                this.updateSubject(subjectId, subject);
                return true;
            }
        }
        return false;
    }

    static deleteFolder(subjectId, folderId) {
        const subject = this.getSubject(subjectId);
        if (subject) {
            subject.folders = subject.folders.filter(f => f.id !== folderId);
            this.updateSubject(subjectId, subject);
            return true;
        }
        return false;
    }

    static addImageToFolder(subjectId, folderId, compressedImage) {
        const folder = this.getFolder(subjectId, folderId);
        if (folder) {
            folder.images.push({
                id: Date.now(),
                data: compressedImage
            });
            this.updateFolder(subjectId, folderId, folder);
            return true;
        }
        return false;
    }

    static removeImageFromFolder(subjectId, folderId, imageId) {
        const folder = this.getFolder(subjectId, folderId);
        if (folder) {
            folder.images = folder.images.filter(img => img.id !== imageId);
            this.updateFolder(subjectId, folderId, folder);
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

/**
 * Gestiona la compresión de imágenes
 */
class ImageCompressor {
    static async compress(file, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedBase64);
                };
                img.onerror = reject;
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

/**
 * Gestiona el horario visual
 */
class ScheduleManager {
    static generateHours() {
        const hours = [];
        for (let i = 8; i <= 21; i++) {
            hours.push(`${i.toString().padStart(2, '0')}:00`);
        }
        return hours;
    }

    static HOURS = ScheduleManager.generateHours();
    static DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    static getScheduleData() {
        return StorageManager.getOrDefault(StorageManager.KEYS.SCHEDULE, {});
    }

    static saveScheduleCell(hour, day, value) {
        const schedule = this.getScheduleData();
        const key = `${hour}-${day}`;
        if (value.trim()) {
            schedule[key] = value;
        } else {
            delete schedule[key];
        }
        StorageManager.set(StorageManager.KEYS.SCHEDULE, schedule);
    }

    static getScheduleCell(hour, day) {
        const schedule = this.getScheduleData();
        const key = `${hour}-${day}`;
        return schedule[key] || '';
    }
}

// ==================== FUNCIONES DE TEMA OSCURO ====================

function initDarkMode() {
    const darkModeBtn = document.getElementById('darkModeBtn');
    const savedDarkMode = StorageManager.get(StorageManager.KEYS.DARK_MODE);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    AppState.darkMode = savedDarkMode !== null ? savedDarkMode : prefersDark;
    applyDarkMode(AppState.darkMode);

    darkModeBtn.addEventListener('click', () => {
        AppState.darkMode = !AppState.darkMode;
        applyDarkMode(AppState.darkMode);
        StorageManager.set(StorageManager.KEYS.DARK_MODE, AppState.darkMode);
    });
}

function applyDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeBtn').textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('darkModeBtn').textContent = '🌙';
    }
}

// ==================== FUNCIONES DE NAVEGACIÓN ====================

function navigateToSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    AppState.currentSection = sectionId;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });

    if (sectionId === 'horarios') {
        renderSchedule();
    }
}

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.dataset.section;
            navigateToSection(sectionId);
        });
    });
}

// ==================== FUNCIONES DE HORARIO VISUAL ====================

function renderSchedule() {
    const tbody = document.getElementById('scheduleBody');
    tbody.innerHTML = '';

    ScheduleManager.HOURS.forEach(hour => {
        const tr = document.createElement('tr');
        
        const timeCell = document.createElement('td');
        timeCell.className = 'schedule-cell schedule-cell-time';
        timeCell.textContent = hour;
        tr.appendChild(timeCell);

        ScheduleManager.DAYS.forEach(day => {
            const td = document.createElement('td');
            const textarea = document.createElement('textarea');
            textarea.className = 'schedule-cell';
            textarea.value = ScheduleManager.getScheduleCell(hour, day);
            textarea.placeholder = `${day} ${hour}`;

            // Guardar con debounce en tiempo real (evento input)
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
                
                // Debounce de 800ms para no saturar localStorage
                DebounceManager.debounce(`schedule-${hour}-${day}`, () => {
                    ScheduleManager.saveScheduleCell(hour, day, textarea.value);
                }, 800);
            });

            // Guardar inmediatamente al perder foco (respaldo)
            textarea.addEventListener('blur', () => {
                ScheduleManager.saveScheduleCell(hour, day, textarea.value);
            });

            td.appendChild(textarea);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

// ==================== FUNCIONES DE VISOR DE IMÁGENES ====================

function initImageViewer() {
    // Crear modal de visor de imágenes
    const viewerHTML = `
        <div id="imageViewerOverlay" class="image-viewer-overlay"></div>
        <div id="imageViewerModal" class="image-viewer-modal">
            <button class="image-viewer-close">×</button>
            <button class="image-viewer-prev">‹</button>
            <img id="imageViewerImg" src="" alt="Imagen ampliada">
            <button class="image-viewer-next">›</button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', viewerHTML);

    const overlay = document.getElementById('imageViewerOverlay');
    const modal = document.getElementById('imageViewerModal');
    const closeBtn = document.querySelector('.image-viewer-close');
    const prevBtn = document.querySelector('.image-viewer-prev');
    const nextBtn = document.querySelector('.image-viewer-next');

    function closeViewer() {
        overlay.classList.remove('active');
        modal.classList.remove('active');
        AppState.imageViewerData = null;
    }

    function showImage(index) {
        if (!AppState.imageViewerData) return;
        
        const { images, currentIndex } = AppState.imageViewerData;
        let newIndex = index;
        
        if (newIndex < 0) newIndex = images.length - 1;
        if (newIndex >= images.length) newIndex = 0;
        
        AppState.imageViewerData.currentIndex = newIndex;
        const img = document.getElementById('imageViewerImg');
        img.src = images[newIndex].data;
        
        // Mostrar/ocultar botones de navegación
        prevBtn.style.display = images.length > 1 ? 'block' : 'none';
        nextBtn.style.display = images.length > 1 ? 'block' : 'none';
    }

    closeBtn.addEventListener('click', closeViewer);
    overlay.addEventListener('click', closeViewer);
    modal.addEventListener('click', (e) => e.stopPropagation());
    
    prevBtn.addEventListener('click', () => {
        if (AppState.imageViewerData) {
            showImage(AppState.imageViewerData.currentIndex - 1);
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (AppState.imageViewerData) {
            showImage(AppState.imageViewerData.currentIndex + 1);
        }
    });

    // Navegación con teclado
    document.addEventListener('keydown', (e) => {
        if (!AppState.imageViewerData) return;
        if (e.key === 'ArrowLeft') prevBtn.click();
        if (e.key === 'ArrowRight') nextBtn.click();
        if (e.key === 'Escape') closeViewer();
    });

    return { openViewer: (images, startIndex = 0) => {
        AppState.imageViewerData = { images, currentIndex: startIndex };
        overlay.classList.add('active');
        modal.classList.add('active');
        showImage(startIndex);
    }};
}

// ==================== FUNCIONES DE APUNTES ====================

function renderSubjects() {
    const grid = document.getElementById('subjectsGrid');
    grid.innerHTML = '';

    const subjects = SubjectManager.getAllSubjects();

    if (subjects.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No hay asignaturas. ¡Crea una!</p>';
        return;
    }

    subjects.forEach(subject => {
        const card = createSubjectCard(subject);
        grid.appendChild(card);
    });
}

function createSubjectCard(subject) {
    const card = document.createElement('div');
    card.className = 'subject-card';

    const header = document.createElement('div');
    header.className = 'subject-card-header';
    header.innerHTML = `
        <h3>${escapeHtml(subject.name)}</h3>
        <div class="subject-card-actions">
            <button class="btn-icon delete" data-id="${subject.id}" title="Eliminar">🗑️</button>
        </div>
    `;

    const preview = document.createElement('div');
    preview.className = 'subject-preview';
    preview.textContent = subject.folders.length + ' carpeta(s)';

    const foldersList = document.createElement('div');
    foldersList.className = 'folders-list';

    subject.folders.forEach(folder => {
        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';
        folderItem.innerHTML = `
            <span class="folder-item-name">📁 ${escapeHtml(folder.name)}</span>
            <div class="folder-item-actions">
                <button class="folder-item-btn delete" data-subject-id="${subject.id}" data-folder-id="${folder.id}">🗑️</button>
            </div>
        `;

        folderItem.querySelector('.folder-item-name').addEventListener('click', () => {
            openFolderModal(subject.id, folder.id);
        });

        folderItem.querySelector('.folder-item-btn.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar la carpeta "${folder.name}"?`)) {
                SubjectManager.deleteFolder(subject.id, folder.id);
                renderSubjects();
            }
        });

        foldersList.appendChild(folderItem);
    });

    const addFolderBtn = document.createElement('button');
    addFolderBtn.className = 'add-folder-btn';
    addFolderBtn.textContent = '+ Agregar carpeta';
    addFolderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const folderName = prompt('Nombre de la carpeta:');
        if (folderName) {
            const folder = SubjectManager.createFolder(folderName);
            SubjectManager.addFolder(subject.id, folder);
            renderSubjects();
        }
    });

    card.appendChild(header);
    card.appendChild(preview);
    card.appendChild(foldersList);
    card.appendChild(addFolderBtn);

    card.querySelector('.btn-icon.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar "${subject.name}" y todas sus carpetas?`)) {
            SubjectManager.deleteSubject(subject.id);
            renderSubjects();
        }
    });

    return card;
}

function openFolderModal(subjectId, folderId) {
    const folder = SubjectManager.getFolder(subjectId, folderId);
    if (!folder) return;

    AppState.currentSubject = subjectId;
    AppState.currentFolder = folderId;

    const subject = SubjectManager.getSubject(subjectId);
    document.getElementById('folderModalTitle').textContent = `${subject.name} > ${folder.name}`;
    document.getElementById('folderNotesText').value = folder.notes;

    renderFolderImages(folder.images);

    document.getElementById('folderModal').classList.add('active');
    document.getElementById('folderModalOverlay').classList.add('active');
}

function closeFolderModal() {
    if (AppState.currentSubject && AppState.currentFolder) {
        const notes = document.getElementById('folderNotesText').value;
        SubjectManager.updateFolder(AppState.currentSubject, AppState.currentFolder, { notes });
        renderSubjects();
    }

    document.getElementById('folderModal').classList.remove('active');
    document.getElementById('folderModalOverlay').classList.remove('active');
    AppState.currentSubject = null;
    AppState.currentFolder = null;
}

function renderFolderImages(images) {
    const list = document.getElementById('folderImagesList');
    list.innerHTML = '';

    if (images.length === 0) {
        list.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 1rem;">Sin imágenes</p>';
        return;
    }

    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.innerHTML = `
            <img src="${image.data}" alt="Apunte" class="image-item-img">
            <button class="image-delete-btn" data-id="${image.id}">×</button>
        `;

        // Abrir visor al hacer click en la imagen
        item.querySelector('.image-item-img').addEventListener('click', (e) => {
            e.stopPropagation();
            window.imageViewer.openViewer(images, index);
        });

        item.querySelector('.image-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (AppState.currentSubject && AppState.currentFolder) {
                SubjectManager.removeImageFromFolder(AppState.currentSubject, AppState.currentFolder, image.id);
                const folder = SubjectManager.getFolder(AppState.currentSubject, AppState.currentFolder);
                renderFolderImages(folder.images);
            }
        });

        list.appendChild(item);
    });
}

async function handleFolderImageUpload(files) {
    if (!AppState.currentSubject || !AppState.currentFolder) return;

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            alert('Solo se permiten archivos de imagen');
            continue;
        }

        try {
            const compressedBase64 = await ImageCompressor.compress(file);
            SubjectManager.addImageToFolder(AppState.currentSubject, AppState.currentFolder, compressedBase64);
            const folder = SubjectManager.getFolder(AppState.currentSubject, AppState.currentFolder);
            renderFolderImages(folder.images);
        } catch (error) {
            console.error('Error compressing image:', error);
            alert('Error al procesar la imagen');
        }
    }

    document.getElementById('folderImageInput').value = '';
}

function initSubjects() {
    SubjectManager.migrateOldData();

    const subjectInput = document.getElementById('subjectInput');
    const addSubjectBtn = document.getElementById('addSubjectBtn');
    const folderImageInput = document.getElementById('folderImageInput');
    const uploadFolderImageBtn = document.getElementById('uploadFolderImageBtn');
    const folderModalClose = document.querySelector('#folderModal .modal-close');
    const folderModalCloseBtn = document.querySelector('#folderModal .modal-close-btn');
    const folderModalOverlay = document.getElementById('folderModalOverlay');
    const folderModal = document.getElementById('folderModal');

    addSubjectBtn.addEventListener('click', () => {
        const name = subjectInput.value.trim();
        if (!name) {
            alert('Ingresa el nombre de la asignatura');
            return;
        }

        const subject = SubjectManager.createSubject(name);
        SubjectManager.addSubject(subject);
        subjectInput.value = '';
        renderSubjects();
    });

    subjectInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSubjectBtn.click();
    });

    uploadFolderImageBtn.addEventListener('click', () => {
        folderImageInput.click();
    });

    folderImageInput.addEventListener('change', (e) => {
        handleFolderImageUpload(e.target.files);
    });

    folderModalClose.addEventListener('click', closeFolderModal);
    folderModalCloseBtn.addEventListener('click', closeFolderModal);
    folderModalOverlay.addEventListener('click', closeFolderModal);
    folderModal.addEventListener('click', (e) => e.stopPropagation());

    renderSubjects();
}

// ==================== FUNCIONES DE ACTIVIDADES ====================

function renderTasks() {
    const list = document.getElementById('tasksList');
    list.innerHTML = '';

    const tasks = TaskManager.getAllTasks();

    if (tasks.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay tareas</p>';
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

        item.querySelector('.task-checkbox').addEventListener('change', () => {
            TaskManager.toggleTask(task.id);
            renderTasks();
        });

        item.querySelector('.btn-delete').addEventListener('click', () => {
            TaskManager.deleteTask(task.id);
            renderTasks();
        });

        list.appendChild(item);
    });
}

function initTasks() {
    const taskInput = document.getElementById('taskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');

    addTaskBtn.addEventListener('click', () => {
        const text = taskInput.value.trim();
        if (!text) {
            alert('Ingresa el texto de la tarea');
            return;
        }

        const task = TaskManager.createTask(text);
        TaskManager.addTask(task);
        taskInput.value = '';
        renderTasks();
    });

    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTaskBtn.click();
    });

    renderTasks();
}

// ==================== FUNCIONES UTILITARIAS ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initApp() {
    initDarkMode();
    initNavigation();
    window.imageViewer = initImageViewer();
    initSubjects();
    initTasks();
    navigateToSection('inicio');
}

// ==================== PUNTO DE ENTRADA ====================

document.addEventListener('DOMContentLoaded', initApp);

window.addEventListener('storage', () => {
    if (AppState.currentSection === 'apuntes') {
        renderSubjects();
    } else if (AppState.currentSection === 'actividades') {
        renderTasks();
    }
});
