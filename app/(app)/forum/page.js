'use client';

export default function ForumPage() {
  return (
    <div className="wrap" style={{ maxWidth: '960px', padding: 0 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Forum Departemen</h2>
        <p className="mut">Ruang diskusi akademik, tanya jawab seputar skripsi, dan pengumuman kegiatan mahasiswa.</p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>💬</span>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Forum Diskusi Segera Hadir</h3>
        <p className="mut" style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.92rem' }}>
          Ruang diskusi interaktif antara mahasiswa dan dosen Departemen Perikanan UGM sedang dalam tahap pengembangan.
        </p>
      </div>
    </div>
  );
}
