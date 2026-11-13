-- ==============================================================================
-- Migrasi SiSkrip: Forum Fakultas dan Alumni
-- Jalankan di Supabase > SQL Editor > Run
-- ==============================================================================

-- 1. Tabel forum_kategori
create table if not exists public.forum_kategori (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nama text not null,
  tipe text not null check (tipe in ('fakultas', 'alumni')),
  deskripsi text,
  urutan int default 0,
  created_at timestamptz default now()
);

-- Seed kategori default
insert into public.forum_kategori (slug, nama, tipe, deskripsi, urutan)
values
  ('akademik', 'Akademik & Perkuliahan', 'fakultas', 'Diskusi seputar mata kuliah, kurikulum, dan kegiatan akademik fakultas.', 1),
  ('beasiswa', 'Informasi Beasiswa', 'fakultas', 'Berbagi peluang beasiswa dalam & luar negeri, tips seleksi, dan beasiswa riset.', 2),
  ('lomba', 'Kompetisi & Lomba Ilmiah', 'fakultas', 'Info PKM, lomba karya tulis ilmiah, dan ajang kompetisi kemahasiswaan.', 3),
  ('tanya_skripsi', 'Tanya-Jawab Skripsi & Riset', 'fakultas', 'Diskusi metodologi riset, alat lab, analisis data statistik, dan bimbingan.', 4),
  ('loker', 'Lowongan Kerja & Magang', 'alumni', 'Peluang karier industri perikanan, instansi pemerintah (KKP), BUMN, dan startup.', 5),
  ('cerita_karier', 'Cerita Karier & Pengalaman', 'alumni', 'Kisah inspiratif para alumni perikanan menembus dunia kerja dan wirausaha.', 6),
  ('jejaring', 'Jejaring Alumni & Silaturahmi', 'alumni', 'Wadah silaturahmi, reuni angkatan, dan kolaborasi profesional alumni.', 7)
on conflict (slug) do update set
  nama = excluded.nama,
  tipe = excluded.tipe,
  deskripsi = excluded.deskripsi,
  urutan = excluded.urutan;

