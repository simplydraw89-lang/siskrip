-- ==============================================================================
-- Migrasi SiSkrip: Alur Pengajuan Skripsi, Berkas & Persetujuan Dosen
-- Jalankan di Supabase > SQL Editor > Run
-- ==============================================================================

-- 1. Tabel skripsi
create table if not exists public.skripsi (
  id uuid primary key default gen_random_uuid(),
  mahasiswa_id uuid not null references public.profiles(id) on delete cascade,
  judul text not null,
  abstrak text,
  pembimbing1_id uuid not null references public.profiles(id),
  pembimbing2_id uuid references public.profiles(id),
  tahap_saat_ini text not null default 'proposal' check (tahap_saat_ini in ('proposal','seminar_proposal','seminar_hasil','ujian','yudisium','selesai')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_skripsi_mahasiswa unique (mahasiswa_id)
);

-- 2. Tabel pengajuan
create table if not exists public.pengajuan (
  id uuid primary key default gen_random_uuid(),
  skripsi_id uuid not null references public.skripsi(id) on delete cascade,
  jenis text not null check (jenis in ('proposal','seminar_proposal','seminar_hasil','ujian','yudisium')),
  status text not null default 'draft' check (status in ('draft','diajukan','diverifikasi','disetujui','revisi','ditolak','terjadwal','selesai')),
  catatan text,
  dibuat_pada timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Tabel berkas
create table if not exists public.berkas (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  nama text not null,
  path text not null,
  ukuran bigint,
  diunggah_oleh uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- 4. Tabel audit_log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  pengajuan_id uuid not null references public.pengajuan(id) on delete cascade,
  user_id uuid references auth.users(id),
  status_lama text,
  status_baru text not null,
  catatan text,
  created_at timestamptz default now()
);

-- Index untuk performa query
create index if not exists idx_skripsi_mahasiswa on public.skripsi(mahasiswa_id);
create index if not exists idx_skripsi_pembimbing1 on public.skripsi(pembimbing1_id);
create index if not exists idx_skripsi_pembimbing2 on public.skripsi(pembimbing2_id);
create index if not exists idx_pengajuan_skripsi on public.pengajuan(skripsi_id);
create index if not exists idx_berkas_pengajuan on public.berkas(pengajuan_id);
create index if not exists idx_audit_log_pengajuan on public.audit_log(pengajuan_id);

-- ==============================================================================
-- Aturan Alur & Triggers
-- ==============================================================================

-- A. Trigger Audit Log
create or replace function log_pengajuan_audit() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(pengajuan_id, user_id, status_lama, status_baru, catatan)
    values (new.id, auth.uid(), null, new.status, new.catatan);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log(pengajuan_id, user_id, status_lama, status_baru, catatan)
    values (new.id, auth.uid(), old.status, new.status, coalesce(new.catatan, 'Perubahan status menjadi ' || new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists on_pengajuan_audit on public.pengajuan;
create trigger on_pengajuan_audit
  after insert or update on public.pengajuan
  for each row execute function log_pengajuan_audit();

-- B. Validasi Alur Pengajuan (Urutan Tahap & Jadwal)
create or replace function check_pengajuan_rule() returns trigger language plpgsql security definer as $$
declare
  v_skripsi public.skripsi;
  v_prev_jenis text;
  v_prev_selesai boolean;
  v_has_jadwal boolean;
begin
  select * into v_skripsi from public.skripsi where id = new.skripsi_id;
  if not found then
    raise exception 'Data skripsi tidak ditemukan';
  end if;

  -- 1. Cek urutan tahap: Tahap berikutnya hanya bisa diajukan jika tahap sebelumnya berstatus 'selesai'
  case new.jenis
    when 'proposal' then
      v_prev_jenis := null;
    when 'seminar_proposal' then
      v_prev_jenis := 'proposal';
    when 'seminar_hasil' then
      v_prev_jenis := 'seminar_proposal';
    when 'ujian' then
      v_prev_jenis := 'seminar_hasil';
    when 'yudisium' then
      v_prev_jenis := 'ujian';
  end case;

  if v_prev_jenis is not null then
    select exists (
      select 1 from public.pengajuan 
      where skripsi_id = new.skripsi_id 
        and jenis = v_prev_jenis 
        and status in ('selesai', 'disetujui')
    ) into v_prev_selesai;

    if not v_prev_selesai then
      raise exception 'Tahap % hanya bisa diajukan jika tahap % sebelumnya sudah berstatus selesai atau disetujui.', new.jenis, v_prev_jenis;
    end if;
  end if;

  -- 2. Seminar dan ujian hanya bisa diajukan jika mahasiswa sudah punya jadwal dari kuota yang ada
  if new.jenis in ('seminar_proposal', 'seminar_hasil') then
    select exists (
      select 1 from public.pendaftaran_jadwal 
      where user_id = v_skripsi.mahasiswa_id and jenis = 'seminar'
    ) into v_has_jadwal;
    if not v_has_jadwal then
      raise exception 'Pengajuan % memerlukan jadwal seminar aktif yang terdaftar.', new.jenis;
    end if;
  elsif new.jenis = 'ujian' then
    select exists (
      select 1 from public.pendaftaran_jadwal 
      where user_id = v_skripsi.mahasiswa_id and jenis = 'ujian'
    ) into v_has_jadwal;
    if not v_has_jadwal then
      raise exception 'Pengajuan ujian skripsi memerlukan jadwal ujian aktif yang terdaftar.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_pengajuan_check on public.pengajuan;
create trigger on_pengajuan_check
  before insert on public.pengajuan
  for each row execute function check_pengajuan_rule();

-- C. Sinkronisasi Tahap Saat Ini pada Tabel Skripsi
create or replace function sync_skripsi_tahap() returns trigger language plpgsql security definer as $$
begin
  if new.status in ('selesai', 'disetujui') and (old.status is null or old.status is distinct from new.status) then
    case new.jenis
      when 'proposal' then
        update public.skripsi set tahap_saat_ini = 'seminar_proposal', updated_at = now() where id = new.skripsi_id;
      when 'seminar_proposal' then
        update public.skripsi set tahap_saat_ini = 'seminar_hasil', updated_at = now() where id = new.skripsi_id;
      when 'seminar_hasil' then
        update public.skripsi set tahap_saat_ini = 'ujian', updated_at = now() where id = new.skripsi_id;
      when 'ujian' then
        update public.skripsi set tahap_saat_ini = 'yudisium', updated_at = now() where id = new.skripsi_id;
      when 'yudisium' then
        update public.skripsi set tahap_saat_ini = 'selesai', updated_at = now() where id = new.skripsi_id;
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists on_pengajuan_status_sync on public.pengajuan;
create trigger on_pengajuan_status_sync
  after update on public.pengajuan
  for each row execute function sync_skripsi_tahap();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

alter table public.skripsi enable row level security;
alter table public.pengajuan enable row level security;
alter table public.berkas enable row level security;
alter table public.audit_log enable row level security;

-- Skripsi RLS
drop policy if exists "baca skripsi terkait" on public.skripsi;
create policy "baca skripsi terkait" on public.skripsi for select to authenticated
  using (
    auth.uid() = mahasiswa_id 
    or auth.uid() in (pembimbing1_id, pembimbing2_id)
    or is_admin()
  );

drop policy if exists "buat skripsi sendiri" on public.skripsi;
create policy "buat skripsi sendiri" on public.skripsi for insert to authenticated
  with check (auth.uid() = mahasiswa_id or is_admin());

drop policy if exists "ubah skripsi sendiri atau pembimbing" on public.skripsi;
create policy "ubah skripsi sendiri atau pembimbing" on public.skripsi for update to authenticated
  using (
    auth.uid() = mahasiswa_id 
    or auth.uid() in (pembimbing1_id, pembimbing2_id)
    or is_admin()
  );

-- Pengajuan RLS
drop policy if exists "baca pengajuan terkait" on public.pengajuan;
create policy "baca pengajuan terkait" on public.pengajuan for select to authenticated
  using (
    exists (
      select 1 from public.skripsi s
      where s.id = pengajuan.skripsi_id 
        and (s.mahasiswa_id = auth.uid() or auth.uid() in (s.pembimbing1_id, s.pembimbing2_id))
    )
    or is_admin()
  );

drop policy if exists "buat pengajuan mahasiswa" on public.pengajuan;
create policy "buat pengajuan mahasiswa" on public.pengajuan for insert to authenticated
  with check (
    exists (
      select 1 from public.skripsi s
      where s.id = pengajuan.skripsi_id and s.mahasiswa_id = auth.uid()
    )
    or is_admin()
  );

drop policy if exists "ubah pengajuan pihak terkait" on public.pengajuan;
create policy "ubah pengajuan pihak terkait" on public.pengajuan for update to authenticated
  using (
    exists (
      select 1 from public.skripsi s
      where s.id = pengajuan.skripsi_id 
        and (s.mahasiswa_id = auth.uid() or auth.uid() in (s.pembimbing1_id, s.pembimbing2_id))
    )
    or is_admin()
  );

-- Berkas RLS
drop policy if exists "baca berkas terkait" on public.berkas;
create policy "baca berkas terkait" on public.berkas for select to authenticated
  using (
    exists (
      select 1 from public.pengajuan p
      join public.skripsi s on s.id = p.skripsi_id
      where p.id = berkas.pengajuan_id
        and (s.mahasiswa_id = auth.uid() or auth.uid() in (s.pembimbing1_id, s.pembimbing2_id))
    )
    or is_admin()
  );

drop policy if exists "unggah berkas pemilik" on public.berkas;
create policy "unggah berkas pemilik" on public.berkas for insert to authenticated
  with check (auth.uid() = diunggah_oleh or is_admin());

-- Audit Log RLS
drop policy if exists "baca audit log terkait" on public.audit_log;
create policy "baca audit log terkait" on public.audit_log for select to authenticated
  using (
    exists (
      select 1 from public.pengajuan p
      join public.skripsi s on s.id = p.skripsi_id
      where p.id = audit_log.pengajuan_id
        and (s.mahasiswa_id = auth.uid() or auth.uid() in (s.pembimbing1_id, s.pembimbing2_id))
    )
    or is_admin()
  );

-- ==============================================================================
-- Supabase Storage: Bucket 'berkas' privat
-- Batasan: Hanya PDF dan maksimal 10 MB (10485760 bytes)
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('berkas', 'berkas', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "Akses berkas authenticated" on storage.objects;
create policy "Akses berkas authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'berkas');

drop policy if exists "Upload berkas PDF max 10MB" on storage.objects;
create policy "Upload berkas PDF max 10MB" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'berkas' 
    and (lower(name) like '%.pdf')
  );

drop policy if exists "Hapus berkas sendiri atau admin" on storage.objects;
create policy "Hapus berkas sendiri atau admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'berkas' 
    and (auth.uid() = owner or is_admin())
  );
