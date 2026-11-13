-- SiSkrip: jalankan seluruh isi file ini di Supabase > SQL Editor > Run
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  nama text, noid text, prodi text,
  role text not null default 'mahasiswa' check (role in ('mahasiswa','dosen','admin')),
  status text not null default 'aktif',
  created_at timestamptz default now());

create table pengaturan_jadwal(
  id int primary key default 1 check (id = 1),
  hari int[] not null default '{2,4}',  -- 0=Min,1=Sen,2=Sel,3=Rab,4=Kam,5=Jum,6=Sab
  kuota int not null default 5);
insert into pengaturan_jadwal(id) values (1);

create table pendaftaran_jadwal(
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  user_id uuid not null references auth.users on delete cascade,
  jenis text not null check (jenis in ('seminar','ujian')),
  created_at timestamptz default now(),
  unique (user_id, jenis));

-- profil otomatis dibuat saat daftar; peran admin TIDAK bisa dipilih dari form
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role','mahasiswa');
begin
  if r not in ('mahasiswa','dosen') then r := 'mahasiswa'; end if;
  insert into profiles(id,nama,noid,prodi,role,status) values (
    new.id, coalesce(new.raw_user_meta_data->>'nama', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'noid', new.raw_user_meta_data->>'prodi', r,
    case when r='dosen' then 'pending' else 'aktif' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security;
alter table pengaturan_jadwal enable row level security;
alter table pendaftaran_jadwal enable row level security;
create policy "profil sendiri" on profiles for select using (auth.uid() = id);
create policy "ubah profil sendiri" on profiles for update using (auth.uid() = id);
revoke update on profiles from authenticated;
grant update (nama, noid, prodi) on profiles to authenticated;  -- role & status tidak bisa diubah user
create policy "baca pengaturan" on pengaturan_jadwal for select to authenticated using (true);
create policy "jadwal sendiri" on pendaftaran_jadwal for select using (auth.uid() = user_id);
create policy "batal sendiri" on pendaftaran_jadwal for delete using (auth.uid() = user_id);

-- jumlah terdaftar per tanggal (tanpa membuka data orang lain)
create function slot_terpakai() returns table(tanggal date, n bigint) language sql security definer set search_path = public as $$
  select tanggal, count(*) from pendaftaran_jadwal where tanggal > current_date group by 1 $$;

-- pendaftaran dengan kuota & hari terkunci; aman walau banyak orang klik bersamaan
create function daftar_jadwal(p_tanggal date, p_jenis text) returns text language plpgsql security definer set search_path = public as $$
declare s pengaturan_jadwal; n int;
begin
  if auth.uid() is null then return 'Belum login'; end if;
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
grant execute on function slot_terpakai(), daftar_jadwal(date,text) to authenticated;

-- Menjadikan diri sendiri admin (ganti emailnya), jalankan SETELAH Anda mendaftar:
-- update profiles set role='admin' where id=(select id from auth.users where email='EMAIL_ANDA');
-- Mengubah kuota/hari: update pengaturan_jadwal set kuota=8, hari='{1,3}';
