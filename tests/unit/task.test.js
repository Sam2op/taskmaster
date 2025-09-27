const request = require('supertest');
const app = require('../server');

describe('Task API', () => {
  describe('GET /api/tasks', () => {
    test('should return all tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks?filter=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(task => {
        expect(task.completed).toBe(false);
      });
    });
  });

  describe('POST /api/tasks', () => {
    test('should create a new task', async () => {
      const newTask = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/tasks')
        .send(newTask)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(newTask.title);
      expect(response.body.data.completed).toBe(false);
    });

    test('should return error for missing title', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ description: 'No title' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('title');
    });
  });
});

describe('Health Check', () => {
  test('GET /api/health should return OK', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.message).toContain('TaskMaster API');
  });
});
