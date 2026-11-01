const express = require('express');
const { z } = require('zod');
const { admin } = require('../supabase');
const { wrap, HttpError } = require('../lib');

const router = express.Router();

// ----- profile -----
router.get('/me', wrap(async (req, res) => {
  const { data, error } = await admin.from('profiles')
    .select('*, barangay:barangays(id,name,city,province)').eq('id', req.user.id).single();
  if (error) throw error;
  res.json({ data: { ...data, email: req.user.email } });
}));

router.patch('/me', wrap(async (req, res) => {
  const body = z.object({
    full_name: z.string().trim().min(2, 'Name is too short').max(100),
    phone: z.string().trim().max(30).optional(),
  }).parse(req.body);
  const { error } = await admin.from('profiles')
    .update({ full_name: body.full_name, phone: body.phone || null }).eq('id', req.user.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ----- dashboard stats (scoped by role) -----
router.get('/stats', wrap(async (req, res) => {
  const p = req.profile;
  const args = {};
  if (p.role === 'resident') args.p_reporter = p.id;
  if (p.role === 'staff') {
    if (!p.barangay_id) return res.json({ data: { total: 0, pending: 0, verified: 0, in_progress: 0, resolved: 0, rejected: 0 } });
    args.p_barangay = p.barangay_id;
  }
  const { data, error } = await admin.rpc('report_counts', args);
  if (error) throw error;
  const out = { total: 0, pending: 0, verified: 0, in_progress: 0, resolved: 0, rejected: 0 };
  (data || []).forEach((r) => { out[r.status] = Number(r.total); out.total += Number(r.total); });
  res.json({ data: out });
}));

// ----- notifications -----
router.get('/notifications', wrap(async (req, res) => {
  const { data, error } = await admin.from('notifications').select('*')
    .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  res.json({ data });
}));

router.get('/notifications/unread-count', wrap(async (req, res) => {
  const { count, error } = await admin.from('notifications')
    .select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('is_read', false);
  if (error) throw error;
  res.json({ count: count || 0 });
}));

router.post('/notifications/read', wrap(async (req, res) => {
  const { id } = z.object({ id: z.string().uuid().optional() }).parse(req.body || {});
  let q = admin.from('notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
  if (id) q = q.eq('id', id);
  const { error } = await q;
  if (error) throw error;
  res.json({ ok: true });
}));

module.exports = router;
