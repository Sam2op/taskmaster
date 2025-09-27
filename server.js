const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'TaskMaster API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Tasks API endpoints
let tasks = [
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
  }
];

// GET all tasks
app.get('/api/tasks', (req, res) => {
  try {
    const { filter, priority, search, sort } = req.query;
    let filteredTasks = [...tasks];

    // Filter by completion status
    if (filter === 'active') {
      filteredTasks = filteredTasks.filter(task => !task.completed);
    } else if (filter === 'completed') {
      filteredTasks = filteredTasks.filter(task => task.completed);
    }

    // Filter by priority
    if (priority && priority !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.priority === priority);
    }

    // Search functionality
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.category.toLowerCase().includes(searchLower)
      );
    }

    // Sort tasks
    if (sort) {
      switch (sort) {
        case 'dueDate':
          filteredTasks.sort((a, b) => new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31'));
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          filteredTasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
          break;
        case 'alphabetical':
          filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
          break;
        default:
          filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    }

    res.json({
      success: true,
      data: filteredTasks,
      total: filteredTasks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

// POST create new task
app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, priority, dueDate, category } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    const newTask = {
      id: Math.max(...tasks.map(t => t.id), 0) + 1,
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority || 'medium',
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: dueDate || null,
      category: category || 'General'
    };

    tasks.push(newTask);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message
    });
  }
});

// PUT update task
app.put('/api/tasks/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const { title, description, priority, completed, dueDate, category } = req.body;

    // Update task properties
    const updatedTask = {
      ...tasks[taskIndex],
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(priority !== undefined && { priority }),
      ...(completed !== undefined && { completed }),
      ...(dueDate !== undefined && { dueDate }),
      ...(category !== undefined && { category }),
      updatedAt: new Date().toISOString()
    };

    tasks[taskIndex] = updatedTask;

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(task => task.id === taskId);

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];

    res.json({
      success: true,
      message: 'Task deleted successfully',
      data: deletedTask
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TaskMaster server is running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
