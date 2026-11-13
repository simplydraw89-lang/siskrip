'use client';

export default function SkripsiPage() {
  return (
    <div className="wrap" style={{ maxWidth: '960px', padding: 0 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Skripsi & Proposal</h2>
        <p className="mut">Manajemen judul skripsi, bimbingan dosen, dan pengunggahan berkas proposal.</p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📖</span>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Fitur Skripsi Segera Hadir</h3>
        <p className="mut" style={{ maxWidth: '480px', margin: '0 auto', fontSize: '0.92rem' }}>
          Modul pengajuan draf skripsi, verifikasi bab bimbingan, dan lembar persetujuan dosen pembimbing sedang dalam tahap pembangunan.
        </p>
      </div>
    </div>
  );
}
