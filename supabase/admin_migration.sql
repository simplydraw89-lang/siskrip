-- Migrasi Area Admin & RLS Security Definer untuk SiSkrip
-- Jalankan di Supabase > SQL Editor > Run

-- 1. Fungsi security definer untuk mengecek apakah user adalah admin
-- Fungsi ini membypass RLS pada profiles saat membaca role, sehingga TIDAK terjadi rekursi RLS
create or replace function is_admin() returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function is_admin() to authenticated;

-- 2. Trigger untuk memastikan user biasa TIDAK BISA mengubah role atau status dirinya sendiri
create or replace function check_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Hanya admin yang memiliki wewenang untuk mengubah role atau status akun.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_update on profiles;
create trigger on_profile_update
  before update on profiles
  for each row execute function check_profile_update();

-- Berikan izin update kolom status & role ke authenticated (eksekusinya diproteksi oleh trigger di atas & policy)
grant update (status, role) on profiles to authenticated;

-- 3. Policy Admin pada tabel profiles
-- Admin bisa melihat seluruh profil pengguna
drop policy if exists "admin baca semua profil" on profiles;
create policy "admin baca semua profil" on profiles
  for select to authenticated
  using (is_admin());

-- Admin bisa mengupdate profil pengguna (misal: verifikasi status dosen)
drop policy if exists "admin ubah profil" on profiles;
create policy "admin ubah profil" on profiles
  for update to authenticated
  using (is_admin());

-- 4. Policy Admin pada tabel pengaturan_jadwal
grant update on pengaturan_jadwal to authenticated;

drop policy if exists "admin ubah pengaturan" on pengaturan_jadwal;
create policy "admin ubah pengaturan" on pengaturan_jadwal
  for update to authenticated
  using (is_admin());

-- 5. Policy Admin pada tabel pendaftaran_jadwal
grant delete on pendaftaran_jadwal to authenticated;

-- Admin bisa membaca semua peserta pendaftaran jadwal
drop policy if exists "admin baca semua jadwal" on pendaftaran_jadwal;
create policy "admin baca semua jadwal" on pendaftaran_jadwal
  for select to authenticated
  using (is_admin());

-- Admin bisa membatalkan pendaftaran jadwal peserta
drop policy if exists "admin hapus jadwal" on pendaftaran_jadwal;
create policy "admin hapus jadwal" on pendaftaran_jadwal
  for delete to authenticated
  using (is_admin());

-- 6. Policy Admin pada tabel pengumuman
grant all on pengumuman to authenticated;

drop policy if exists "admin kelola pengumuman" on pengumuman;
create policy "admin kelola pengumuman" on pengumuman
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- 7. Cegah pendaftaran jadwal oleh dosen yang masih berstatus 'pending'
create or replace function daftar_jadwal(p_tanggal date, p_jenis text) returns text language plpgsql security definer set search_path = public as $$
declare s pengaturan_jadwal; n int; u_status text;
begin
  if auth.uid() is null then return 'Belum login'; end if;
  
  select status into u_status from profiles where id = auth.uid();
  if u_status = 'pending' then
    return 'Akun Anda masih dalam status pending dan belum diverifikasi admin';
  end if;
  if u_status = 'ditolak' then
    return 'Akun Anda ditolak oleh admin departemen';
  end if;

  select * into s from pengaturan_jadwal where id = 1;
  if p_tanggal <= current_date then return 'Tanggal sudah lewat'; end if;
  if not (extract(dow from p_tanggal)::int = any(s.hari)) then return 'Bukan hari seminar/ujian'; end if;
  perform pg_advisory_xact_lock(hashtext(p_tanggal::text));
  select count(*) into n from pendaftaran_jadwal where tanggal = p_tanggal;
  if n >= s.kuota then return 'Kuota tanggal ini sudah penuh, pilih tanggal lain'; end if;
  insert into pendaftaran_jadwal(tanggal,user_id,jenis) values (p_tanggal, auth.uid(), p_jenis);
  return 'ok';
exception when unique_violation then return 'Anda sudah punya jadwal ' || p_jenis;
end $$;
