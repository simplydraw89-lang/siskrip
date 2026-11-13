'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ThemeBtn from '@/components/ThemeBtn';
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (s) => { const d = new Date(s + 'T00:00'); return `${HARI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

export default function Dashboard() {
  const r = useRouter();
  const [p, setP] = useState(null), [set, setSet] = useState(null), [used, setUsed] = useState({}), [mine, setMine] = useState([]), [jenis, setJenis] = useState('seminar'), [msg, setMsg] = useState('');

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return r.replace('/login');
    const [a, b, c, d] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('pengaturan_jadwal').select('*').single(),
      supabase.rpc('slot_terpakai'),
      supabase.from('pendaftaran_jadwal').select('*').eq('user_id', session.user.id)]);
    setP(a.data); setSet(b.data); setMine(d.data || []);
    setUsed(Object.fromEntries((c.data || []).map((x) => [x.tanggal, Number(x.n)])));
  }
  useEffect(() => { load(); }, []);

  async function daftar(t) {
    const { data, error } = await supabase.rpc('daftar_jadwal', { p_tanggal: t, p_jenis: jenis });
    setMsg(error ? error.message : data === 'ok' ? 'Berhasil terdaftar.' : data); load();
  }
  async function batal(id) { await supabase.from('pendaftaran_jadwal').delete().eq('id', id); load(); }
  async function lengkapi(e) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    await supabase.from('profiles').update({ nama: f.nama, noid: f.noid, prodi: f.prodi }).eq('id', p.id); load();
  }
  if (!p) return <p style={{ padding: 20 }}>Memuat…</p>;

  const slots = []; if (set) for (let i = 1; i <= 35; i++) { const d = new Date(); d.setDate(d.getDate() + i); if (set.hari.includes(d.getDay())) slots.push(iso(d)); }
  return (
    <div>
      <header className="top"><img src="/logo.png" alt="" height="34" /><b style={{ flex: 1 }}>SiSkrip · Perikanan UGM</b><ThemeBtn />
        <button className="btn ghost2" onClick={async () => { await supabase.auth.signOut(); r.replace('/login'); }}>Keluar</button></header>
      <main className="wrap">
        <h2>Halo, {p.nama || 'Pengguna'} 👋</h2>
        <p className="mut">{p.role} · {p.noid || '-'} · {p.prodi || ''} {p.status === 'pending' && ' · menunggu verifikasi admin'}</p><br />
        {!p.noid && <form className="card" onSubmit={lengkapi}><h3>Lengkapi profil</h3>
          <input name="nama" defaultValue={p.nama || ''} placeholder="Nama" required /><input name="noid" placeholder="NIM / NIDN" required />
          <input name="prodi" placeholder="Program studi" /><button className="btn">Simpan</button></form>}
        {p.role === 'mahasiswa' && <>
          <div className="card"><h3>Jadwal Anda</h3>{mine.length ? mine.map((m) => <div key={m.id} className="row"><span><b>{m.jenis}</b> · {fmt(m.tanggal)}</span><button className="btn ghost2" onClick={() => batal(m.id)}>Batalkan</button></div>) : <p className="mut">Belum ada jadwal.</p>}</div>
          <h3>Pilih tanggal seminar / ujian</h3>
          <p className="mut">Dibuka {set && set.hari.map((h) => HARI[h]).join(' & ')} · kuota {set?.kuota} mahasiswa per hari</p>
          <select style={{ maxWidth: 220 }} value={jenis} onChange={(e) => setJenis(e.target.value)}><option value="seminar">Seminar</option><option value="ujian">Ujian</option></select>
          {msg && <p className="mut">{msg}</p>}
          <div className="grid">{slots.map((s) => { const n = used[s] || 0, full = n >= set.kuota;
            return <div className="card" key={s}><div className="row"><b>{fmt(s)}</b><span className={'tag' + (full ? ' full' : '')}>{full ? 'PENUH' : `${n}/${set.kuota}`}</span></div>
              <div className="bar"><i style={{ width: (n / set.kuota) * 100 + '%' }} /></div><button className="btn" disabled={full} onClick={() => daftar(s)}>Daftar</button></div>; })}</div></>}
        {p.role !== 'mahasiswa' && <div className="card">Dashboard {p.role} akan dibangun pada tahap berikutnya.</div>}
      </main>
    </div>);
}
