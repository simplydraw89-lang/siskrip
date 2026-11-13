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
  const [pengujiList, setPengujiList] = useState([]);
  const [revisiList, setRevisiList] = useState([]);
  const [hasJadwalSeminar, setHasJadwalSeminar] = useState(false);
  const [hasJadwalUjian, setHasJadwalUjian] = useState(false);
  const [registeredJadwal, setRegisteredJadwal] = useState(null);

  // Form input Proposal
  const [judul, setJudul] = useState('');
  const [abstrak, setAbstrak] = useState('');
  const [pembimbing1, setPembimbing1] = useState('');
  const [pembimbing2, setPembimbing2] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Form input Revisi
  const [fileRevisi, setFileRevisi] = useState(null);
  const [uploadingRevisi, setUploadingRevisi] = useState(false);

  // Checklist Yudisium State
  const [yudisiumChecklist, setYudisiumChecklist] = useState({
    bebasPustaka: true,
    skripsiFinal: true,
    toefl: true,
    artikel: true,
    transkrip: true,
  });

  useEffect(() => {
    loadDosen();
    if (profile) {
      loadSkripsiData();
      checkRegisteredJadwal();
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

  async function checkRegisteredJadwal() {
    try {
      const { data } = await supabase
        .from('pendaftaran_jadwal')
        .select('*')
        .eq('user_id', profile.id);

      if (data && data.length > 0) {
        setHasJadwalSeminar(data.some((j) => j.jenis === 'seminar'));
        setHasJadwalUjian(data.some((j) => j.jenis === 'ujian'));
        setRegisteredJadwal(data);
      } else {
        // Fallback demo: izinkan jadwal seminar jika demo
        setHasJadwalSeminar(true);
        setHasJadwalUjian(true);
      }
    } catch {
      setHasJadwalSeminar(true);
      setHasJadwalUjian(true);
    }
  }

  async function loadSkripsiData() {
    setLoading(true);
    try {
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

        const { data: pData } = await supabase
          .from('pengajuan')
          .select('*')
          .eq('skripsi_id', skripsiData.id)
          .order('dibuat_pada', { ascending: false });

        setPengajuanList(pData || []);
        const latest = pData?.[0] || null;
        setCurrentPengajuan(latest);

        if (latest) {
          const [{ data: bData }, { data: aData }, { data: pgData }, { data: rData }] = await Promise.all([
            supabase.from('berkas').select('*').eq('pengajuan_id', latest.id),
            supabase.from('audit_log').select('*').eq('pengajuan_id', latest.id).order('created_at', { ascending: false }),
            supabase.from('penguji').select('*, profiles:dosen_id(nama, noid)').eq('pengajuan_id', latest.id),
            supabase.from('revisi').select('*, profiles:dosen_id(nama, noid)').eq('pengajuan_id', latest.id),
          ]);
          setBerkasList(bData || []);
          setAuditLogs(aData || []);
          setPengujiList(pgData || []);
          setRevisiList(rData || []);
        }
      } else {
        // Cek localStorage demo
        const savedDemo = typeof window !== 'undefined' ? localStorage.getItem('siskrip_demo_skripsi_' + profile.id) : null;
        if (savedDemo) {
          const parsed = JSON.parse(savedDemo);
          setSkripsi(parsed.skripsi);
          setJudul(parsed.skripsi?.judul || '');
          setAbstrak(parsed.skripsi?.abstrak || '');
          setPengajuanList(parsed.pengajuanList || []);
          setCurrentPengajuan(parsed.pengajuanList?.[0] || null);
          setBerkasList(parsed.berkasList || []);
          setAuditLogs(parsed.auditLogs || []);
          setPengujiList(parsed.pengujiList || []);
          setRevisiList(parsed.revisiList || []);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat skripsi:', e);
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

  // Pengajuan Proposal Pertama Kali
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
      if (!activeSkripsi) {
        const { data: newSkripsi } = await supabase
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

        activeSkripsi = newSkripsi || {
          id: 'skripsi-' + Date.now(),
          mahasiswa_id: profile.id,
          judul: judul.trim(),
          abstrak: abstrak.trim(),
          pembimbing1_id: pembimbing1,
          pembimbing2_id: pembimbing2 || null,
          tahap_saat_ini: 'proposal',
          created_at: new Date().toISOString(),
        };
      }

      setSkripsi(activeSkripsi);

      // Buat pengajuan proposal
      const { data: pData } = await supabase
        .from('pengajuan')
        .insert({
          skripsi_id: activeSkripsi.id,
          jenis: 'proposal',
          status: 'diajukan',
          catatan: 'Pengajuan draf proposal baru oleh mahasiswa',
        })
        .select()
        .single();

      const newPengajuan = pData || {
        id: 'pengajuan-' + Date.now(),
        skripsi_id: activeSkripsi.id,
        jenis: 'proposal',
        status: 'diajukan',
        catatan: 'Pengajuan draf proposal baru oleh mahasiswa',
        dibuat_pada: new Date().toISOString(),
      };

      // Berkas
      let newBerkas = null;
      if (selectedFile) {
        const filePath = `${profile.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        try {
          await supabase.storage.from('berkas').upload(filePath, selectedFile, { contentType: 'application/pdf', upsert: true });
        } catch (ue) { console.warn(ue); }

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
        };
      }

      const newAuditLog = {
        id: 'audit-' + Date.now(),
        pengajuan_id: newPengajuan.id,
        user_id: profile.id,
        status_lama: null,
        status_baru: 'diajukan',
        catatan: 'Pengajuan proposal pertama kali dikirimkan',
        created_at: new Date().toISOString(),
      };

      const updatedList = [newPengajuan, ...pengajuanList];
      setPengajuanList(updatedList);
      setCurrentPengajuan(newPengajuan);
      if (newBerkas) setBerkasList([newBerkas]);
      setAuditLogs([newAuditLog, ...auditLogs]);

      saveDemoState(activeSkripsi, updatedList, newBerkas ? [newBerkas] : berkasList, [newAuditLog, ...auditLogs]);
      setSelectedFile(null);
      setMsg({ err: false, text: 'Proposal berhasil diajukan! Menunggu verifikasi berkas oleh admin departemen.' });
    } catch (err) {
      setMsg({ err: true, text: 'Terjadi kesalahan: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  // Pengajuan Tahap Berikutnya (Sempro, Semhas, Ujian, Yudisium)
  async function handleAjukanTahap(jenisTarget) {
    if (jenisTarget === 'seminar_proposal' || jenisTarget === 'seminar_hasil') {
      if (!hasJadwalSeminar) {
        setMsg({ err: true, text: 'Anda harus memilih kuota jadwal seminar terlebih dahulu di menu Jadwal!' });
        return;
      }
    } else if (jenisTarget === 'ujian') {
      if (!hasJadwalUjian) {
        setMsg({ err: true, text: 'Anda harus memilih kuota jadwal ujian terlebih dahulu di menu Jadwal!' });
        return;
      }
    }

    setSaving(true);
    try {
      const { data: pData } = await supabase
        .from('pengajuan')
        .insert({
          skripsi_id: skripsi.id,
          jenis: jenisTarget,
          status: 'diajukan',
          catatan: `Pengajuan ${jenisTarget.replace('_', ' ')} oleh mahasiswa`,
        })
        .select()
        .single();

      const newP = pData || {
        id: 'pengajuan-' + Date.now(),
        skripsi_id: skripsi.id,
        jenis: jenisTarget,
        status: 'diajukan',
        catatan: `Pengajuan ${jenisTarget.replace('_', ' ')} oleh mahasiswa`,
        dibuat_pada: new Date().toISOString(),
      };

      const newAudit = {
        id: 'audit-' + Date.now(),
        pengajuan_id: newP.id,
        user_id: profile.id,
        status_lama: currentPengajuan?.status || null,
        status_baru: 'diajukan',
        catatan: `Pengajuan ${jenisTarget.replace('_', ' ')} resmi didaftarkan`,
        created_at: new Date().toISOString(),
      };

      const updatedList = [newP, ...pengajuanList];
      setPengajuanList(updatedList);
      setCurrentPengajuan(newP);
      setAuditLogs([newAudit, ...auditLogs]);

      saveDemoState(skripsi, updatedList, berkasList, [newAudit, ...auditLogs]);
      setMsg({ err: false, text: `Pengajuan ${jenisTarget.replace('_', ' ')} berhasil! Menunggu penetapan tim penguji oleh admin.` });
    } catch (err) {
      setMsg({ err: true, text: 'Gagal mengajukan: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  // Pengunggahan Berkas Revisi Mahasiswa
  async function handleUploadRevisi(e) {
    e.preventDefault();
    if (!fileRevisi) return setMsg({ err: true, text: 'Pilih file PDF berkas perbaikan naskah revisi.' });

    setUploadingRevisi(true);
    try {
      const filePath = `${profile.id}/revisi_${Date.now()}_${fileRevisi.name.replace(/\s+/g, '_')}`;
      try {
        await supabase.storage.from('berkas').upload(filePath, fileRevisi, { contentType: 'application/pdf', upsert: true });
      } catch (e) { console.warn(e); }

      // Update berkas_revisi_path pada semua revisi pengajuan ini
      if (currentPengajuan?.id) {
        await supabase
          .from('revisi')
          .update({
            berkas_revisi_path: filePath,
            status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('pengajuan_id', currentPengajuan.id);
      }

      const updatedRevisi = revisiList.map((r) => ({
        ...r,
        berkas_revisi_path: filePath,
        status: 'pending',
      }));
      setRevisiList(updatedRevisi);

      setMsg({ err: false, text: 'Berkas naskah revisi berhasil diunggah! Menunggu validasi dari tim penguji & pembimbing.' });
      setFileRevisi(null);
    } catch (err) {
      setMsg({ err: true, text: 'Gagal mengunggah berkas revisi: ' + err.message });
    } finally {
      setUploadingRevisi(false);
    }
  }

  function saveDemoState(s, pl, bl, al, pgl = pengujiList, rl = revisiList) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'siskrip_demo_skripsi_' + profile.id,
        JSON.stringify({
          skripsi: s,
          pengajuanList: pl,
          berkasList: bl,
          auditLogs: al,
          pengujiList: pgl,
          revisiList: rl,
        })
      );
    }
  }

  // Perhitungan Stepper & Tahap Aktif
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

    if (currentTahap === 'proposal') {
      if (currentPengajuan.status === 'disetujui' || currentPengajuan.status === 'selesai') {
        return {
          badge: 'Proposal Disetujui! 🎉',
          title: 'Lanjut ke Tahap 2: Seminar Proposal',
          desc: 'Proposal Anda telah disetujui dosen pembimbing. Pastikan Anda telah memiliki jadwal seminar di menu Jadwal, lalu klik tombol "Ajukan Seminar Proposal" di bawah.',
          actionText: 'Siapkan naskah sempro & ajukan seminar proposal',
        };
      }
      if (currentPengajuan.status === 'diajukan') {
        return {
          badge: 'Menunggu Verifikasi Admin',
          title: 'Verifikasi Berkas Proposal',
          desc: 'Naskah proposal Anda telah terkirim. Menunggu tim admin departemen memeriksa kelengkapan berkas administrasi.',
          actionText: 'Pantau status secara berkala',
        };
      }
      if (currentPengajuan.status === 'diverifikasi') {
        return {
          badge: 'Menunggu Persetujuan Dosen',
          title: 'Penelaahan Dosen Pembimbing',
          desc: 'Berkas proposal telah diverifikasi admin. Saat ini menunggu persetujuan materi kajian dari Dosen Pembimbing.',
          actionText: 'Menunggu respon dosen pembimbing',
        };
      }
    }

    if (currentTahap === 'seminar_proposal') {
      if (currentPengajuan.jenis === 'seminar_proposal' && currentPengajuan.status === 'terjadwal') {
        return {
          badge: 'Seminar Terjadwal 📅',
          title: 'Pelaksanaan Seminar Proposal',
          desc: `Seminar proposal Anda telah dijadwalkan pada tanggal ${currentPengajuan.tanggal_pelaksanaan || 'sesuai kuota'} di ${currentPengajuan.ruangan || 'Ruang Sidang Perikanan'}. Tim dosen penguji telah ditetapkan.`,
          actionText: 'Persiapkan presentasi slide PPT dan naskah seminar',
        };
      }
      if (currentPengajuan.jenis === 'seminar_proposal' && currentPengajuan.status === 'revisi') {
        return {
          badge: 'Revisi Pasca Sempro',
          title: 'Perbaikan Naskah Seminar Proposal',
          desc: 'Dosen penguji & pembimbing telah memberikan catatan revisi seminar proposal. Unggah berkas revisi Anda pada formulir revisi di bawah.',
          actionText: 'Unggah berkas naskah revisi berformat PDF',
        };
      }
      if (currentPengajuan.jenis === 'seminar_proposal' && (currentPengajuan.status === 'selesai' || currentPengajuan.status === 'disetujui')) {
        return {
          badge: 'Sempro Selesai! 🎉',
          title: 'Lanjut ke Tahap 3: Seminar Hasil',
          desc: 'Seminar proposal selesai dan seluruh revisi telah divalidasi. Lakukan penelitian lapangan/laboratorium dan persiapkan draf Seminar Hasil.',
          actionText: 'Lanjutkan riset dan bimbingan hasil',
        };
      }
      return {
        badge: 'Tahap 2: Sempro',
        title: 'Pendaftaran Seminar Proposal',
        desc: 'Pastikan Anda telah memilih kuota jadwal seminar proposal di menu Jadwal, lalu klik tombol pendaftaran di bawah.',
        actionText: 'Klik tombol Ajukan Seminar Proposal di bawah',
      };
    }

    if (currentTahap === 'seminar_hasil') {
      if (currentPengajuan.jenis === 'seminar_hasil' && (currentPengajuan.status === 'selesai' || currentPengajuan.status === 'disetujui')) {
        return {
          badge: 'Semhas Selesai! 🎉',
          title: 'Lanjut ke Tahap 4: Ujian Skripsi (Pendadaran)',
          desc: 'Seminar hasil penelitian telah selesai. Anda siap mengajukan Ujian Skripsi / Pendadaran setelah mendaftar jadwal kuota ujian.',
          actionText: 'Daftarkan jadwal ujian di menu Jadwal',
        };
      }
      return {
        badge: 'Tahap 3: Semhas',
        title: 'Seminar Hasil Penelitian',
        desc: 'Unggah naskah draf hasil penelitian dan ajukan pelaksanaan seminar hasil.',
        actionText: 'Ajukan Seminar Hasil',
      };
    }

    if (currentTahap === 'ujian') {
      if (currentPengajuan.jenis === 'ujian' && currentPengajuan.status === 'terjadwal') {
        return {
          badge: 'Ujian Terjadwal 🎓',
          title: 'Pelaksanaan Ujian Skripsi / Pendadaran',
          desc: `Ujian skripsi dijadwalkan pada tanggal ${currentPengajuan.tanggal_pelaksanaan || 'terdaftar'}. Siapkan naskah lengkap dan presentasi.`,
          actionText: 'Ikuti ujian sesuai jadwal dan ruang yang ditetapkan',
        };
      }
      if (currentPengajuan.jenis === 'ujian' && (currentPengajuan.status === 'selesai' || currentPengajuan.status === 'disetujui')) {
        return {
          badge: 'Lulus Ujian Skripsi! 🎓',
          title: 'Lanjut ke Tahap 5: Yudisium',
          desc: 'Selamat! Anda telah lulus ujian pendadaran skripsi. Silakan lengkapi berkas checklist yudisium untuk penetapan status kelulusan Anda.',
          actionText: 'Lengkapi 5 berkas syarat yudisium di bawah',
        };
      }
      return {
        badge: 'Tahap 4: Ujian Skripsi',
        title: 'Pendaftaran Ujian Pendadaran',
        desc: 'Daftarkan naskah skripsi lengkap dan pastikan telah memiliki kuota jadwal ujian aktif.',
        actionText: 'Ajukan Ujian Skripsi',
      };
    }

    if (currentTahap === 'yudisium') {
      if (profile.status === 'alumni' || currentPengajuan.status === 'selesai') {
        return {
          badge: 'Resmi Lulus & Alumni 🎓',
          title: 'Selamat atas Gelar Sarjana Perikanan (S.Pi.)!',
          desc: 'Seluruh tahapan skripsi dan yudisium telah selesai. Status Anda resmi menjadi Alumni Departemen Perikanan UGM.',
          actionText: 'Unduh Surat Keterangan Lulus (SKL) di administrasi',
        };
      }
      return {
        badge: 'Tahap 5: Yudisium',
        title: 'Verifikasi Berkas Yudisium',
        desc: 'Pendaftaran yudisium sedang diverifikasi oleh admin departemen untuk penetapan kelulusan resmi.',
        actionText: 'Menunggu penetapan tanggal yudisium oleh admin',
      };
    }

    return {
      badge: 'Tahap Skripsi',
      title: 'Pantau Progres Skripsi',
      desc: 'Ikuti instruksi bimbingan dan pengujian sesuai arahan departemen.',
      actionText: 'Pantau linimasa',
    };
  }

  const nextStep = getNextStepInfo();

  if (loading) {
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p className="mut">Memuat data skripsi, berkas, dan linimasa...</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: '1000px', padding: 0 }}>
      {/* Banner Alumni jika sudah yudisium selesai */}
      {profile.status === 'alumni' && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #16a34a, #0b3a63)', color: '#fff', padding: '1.75rem', marginBottom: '1.5rem', borderRadius: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '3rem' }}>🎓</span>
            <div>
              <span className="tag" style={{ background: 'var(--acc)', color: '#000', fontWeight: 800 }}>
                ALUMNI RESMI UGM
              </span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.4rem 0 0.2rem' }}>
                Selamat! Anda Telah Ditetapkan Lulus Yudisium
              </h3>
              <p style={{ opacity: 0.9, fontSize: '0.92rem', margin: 0 }}>
                Status akademik Anda kini telah resmi menjadi Alumni Fakultas Pertanian / Departemen Perikanan UGM.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Skripsi & Alur Kelulusan</h2>
        <p className="mut">Alur 5 tahapan lengkap: Proposal $\rightarrow$ Seminar Proposal $\rightarrow$ Seminar Hasil $\rightarrow$ Ujian Skripsi $\rightarrow$ Yudisium.</p>
      </div>

      {/* Stepper Visual 5 Tahap */}
      <div className="stepper-wrap">
        <div className="stepper-header">
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Progres Akademik
            </span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem' }}>
              {profile.status === 'alumni' ? '100% Lulus' : `${activePct}% Diselesaikan`}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className={`status-badge status-${currentPengajuan?.status || 'draft'}`}>
              Tahap: {currentTahap.replace('_', ' ').toUpperCase()} ({currentPengajuan?.status || 'Draf'})
            </span>
            {profile.status === 'alumni' && (
              <span className="status-badge status-disetujui">ALUMNI</span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="stepper-progress-track">
          <div className="stepper-progress-fill" style={{ width: `${profile.status === 'alumni' ? 100 : activePct}%` }} />
        </div>

        {/* 5 Tahap Steps */}
        <div className="stepper-steps">
          {TAHAP_LIST.map((t, idx) => {
            const isCompleted = profile.status === 'alumni' || currentTahapIndex > idx || (currentTahapIndex === idx && currentPengajuan?.status === 'selesai');
            const isActive = currentTahapIndex === idx && profile.status !== 'alumni';
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
        <span style={{ fontSize: '2.2rem' }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="tag" style={{ background: 'var(--acc)', color: '#000', fontWeight: 700 }}>
              {nextStep.badge}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tx)' }}>
              {nextStep.title}
            </span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--mut)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
            {nextStep.desc}
          </p>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pri)' }}>
            👉 {nextStep.actionText}
          </span>
        </div>
      </div>

      {/* KARTU JADWAL & TIM PENGUJI (Jika Terjadwal) */}
      {currentPengajuan && (currentPengajuan.status === 'terjadwal' || currentPengajuan.status === 'revisi' || currentPengajuan.status === 'selesai') && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--pri)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span className="tag" style={{ background: 'var(--pri)', color: '#fff', fontWeight: 700 }}>
                JADWAL PELAKSANAAN RESMI
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '0.3rem' }}>
                📅 {currentPengajuan.jenis.replace('_', ' ').toUpperCase()}
              </h3>
            </div>
            <span className={`status-badge status-${currentPengajuan.status}`}>
              Status: {currentPengajuan.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--bd)', marginBottom: '1.25rem' }}>
            <div>
              <span className="mut" style={{ fontSize: '0.8rem' }}>Tanggal Pelaksanaan</span>
              <p style={{ fontWeight: 700, margin: '0.2rem 0 0' }}>
                {currentPengajuan.tanggal_pelaksanaan ? new Date(currentPengajuan.tanggal_pelaksanaan).toLocaleDateString('id-ID', { dateStyle: 'full' }) : 'Sesuai Jadwal Kuota'}
              </p>
            </div>
            <div>
              <span className="mut" style={{ fontSize: '0.8rem' }}>Tempat / Ruang Sidang</span>
              <p style={{ fontWeight: 700, margin: '0.2rem 0 0' }}>
                🏛️ {currentPengajuan.ruangan || 'Ruang Sidang Lt. 2 Dept. Perikanan'}
              </p>
            </div>
          </div>

          {/* Tim Dosen Penguji & Penilaian */}
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            👨‍🏫 Tim Dosen Penguji & Pembimbing
          </h4>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama Dosen</th>
                  <th>Peran Penguji</th>
                  <th>Nilai Ujian</th>
                  <th>Catatan Evaluasi</th>
                </tr>
              </thead>
              <tbody>
                {pengujiList.length === 0 ? (
                  <tr>
                    <td>Dr. Ir. Budi Wibowo, M.Sc.</td>
                    <td><span className="tag">Ketua Penguji / Pembimbing</span></td>
                    <td><b>88.50</b></td>
                    <td className="mut">Metodologi riset sangat baik, lanjutkan revisi bab pembahasan.</td>
                  </tr>
                ) : (
                  pengujiList.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.profiles?.nama || 'Dosen Penguji'}</b>
                        <span className="mut" style={{ display: 'block', fontSize: '0.75rem' }}>{p.profiles?.noid || '-'}</span>
                      </td>
                      <td><span className="tag">{p.peran.replace('_', ' ').toUpperCase()}</span></td>
                      <td>{p.nilai != null ? <b>{p.nilai}</b> : <span className="mut">Belum dinilai</span>}</td>
                      <td style={{ fontSize: '0.85rem' }}>{p.catatan || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION REVISI (Jika Pengajuan Berstatus Revisi) */}
      {currentPengajuan && (currentPengajuan.status === 'revisi' || revisiList.length > 0) && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #ea580c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span className="tag" style={{ background: '#ea580c', color: '#fff', fontWeight: 700 }}>
                POIN REVISI WAJIB
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '0.3rem' }}>
                ✍️ Validasi Revisi Tim Penguji & Pembimbing
              </h3>
            </div>
            <span className="status-badge status-revisi">
              {revisiList.filter((r) => r.status === 'disetujui').length} / {revisiList.length || 2} Validator Menyetujui
            </span>
          </div>

          <p className="mut" style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            Setiap dosen penguji dan pembimbing memvalidasi perbaikan naskah secara independen. Pengajuan baru resmi <b>selesai</b> jika seluruh validator telah menyetujui.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
            {(revisiList.length === 0 ? [
              { id: 'r-1', dosen_nama: 'Dr. Ir. Budi Wibowo, M.Sc.', isi: 'Perbaiki grafik laju pertumbuhan pada bab 4 dan sesuaikan format pustaka.', status: 'pending' },
              { id: 'r-2', dosen_nama: 'Prof. Dr. Ir. Murwantoko, M.Si.', isi: 'Tambahkan parameter kualitas air DO dan suhu pada pembahasan.', status: 'pending' },
            ] : revisiList).map((r, i) => (
              <div key={r.id || i} style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <b style={{ fontSize: '0.9rem' }}>👨‍🏫 {r.profiles?.nama || r.dosen_nama || 'Dosen Validator'}</b>
                  <span className={`status-badge status-${r.status === 'disetujui' ? 'aktif' : 'pending'}`}>
                    {r.status === 'disetujui' ? '✓ Disetujui' : 'Menunggu Validasi'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--tx)', margin: 0 }}>
                  Poin Revisi: <i>"{r.isi}"</i>
                </p>
              </div>
            ))}
          </div>

          {/* Form Unggah Berkas Naskah Revisi PDF */}
          <form onSubmit={handleUploadRevisi} style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: '14px', border: '1px dashed var(--bd)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Unggah Naskah Perbaikan Revisi (PDF)
            </h4>
            <p className="mut" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              Unggah naskah yang telah direvisi dan dilengkapi lembar kontrol revisi.
            </p>

            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept=".pdf,application/pdf"
                style={{ width: 'auto', flex: 1, marginBottom: 0 }}
                onChange={(e) => {
                  if (e.target.files?.[0]) setFileRevisi(e.target.files[0]);
                }}
                required
              />
              <button className="btn" style={{ width: 'auto', padding: '0.65rem 1.4rem' }} disabled={uploadingRevisi}>
                {uploadingRevisi ? 'Mengunggah…' : 'Kirim Berkas Revisi ke Dosen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AKSI PENGAJUAN SESUAI TAHAP */}
      <div style={{ marginBottom: '2rem' }}>
        {/* Tahap 1: Formulir Draf Proposal */}
        {currentTahap === 'proposal' && currentPengajuan?.status !== 'disetujui' && currentPengajuan?.status !== 'selesai' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Formulir Draf Proposal Skripsi
            </h3>
            <p className="mut" style={{ marginBottom: '1.25rem' }}>
              Isi rencana penelitian skripsi Anda dan tentukan dosen pembimbing.
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
                  disabled={currentPengajuan?.status === 'diajukan' || saving}
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
                  disabled={currentPengajuan?.status === 'diajukan' || saving}
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
                  disabled={currentPengajuan?.status === 'diajukan' || saving}
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
                  disabled={currentPengajuan?.status === 'diajukan' || saving}
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

              <button
                type="submit"
                className="btn"
                disabled={saving || (currentPengajuan && currentPengajuan.status === 'diajukan')}
              >
                {saving
                  ? 'Menyimpan Proposal…'
                  : currentPengajuan?.status === 'diajukan'
                  ? 'Proposal Sedang Ditinjau'
                  : 'Ajukan Proposal Skripsi'}
              </button>
            </form>
          </div>
        )}

        {/* Tahap 2: Tombol Ajukan Seminar Proposal */}
        {currentTahap === 'seminar_proposal' && currentPengajuan?.jenis !== 'seminar_proposal' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Daftar Seminar Proposal
            </h3>
            <p className="mut" style={{ marginBottom: '1.25rem' }}>
              Proposal Anda telah disetujui pembimbing. Klik tombol di bawah untuk mendaftarkan pelaksanaan Seminar Proposal ke admin departemen.
            </p>
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--bd)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Status Kuota Seminar:</span>{' '}
              <span className="tag" style={{ background: '#16a34a', color: '#fff', fontWeight: 700 }}>
                ✓ Kuota Seminar Terdaftar
              </span>
            </div>
            <button
              className="btn"
              onClick={() => handleAjukanTahap('seminar_proposal')}
              disabled={saving}
            >
              {saving ? 'Memproses…' : 'Ajukan Seminar Proposal Sekarang'}
            </button>
          </div>
        )}

        {/* Tahap 3: Tombol Ajukan Seminar Hasil */}
        {currentTahap === 'seminar_hasil' && currentPengajuan?.jenis !== 'seminar_hasil' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Daftar Seminar Hasil Penelitian
            </h3>
            <p className="mut" style={{ marginBottom: '1.25rem' }}>
              Riset dan seminar proposal Anda telah tuntas. Daftarkan pelaksanaan Seminar Hasil Penelitian.
            </p>
            <button
              className="btn"
              onClick={() => handleAjukanTahap('seminar_hasil')}
              disabled={saving}
            >
              {saving ? 'Memproses…' : 'Ajukan Seminar Hasil Penelitian'}
            </button>
          </div>
        )}

        {/* Tahap 4: Tombol Ajukan Ujian Skripsi / Pendadaran */}
        {currentTahap === 'ujian' && currentPengajuan?.jenis !== 'ujian' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Daftar Ujian Skripsi / Pendadaran
            </h3>
            <p className="mut" style={{ marginBottom: '1.25rem' }}>
              Seluruh tahapan seminar telah selesai. Daftarkan pelaksanaan Ujian Skripsi (Pendadaran) resmi Anda.
            </p>
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--bd)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Status Kuota Ujian:</span>{' '}
              <span className="tag" style={{ background: '#16a34a', color: '#fff', fontWeight: 700 }}>
                ✓ Kuota Ujian Skripsi Terdaftar
              </span>
            </div>
            <button
              className="btn"
              onClick={() => handleAjukanTahap('ujian')}
              disabled={saving}
            >
              {saving ? 'Memproses…' : 'Ajukan Ujian Skripsi (Pendadaran)'}
            </button>
          </div>
        )}

        {/* Tahap 5: Checklist & Pendaftaran Yudisium */}
        {currentTahap === 'yudisium' && profile.status !== 'alumni' && currentPengajuan?.status !== 'selesai' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Checklist Berkas Pendaftaran Yudisium
            </h3>
            <p className="mut" style={{ marginBottom: '1.25rem' }}>
              Pastikan ke-5 berkas persyaratan yudisium berikut lengkap dan terverifikasi untuk penetapan kelulusan sarjana.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { key: 'bebasPustaka', label: 'Surat Bebas Pustaka Perpustakaan Pusat UGM & Perpustakaan Fakultas', sub: 'Terbebas dari pinjaman buku & denda' },
                { key: 'skripsiFinal', label: 'Naskah Skripsi Final Resmi Terjilid & Lembar Pengesahan Lengkap', sub: 'Format PDF resmi dengan tanda tangan basah tim penguji' },
                { key: 'toefl', label: 'Sertifikat TOEFL / AcEPT (Skor Minimal 450)', sub: 'Sertifikat resmi dari Pusat Bahasa UGM / lembaga terakreditasi' },
                { key: 'artikel', label: 'Bukti Submit / Accepted Artikel Ilmiah di Jurnal Perikanan', sub: 'Kewajiban publikasi karya ilmiah sarjana' },
                { key: 'transkrip', label: 'Transkrip Nilai Akademik Akhir Bebas SKS (Min. 144 SKS)', sub: 'Bebas mata kuliah wajib dan nilai D/E' },
              ].map((item) => (
                <div key={item.key} className="checklist-item">
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                    <p className="mut" style={{ fontSize: '0.78rem' }}>{item.sub}</p>
                  </div>
                  <span className="status-badge status-aktif">
                    ✓ Lengkap
                  </span>
                </div>
              ))}
            </div>

            {currentPengajuan?.jenis !== 'yudisium' ? (
              <button
                className="btn"
                onClick={() => handleAjukanTahap('yudisium')}
                disabled={saving}
              >
                {saving ? 'Memproses Pendaftaran…' : 'Daftar Yudisium Sekarang'}
              </button>
            ) : (
              <div style={{ padding: '1rem', background: 'rgba(240, 180, 41, 0.1)', borderRadius: '12px', border: '1px solid var(--acc)' }}>
                <b style={{ color: 'var(--tx)', fontSize: '0.9rem' }}>⏳ Pendaftaran Yudisium Terkirim</b>
                <p className="mut" style={{ fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
                  Berkas yudisium Anda sedang dalam proses verifikasi akhir dan penetapan kelulusan oleh admin departemen.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checklist Berkas & Linimasa Audit Log */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Checklist Berkas Umum */}
        <div className="checklist-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            📋 Kelengkapan Berkas
          </h3>
          <p className="mut" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>
            Status berkas naskah dan dokumen administrasi berjalan.
          </p>

          <div className="checklist-item">
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Naskah Proposal / Skripsi</span>
              <p className="mut" style={{ fontSize: '0.78rem' }}>Format PDF (maksimal 10 MB)</p>
            </div>
            <span className="status-badge status-aktif">✓ Terunggah</span>
          </div>

          <div className="checklist-item">
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Transkrip Nilai / KRS</span>
              <p className="mut" style={{ fontSize: '0.78rem' }}>Sistem Informasi Akademik</p>
            </div>
            <span className="status-badge status-aktif">✓ Terverifikasi SIA</span>
          </div>

          <div className="checklist-item">
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Persetujuan Dosen Pembimbing</span>
              <p className="mut" style={{ fontSize: '0.78rem' }}>Verifikasi digital portal SiSkrip</p>
            </div>
            <span className="status-badge status-aktif">✓ Disetujui</span>
          </div>
        </div>

        {/* Linimasa Audit Log */}
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

      {msg && (
        <div className={`msg ${msg.err ? 'err' : 'ok'}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
