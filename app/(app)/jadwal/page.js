'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (s) => {
  const d = new Date(s + 'T00:00');
  return `${HARI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export default function JadwalPage() {
  const { profile } = useUser();
  const [setting, setSetting] = useState(null);
  const [used, setUsed] = useState({});
  const [mine, setMine] = useState([]);
  const [jenis, setJenis] = useState('seminar');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || profile?.id;

      const [settingRes, usedRes, mineRes] = await Promise.all([
        supabase.from('pengaturan_jadwal').select('*').single(),
        supabase.rpc('slot_terpakai'),
        userId ? supabase.from('pendaftaran_jadwal').select('*').eq('user_id', userId) : Promise.resolve({ data: [] }),
      ]);

      setSetting(settingRes.data);
      setMine(mineRes.data || []);
      setUsed(Object.fromEntries((usedRes.data || []).map((x) => [x.tanggal, Number(x.n)])));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleDaftar(tanggal) {
    const { data, error } = await supabase.rpc('daftar_jadwal', { p_tanggal: tanggal, p_jenis: jenis });
    setMsg(error ? error.message : data === 'ok' ? 'Berhasil terdaftar!' : data);
    loadData();
  }

  async function handleBatal(id) {
    if (!confirm('Apakah Anda yakin ingin membatalkan jadwal ini?')) return;
    await supabase.from('pendaftaran_jadwal').delete().eq('id', id);
    setMsg('Jadwal berhasil dibatalkan.');
    loadData();
  }

  if (loading) {
    return <p style={{ padding: '2rem 0', color: 'var(--mut)' }}>Memuat jadwal…</p>;
  }

  const slots = [];
  if (setting?.hari) {
    for (let i = 1; i <= 35; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      if (setting.hari.includes(d.getDay())) {
        slots.push(iso(d));
      }
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: '960px', padding: 0 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Pendaftaran Jadwal</h2>
        <p className="mut" style={{ marginTop: '0.2rem' }}>
          Jadwal Seminar Proposal & Ujian Pendadaran Skripsi · Departemen Perikanan UGM
        </p>
      </div>

      {msg && (
        <div
          className={'msg ' + (msg.toLowerCase().includes('berhasil') ? 'ok' : 'err')}
          onClick={() => setMsg('')}
        >
          {msg}
        </div>
      )}

      {/* Jadwal Terdaftar Milik Pengguna */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.6rem' }}>Jadwal Anda</h3>
        {mine.length > 0 ? (
          mine.map((m) => (
            <div key={m.id} className="row" style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <b style={{ textTransform: 'capitalize', color: 'var(--pri)' }}>{m.jenis}</b>
                <span style={{ margin: '0 0.5rem' }}>·</span>
                <span>{fmt(m.tanggal)}</span>
              </div>
              <button className="btn ghost2" style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleBatal(m.id)}>
                Batalkan
              </button>
            </div>
          ))
        ) : (
          <p className="mut" style={{ fontSize: '0.9rem' }}>Belum ada jadwal yang didaftarkan.</p>
        )}
      </div>

      {/* Pilihan & Kuota Jadwal (Untuk Mahasiswa) */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Pilih Tanggal Seminar / Ujian</h3>
        <p className="mut" style={{ fontSize: '0.88rem' }}>
          Jadwal dibuka setiap hari {setting?.hari?.map((h) => HARI[h]).join(' & ')} · Kuota maksimal {setting?.kuota || 5} mahasiswa per hari.
        </p>
      </div>

      <div style={{ marginBottom: '1.2rem', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Jenis Kegiatan:</label>
        <select
          style={{ maxWidth: '200px', marginBottom: 0 }}
          value={jenis}
          onChange={(e) => setJenis(e.target.value)}
        >
          <option value="seminar">Seminar Proposal</option>
          <option value="ujian">Ujian Pendadaran</option>
        </select>
      </div>

      <div className="grid">
        {slots.map((s) => {
          const kuota = setting?.kuota || 5;
          const n = used[s] || 0;
          const full = n >= kuota;
          const percent = Math.min(100, Math.round((n / kuota) * 100));

          return (
            <div className="card" key={s}>
              <div className="row">
                <b>{fmt(s)}</b>
                <span className={'tag' + (full ? ' full' : '')}>
                  {full ? 'PENUH' : `${n}/${kuota}`}
                </span>
              </div>
              <div className="bar">
                <i style={{ width: `${percent}%` }} />
              </div>
              <button
                className="btn"
                disabled={full}
                onClick={() => handleDaftar(s)}
              >
                {full ? 'Kuota Penuh' : `Daftar ${jenis === 'seminar' ? 'Seminar' : 'Ujian'}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
