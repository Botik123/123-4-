const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);
app.use('/upload', uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = app;