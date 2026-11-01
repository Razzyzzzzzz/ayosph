-- OPTIONAL: starter barangays so registration works immediately. Edit freely,
-- or skip this and add barangays from the Super Admin screen instead.
insert into public.barangays (name, city, province) values
  ('Sta. Rita', 'Guiguinto', 'Bulacan'),
  ('Tabang', 'Guiguinto', 'Bulacan')
on conflict do nothing;
