'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ThemeBtn from '@/components/ThemeBtn';
const PRODI = ['Akuakultur', 'Manajemen Sumberdaya Akuatik', 'Teknologi Hasil Perikanan', 'Magister Ilmu Perikanan', 'Doktor Ilmu Perikanan dan Kelautan Tropis'];
const form = (e) => Object.fromEntries(new FormData(e.target));

export default function Login() {
  const r = useRouter();
  const [reg, setReg] = useState(false), [role, setRole] = useState('mahasiswa'), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => data.session && r.replace('/dashboard')); }, [r]);
  const err = (t) => setMsg({ e: 1, t }), ok = (t) => setMsg({ t });

  async function masuk(e) {
    e.preventDefault(); setBusy(true); const f = form(e);
    const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
    setBusy(false);
    if (error) return err(error.message.includes('not confirmed') ? 'Email belum diverifikasi. Cek kotak masuk Anda.' : 'Email atau password salah.');
    r.replace('/dashboard');
  }
  async function daftar(e) {
    e.preventDefault(); const f = form(e);
    if (f.email !== f.email2) return err('Konfirmasi email tidak sama.');
    if (f.password !== f.password2) return err('Konfirmasi password tidak sama.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password,
      options: { data: { nama: f.nama, noid: f.noid, prodi: f.prodi || null, role }, emailRedirectTo: location.origin + '/dashboard' } });
    setBusy(false);
    if (error) return err(error.message);
    if (data.user?.identities?.length === 0) return err('Email sudah terdaftar.');
    ok('Pendaftaran berhasil! Cek email Anda untuk verifikasi, lalu masuk.'); setReg(false);
  }
  const google = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/dashboard' } });
  async function lupa() {
    const email = document.getElementById('le').value;
    if (!email) return err('Isi email dulu, lalu klik Lupa password.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset' });
    error ? err(error.message) : ok('Tautan reset password dikirim ke email Anda.');
  }
  const Social = () => <><div className="sep">atau lanjutkan dengan</div><button type="button" className="gbtn" onClick={google}><b>G</b> Google</button></>;

  return (
    <main className="authwrap">
      <div className="tb"><ThemeBtn /></div>
      <div className={'box' + (reg ? ' reg' : '')}>
        <section className="pane lp">
          <form onSubmit={masuk}>
            <h1>Masuk</h1>
            <input id="le" name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Password" required />
            <button type="button" className="lnk" onClick={lupa}>Lupa password?</button>
            <button className="btn" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
            <Social />
          </form>
        </section>
        <section className="pane rp">
          <form onSubmit={daftar}>
            <h1>Daftar Akun</h1>
            <select value={role} onChange={(e) => setRole(e.target.value)}><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option></select>
            <input name="nama" placeholder="Nama lengkap" required />
            <input name="noid" placeholder={role === 'dosen' ? 'NIDN / NIP' : 'NIM'} required />
            {role === 'mahasiswa' && <select name="prodi" required defaultValue=""><option value="" disabled>Program studi</option>{PRODI.map((p) => <option key={p}>{p}</option>)}</select>}
            <input name="email" type="email" placeholder="Email" required />
            <input name="email2" type="email" placeholder="Konfirmasi email" required />
            <input name="password" type="password" minLength={6} placeholder="Password (min. 6 karakter)" required />
            <input name="password2" type="password" placeholder="Konfirmasi password" required />
            {role === 'dosen' && <p className="mut">Akun dosen akan diverifikasi admin departemen.</p>}
            <button className="btn" disabled={busy}>{busy ? 'Memproses…' : 'Daftar'}</button>
            <Social />
          </form>
        </section>
        <aside className="panel">
          <img src="/logo.png" alt="Logo UGM" />
          <h2>{reg ? 'Selamat Datang Kembali!' : 'Halo, Selamat Datang!'}</h2>
          <p>SiSkrip · Departemen Perikanan<br />Fakultas Pertanian UGM</p>
          <p>{reg ? 'Sudah punya akun?' : 'Belum punya akun?'}</p>
          <button className="ghost" onClick={() => { setReg(!reg); setMsg(null); }}>{reg ? 'Masuk' : 'Daftar'}</button>
        </aside>
      </div>
      {msg && <div className={'msg ' + (msg.e ? 'err' : 'ok')} onClick={() => setMsg(null)}>{msg.t}</div>}
    </main>
  );
}
