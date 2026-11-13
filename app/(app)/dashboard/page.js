'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';
import AnnouncementCarousel from '@/components/AnnouncementCarousel';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (s) => {
  const d = new Date(s + 'T00:00');
  return `${HARI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export default function DashboardBeranda() {
  const { profile, reloadProfile } = useUser();
  const [scheduleSetting, setScheduleSetting] = useState(null);
  const [usedSlots, setUsedSlots] = useState({});
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const [settingRes, usedRes] = await Promise.all([
          supabase.from('pengaturan_jadwal').select('*').single(),
          supabase.rpc('slot_terpakai'),
        ]);
        if (settingRes.data) setScheduleSetting(settingRes.data);
        if (usedRes.data) {
          setUsedSlots(Object.fromEntries(usedRes.data.map((x) => [x.tanggal, Number(x.n)])));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSchedule(false);
      }
    }
    fetchQuota();
  }, []);

  async function handleLengkapi(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    await supabase.from('profiles').update({ nama: f.nama, noid: f.noid, prodi: f.prodi }).eq('id', profile.id);
    reloadProfile();
  }

  // Hitung jadwal terdekat (maks 3 slot terdekat)
  const upcomingSlots = [];
  if (scheduleSetting?.hari) {
    for (let i = 1; i <= 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      if (scheduleSetting.hari.includes(d.getDay())) {
        upcomingSlots.push(iso(d));
        if (upcomingSlots.length >= 3) break;
      }
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: '960px', padding: 0 }}>
      {/* Sapaan Personal */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
          Halo, {profile?.nama || 'Pengguna'} 👋
        </h2>
        <p className="mut" style={{ marginTop: '0.3rem', fontSize: '0.95rem' }}>
          <b style={{ textTransform: 'capitalize', color: 'var(--pri)' }}>{profile?.role}</b>
          {profile?.noid && ` · ${profile.noid}`}
          {profile?.prodi && ` · ${profile.prodi}`}
          {profile?.status === 'pending' && (
            <span style={{ color: 'var(--bad)', fontWeight: 600 }}> · Menunggu verifikasi admin</span>
          )}
        </p>
      </section>

      {/* Form Lengkapi Profil jika NOID (NIM/NIDN) masih kosong */}
      {!profile?.noid && (
        <form className="card" onSubmit={handleLengkapi} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.6rem' }}>Lengkapi Profil Anda</h3>
          <p className="mut" style={{ marginBottom: '0.8rem', fontSize: '0.85rem' }}>
            Data NIM / NIDN diperlukan untuk administrasi skripsi dan jadwal seminar.
          </p>
          <input name="nama" defaultValue={profile?.nama || ''} placeholder="Nama Lengkap" required />
          <input name="noid" placeholder={profile?.role === 'dosen' ? 'NIDN / NIP' : 'NIM'} required />
          <input name="prodi" defaultValue={profile?.prodi || ''} placeholder="Program Studi" />
          <button className="btn" style={{ width: 'auto' }}>Simpan Profil</button>
        </form>
      )}

      {/* 1. Carousel Pengumuman Fakultas */}
      <AnnouncementCarousel />

      {/* 2. Kartu Kuota Jadwal Terdekat */}
      <section className="card quota-card-highlight">
        <div className="row">
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>📅 Kuota Jadwal Terdekat</h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Seminar proposal & ujian pendadaran · Kuota {scheduleSetting?.kuota || 5} peserta/hari
            </p>
          </div>
          <Link href="/jadwal" className="btn ghost2" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Lihat Semua Jadwal →
          </Link>
        </div>

        {loadingSchedule ? (
          <p className="mut" style={{ fontSize: '0.9rem', padding: '1rem 0' }}>Memuat kuota jadwal…</p>
        ) : upcomingSlots.length === 0 ? (
          <p className="mut" style={{ fontSize: '0.9rem' }}>Belum ada jadwal yang dibuka.</p>
        ) : (
          <div className="quota-preview-grid">
            {upcomingSlots.map((s) => {
              const kuota = scheduleSetting?.kuota || 5;
              const n = usedSlots[s] || 0;
              const full = n >= kuota;
              const percent = Math.min(100, Math.round((n / kuota) * 100));

              return (
                <div key={s} className="quota-preview-item">
                  <div className="row" style={{ marginBottom: '0.4rem' }}>
                    <b style={{ fontSize: '0.9rem' }}>{fmt(s)}</b>
                    <span className={'tag' + (full ? ' full' : '')}>
                      {full ? 'PENUH' : `${n}/${kuota}`}
                    </span>
                  </div>
                  <div className="bar" style={{ margin: '0.4rem 0 0.5rem' }}>
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--mut)' }}>
                    {full ? 'Slot sudah habis' : `Tersisa ${kuota - n} kursi`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pintasan Fitur Berdasarkan Peran */}
      <section style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>Akses Cepat</h3>
        <div className="grid">
          {profile?.role === 'mahasiswa' && (
            <>
              <Link href="/skripsi" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>📖</span>
                <h4 style={{ marginTop: '0.5rem' }}>Skripsi & Proposal</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Pantau draf, pembimbing, dan progres judul skripsi.
                </p>
              </Link>
              <Link href="/jadwal" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>📅</span>
                <h4 style={{ marginTop: '0.5rem' }}>Daftar Seminar / Ujian</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Pilih tanggal pelaksanaan seminar proposal & pendadaran.
                </p>
              </Link>
              <Link href="/forum" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>💬</span>
                <h4 style={{ marginTop: '0.5rem' }}>Forum Departemen</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Ruang tanya jawab dan informasi antar mahasiswa & dosen.
                </p>
              </Link>
            </>
          )}

          {profile?.role === 'dosen' && (
            <>
              <Link href="/bimbingan" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>👥</span>
                <h4 style={{ marginTop: '0.5rem' }}>Mahasiswa Bimbingan</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Daftar bimbingan dan review draf proposal skripsi mahasiswa.
                </p>
              </Link>
              <Link href="/jadwal" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>📅</span>
                <h4 style={{ marginTop: '0.5rem' }}>Jadwal Menguji & Seminar</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Lihat agenda pengujian seminar & pendadaran mahasiswa.
                </p>
              </Link>
              <Link href="/forum" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>💬</span>
                <h4 style={{ marginTop: '0.5rem' }}>Forum Diskusi</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Diskusi akademik Departemen Perikanan.
                </p>
              </Link>
            </>
          )}

          {profile?.role === 'admin' && (
            <>
              <Link href="/kelola" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>⚙️</span>
                <h4 style={{ marginTop: '0.5rem' }}>Panel Pengelolaan</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Verifikasi akun dosen, atur kuota, dan publish pengumuman.
                </p>
              </Link>
              <Link href="/jadwal" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>📅</span>
                <h4 style={{ marginTop: '0.5rem' }}>Master Jadwal</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Monitoring pendaftaran ujian dan seminar mahasiswa.
                </p>
              </Link>
              <Link href="/forum" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '1.8rem' }}>💬</span>
                <h4 style={{ marginTop: '0.5rem' }}>Moderasi Forum</h4>
                <p className="mut" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Kelola postingan dan informasi resmi departemen.
                </p>
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
