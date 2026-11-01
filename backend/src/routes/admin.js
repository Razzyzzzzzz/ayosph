const express = require('express');
const { z } = require('zod');
const { admin } = require('../supabase');
const { wrap, HttpError } = require('../lib');

const router = express.Router(); // mounted behind requireAuth + requireRole('admin')
const uuid = z.string().uuid();

// ----- overview: totals, per-barangay activity, recent updates -----
router.get('/activity', wrap(async (req, res) => {
  const [counts, brgy, recent, ...roleCounts] = await Promise.all([
    admin.rpc('report_counts', {}),
    admin.rpc('barangay_activity'),
    admin.from('report_updates')
      .select('id,old_status,new_status,note,created_at, author:profiles!author_id(full_name), report:reports(id,title, barangay:barangays(name))')
      .order('created_at', { ascending: false }).limit(15),
    ...['resident', 'staff', 'admin'].map((r) =>
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', r)),
  ]);
  for (const r of [counts, brgy, recent]) if (r.error) throw r.error;
  const stats = { total: 0, pending: 0, verified: 0, in_progress: 0, resolved: 0, rejected: 0 };
  counts.data.forEach((r) => { stats[r.status] = Number(r.total); stats.total += Number(r.total); });
  res.json({
    stats,
    users: { resident: roleCounts[0].count || 0, staff: roleCounts[1].count || 0, admin: roleCounts[2].count || 0 },
    barangays: brgy.data.map((b) => ({ ...b, total: Number(b.total), pending: Number(b.pending), in_progress: Number(b.in_progress), resolved: Number(b.resolved) })),
    recent: recent.data,
  });
}));

// ----- users -----
router.get('/users', wrap(async (req, res) => {
  const { q, role } = z.object({
    q: z.string().trim().max(100).optional(),
    role: z.enum(['resident', 'staff', 'admin']).optional(),
  }).parse(req.query);
  let query = admin.from('profiles').select('*, barangay:barangays(id,name,city)').order('created_at', { ascending: false }).limit(100);
  if (role) query = query.eq('role', role);
  if (q) query = query.ilike('full_name', `%${q.replace(/[%,()*\\]/g, ' ')}%`);
  const { data, error } = await query;
  if (error) throw error;
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emails = {};
  (authUsers?.users || []).forEach((u) => { emails[u.id] = u.email; });
  res.json({ data: data.map((u) => ({ ...u, email: emails[u.id] || null })) });
}));

router.patch('/users/:id', wrap(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const body = z.object({
    role: z.enum(['resident', 'staff', 'admin']).optional(),
    barangay_id: uuid.nullable().optional(),
  }).parse(req.body);
  const { data: target } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!target) throw new HttpError(404, 'User not found');

  const role = body.role ?? target.role;
  const barangay_id = body.barangay_id !== undefined ? body.barangay_id : target.barangay_id;
  if (id === req.user.id && role !== 'admin') throw new HttpError(400, 'You cannot remove your own admin role');
  if (role === 'staff' && !barangay_id) throw new HttpError(400, 'Barangay Staff must be assigned to a barangay');
  if (barangay_id) {
    const { data: b } = await admin.from('barangays').select('id').eq('id', barangay_id).maybeSingle();
    if (!b) throw new HttpError(400, 'Barangay not found');
  }
  const { error } = await admin.from('profiles').update({ role, barangay_id }).eq('id', id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ----- barangays -----
const brgySchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  city: z.string().trim().min(2, 'City is too short').max(100),
  province: z.string().trim().max(100).optional(),
  is_active: z.boolean().optional(),
});

const dupMessage = (error) => (error.code === '23505' ? new HttpError(409, 'That barangay already exists in this city') : error);

router.post('/barangays', wrap(async (req, res) => {
  const b = brgySchema.parse(req.body);
  const { data, error } = await admin.from('barangays')
    .insert({ name: b.name, city: b.city, province: b.province || '' }).select().single();
  if (error) throw dupMessage(error);
  res.status(201).json({ data });
}));

router.patch('/barangays/:id', wrap(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const b = brgySchema.partial().parse(req.body);
  const { data, error } = await admin.from('barangays').update(b).eq('id', id).select().maybeSingle();
  if (error) throw dupMessage(error);
  if (!data) throw new HttpError(404, 'Barangay not found');
  res.json({ data });
}));

router.delete('/barangays/:id', wrap(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { error } = await admin.from('barangays').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw new HttpError(409, 'This barangay still has users or reports. Deactivate it instead.');
    throw error;
  }
  res.json({ ok: true });
}));

module.exports = router;
