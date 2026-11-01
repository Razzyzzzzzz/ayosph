-- Register normally in the app first, then run this ONCE to create your first Super Admin.
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
