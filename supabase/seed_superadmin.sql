-- ==============================================================================
-- SiSkrip: Jadikan spr@admin.ac.id sebagai Super Admin
-- Jalankan di Supabase > SQL Editor > Run
-- ==============================================================================

-- 1. Perbarui trigger agar mengizinkan eksekusi langsung dari SQL Editor (auth.uid() is null)
create or replace function check_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Hanya admin yang memiliki wewenang untuk mengubah role atau status akun.';
    end if;
  end if;
  return new;
end;
$$;

-- 2. Update tabel public.profiles agar akun spr@admin.ac.id menjadi role 'admin' dan berstatus 'aktif'
update public.profiles
set role = 'admin',
    status = 'aktif',
    nama = 'Super Admin',
    noid = 'ADM-PRK-001',
    prodi = 'Fakultas Perikanan'
where id = (select id from auth.users where email = 'spr@admin.ac.id');

-- 3. Pastikan email terkonfirmasi di auth.users (tanpa perlu klik link aktivasi email)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_user_meta_data = jsonb_set(
      coalesce(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
where email = 'spr@admin.ac.id';

-- 4. Verifikasi hasil update
select id, email, email_confirmed_at from auth.users where email = 'spr@admin.ac.id';
select * from public.profiles where id = (select id from auth.users where email = 'spr@admin.ac.id');
