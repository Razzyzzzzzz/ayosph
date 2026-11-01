const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { ZodError } = require('zod');
const { admin } = require('./supabase');
const { requireAuth, requireRole } = require('./middleware/auth');
const { wrap, HttpError } = require('./lib');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public: active barangays for the registration picker
app.get('/api/barangays', wrap(async (req, res) => {
  const { data, error } = await admin.from('barangays').select('id,name,city,province').eq('is_active', true).order('city').order('name');
  if (error) throw error;
  res.json({ data });
}));

app.use('/api/admin', requireAuth, requireRole('admin'), require('./routes/admin'));
app.use('/api/reports', requireAuth, require('./routes/reports'));
app.use('/api', requireAuth, require('./routes/misc'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return res.status(400).json({ error: i.message && i.message !== 'Required' ? i.message : `Invalid or missing field: ${i.path.join('.')}` });
  }
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 8 MB)' : err.message });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => console.log(`AyosPH API listening on :${port}`));
