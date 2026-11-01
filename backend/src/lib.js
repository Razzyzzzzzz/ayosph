const { admin, BUCKET } = require('./supabase');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Authorization rules (mirrored by RLS in the database)
const canView = (profile, report) =>
  profile.role === 'admin' ||
  report.reporter_id === profile.id ||
  (profile.role === 'staff' && !!profile.barangay_id && report.barangay_id === profile.barangay_id);
const canManage = (profile, report) =>
  profile.role === 'admin' ||
  (profile.role === 'staff' && !!profile.barangay_id && report.barangay_id === profile.barangay_id);

// Replace storage paths with short-lived signed URLs (bucket is private).
async function signReports(list) {
  const paths = new Set();
  list.forEach((r) => ['photo_path', 'before_photo_path', 'after_photo_path'].forEach((k) => r[k] && paths.add(r[k])));
  let map = {};
  if (paths.size) {
    const { data } = await admin.storage.from(BUCKET).createSignedUrls([...paths], 3600);
    (data || []).forEach((d) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
  }
  return list.map((r) => ({
    ...r,
    photo_url: map[r.photo_path] || null,
    before_photo_url: map[r.before_photo_path] || null,
    after_photo_url: map[r.after_photo_path] || null,
  }));
}

module.exports = { HttpError, wrap, canView, canManage, signReports };
