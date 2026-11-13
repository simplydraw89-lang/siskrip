-- Migrasi tabel pengumuman untuk SiSkrip
-- Jalankan di Supabase > SQL Editor > Run

create table if not exists pengumuman (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  tanggal date not null default current_date,
  aktif boolean not null default true,
  created_at timestamptz default now()
);

-- Aktifkan RLS
alter table pengumuman enable row level security;

-- Kebijakan: Semua user yang login dapat membaca pengumuman yang aktif
create policy "baca pengumuman" on pengumuman
  for select to authenticated
  using (aktif = true);

-- Kebijakan: Hanya admin yang dapat menambah/mengubah/menghapus pengumuman
create policy "admin kelola pengumuman" on pengumuman
  for all to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

-- Masukkan 3 contoh pengumuman resmi Fakultas / Departemen Perikanan UGM
insert into pengumuman (judul, isi, tanggal, aktif) values
  ('Pendaftaran Seminar Proposal Periode November Dibuka', 'Bagi mahasiswa Departemen Perikanan yang telah menyelesaikan draf proposal dan disetujui dosen pembimbing, pendaftaran jadwal seminar telah dibuka di SiSkrip.', current_date, true),
  ('Panduan Penulisan Skripsi Terbaru Departemen Perikanan', 'Format dan template resmi penulisan skripsi edisi revisi dapat diunduh melalui portal akademik departemen. Pastikan mengacu pada pedoman terbaru.', current_date - interval '2 days', true),
  ('Sosialisasi Ujian Pendadaran & Bebas Laboratorium', 'Mahasiswa tingkat akhir wajib melengkapi surat bebas laboratorium dan verifikasi logbook bimbingan sebelum mengajukan tanggal ujian pendadaran skripsi.', current_date - interval '5 days', true);