-- 2. Tabel forum_thread
create table if not exists public.forum_thread (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  kategori_id uuid not null references public.forum_kategori(id) on delete cascade,
  penulis_id uuid not null references public.profiles(id) on delete cascade,
  disematkan boolean not null default false,
  dikunci boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_thread_kategori on public.forum_thread(kategori_id);
create index if not exists idx_thread_penulis on public.forum_thread(penulis_id);
create index if not exists idx_thread_disematkan on public.forum_thread(disematkan desc, created_at desc);

-- 3. Tabel forum_post (balasan komentar)
create table if not exists public.forum_post (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_thread(id) on delete cascade,
  penulis_id uuid not null references public.profiles(id) on delete cascade,
  isi text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_post_thread on public.forum_post(thread_id, created_at asc);

-- 4. Tabel forum_like
create table if not exists public.forum_like (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_thread(id) on delete cascade,
  post_id uuid references public.forum_post(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  constraint chk_like_target check (
    (thread_id is not null and post_id is null) or
    (thread_id is null and post_id is not null)
  )
);

create unique index if not exists uq_like_thread_user on public.forum_like(thread_id, user_id) where thread_id is not null;
create unique index if not exists uq_like_post_user on public.forum_like(post_id, user_id) where post_id is not null;

-- 5. Tabel forum_laporan (moderasi laporan thread/post)
create table if not exists public.forum_laporan (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_thread(id) on delete cascade,
  post_id uuid references public.forum_post(id) on delete cascade,
  pelapor_id uuid not null references public.profiles(id) on delete cascade,
  alasan text not null,
  status text not null default 'pending' check (status in ('pending', 'ditinjau', 'diabaikan', 'tindakan_diambil')),
  catatan_admin text,
  created_at timestamptz default now()
);

create index if not exists idx_laporan_status on public.forum_laporan(status, created_at desc);

-- ==============================================================================
-- Helper Functions & Trigger Keamanan Akses
-- ==============================================================================

-- Cek apakah user adalah alumni, admin, atau mahasiswa tingkat akhir yang sudah daftar yudisium
create or replace function is_tingkat_akhir_or_alumni(p_uid uuid) returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles where id = p_uid and (status = 'alumni' or role = 'admin')
  ) or exists (
    select 1 from public.pengajuan p
    join public.skripsi s on s.id = p.skripsi_id
    where s.mahasiswa_id = p_uid and p.jenis = 'yudisium'
  );
$$;

-- Trigger untuk memvalidasi izin menulis di Forum Alumni
create or replace function check_forum_write_permission() returns trigger language plpgsql security definer as $$
declare
  v_tipe text;
  v_status text;
  v_role text;
begin
  -- Ambil tipe kategori thread
  select tipe into v_tipe from public.forum_kategori where id = new.kategori_id;

  -- Ambil status & role user
  select status, role into v_status, v_role from public.profiles where id = auth.uid();

  if v_tipe = 'alumni' then
    -- Hanya profil berstatus 'alumni' atau 'admin' yang boleh menulis di Forum Alumni
    if v_status != 'alumni' and v_role != 'admin' then
      raise exception 'Hanya alumni terverifikasi yang diperbolehkan membuat thread di Forum Alumni.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_forum_thread_write_check on public.forum_thread;
create trigger on_forum_thread_write_check
  before insert on public.forum_thread
  for each row execute function check_forum_write_permission();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

alter table public.forum_kategori enable row level security;
alter table public.forum_thread enable row level security;
alter table public.forum_post enable row level security;
alter table public.forum_like enable row level security;
alter table public.forum_laporan enable row level security;

-- Kategori: semua authenticated boleh membaca
drop policy if exists "baca kategori forum" on public.forum_kategori;
create policy "baca kategori forum" on public.forum_kategori for select to authenticated using (true);

-- Thread RLS
drop policy if exists "baca thread forum" on public.forum_thread;
create policy "baca thread forum" on public.forum_thread for select to authenticated
  using (
    exists (
      select 1 from public.forum_kategori k
      where k.id = forum_thread.kategori_id
        and (
          k.tipe = 'fakultas'
          or (k.tipe = 'alumni' and is_tingkat_akhir_or_alumni(auth.uid()))
        )
    )
  );

drop policy if exists "buat thread forum" on public.forum_thread;
create policy "buat thread forum" on public.forum_thread for insert to authenticated
  with check (
    auth.uid() = penulis_id
    and exists (
      select 1 from public.forum_kategori k
      where k.id = kategori_id
        and (
          k.tipe = 'fakultas'
          or (k.tipe = 'alumni' and (select status from public.profiles where id = auth.uid()) = 'alumni')
          or is_admin()
        )
    )
  );

drop policy if exists "ubah thread penulis atau admin" on public.forum_thread;
create policy "ubah thread penulis atau admin" on public.forum_thread for update to authenticated
  using (auth.uid() = penulis_id or is_admin())
  with check (auth.uid() = penulis_id or is_admin());

drop policy if exists "hapus thread penulis atau admin" on public.forum_thread;
create policy "hapus thread penulis atau admin" on public.forum_thread for delete to authenticated
  using (auth.uid() = penulis_id or is_admin());

-- Post RLS
drop policy if exists "baca post balasan" on public.forum_post;
create policy "baca post balasan" on public.forum_post for select to authenticated
  using (
    exists (
      select 1 from public.forum_thread t
      join public.forum_kategori k on k.id = t.kategori_id
      where t.id = forum_post.thread_id
        and (
          k.tipe = 'fakultas'
          or (k.tipe = 'alumni' and is_tingkat_akhir_or_alumni(auth.uid()))
        )
    )
  );

drop policy if exists "buat post balasan" on public.forum_post;
create policy "buat post balasan" on public.forum_post for insert to authenticated
  with check (
    auth.uid() = penulis_id
    and exists (
      select 1 from public.forum_thread t
      join public.forum_kategori k on k.id = t.kategori_id
      where t.id = thread_id
        and not t.dikunci
        and (
          k.tipe = 'fakultas'
          or (k.tipe = 'alumni' and (select status from public.profiles where id = auth.uid()) = 'alumni')
          or is_admin()
        )
    )
  );

drop policy if exists "ubah post balasan" on public.forum_post;
create policy "ubah post balasan" on public.forum_post for update to authenticated
  using (auth.uid() = penulis_id or is_admin());

drop policy if exists "hapus post balasan" on public.forum_post;
create policy "hapus post balasan" on public.forum_post for delete to authenticated
  using (auth.uid() = penulis_id or is_admin());

-- Like RLS
drop policy if exists "baca likes" on public.forum_like;
create policy "baca likes" on public.forum_like for select to authenticated using (true);

drop policy if exists "toggle like sendiri" on public.forum_like;
create policy "toggle like sendiri" on public.forum_like for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "hapus like sendiri" on public.forum_like;
create policy "hapus like sendiri" on public.forum_like for delete to authenticated
  using (auth.uid() = user_id);

-- Laporan RLS
drop policy if exists "kirim laporan" on public.forum_laporan;
create policy "kirim laporan" on public.forum_laporan for insert to authenticated
  with check (auth.uid() = pelapor_id);

drop policy if exists "kelola laporan admin" on public.forum_laporan;
create policy "kelola laporan admin" on public.forum_laporan for all to authenticated
  using (is_admin())
  with check (is_admin());
