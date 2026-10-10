update public.profiles
set role = 'admin', access_status = 'approved'
where id = (select id from auth.users where email = 'guri020406@gmail.com');