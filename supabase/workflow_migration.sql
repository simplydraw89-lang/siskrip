-- ==============================================================================
-- Migrasi SiSkrip: Seminar, Ujian, Revisi, Yudisium & Notifikasi
-- Jalankan di Supabase > SQL Editor > Run
-- ==============================================================================

-- 1. Tambah kolom tanggal_pelaksanaan & ruangan pada tabel pengajuan jika belum ada
alter table public.pengajuan
  add column if not exists tanggal_pelaksanaan date,
  add column if not exists ruangan text;

-- 2. Tabel penguji (Seminar Proposal, Seminar Hasil, Ujian Skripsi)
create table if not exists public.penguji (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  dosen_id uuid not null references public.profiles(id),
  peran text not null default 'penguji_1' check (peran in ('ketua_penguji','penguji_1','penguji_2','penguji_3','pembimbing')),
  nilai numeric(5,2) check (nilai >= 0 and nilai <= 100),
  catatan text,
  dinilai_pada timestamptz,
  created_at timestamptz default now(),
  constraint uq_pengajuan_dosen unique (pengajuan_id, dosen_id)
);

create index if not exists idx_penguji_pengajuan on public.penguji(pengajuan_id);
create index if not exists idx_penguji_dosen on public.penguji(dosen_id);

