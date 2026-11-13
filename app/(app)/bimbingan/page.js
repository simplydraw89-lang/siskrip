'use client';

export default function BimbinganPage() {
  return (
    <div className="wrap" style={{ maxWidth: '960px', padding: 0 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Bimbingan Mahasiswa</h2>
        <p className="mut">Daftar mahasiswa bimbingan skripsi, progres bab, dan persetujuan ujian.</p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>👥</span>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Fitur Bimbingan Dosen Segera Hadir</h3>
        <p className="mut" style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.92rem' }}>
          Portal evaluasi bimbingan, catatan revisi bab skripsi mahasiswa, dan approval seminar/ujian sedang disiapkan.
        </p>
      </div>
    </div>
  );
}
