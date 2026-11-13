const express = require('express');
const app = express();
app.use(express.json());

let users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];
let nextId = 3;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/users', (req, res) => {
  res.status(200).json(users);
});

app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  return res.status(200).json(user);
});

app.post('/users', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const user = { id: nextId, name };
  nextId += 1;
  users.push(user);
  return res.status(201).json(user);
});

app.put('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  user.name = name;
  return res.status(200).json(user);
});

app.delete('/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  const [deleted] = users.splice(index, 1);
  return res.status(200).json(deleted);
});

module.exports = app;
