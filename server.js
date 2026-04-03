require('dotenv').config();

const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { transformSpeechToDialect, getPublicConfig } = require('./lib/openaiDialectDemo');
const { getLocaleBundle, getLocaleFromPath } = require('./lib/locales');
const { renderPage } = require('./lib/renderPage');

const app = express();
const publicDir = path.join(__dirname, 'public');
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT) || 8787;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (Number(process.env.DIALECTLAB_MAX_AUDIO_MB) || 25) * 1024 * 1024,
  },
});

const transformLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.DIALECTLAB_IP_MAX) || 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many Dialektlab requests. Try again soon.' },
});

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(publicDir, { index: false }));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.status(200).json(getPublicConfig());
});

app.post('/api/transform', transformLimiter, upload.single('audio'), async (req, res) => {
  try {
    const payload = await transformSpeechToDialect(req);
    res.set('Cache-Control', 'no-store');
    res.status(200).json(payload);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: statusCode >= 500 ? 'Dialektlab could not process the recording right now.' : error.message,
    });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.use((req, res) => {
  const locale = getLocaleFromPath(req.path);
  const bundle = getLocaleBundle(locale);
  res.status(200).type('html').send(renderPage(locale, bundle));
});

app.listen(port, host, () => {
  const visibleHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`Dialektlab listening on http://${visibleHost}:${port}`);
});
