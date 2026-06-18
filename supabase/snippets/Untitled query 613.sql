INSERT INTO public.profiles (id, full_name, role)
SELECT id, coalesce(raw_user_meta_data->>'full_name', 'System Admin'), 'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';
