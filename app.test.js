const request = require('supertest');

describe('API Tests', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    app = require('./app');
  });

  test('GET /health debe retornar status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /users debe retornar una lista de usuarios', async () => {
    const res = await request(app).get('/users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test('GET /users/:id debe retornar un usuario existente', async () => {
    const res = await request(app).get('/users/1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 1, name: 'Alice' });
  });

  test('GET /users/:id debe retornar 404 si no existe', async () => {
    const res = await request(app).get('/users/999');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Usuario no encontrado');
  });

  test('POST /users debe crear un usuario', async () => {
    const res = await request(app).post('/users').send({ name: 'Carla' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ id: 3, name: 'Carla' });
    const list = await request(app).get('/users');
    expect(list.body.length).toBe(3);
  });

  test('POST /users debe rechazar un nombre ausente', async () => {
    const res = await request(app).post('/users').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('El nombre es obligatorio');
  });

  test('POST /users debe rechazar un nombre no string', async () => {
    const res = await request(app).post('/users').send({ name: 123 });
    expect(res.statusCode).toBe(400);
  });

  test('PUT /users/:id debe actualizar un usuario', async () => {
    const res = await request(app).put('/users/1').send({ name: 'Alicia' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 1, name: 'Alicia' });
  });

  test('PUT /users/:id debe retornar 404 si no existe', async () => {
    const res = await request(app).put('/users/999').send({ name: 'X' });
    expect(res.statusCode).toBe(404);
  });

  test('PUT /users/:id debe rechazar un nombre ausente', async () => {
    const res = await request(app).put('/users/1').send({});
    expect(res.statusCode).toBe(400);
  });

  test('DELETE /users/:id debe eliminar un usuario', async () => {
    const res = await request(app).delete('/users/2');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 2, name: 'Bob' });
    const check = await request(app).get('/users/2');
    expect(check.statusCode).toBe(404);
  });

  test('DELETE /users/:id debe retornar 404 si no existe', async () => {
    const res = await request(app).delete('/users/999');
    expect(res.statusCode).toBe(404);
  });
});
