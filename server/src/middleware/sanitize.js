const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Очистка HTML от XSS
const sanitize = (text) => {
  if (!text || typeof text !== 'string') return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // Запрещаем все теги
    ALLOWED_ATTR: [], // Запрещаем все атрибуты
    KEEP_CONTENT: true // Сохраняем текст
  });
};

// Middleware для очистки входящих данных
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    if (req.body.text) {
      req.body.text = sanitize(req.body.text);
    }
    if (req.body.username) {
      req.body.username = sanitize(req.body.username);
    }
  }
  next();
};

module.exports = { sanitize, sanitizeBody };