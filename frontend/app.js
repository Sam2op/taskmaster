// TaskMaster Application JavaScript
class TaskMaster {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.currentPriority = null;
        this.searchQuery = '';
        this.editingTask = null;
        this.draggedTask = null;
        
        this.init();
    }

    init() {
        this.loadTasks();
        this.setupEventListeners();
        this.setupTheme();
        this.renderTasks();
        this.updateProgress();
    }

    // Load tasks from localStorage or initialize with sample data
    loadTasks() {
        const savedTasks = localStorage.getItem('taskmaster-tasks');
        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        } else {
            // Initialize with sample data
            this.tasks = [
                {
                    id: 1,
                    title: "Set up development environment",
                    description: "Install Node.js, Docker, and configure development tools",
                    priority: "high",
                    completed: false,
                    createdAt: "2025-09-27T10:00:00Z",
                    dueDate: "2025-09-28T00:00:00Z",
                    category: "Development"
                },
                {
                    id: 2,
                    title: "Design database schema",
                    description: "Create ERD and plan database structure for the application",
                    priority: "medium",
                    completed: true,
                    createdAt: "2025-09-26T14:30:00Z",
                    dueDate: "2025-09-27T00:00:00Z",
                    category: "Planning"
                },
                {
                    id: 3,
                    title: "Write unit tests",
                    description: "Create comprehensive test suite for all API endpoints",
                    priority: "medium",
                    completed: false,
                    createdAt: "2025-09-25T09:15:00Z",
                    dueDate: "2025-09-30T00:00:00Z",
                    category: "Testing"
                }
            ];
            this.saveTasks();
        }
    }

    // Save tasks to localStorage
    saveTasks() {
        localStorage.setItem('taskmaster-tasks', JSON.stringify(this.tasks));
    }

    // Setup event listeners
    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Add task button
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.openAddTaskModal();
        });

        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal('addTaskModal');
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal('addTaskModal');
        });

        // Task form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskSubmission();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Priority filter
        document.getElementById('priorityFilter').addEventListener('change', (e) => {
            this.currentPriority = e.target.value || null;
            this.renderTasks();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderTasks();
        });

        // Sort button
        document.getElementById('sortBtn').addEventListener('click', (e) => {
            this.toggleSortMenu();
        });

        // Sort options
        document.querySelectorAll('.sort-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.sortTasks(e.target.dataset.sort);
                this.closeSortMenu();
            });
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Confirm modal buttons
        document.getElementById('confirmCancel').addEventListener('click', () => {
            this.closeModal('confirmModal');
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.confirmDelete();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Close sort menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-sort') && !e.target.closest('.sort-menu')) {
                this.closeSortMenu();
            }
        });
    }

    // Theme management
    setupTheme() {
        const savedTheme = localStorage.getItem('taskmaster-theme') || 'light';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('taskmaster-theme', theme);
        
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Modal management
    openAddTaskModal(task = null) {
        const modal = document.getElementById('addTaskModal');
        const form = document.getElementById('taskForm');
        const modalTitle = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('submitBtn');

        this.editingTask = task;

        if (task) {
            // Edit mode
            modalTitle.textContent = 'Edit Task';
            submitBtn.textContent = 'Update Task';
            this.populateForm(task);
        } else {
            // Add mode
            modalTitle.textContent = 'Add New Task';
            submitBtn.textContent = 'Add Task';
            form.reset();
            
            // Set default due date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('taskDueDate').value = tomorrow.toISOString().split('T')[0];
        }

        modal.classList.add('active');
        document.getElementById('taskTitle').focus();
        document.body.style.overflow = 'hidden';
    }

    populateForm(task) {
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskCategory').value = task.category || '';
        
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            document.getElementById('taskDueDate').value = dueDate.toISOString().split('T')[0];
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('active');
        document.body.style.overflow = '';
        this.editingTask = null;
    }

    // Task management
    handleTaskSubmission() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const category = document.getElementById('taskCategory').value.trim();

        if (!title) {
            this.showNotification('Please enter a task title', 'error');
            return;
        }

        const taskData = {
            title,
            description,
            priority,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            category: category || 'General'
        };

        if (this.editingTask) {
            this.updateTask(this.editingTask.id, taskData);
        } else {
            this.createTask(taskData);
        }

        this.closeModal('addTaskModal');
    }

    createTask(taskData) {
        const newTask = {
            id: Date.now(),
            ...taskData,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.unshift(newTask);
        this.saveTasks();
        this.renderTasks();
        this.updateProgress();
        this.showNotification('Task created successfully!', 'success');
    }

    updateTask(id, updates) {
        const taskIndex = this.tasks.findIndex(task => task.id === id);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = {
                ...this.tasks[taskIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveTasks();
            this.renderTasks();
            this.updateProgress();
            this.showNotification('Task updated successfully!', 'success');
        }
    }

    deleteTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            this.pendingDeleteId = id;
            document.getElementById('confirmMessage').textContent = 
                `Are you sure you want to delete "${task.title}"?`;
            document.getElementById('confirmModal').classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    confirmDelete() {
        if (this.pendingDeleteId) {
            const taskIndex = this.tasks.findIndex(task => task.id === this.pendingDeleteId);
            if (taskIndex !== -1) {
                const deletedTask = this.tasks.splice(taskIndex, 1)[0];
                this.saveTasks();
                this.renderTasks();
                this.updateProgress();
                this.showNotification(`"${deletedTask.title}" deleted`, 'info');
            }
        }
        this.closeModal('confirmModal');
        this.pendingDeleteId = null;
    }

    toggleTaskComplete(id) {
        const task = this.tasks.find(task => task.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveTasks();
            this.renderTasks();
            this.updateProgress();
            
            const message = task.completed ? 'Task completed! 🎉' : 'Task reopened';
            this.showNotification(message, task.completed ? 'success' : 'info');
        }
    }

    // Filtering and sorting
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.renderTasks();
    }

    getFilteredTasks() {
        let filtered = [...this.tasks];

        // Filter by completion status
        if (this.currentFilter === 'active') {
            filtered = filtered.filter(task => !task.completed);
        } else if (this.currentFilter === 'completed') {
            filtered = filtered.filter(task => task.completed);
        }

        // Filter by priority
        if (this.currentPriority) {
            filtered = filtered.filter(task => task.priority === this.currentPriority);
        }

        // Filter by search query
        if (this.searchQuery) {
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(this.searchQuery) ||
                task.description.toLowerCase().includes(this.searchQuery) ||
                (task.category && task.category.toLowerCase().includes(this.searchQuery))
            );
        }

        return filtered;
    }

    sortTasks(sortBy) {
        switch (sortBy) {
            case 'dueDate':
                this.tasks.sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                });
                break;
            case 'priority':
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                this.tasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
                break;
            case 'alphabetical':
                this.tasks.sort((a, b) => a.title.localeCompare(b.title));
                break;
            default:
                this.tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        this.saveTasks();
        this.renderTasks();
        this.showNotification(`Tasks sorted by ${sortBy}`, 'info');
    }

    toggleSortMenu() {
        const menu = document.getElementById('sortMenu');
        menu.classList.toggle('active');
    }

    closeSortMenu() {
        document.getElementById('sortMenu').classList.remove('active');
    }

    // Rendering
    renderTasks() {
        const container = document.getElementById('tasksContainer');
        const emptyState = document.getElementById('emptyState');
        const filteredTasks = this.getFilteredTasks();

        container.innerHTML = '';

        if (filteredTasks.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        filteredTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const taskCard = document.createElement('div');
        taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;
        taskCard.setAttribute('data-task-id', task.id);

        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = dueDate && dueDate < new Date() && !task.completed;

        taskCard.innerHTML = `
            <div class="task-priority-indicator ${task.priority}"></div>
            <div class="task-content">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}"></div>
                <div class="task-info">
                    <div class="task-header">
                        <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                        <div class="task-actions">
                            <button class="task-action-btn edit" data-task-id="${task.id}" title="Edit task">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="task-action-btn delete" data-task-id="${task.id}" title="Delete task">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${task.description ? `<p class="task-description">${this.escapeHtml(task.description)}</p>` : ''}
                    <div class="task-meta">
                        <span class="task-priority ${task.priority}">
                            <i class="fas fa-flag"></i>
                            ${task.priority}
                        </span>
                        ${dueDate ? `
                            <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                                <i class="fas fa-calendar"></i>
                                ${this.formatDate(dueDate)}
                            </span>
                        ` : ''}
                        ${task.category ? `
                            <span class="task-category">${this.escapeHtml(task.category)}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.addTaskEventListeners(taskCard, task);

        return taskCard;
    }

    addTaskEventListeners(taskCard, task) {
        // Checkbox toggle
        const checkbox = taskCard.querySelector('.task-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskComplete(task.id);
        });

        // Edit button
        const editBtn = taskCard.querySelector('.task-action-btn.edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAddTaskModal(task);
        });

        // Delete button
        const deleteBtn = taskCard.querySelector('.task-action-btn.delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTask(task.id);
        });

        // Card click for edit (mobile friendly)
        taskCard.addEventListener('click', () => {
            this.openAddTaskModal(task);
        });
    }

    // Progress tracking
    updateProgress() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const activeTasks = totalTasks - completedTasks;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        document.getElementById('totalCount').textContent = totalTasks;
        document.getElementById('activeCount').textContent = activeTasks;
        document.getElementById('progressFill').style.width = `${progressPercentage}%`;
        document.getElementById('progressPercentage').textContent = `${progressPercentage}%`;
    }

    // Utility functions
    formatDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const dateStr = date.toDateString();
        const todayStr = today.toDateString();
        const tomorrowStr = tomorrow.toDateString();

        if (dateStr === todayStr) return 'Today';
        if (dateStr === tomorrowStr) return 'Tomorrow';
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add styles for notifications
        if (!document.querySelector('.notification-styles')) {
            const style = document.createElement('style');
            style.className = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-md);
                    box-shadow: var(--shadow-lg);
                    z-index: 1001;
                    min-width: 300px;
                    transform: translateX(100%);
                    transition: transform var(--transition);
                }
                .notification.show {
                    transform: translateX(0);
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }
                .notification-success { border-left: 4px solid var(--color-success); }
                .notification-error { border-left: 4px solid var(--color-danger); }
                .notification-info { border-left: 4px solid var(--color-info); }
                .notification-close {
                    position: absolute;
                    top: var(--spacing-sm);
                    right: var(--spacing-sm);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: var(--color-text-muted);
                }
            `;
            document.head.appendChild(style);
        }

        // Add to DOM and show
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Auto remove after 3 seconds
        setTimeout(() => {
            this.removeNotification(notification);
        }, 3000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.removeNotification(notification);
        });
    }

    removeNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Keyboard shortcuts
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to add new task
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.openAddTaskModal();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                this.closeModal(activeModal.id);
            }
            this.closeSortMenu();
        }

        // Ctrl/Cmd + F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.taskMaster = new TaskMaster();
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
