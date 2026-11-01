const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { z } = require('zod');
const { admin, BUCKET } = require('../supabase');
const { requireRole } = require('../middleware/auth');
const { wrap, HttpError, signReports, canView, canManage } = require('../lib');

const router = express.Router();
const STATUSES = ['pending', 'verified', 'in_progress', 'resolved', 'rejected'];
const CATEGORIES = ['pothole', 'garbage', 'streetlight', 'drainage', 'public_facility', 'other'];
const SELECT = '*, barangay:barangays(id,name,city), reporter:profiles!reporter_id(id,full_name,phone)';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG or WEBP images are allowed')),
});

async function storeImage(folder, file) {
  const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw new HttpError(500, 'Image upload failed. Please try again.');
  return path;
}

async function fetchReport(id) {
  const { data, error } = await admin.from('reports').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Report not found');
  return data;
}

router.param('id', (req, res, next, id) =>
  /^[0-9a-f-]{36}$/i.test(id) ? next() : next(new HttpError(400, 'Invalid report id')));

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  barangay_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// List reports, scoped by role: resident = own, staff = own barangay, admin = all
router.get('/', wrap(async (req, res) => {
  const f = listSchema.parse(req.query);
  const p = req.profile;
  let query = admin.from('reports').select(SELECT, { count: 'exact' });

  if (p.role === 'resident') query = query.eq('reporter_id', p.id);
  else if (p.role === 'staff') {
    if (!p.barangay_id) return res.json({ data: [], count: 0 });
    query = query.eq('barangay_id', p.barangay_id);
  } else if (f.barangay_id) query = query.eq('barangay_id', f.barangay_id);

  if (f.status) query = query.eq('status', f.status);
  if (f.category) query = query.eq('category', f.category);
  if (f.q) {
    const s = f.q.replace(/[%,()*\\]/g, ' ').trim();
    if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
  }
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(f.offset, f.offset + f.limit - 1);
  if (error) throw error;
  res.json({ data: await signReports(data), count: count ?? 0 });
}));

const createSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.enum(CATEGORIES),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address_text: z.string().trim().max(200).optional(),
});

router.post('/', requireRole('resident'), upload.single('photo'), wrap(async (req, res) => {
  const body = createSchema.parse(req.body);
  if (!req.file) throw new HttpError(400, 'A photo is required');
  if (!req.profile.barangay_id) throw new HttpError(400, 'Your account has no barangay. Contact your administrator.');

  const photo_path = await storeImage(req.user.id, req.file);
  const { data, error } = await admin.from('reports').insert({
    reporter_id: req.user.id,
    barangay_id: req.profile.barangay_id,
    title: body.title, description: body.description, category: body.category,
    latitude: body.latitude, longitude: body.longitude,
    address_text: body.address_text || null, photo_path,
  }).select(SELECT).single();
  if (error) {
    await admin.storage.from(BUCKET).remove([photo_path]);
    throw error;
  }
  res.status(201).json({ data: (await signReports([data]))[0] });
}));

router.get('/:id', wrap(async (req, res) => {
  const report = await fetchReport(req.params.id);
  if (!canView(req.profile, report)) throw new HttpError(404, 'Report not found');
  const { data: updates, error } = await admin.from('report_updates')
    .select('*, author:profiles!author_id(full_name,role)')
    .eq('report_id', report.id).order('created_at', { ascending: false });
  if (error) throw error;
  const [signed] = await signReports([report]);
  res.json({ data: { ...signed, updates, can_manage: canManage(req.profile, report) } });
}));

const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(1000).optional(),
});

router.patch('/:id/status', requireRole('staff', 'admin'), wrap(async (req, res) => {
  const { status, note } = statusSchema.parse(req.body);
  const report = await fetchReport(req.params.id);
  if (!canManage(req.profile, report)) throw new HttpError(403, 'You can only manage reports in your own barangay');
  if (status === report.status) throw new HttpError(400, 'Report is already ' + status.replace('_', ' '));
  if (status === 'rejected' && !note) throw new HttpError(400, 'A note is required when rejecting a report');

  const { error } = await admin.from('reports').update({ status }).eq('id', report.id);
  if (error) throw error;
  const { error: e2 } = await admin.from('report_updates').insert({
    report_id: report.id, author_id: req.user.id,
    old_status: report.status, new_status: status, note: note || null,
  });
  if (e2) throw e2;
  res.json({ ok: true });
}));

router.post('/:id/notes', requireRole('staff', 'admin'), wrap(async (req, res) => {
  const { note } = z.object({ note: z.string().trim().min(1, 'Note cannot be empty').max(1000) }).parse(req.body);
  const report = await fetchReport(req.params.id);
  if (!canManage(req.profile, report)) throw new HttpError(403, 'You can only manage reports in your own barangay');
  const { error } = await admin.from('report_updates').insert({ report_id: report.id, author_id: req.user.id, note });
  if (error) throw error;
  await admin.from('notifications').insert({
    user_id: report.reporter_id, report_id: report.id,
    title: 'Progress update', body: `New note on "${report.title}": ${note.slice(0, 120)}`,
  });
  res.status(201).json({ ok: true });
}));

router.post('/:id/photos', requireRole('staff', 'admin'), upload.single('photo'), wrap(async (req, res) => {
  const { kind } = z.object({ kind: z.enum(['before', 'after']) }).parse(req.body);
  if (!req.file) throw new HttpError(400, 'A photo is required');
  const report = await fetchReport(req.params.id);
  if (!canManage(req.profile, report)) throw new HttpError(403, 'You can only manage reports in your own barangay');

  const col = `${kind}_photo_path`;
  const path = await storeImage(`${report.id}`, req.file);
  const { error } = await admin.from('reports').update({ [col]: path }).eq('id', report.id);
  if (error) { await admin.storage.from(BUCKET).remove([path]); throw error; }
  if (report[col]) await admin.storage.from(BUCKET).remove([report[col]]);
  await admin.from('report_updates').insert({
    report_id: report.id, author_id: req.user.id, note: `Uploaded ${kind} photo`,
  });
  res.status(201).json({ ok: true });
}));

module.exports = router;
