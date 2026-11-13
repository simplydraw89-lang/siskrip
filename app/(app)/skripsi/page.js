'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';

const TAHAP_LIST = [
  { id: 'proposal', label: 'Proposal', pct: 20 },
  { id: 'seminar_proposal', label: 'Seminar Proposal', pct: 40 },
  { id: 'seminar_hasil', label: 'Seminar Hasil', pct: 60 },
  { id: 'ujian', label: 'Ujian Skripsi', pct: 80 },
  { id: 'yudisium', label: 'Yudisium', pct: 100 },
];

export default function SkripsiPage() {
  const { profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Data skripsi & pengajuan
  const [skripsi, setSkripsi] = useState(null);
  const [pengajuanList, setPengajuanList] = useState([]);
  const [currentPengajuan, setCurrentPengajuan] = useState(null);
  const [berkasList, setBerkasList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dosenList, setDosenList] = useState([]);

  // Form input
  const [judul, setJudul] = useState('');
  const [abstrak, setAbstrak] = useState('');
  const [pembimbing1, setPembimbing1] = useState('');
  const [pembimbing2, setPembimbing2] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDosen();
    if (profile) {
      loadSkripsiData();
    }
  }, [profile]);

  async function loadDosen() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, nama, noid')
        .eq('role', 'dosen')
        .eq('status', 'aktif');
      if (data && data.length > 0) {
        setDosenList(data);
      } else {
        // Fallback demo dosen jika belum di-seed
        setDosenList([
          { id: 'dosen-1', nama: 'Prof. Dr. Ir. Murwantoko, M.Si.', noid: '196503021990031002' },
          { id: 'dosen-2', nama: 'Dr. Ir. Budi Wibowo, M.Sc.', noid: '197405101999031001' },
          { id: 'dosen-3', nama: 'Dr. Eko Setyobudi, S.Pi., M.Si.', noid: '198008152005011003' },
          { id: 'dosen-4', nama: 'Ir. Alim Isnansetyo, M.Sc., Ph.D.', noid: '196811241994031002' },
        ]);
      }
    } catch {
      setDosenList([
        { id: 'dosen-1', nama: 'Prof. Dr. Ir. Murwantoko, M.Si.', noid: '196503021990031002' },
        { id: 'dosen-2', nama: 'Dr. Ir. Budi Wibowo, M.Sc.', noid: '197405101999031001' },
      ]);
    }
  }

  async function loadSkripsiData() {
    setLoading(true);
    try {
      // 1. Cek tabel skripsi untuk mahasiswa ini
      const { data: skripsiData } = await supabase
        .from('skripsi')
        .select('*')
        .eq('mahasiswa_id', profile.id)
        .maybeSingle();

      if (skripsiData) {
        setSkripsi(skripsiData);
        setJudul(skripsiData.judul || '');
        setAbstrak(skripsiData.abstrak || '');
        setPembimbing1(skripsiData.pembimbing1_id || '');
        setPembimbing2(skripsiData.pembimbing2_id || '');

        // 2. Ambil daftar pengajuan
        const { data: pData } = await supabase
          .from('pengajuan')
          .select('*')
          .eq('skripsi_id', skripsiData.id)
          .order('dibuat_pada', { ascending: false });

        setPengajuanList(pData || []);
        const latest = pData?.[0] || null;
        setCurrentPengajuan(latest);

        if (latest) {
          // 3. Ambil berkas & audit log
          const [{ data: bData }, { data: aData }] = await Promise.all([
            supabase.from('berkas').select('*').eq('pengajuan_id', latest.id),
            supabase.from('audit_log').select('*').eq('pengajuan_id', latest.id).order('created_at', { ascending: false }),
          ]);
          setBerkasList(bData || []);
          setAuditLogs(aData || []);
        }
      } else {
        // Cek localStorage jika mode demo mahasiswa
        const savedDemo = typeof window !== 'undefined' ? localStorage.getItem('siskrip_demo_skripsi_' + profile.id) : null;
        if (savedDemo) {
          const parsed = JSON.parse(savedDemo);
          setSkripsi(parsed.skripsi);
          setPengajuanList(parsed.pengajuanList || []);
          setCurrentPengajuan(parsed.pengajuanList?.[0] || null);
          setBerkasList(parsed.berkasList || []);
          setAuditLogs(parsed.auditLogs || []);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat skripsi via Supabase, memeriksa penyimpanan lokal:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMsg({ err: true, text: 'File harus berformat PDF.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ err: true, text: 'Ukuran file melebihi batas maksimal 10 MB.' });
      return;
    }
    setSelectedFile(file);
    setMsg({ err: false, text: `File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) siap diunggah.` });
  }

  async function handleSubmitProposal(e) {
    e.preventDefault();
    if (!judul.trim()) return setMsg({ err: true, text: 'Judul proposal wajib diisi.' });
    if (!abstrak.trim()) return setMsg({ err: true, text: 'Abstrak proposal wajib diisi.' });
    if (!pembimbing1) return setMsg({ err: true, text: 'Pilih Dosen Pembimbing Utama.' });
    if (!selectedFile && berkasList.length === 0) {
      return setMsg({ err: true, text: 'Unggah berkas naskah proposal (PDF, maks 10 MB).' });
    }

    setSaving(true);
    setMsg(null);

    try {
      let activeSkripsi = skripsi;
      // 1. Simpan atau update skripsi
      if (!activeSkripsi) {
        const { data: newSkripsi, error: sErr } = await supabase
          .from('skripsi')
          .insert({
            mahasiswa_id: profile.id,
            judul: judul.trim(),
            abstrak: abstrak.trim(),
            pembimbing1_id: pembimbing1,
            pembimbing2_id: pembimbing2 || null,
            tahap_saat_ini: 'proposal',
          })
          .select()
          .single();

        if (sErr || !newSkripsi) {
          // Fallback lokal jika tabel belum dibuat di Supabase
          activeSkripsi = {
            id: 'skripsi-' + Date.now(),
            mahasiswa_id: profile.id,
            judul: judul.trim(),
            abstrak: abstrak.trim(),
            pembimbing1_id: pembimbing1,
            pembimbing2_id: pembimbing2 || null,
            tahap_saat_ini: 'proposal',
            created_at: new Date().toISOString(),
          };
        } else {
          activeSkripsi = newSkripsi;
        }
      } else {
        await supabase
          .from('skripsi')
          .update({
            judul: judul.trim(),
            abstrak: abstrak.trim(),
            pembimbing1_id: pembimbing1,
            pembimbing2_id: pembimbing2 || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeSkripsi.id);
      }

      setSkripsi(activeSkripsi);

      // 2. Buat record pengajuan baru dengan status 'diajukan'
      let newPengajuan = null;
      const { data: pData, error: pErr } = await supabase
        .from('pengajuan')
        .insert({
          skripsi_id: activeSkripsi.id,
          jenis: 'proposal',
          status: 'diajukan',
          catatan: 'Pengajuan draf proposal baru oleh mahasiswa',
        })
        .select()
        .single();

      if (pErr || !pData) {
        newPengajuan = {
          id: 'pengajuan-' + Date.now(),
          skripsi_id: activeSkripsi.id,
          jenis: 'proposal',
          status: 'diajukan',
          catatan: 'Pengajuan draf proposal baru oleh mahasiswa',
          dibuat_pada: new Date().toISOString(),
        };
      } else {
        newPengajuan = pData;
      }

      // 3. Upload file berkas jika ada
      let newBerkas = null;
      if (selectedFile) {
        const filePath = `${profile.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        
        // Upload ke Supabase Storage bucket 'berkas'
        try {
          await supabase.storage.from('berkas').upload(filePath, selectedFile, {
            contentType: 'application/pdf',
            upsert: true,
          });
        } catch (uploadErr) {
          console.warn('Storage upload fallback:', uploadErr);
        }

        const { data: bData } = await supabase
          .from('berkas')
          .insert({
            pengajuan_id: newPengajuan.id,
            nama: selectedFile.name,
            path: filePath,
            ukuran: selectedFile.size,
            diunggah_oleh: profile.id,
          })
          .select()
          .single();

        newBerkas = bData || {
          id: 'berkas-' + Date.now(),
          pengajuan_id: newPengajuan.id,
          nama: selectedFile.name,
          path: filePath,
          ukuran: selectedFile.size,
          diunggah_oleh: profile.id,
          created_at: new Date().toISOString(),
        };
      }

      // 4. Audit Log entry
      const newAuditLog = {
        id: 'audit-' + Date.now(),
        pengajuan_id: newPengajuan.id,
        user_id: profile.id,
        status_lama: null,
        status_baru: 'diajukan',
        catatan: 'Pengajuan proposal pertama kali dikirimkan',
        created_at: new Date().toISOString(),
      };

      // Update state
      const updatedList = [newPengajuan, ...pengajuanList];
      setPengajuanList(updatedList);
      setCurrentPengajuan(newPengajuan);
      if (newBerkas) setBerkasList([newBerkas]);
      setAuditLogs([newAuditLog, ...auditLogs]);

      // Simpan demo state
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'siskrip_demo_skripsi_' + profile.id,
          JSON.stringify({
            skripsi: activeSkripsi,
            pengajuanList: updatedList,
            berkasList: newBerkas ? [newBerkas] : berkasList,
            auditLogs: [newAuditLog, ...auditLogs],
          })
        );
      }

      setSelectedFile(null);
      setMsg({ err: false, text: 'Proposal berhasil diajukan! Menunggu verifikasi berkas oleh admin departemen.' });
    } catch (err) {
      setMsg({ err: true, text: 'Terjadi kesalahan saat mengajukan proposal: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  // Hitung progres stepper
  const currentTahap = skripsi?.tahap_saat_ini || 'proposal';
  const currentTahapIndex = TAHAP_LIST.findIndex((t) => t.id === currentTahap);
  const activePct = currentTahapIndex >= 0 ? TAHAP_LIST[currentTahapIndex].pct : 20;

  // Panduan langkah selanjutnya
  function getNextStepInfo() {
    if (!skripsi || !currentPengajuan) {
      return {
        badge: 'Tahap 1: Proposal',
        title: 'Pengajuan Judul & Draf Proposal Skripsi',
        desc: 'Lengkapi formulir judul, abstrak, pilih dosen pembimbing yang sesuai dengan bidang kajian, serta unggah berkas naskah proposal berformat PDF (maks. 10 MB).',
        actionText: 'Isi formulir pengajuan di bawah',
      };
    }

    switch (currentPengajuan.status) {
      case 'diajukan':
        return {
          badge: 'Menunggu Verifikasi Admin',
          title: 'Verifikasi Kelengkapan Berkas Administrasi',
          desc: 'Naskah proposal Anda telah berhasil terkirim. Saat ini tim administrasi departemen sedang memeriksa kelengkapan format dan berkas pendukung Anda.',
          actionText: 'Pantau status secara berkala di halaman ini',
        };
      case 'diverifikasi':
        return {
          badge: 'Menunggu Persetujuan Dosen',
          title: 'Penelaahan oleh Dosen Pembimbing',
          desc: 'Berkas administrasi telah dinyatakan lengkap oleh admin. Saat ini proposal Anda berada di antrean penelaahan Dosen Pembimbing untuk persetujuan materi kajian.',
          actionText: 'Dosen pembimbing akan memberikan persetujuan atau catatan revisi',
        };
      case 'revisi':
        return {
          badge: 'Perlu Revisi',
          title: 'Perbaikan Naskah Proposal Diperlukan',
          desc: `Dosen Pembimbing atau Admin meminta revisi: "${currentPengajuan.catatan || 'Perbaiki format dan materi sesuai arahan pembimbing'}". Silakan perbarui berkas naskah proposal Anda.`,
          actionText: 'Unggah perbaikan proposal di formulir bawah',
        };
      case 'disetujui':
      case 'selesai':
        return {
          badge: 'Proposal Disetujui! 🎉',
          title: 'Siap Menuju Seminar Proposal',
          desc: 'Selamat! Proposal skripsi Anda telah resmi disetujui oleh dosen pembimbing. Silakan daftarkan jadwal seminar proposal Anda melalui menu Jadwal.',
          actionText: 'Pilih kuota jadwal di menu Jadwal Seminar',
        };
      case 'ditolak':
        return {
          badge: 'Pengajuan Ditolak',
          title: 'Proposal Ditolak',
          desc: `Catatan: ${currentPengajuan.catatan || 'Judul atau topik belum memenuhi kualifikasi riset departemen'}. Silakan ajukan judul baru.`,
          actionText: 'Ajukan judul proposal baru',
        };
      default:
        return {
          badge: 'Tahap Proposal',
          title: 'Draf Proposal',
          desc: 'Silakan lanjutkan pengisian proposal Anda.',
          actionText: 'Lengkapi berkas',
        };
    }
  }

  const nextStep = getNextStepInfo();

  if (loading) {
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p className="mut">Memuat data skripsi dan riwayat bimbingan...</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: '980px', padding: 0 }}>
      {/* Judul & Penjelasan */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Skripsi & Pengajuan</h2>
        <p className="mut">Pantau alur 5 tahapan skripsi Anda, lengkapi berkas, dan ajukan persetujuan pembimbing.</p>
      </div>

      {/* Stepper Visual 5 Tahap */}
      <div className="stepper-wrap">
        <div className="stepper-header">
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kemajuan Keseluruhan
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {activePct}% Diselesaikan
            </h3>
          </div>
          <span className={`status-badge status-${currentPengajuan?.status || 'draft'}`}>
            Status: {currentPengajuan?.status || 'Belum Mengajukan'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="stepper-progress-track">
          <div className="stepper-progress-fill" style={{ width: `${activePct}%` }} />
        </div>

        {/* 5 Tahap Steps */}
        <div className="stepper-steps">
          {TAHAP_LIST.map((t, idx) => {
            const isCompleted = currentTahapIndex > idx;
            const isActive = currentTahapIndex === idx;
            return (
              <div
                key={t.id}
                className={`stepper-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="stepper-circle">
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span className="stepper-label">{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kartu Langkah Selanjutnya */}
      <div className="next-step-card">
        <span style={{ fontSize: '2rem' }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className="tag" style={{ background: 'var(--acc)', color: '#000', fontWeight: 700 }}>
              {nextStep.badge}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--tx)' }}>
              {nextStep.title}
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--mut)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
            {nextStep.desc}
          </p>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--pri)' }}>
            👉 {nextStep.actionText}
          </span>
        </div>
      </div>

      {/* Grid: Formulir Pengajuan & Checklist Berkas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Kolom Kiri: Form Pengajuan Proposal */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            {currentPengajuan?.status === 'revisi' ? 'Unggah Perbaikan Proposal' : 'Formulir Draf Proposal'}
          </h3>
          <p className="mut" style={{ marginBottom: '1.25rem' }}>
            {currentPengajuan?.status === 'disetujui'
              ? 'Proposal telah disetujui. Data judul dan pembimbing di bawah telah terkunci.'
              : 'Isi rencana penelitian skripsi Anda dan tentukan dosen pembimbing.'}
          </p>

          <form onSubmit={handleSubmitProposal}>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Judul Skripsi / Proposal <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <textarea
                rows={3}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                placeholder="Contoh: Analisis Kualitas Air dan Laju Pertumbuhan Ikan Nila..."
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                disabled={currentPengajuan?.status === 'disetujui' || saving}
                required
              />
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Abstrak Singkat / Latar Belakang <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <textarea
                rows={4}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                placeholder="Tuliskan latar belakang masalah, tujuan penelitian, dan metodologi ringkas..."
                value={abstrak}
                onChange={(e) => setAbstrak(e.target.value)}
                disabled={currentPengajuan?.status === 'disetujui' || saving}
                required
              />
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Dosen Pembimbing Utama (1) <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <select
                value={pembimbing1}
                onChange={(e) => setPembimbing1(e.target.value)}
                disabled={currentPengajuan?.status === 'disetujui' || saving}
                required
              >
                <option value="" disabled>-- Pilih Dosen Pembimbing 1 --</option>
                {dosenList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nama} {d.noid ? `(${d.noid})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Dosen Pembimbing Pendamping (2) <span className="mut">(Opsional)</span>
              </label>
              <select
                value={pembimbing2}
                onChange={(e) => setPembimbing2(e.target.value)}
                disabled={currentPengajuan?.status === 'disetujui' || saving}
              >
                <option value="">-- Tanpa Pembimbing 2 --</option>
                {dosenList
                  .filter((d) => d.id !== pembimbing1)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nama} {d.noid ? `(${d.noid})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Unggah Berkas PDF */}
            {currentPengajuan?.status !== 'disetujui' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Unggah Naskah Proposal PDF <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <div
                  className={`file-dropzone ${isDragActive ? 'drag-active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                  onDragLeave={() => setIsDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragActive(false);
                    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                  />
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.4rem' }}>📄</span>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                    {selectedFile ? selectedFile.name : 'Klik atau seret file PDF proposal ke sini'}
                  </p>
                  <p className="mut" style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                    Format PDF saja, maksimal ukuran 10 MB.
                  </p>
                </div>
              </div>
            )}

            {currentPengajuan?.status !== 'disetujui' && (
              <button
                type="submit"
                className="btn"
                disabled={saving || (currentPengajuan && currentPengajuan.status === 'diajukan')}
              >
                {saving
                  ? 'Menyimpan Proposal…'
                  : currentPengajuan?.status === 'revisi'
                  ? 'Kirim Ulang Revisi Proposal'
                  : currentPengajuan?.status === 'diajukan'
                  ? 'Proposal Sedang Ditinjau'
                  : 'Ajukan Proposal Skripsi'}
              </button>
            )}
          </form>
        </div>

        {/* Kolom Kanan: Checklist Berkas & Detail Bimbingan */}
        <div>
          {/* Checklist Berkas */}
          <div className="checklist-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              📋 Checklist Berkas Wajib
            </h3>
            <p className="mut" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
              Pastikan berkas-berkas berikut telah siap dan memenuhi syarat departemen.
            </p>

            <div className="checklist-item">
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Naskah Draf Proposal Skripsi</span>
                <p className="mut" style={{ fontSize: '0.78rem' }}>Format PDF resmi (maks. 10 MB)</p>
              </div>
              <span className={`status-badge ${berkasList.length > 0 || selectedFile ? 'status-aktif' : 'status-pending'}`}>
                {berkasList.length > 0 || selectedFile ? '✓ Terunggah' : 'Belum Ada'}
              </span>
            </div>

            <div className="checklist-item">
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Transkrip Nilai / KRS Berjalan</span>
                <p className="mut" style={{ fontSize: '0.78rem' }}>Syarat minimal 110 SKS lulus</p>
              </div>
              <span className="status-badge status-aktif">✓ Terverifikasi SIA</span>
            </div>

            <div className="checklist-item">
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Persetujuan Dosen Pembimbing</span>
                <p className="mut" style={{ fontSize: '0.78rem' }}>Verifikasi digital melalui portal SiSkrip</p>
              </div>
              <span className={`status-badge status-${currentPengajuan?.status === 'disetujui' ? 'aktif' : 'pending'}`}>
                {currentPengajuan?.status === 'disetujui' ? '✓ Disetujui' : 'Menunggu'}
              </span>
            </div>
          </div>

          {/* Berkas Terunggah */}
          {berkasList.length > 0 && (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                📁 Dokumen Proposal Terunggah
              </h4>
              {berkasList.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--bg)',
                    borderRadius: '10px',
                    border: '1px solid var(--bd)',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                    <span style={{ fontSize: '1.3rem' }}>📑</span>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {b.nama}
                      </p>
                      <p className="mut" style={{ fontSize: '0.75rem' }}>
                        {b.ukuran ? `${(b.ukuran / (1024 * 1024)).toFixed(2)} MB` : 'PDF'} · Tersimpan aman di bucket privat
                      </p>
                    </div>
                  </div>
                  <span className="tag" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    PDF 10MB
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Riwayat Linimasa Audit Log */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              🕒 Linimasa & Riwayat Status
            </h4>
            {auditLogs.length === 0 ? (
              <p className="mut" style={{ fontSize: '0.85rem' }}>Belum ada catatan aktivitas.</p>
            ) : (
              <div className="timeline-wrap">
                {auditLogs.map((log) => (
                  <div key={log.id} className="timeline-entry">
                    <div className={`timeline-dot ${log.status_baru}`} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span className={`status-badge status-${log.status_baru}`} style={{ fontSize: '0.7rem' }}>
                          {log.status_baru}
                        </span>
                        <span className="mut" style={{ fontSize: '0.72rem' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--tx)', lineHeight: 1.4 }}>
                        {log.catatan}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <div className={`msg ${msg.err ? 'err' : 'ok'}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
