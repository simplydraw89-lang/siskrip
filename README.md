# SiSkrip - Departemen Perikanan, Fakultas Pertanian UGM
Next.js 14 + Supabase. Tahap ini: login/daftar (panel geser), Google, lupa password, tema terang/gelap,
dan jadwal seminar/ujian dengan kuota per hari.

## Menjalankan
1. Pasang Node.js LTS (nodejs.org).
2. supabase.com > New project. Buka SQL Editor, tempel seluruh isi `supabase/schema.sql`, klik Run.
3. Salin `.env.local.example` menjadi `.env.local`, isi URL dan anon key (Project Settings > API).
4. Supabase > Authentication > URL Configuration: Site URL `http://localhost:3000`,
   Redirect URLs: `http://localhost:3000/**`.
5. Terminal di folder ini: `npm install` lalu `npm run dev`, buka http://localhost:3000
6. Google (opsional): Authentication > Providers > Google, isi Client ID/Secret dari Google Cloud Console.

## Menempel di web departemen (WordPress)
Pasang aplikasi di alamat sendiri (mis. subdomain dari IT fakultas), lalu di WordPress:
Tampilan > Menu > Tautan Kustom > "SiSkrip" > URL aplikasi. Tidak perlu mengubah tema.
