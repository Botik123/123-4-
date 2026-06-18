const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// 🔥 ФИКС: Проверка типов перед санитаризацией
const sanitize = (text) => {
  if (!text || typeof text !== 'string') return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
};

// 🔥 ФИКС: Санитизация имени файла
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return 'file';
  return filename
    .replace(/[<>"']/g, '')
    .replace(/[^a-zA-Zа-яА-Я0-9._\-() ]/g, '')
    .trim()
    .substring(0, 100);
};

const sanitizeBody = (req, res, next) => {
  if (req.body) {
    if (req.body.text && typeof req.body.text === 'string') {
      req.body.text = sanitize(req.body.text);
    }
    if (req.body.username && typeof req.body.username === 'string') {
      req.body.username = sanitize(req.body.username);
    }
    if (req.body.filename && typeof req.body.filename === 'string') {
      req.body.filename = sanitize(req.body.filename);
    }
  }
  next();
};

module.exports = { sanitize, sanitizeBody, sanitizeFilename };