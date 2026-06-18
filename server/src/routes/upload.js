const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { sanitizeFilename } = require('../middleware/sanitize');
const config = require('../config');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: config.maxFileSize || 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/ogg', 'audio/wav',
      'video/mp4', 'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'), false);
    }
  }
});

router.use(authMiddleware);

router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  try {
    const safeName = sanitizeFilename(file.originalname);
    
    let fileUrl = `/uploads/${file.filename}`;
    let fileType = 'file';

    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
      try {
        const thumbnailPath = path.join(uploadDir, `thumb_${file.filename}`);
        await sharp(file.path).resize(200, 200, { fit: 'inside' }).toFile(thumbnailPath);
      } catch (e) {
        console.warn('Ошибка создания миниатюры:', e.message);
      }
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      fileType = 'audio';
    }

    res.json({
      url: fileUrl,
      type: fileType,
      name: safeName || file.originalname,
      size: file.size,
      mimetype: file.mimetype
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    try {
      if (file && file.path) {
        fs.unlink(file.path, () => {});
      }
    } catch (cleanupError) {
      console.warn('Ошибка очистки:', cleanupError.message);
    }
    
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

module.exports = router;