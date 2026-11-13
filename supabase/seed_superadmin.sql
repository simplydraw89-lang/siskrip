-- ==============================================================================
-- SiSkrip: Jadikan spr@admin.ac.id sebagai Super Admin
-- Jalankan di Supabase > SQL Editor > Run
-- ==============================================================================

-- 1. Update tabel public.profiles agar akun spr@admin.ac.id menjadi role 'admin' dan berstatus 'aktif'
update public.profiles
set role = 'admin',
    status = 'aktif',
    nama = coalesce(nama, 'Super Admin'),
    noid = coalesce(noid, 'ADM-PRK-001'),
    prodi = coalesce(prodi, 'Fakultas Perikanan')
where id = (select id from auth.users where email = 'spr@admin.ac.id');

-- 2. Pastikan email terkonfirmasi di auth.users (jika belum)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = jsonb_set(
      coalesce(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
where email = 'spr@admin.ac.id';

-- 3. Verifikasi hasil update
select id, email, email_confirmed_at from auth.users where email = 'spr@admin.ac.id';
select * from public.profiles where id = (select id from auth.users where email = 'spr@admin.ac.id');
