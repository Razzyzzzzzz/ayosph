const { admin } = require('../supabase');

// Verifies the Supabase access token and loads the caller's profile (role + barangay).
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) {
      // Log the real reason so config problems (wrong project / wrong key) are visible.
      console.error('[auth] getUser failed:', error?.status, error?.name, error?.message);
      // Network / Supabase outage is not the user's fault: don't force a logout.
      if (error?.name === 'AuthRetryableFetchError' || error?.status >= 500) {
        return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
      }
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const { data: profile, error: profileErr } = await admin
      .from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    if (profileErr) {
      console.error('[auth] profile lookup failed:', profileErr.message);
      return res.status(500).json({ error: 'Could not load profile' });
    }
    if (!profile) return res.status(403).json({ error: 'Profile not found' });

    req.user = { id: data.user.id, email: data.user.email };
    req.profile = profile;
    next();
  } catch (e) { next(e); }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.profile?.role) ? next() : res.status(403).json({ error: 'You do not have permission to do this' });

module.exports = { requireAuth, requireRole };