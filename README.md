# AyosPH — Barangay Issue Reporting

Residents report problems (potholes, garbage, broken streetlights, drainage, public facilities); barangay staff verify and resolve them; a Super Admin manages users and barangays.

**Stack:** Expo (React Native) · Node.js + Express API · Supabase (PostgreSQL, Auth, Storage)

```
ayosph/
├─ supabase/migrations/001_init.sql      schema, triggers, RLS, storage bucket
├─ supabase/migrations/002_optional_seed.sql   example barangays (optional)
├─ supabase/promote_admin.sql            create your first Super Admin
├─ backend/                              Express API (service-role, role-checked)
└─ mobile/                               Expo app
```

## 1. Supabase setup
1. Create a project at supabase.com.
2. **SQL Editor** → paste and run `supabase/migrations/001_init.sql`. Optionally run `002_optional_seed.sql`.
3. **Authentication → Providers → Email**: for quick local testing turn **Confirm email** off (or keep it on and confirm via inbox).
4. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.

## 2. Backend
```bash
cd backend
cp .env.example .env     # fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev              # http://localhost:4000/api/health -> {"ok":true}
```

## 3. Mobile
```bash
cd mobile
cp .env.example .env     # SUPABASE_URL, ANON key, and EXPO_PUBLIC_API_URL
npm install
npx expo install --fix   # aligns package versions with your Expo SDK
npx expo start           # scan QR with Expo Go (same Wi-Fi as your computer)
```
`EXPO_PUBLIC_API_URL`: use your computer's LAN IP (e.g. `http://192.168.1.10:4000`) on a real phone, `http://10.0.2.2:4000` on the Android emulator. Restart Expo after editing `.env`.

## 4. First run (end-to-end)
1. In the app, **register** an account → then run `supabase/promote_admin.sql` (with your email) in the SQL Editor → log out/in. You are now Super Admin.
2. **Admin → Barangays → Add barangay** (skip if you ran the seed).
3. Register a **resident** (picks a barangay) and a second account; in **Admin → Users** set it to **Barangay Staff** and assign the same barangay.
4. Resident: **New report** (photo + GPS auto-captured) → appears in *My reports* as Pending.
5. Staff: sees it in Dashboard, opens it, sets **Verified → In Progress → Resolved**, adds notes, uploads before/after photos.
6. Resident gets an in-app notification for every status change (realtime + badge on the Notifications tab).

## Roles & security
| Role | Can do |
|---|---|
| Resident | Register, submit reports (own barangay), view only own reports, notifications |
| Barangay Staff | View/manage reports **only in their assigned barangay**: status, notes, before/after photos |
| Super Admin | Everything above for all barangays + manage user roles, barangays, activity overview |

- **Auth:** Supabase Auth; the API verifies the JWT on every request and loads role/barangay from `profiles`.
- **Two enforcement layers:** API checks (`backend/src/lib.js`, middleware) *and* Postgres **RLS** on every table.
- Signup always creates a `resident` (trigger ignores any client-supplied role); only an admin can promote. A trigger blocks self-promotion via direct DB access.
- Photos live in a **private** bucket; the API returns 1-hour signed URLs. Uploads limited to JPG/PNG/WEBP, 8 MB.
- Input validated with Zod server-side; Helmet, rate limiting, CORS off by default. The service-role key lives only on the server.
- Status-change and new-report notifications are created by DB triggers, so they can't be skipped.

## Deployment
**API** (Render / Railway / Fly.io): root `backend`, build `npm install`, start `npm start`, env vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (PORT is provided by the host). Verify `https://<host>/api/health`.

**Mobile:** set `EXPO_PUBLIC_API_URL` to the HTTPS API URL, then
```bash
npm i -g eas-cli && eas login && eas build:configure
eas build -p android --profile preview     # installable APK
```
Production iOS/Android builds require HTTPS for the API.

## API summary (all under `/api`, Bearer token required unless noted)
`GET /barangays` (public) · `GET/PATCH /me` · `GET /stats` · `GET/POST /reports` · `GET /reports/:id` · `PATCH /reports/:id/status` · `POST /reports/:id/notes` · `POST /reports/:id/photos` · `GET /notifications`, `/notifications/unread-count`, `POST /notifications/read` · admin: `GET /admin/activity`, `GET/PATCH /admin/users`, `POST/PATCH/DELETE /admin/barangays`