-- 3. Tabel revisi (Validasi Poin Revisi Dosen per Penguji/Pembimbing)
create table if not exists public.revisi (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  dosen_id uuid not null references public.profiles(id),
  isi text not null,
  status text not null default 'pending' check (status in ('pending', 'perlu_revisi', 'disetujui')),
  berkas_revisi_path text,
  catatan_validasi text,
  divalidasi_pada timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_revisi_pengajuan on public.revisi(pengajuan_id);
create index if not exists idx_revisi_dosen on public.revisi(dosen_id);

-- 4. Tabel notifikasi
create table if not exists public.notifikasi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  judul text not null,
  pesan text not null,
  link text,
  dibaca boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifikasi_user on public.notifikasi(user_id, dibaca);

-- ==============================================================================
-- Validasi Cek Bentrok Penguji & Mahasiswa
-- ==============================================================================

create or replace function check_bentrok_penguji() returns trigger language plpgsql security definer as $$
declare
  v_pengajuan public.pengajuan;
  v_skripsi public.skripsi;
  v_tanggal date;
  v_bentrok_count int;
begin
  select * into v_pengajuan from public.pengajuan where id = new.pengajuan_id;
  if not found then
    raise exception 'Pengajuan tidak ditemukan';
  end if;

  select * into v_skripsi from public.skripsi where id = v_pengajuan.skripsi_id;

  -- 1. Dosen penguji TIDAK BOLEH sama dengan mahasiswa yang bersangkutan
  if new.dosen_id = v_skripsi.mahasiswa_id then
    raise exception 'Dosen penguji tidak boleh sama dengan mahasiswa peserta ujian.';
  end if;

  -- Ambil tanggal pelaksanaan (dari pengajuan atau pendaftaran jadwal kuota)
  v_tanggal := coalesce(
    v_pengajuan.tanggal_pelaksanaan,
    (select tanggal from public.pendaftaran_jadwal 
     where user_id = v_skripsi.mahasiswa_id and jenis in ('seminar','ujian') 
     order by created_at desc limit 1)
  );

  -- 2. Cek bentrok: satu dosen tidak boleh menguji dua mahasiswa pada tanggal yang sama
  if v_tanggal is not null then
    select count(*) into v_bentrok_count
    from public.penguji p
    join public.pengajuan pj on pj.id = p.pengajuan_id
    join public.skripsi s on s.id = pj.skripsi_id
    where p.dosen_id = new.dosen_id
      and p.pengajuan_id != new.pengajuan_id
      and s.mahasiswa_id != v_skripsi.mahasiswa_id
      and coalesce(
        pj.tanggal_pelaksanaan,
        (select tanggal from public.pendaftaran_jadwal where user_id = s.mahasiswa_id and jenis in ('seminar','ujian') order by created_at desc limit 1)
      ) = v_tanggal
      and pj.status in ('terjadwal', 'diverifikasi');

    if v_bentrok_count > 0 then
      raise exception 'Dosen yang dipilih telah terdaftar menguji mahasiswa lain pada tanggal %. Terjadi bentrok jadwal.', v_tanggal;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_penguji_bentrok_check on public.penguji;
create trigger on_penguji_bentrok_check
  before insert or update of dosen_id on public.penguji
  for each row execute function check_bentrok_penguji();

-- ==============================================================================
-- Trigger Penyelesaian Revisi Secara Otomatis
-- Pengajuan baru 'selesai' jika semua validator menyetujui
-- ==============================================================================

create or replace function check_all_revisi_approved() returns trigger language plpgsql security definer as $$
declare
  v_pending_count int;
  v_total_count int;
begin
  select count(*), count(*) filter (where status != 'disetujui')
  into v_total_count, v_pending_count
  from public.revisi
  where pengajuan_id = new.pengajuan_id;

  if v_total_count > 0 and v_pending_count = 0 then
    -- Semua validator telah menyetujui revisi -> tandai pengajuan 'selesai'
    update public.pengajuan
    set status = 'selesai',
        updated_at = now(),
        catatan = 'Seluruh poin revisi telah disetujui oleh dosen penguji dan pembimbing.'
    where id = new.pengajuan_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_revisi_validation_check on public.revisi;
create trigger on_revisi_validation_check
  after update of status on public.revisi
  for each row execute function check_all_revisi_approved();

-- ==============================================================================
-- Trigger Yudisium Selesai -> profiles.status otomatis menjadi 'alumni'
-- ==============================================================================

create or replace function handle_yudisium_alumni() returns trigger language plpgsql security definer as $$
declare
  v_mhs_id uuid;
begin
  if new.jenis = 'yudisium' and new.status = 'selesai' and (old.status is null or old.status != 'selesai') then
    select mahasiswa_id into v_mhs_id from public.skripsi where id = new.skripsi_id;
    if v_mhs_id is not null then
      update public.profiles
      set status = 'alumni'
      where id = v_mhs_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_yudisium_completed on public.pengajuan;
create trigger on_yudisium_completed
  after update of status on public.pengajuan
  for each row execute function handle_yudisium_alumni();

-- ==============================================================================
-- Trigger Otomatis Pembuatan Notifikasi saat Status Pengajuan Berubah
-- ==============================================================================

create or replace function create_notifikasi_on_pengajuan_change() returns trigger language plpgsql security definer as $$
declare
  v_skripsi public.skripsi;
  v_judul_notif text;
  v_pesan_notif text;
  v_jenis_label text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select * into v_skripsi from public.skripsi where id = new.skripsi_id;
  if not found then return new; end if;

  case new.jenis
    when 'proposal' then v_jenis_label := 'Proposal Skripsi';
    when 'seminar_proposal' then v_jenis_label := 'Seminar Proposal';
    when 'seminar_hasil' then v_jenis_label := 'Seminar Hasil';
    when 'ujian' then v_jenis_label := 'Ujian Skripsi / Pendadaran';
    when 'yudisium' then v_jenis_label := 'Pendaftaran Yudisium';
    else v_jenis_label := new.jenis;
  end case;

  -- 1. Notifikasi untuk Mahasiswa
  v_judul_notif := 'Update ' || v_jenis_label;
  case new.status
    when 'diajukan' then
      v_pesan_notif := 'Pengajuan ' || v_jenis_label || ' Anda berhasil terkirim dan sedang menunggu verifikasi berkas oleh admin.';
    when 'diverifikasi' then
      v_pesan_notif := 'Berkas ' || v_jenis_label || ' Anda telah diverifikasi oleh admin departemen.';
    when 'terjadwal' then
      v_pesan_notif := 'Jadwal ' || v_jenis_label || ' dan tim dosen penguji Anda telah ditetapkan.';
    when 'disetujui' then
      v_pesan_notif := 'Pengajuan ' || v_jenis_label || ' Anda telah disetujui oleh dosen pembimbing.';
    when 'revisi' then
      v_pesan_notif := 'Terdapat catatan revisi untuk ' || v_jenis_label || ' Anda: ' || coalesce(new.catatan, 'Silakan periksa di portal.');
    when 'ditolak' then
      v_pesan_notif := 'Pengajuan ' || v_jenis_label || ' Anda ditolak. Catatan: ' || coalesce(new.catatan, '-');
    when 'selesai' then
      v_pesan_notif := 'Selamat! Tahapan ' || v_jenis_label || ' Anda telah resmi dinyatakan selesai.';
    else
      v_pesan_notif := 'Status ' || v_jenis_label || ' berubah menjadi ' || new.status;
  end case;

  insert into public.notifikasi (user_id, judul, pesan, link)
  values (v_skripsi.mahasiswa_id, v_judul_notif, v_pesan_notif, '/skripsi');

  -- 2. Notifikasi untuk Pembimbing saat mahasiswa mengajukan atau diverifikasi
  if new.status in ('diajukan', 'diverifikasi') then
    if v_skripsi.pembimbing1_id is not null then
      insert into public.notifikasi (user_id, judul, pesan, link)
      values (v_skripsi.pembimbing1_id, 'Telaah ' || v_jenis_label, 'Mahasiswa bimbingan mengajukan ' || v_jenis_label || '. Mohon lakukan penelaahan.', '/bimbingan');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_pengajuan_notifikasi on public.pengajuan;
create trigger on_pengajuan_notifikasi
  after insert or update of status on public.pengajuan
  for each row execute function create_notifikasi_on_pengajuan_change();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

alter table public.penguji enable row level security;
alter table public.revisi enable row level security;
alter table public.notifikasi enable row level security;

-- Penguji RLS
drop policy if exists "baca penguji terkait" on public.penguji;
create policy "baca penguji terkait" on public.penguji for select to authenticated
  using (
    dosen_id = auth.uid() 
    or is_admin() 
    or exists (
      select 1 from public.pengajuan pj
      join public.skripsi s on s.id = pj.skripsi_id
      where pj.id = penguji.pengajuan_id
        and (s.mahasiswa_id = auth.uid() or auth.uid() in (s.pembimbing1_id, s.pembimbing2_id))
    )
  );

drop policy if exists "kelola penguji admin" on public.penguji;
create policy "kelola penguji admin" on public.penguji for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "isi nilai penguji" on public.penguji;
create policy "isi nilai penguji" on public.penguji for update to authenticated
  using (dosen_id = auth.uid() or is_admin())
  with check (dosen_id = auth.uid() or is_admin());

-- Revisi RLS
drop policy if exists "baca revisi terkait" on public.revisi;
create policy "baca revisi terkait" on public.revisi for select to authenticated
  using (
    dosen_id = auth.uid() 
    or is_admin() 
    or exists (
      select 1 from public.pengajuan pj
      join public.skripsi s on s.id = pj.skripsi_id
      where pj.id = revisi.pengajuan_id and s.mahasiswa_id = auth.uid()
    )
  );

drop policy if exists "buat dan ubah revisi dosen dan admin" on public.revisi;
create policy "buat dan ubah revisi dosen dan admin" on public.revisi for all to authenticated
  using (dosen_id = auth.uid() or is_admin())
  with check (dosen_id = auth.uid() or is_admin());

drop policy if exists "unggah revisi mahasiswa" on public.revisi;
create policy "unggah revisi mahasiswa" on public.revisi for update to authenticated
  using (
    exists (
      select 1 from public.pengajuan pj
      join public.skripsi s on s.id = pj.skripsi_id
      where pj.id = revisi.pengajuan_id and s.mahasiswa_id = auth.uid()
    )
  );

-- Notifikasi RLS
drop policy if exists "baca notifikasi sendiri" on public.notifikasi;
create policy "baca notifikasi sendiri" on public.notifikasi for select to authenticated
  using (user_id = auth.uid() or is_admin());

drop policy if exists "update notifikasi sendiri" on public.notifikasi;
create policy "update notifikasi sendiri" on public.notifikasi for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
