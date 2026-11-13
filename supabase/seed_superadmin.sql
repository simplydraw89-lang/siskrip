-- ==============================================================================
-- SiSkrip: Seed Super Admin (super@admin.test / adm123)
-- Jalankan di Supabase > SQL Editor > Run
-- CATATAN: Pastikan supabase/schema.sql sudah dijalankan terlebih dahulu!
-- ==============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_user_id uuid;
begin
  -- 1. Cek apakah user super@admin.test sudah ada di auth.users
  select id into v_user_id from auth.users where email = 'super@admin.test';

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    -- Tambahkan user baru ke auth.users
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'super@admin.test',
      extensions.crypt('adm123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nama":"Super Admin","role":"admin","noid":"ADM-PRK-001","prodi":"Fakultas Perikanan"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Tambahkan identitas login email ke auth.identities
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id::text,
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id, 'super@admin.test')::jsonb,
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    -- Jika sudah ada, reset password menjadi adm123 dan konfirmasi email
    update auth.users
    set encrypted_password = extensions.crypt('adm123', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_set(
          coalesce(raw_user_meta_data, '{}'::jsonb),
          '{role}',
          '"admin"'
        ),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- 2. Pastikan data profile memiliki role 'admin' dan status 'aktif'
  insert into public.profiles (id, nama, noid, prodi, role, status)
  values (v_user_id, 'Super Admin', 'ADM-PRK-001', 'Fakultas Perikanan', 'admin', 'aktif')
  on conflict (id) do update
  set role = 'admin',
      status = 'aktif',
      nama = 'Super Admin',
      noid = coalesce(public.profiles.noid, 'ADM-PRK-001'),
      prodi = coalesce(public.profiles.prodi, 'Fakultas Perikanan');

end $$;
