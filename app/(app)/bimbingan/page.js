'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';

export default function BimbinganPage() {
  const { profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('antrean'); // 'antrean' | 'penilaian' | 'revisi' | 'mahasiswa'
  
  // Modal aksi proposal
  const [actionItem, setActionItem] = useState(null); // Item yang sedang ditindaklanjuti
  const [actionType, setActionType] = useState(''); // 'setujui' | 'revisi' | 'tolak'
  const [catatan, setCatatan] = useState('');
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState(null);

  // Modal penilaian seminar / ujian
  const [modalPenilaian, setModalPenilaian] = useState(null); // Item seminar/ujian yang akan dinilai
  const [inputNilai, setInputNilai] = useState('85');
  const [catatanNilai, setCatatanNilai] = useState('');
  const [savingNilai, setSavingNilai] = useState(false);

  // Data bimbingan
  const [antreanProposal, setAntreanProposal] = useState([]);
  const [antreanPenilaian, setAntreanPenilaian] = useState([]);
  const [antreanRevisi, setAntreanRevisi] = useState([]);
  const [mahasiswaList, setMahasiswaList] = useState([]);

  useEffect(() => {
    if (profile) {
      loadBimbinganData();
    }
  }, [profile]);

  async function loadBimbinganData() {
    setLoading(true);
    try {
      // 1. Ambil seluruh skripsi di mana dosen adalah pembimbing 1 atau 2
      const { data: skripsiData } = await supabase
        .from('skripsi')
        .select('*')
        .or(`pembimbing1_id.eq.${profile.id},pembimbing2_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (skripsiData && skripsiData.length > 0) {
        const mhsIds = skripsiData.map((s) => s.mahasiswa_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nama, noid, prodi')
          .in('id', mhsIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p]));

        const skripsiIds = skripsiData.map((s) => s.id);
        const { data: pengajuanData } = await supabase
          .from('pengajuan')
          .select('*')
          .in('skripsi_id', skripsiIds)
          .order('dibuat_pada', { ascending: false });

        const pIds = (pengajuanData || []).map((p) => p.id);
        const [{ data: berkasData }, { data: pengujiData }, { data: revisiData }] = await Promise.all([
          supabase.from('berkas').select('*').in('pengajuan_id', pIds),
          supabase.from('penguji').select('*').in('pengajuan_id', pIds),
          supabase.from('revisi').select('*').in('pengajuan_id', pIds),
        ]);

        const berkasMap = {};
        (berkasData || []).forEach((b) => {
          if (!berkasMap[b.pengajuan_id]) berkasMap[b.pengajuan_id] = [];
          berkasMap[b.pengajuan_id].push(b);
        });

        const pengujiMap = {};
        (pengujiData || []).forEach((pg) => {
          if (!pengujiMap[pg.pengajuan_id]) pengujiMap[pg.pengajuan_id] = [];
          pengujiMap[pg.pengajuan_id].push(pg);
        });

        const revisiMap = {};
        (revisiData || []).forEach((r) => {
          if (!revisiMap[r.pengajuan_id]) revisiMap[r.pengajuan_id] = [];
          revisiMap[r.pengajuan_id].push(r);
        });

        const mList = [];
        const aProposal = [];
        const aPenilaian = [];
        const aRevisi = [];

        skripsiData.forEach((s) => {
          const mhs = profileMap[s.mahasiswa_id] || { nama: 'Mahasiswa', noid: '-', prodi: 'Akuakultur' };
          const pLatest = (pengajuanData || []).find((p) => p.skripsi_id === s.id);
          const berkas = pLatest ? berkasMap[pLatest.id] || [] : [];
          const penguji = pLatest ? pengujiMap[pLatest.id] || [] : [];
          const revisi = pLatest ? revisiMap[pLatest.id] || [] : [];
          const peran = s.pembimbing1_id === profile.id ? 'Pembimbing Utama' : 'Pembimbing Pendamping';

          const item = {
            skripsi: s,
            mahasiswa: mhs,
            pengajuan: pLatest,
            berkas,
            penguji,
            revisi,
            peran,
          };

          mList.push(item);

          if (pLatest) {
            // Antrean proposal
            if (pLatest.jenis === 'proposal' && (pLatest.status === 'diverifikasi' || pLatest.status === 'diajukan')) {
              aProposal.push(item);
            }
            // Antrean penilaian seminar / ujian
            if (pLatest.jenis !== 'proposal' && (pLatest.status === 'terjadwal' || pLatest.status === 'diajukan')) {
              aPenilaian.push(item);
            }
            // Antrean validasi revisi
            if (pLatest.status === 'revisi' || revisi.some((r) => r.dosen_id === profile.id && r.status !== 'disetujui')) {
              aRevisi.push(item);
            }
          }
        });

        setMahasiswaList(mList);
        setAntreanProposal(aProposal);
        setAntreanPenilaian(aPenilaian);
        setAntreanRevisi(aRevisi);
      } else {
        loadDemoBimbingan();
      }
    } catch {
      loadDemoBimbingan();
    } finally {
      setLoading(false);
    }
  }

  function loadDemoBimbingan() {
    let submittedItem = null;
    if (typeof window !== 'undefined') {
      const demoKey = 'siskrip_demo_skripsi_demo-user-id';
      const cur = localStorage.getItem(demoKey);
      if (cur) {
        try {
          const parsed = JSON.parse(cur);
          if (parsed.skripsi && parsed.pengajuanList?.[0]) {
            submittedItem = {
              skripsi: parsed.skripsi,
              mahasiswa: { nama: 'Budi Santoso', noid: '22/499123/PN/18000', prodi: 'Akuakultur' },
              pengajuan: parsed.pengajuanList[0],
              berkas: parsed.berkasList || [{ id: 'b1', nama: 'Proposal_Skripsi_Budi_Santoso.pdf', ukuran: 2450000 }],
              penguji: parsed.pengujiList || [],
              revisi: parsed.revisiList || [],
              peran: 'Pembimbing Utama',
            };
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }

    const defaultProposal = submittedItem && submittedItem.pengajuan?.jenis === 'proposal' && submittedItem.pengajuan?.status !== 'disetujui' && submittedItem.pengajuan?.status !== 'selesai'
      ? [submittedItem]
      : [
          {
            skripsi: {
              id: 'sk-2',
              judul: 'Formulasi Pakan Mandiri Berbasis Limbah Pengolahan Ikan Tuna untuk Efisiensi Budidaya Patin',
              abstrak: 'Optimalisasi pemanfaatan limbah perikanan sebagai substitusi tepung ikan guna menekan rasio konversi pakan (FCR)...',
              tahap_saat_ini: 'proposal',
            },
            mahasiswa: { nama: 'Siti Rahmawati', noid: '22/498765/PN/17988', prodi: 'Teknologi Hasil Perikanan' },
            pengajuan: { id: 'p-2', jenis: 'proposal', status: 'diverifikasi', dibuat_pada: new Date().toISOString() },
            berkas: [{ id: 'b-2', nama: 'Proposal_Siti_Rahmawati_THP.pdf', ukuran: 1800000 }],
            peran: 'Pembimbing Utama',
          },
        ];

    const defaultPenilaian = [
      (submittedItem && submittedItem.pengajuan?.jenis !== 'proposal' && submittedItem.pengajuan?.status === 'terjadwal') ? submittedItem : {
        skripsi: {
          id: 'sk-1',
          judul: 'Kajian Efektivitas Probiotik Bacillus sp. pada Budidaya Udang Vaname (Litopenaeus vannamei)',
          abstrak: 'Penelitian ini menguji pengaruh konsentrasi probiotik terhadap kelangsungan hidup dan laju pertumbuhan udang vaname di tambak intensif.',
          tahap_saat_ini: 'seminar_proposal',
        },
        mahasiswa: { nama: 'Budi Santoso', noid: '22/499123/PN/18000', prodi: 'Akuakultur' },
        pengajuan: {
          id: 'p-1',
          jenis: 'seminar_proposal',
          status: 'terjadwal',
          tanggal_pelaksanaan: '2026-11-18',
          ruangan: 'Ruang Sidang 1 Dept. Perikanan',
          catatan: 'Seminar Proposal dijadwalkan oleh admin departemen',
        },
        berkas: [{ id: 'b-1', nama: 'Proposal_Skripsi_Budi_Santoso.pdf', ukuran: 3200000 }],
        peran: 'Ketua Penguji / Pembimbing',
      },
    ];

    const defaultRevisi = [
      {
        skripsi: {
          id: 'sk-3',
          judul: 'Dinamika Populasi dan Pola Rekrutmen Rajungan (Portunus pelagicus) di Teluk Bintan',
          abstrak: 'Kajian stok sumber daya perikanan menggunakan model surplus produksi Schaefer...',
          tahap_saat_ini: 'ujian',
        },
        mahasiswa: { nama: 'Ahmad Fauzi', noid: '21/476543/PN/17120', prodi: 'Manajemen Sumberdaya Akuatik' },
        pengajuan: { id: 'p-3', jenis: 'ujian', status: 'revisi', catatan: 'Perbaiki bab pembahasan dan cantumkan uji signifikansi statistik.' },
        revisi: [
          { id: 'r-1', dosen_id: 'dosen-2', isi: 'Perbaiki bab pembahasan dan cantumkan uji signifikansi statistik.', status: 'pending', berkas_revisi_path: 'Revisi_Ahmad_Fauzi_Final.pdf' },
        ],
        peran: 'Pembimbing Utama',
      },
    ];

    setAntreanProposal(defaultProposal);
    setAntreanPenilaian(defaultPenilaian);
    setAntreanRevisi(defaultRevisi);
    setMahasiswaList([...defaultProposal, ...defaultPenilaian, ...defaultRevisi]);
  }

  // 1. Aksi Persetujuan Proposal
  function openActionModal(item, type) {
    setActionItem(item);
    setActionType(type);
    setCatatan(type === 'setujui' ? 'Proposal disetujui untuk lanjut ke tahap Seminar Proposal.' : '');
  }

  async function handleConfirmAction() {
    if (!actionItem) return;
    if ((actionType === 'revisi' || actionType === 'tolak') && !catatan.trim()) {
      setMsg({ err: true, text: 'Wajib mengisi catatan pembimbing untuk tindakan ' + actionType + '.' });
      return;
    }

    setProcessing(true);
    const newStatus = actionType === 'setujui' ? 'disetujui' : actionType === 'revisi' ? 'revisi' : 'ditolak';

    try {
      const pId = actionItem.pengajuan?.id;
      if (pId && !pId.startsWith('p-')) {
        await supabase.from('pengajuan').update({ status: newStatus, catatan: catatan.trim(), updated_at: new Date().toISOString() }).eq('id', pId);
        await supabase.from('audit_log').insert({
          pengajuan_id: pId,
          user_id: profile?.id,
          status_lama: actionItem.pengajuan?.status,
          status_baru: newStatus,
          catatan: catatan.trim(),
        });
      }

      setAntreanProposal((prev) => prev.filter((a) => a.skripsi.id !== actionItem.skripsi.id));

      // Simpan demo state
      if (typeof window !== 'undefined' && actionItem.mahasiswa?.noid === '22/499123/PN/18000') {
        const demoKey = 'siskrip_demo_skripsi_demo-user-id';
        const cur = localStorage.getItem(demoKey);
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed.pengajuanList?.[0]) {
            parsed.pengajuanList[0].status = newStatus;
            parsed.pengajuanList[0].catatan = catatan.trim();
            if (newStatus === 'disetujui') parsed.skripsi.tahap_saat_ini = 'seminar_proposal';
            parsed.auditLogs = [
              {
                id: 'audit-' + Date.now(),
                pengajuan_id: parsed.pengajuanList[0].id,
                status_lama: actionItem.pengajuan?.status,
                status_baru: newStatus,
                catatan: catatan.trim(),
                created_at: new Date().toISOString(),
              },
              ...(parsed.auditLogs || []),
            ];
            localStorage.setItem(demoKey, JSON.stringify(parsed));
          }
        }
      }

      setMsg({ err: false, text: `Tindakan ${actionType.toUpperCase()} untuk mahasiswa ${actionItem.mahasiswa.nama} berhasil disimpan!` });
      setActionItem(null);
    } catch (err) {
      setMsg({ err: true, text: 'Gagal memproses: ' + err.message });
    } finally {
      setProcessing(false);
    }
  }

  // 2. Aksi Pengisian Nilai & Catatan Evaluasi Seminar / Ujian
  async function handleSubmitPenilaian() {
    if (!modalPenilaian) return;
    const scoreNum = parseFloat(inputNilai);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setMsg({ err: true, text: 'Nilai harus berupa angka antara 0 hingga 100.' });
      return;
    }

    setSavingNilai(true);
    try {
      const pId = modalPenilaian.pengajuan?.id;
      if (pId && !pId.startsWith('p-')) {
        // Simpan / update di tabel penguji
        await supabase.from('penguji').upsert({
          pengajuan_id: pId,
          dosen_id: profile.id,
          peran: 'pembimbing',
          nilai: scoreNum,
          catatan: catatanNilai.trim(),
          dinilai_pada: new Date().toISOString(),
        });

        // Buat record revisi jika ada catatan perbaikan
        if (catatanNilai.trim()) {
          await supabase.from('revisi').insert({
            pengajuan_id: pId,
            dosen_id: profile.id,
            isi: catatanNilai.trim(),
            status: 'pending',
          });
          // Ubah status pengajuan menjadi 'revisi'
          await supabase.from('pengajuan').update({ status: 'revisi', catatan: 'Dosen memberikan catatan revisi pasca seminar/ujian.' }).eq('id', pId);
        }
      }

      setAntreanPenilaian((prev) => prev.filter((a) => a.skripsi.id !== modalPenilaian.skripsi.id));

      // Simpan demo state
      if (typeof window !== 'undefined' && modalPenilaian.mahasiswa?.noid === '22/499123/PN/18000') {
        const demoKey = 'siskrip_demo_skripsi_demo-user-id';
        const cur = localStorage.getItem(demoKey);
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed.pengajuanList?.[0]) {
            parsed.pengajuanList[0].status = 'revisi';
            parsed.pengajuanList[0].catatan = catatanNilai.trim() || 'Nilai terkirim. Lanjutkan revisi.';
            parsed.pengujiList = [
              {
                id: 'pg-1',
                profiles: { nama: profile.nama, noid: profile.noid },
                peran: 'Ketua Penguji / Pembimbing',
                nilai: scoreNum,
                catatan: catatanNilai.trim(),
              },
            ];
            parsed.revisiList = [
              {
                id: 'r-new',
                dosen_id: profile.id,
                profiles: { nama: profile.nama, noid: profile.noid },
                isi: catatanNilai.trim() || 'Perbaiki format naskah dan grafik pembahasan.',
                status: 'pending',
              },
            ];
            parsed.auditLogs = [
              {
                id: 'audit-' + Date.now(),
                pengajuan_id: parsed.pengajuanList[0].id,
                status_lama: 'terjadwal',
                status_baru: 'revisi',
                catatan: `Penilaian diisi (${scoreNum}) dengan catatan revisi: ${catatanNilai.trim()}`,
                created_at: new Date().toISOString(),
              },
              ...(parsed.auditLogs || []),
            ];
            localStorage.setItem(demoKey, JSON.stringify(parsed));
          }
        }
      }

      setMsg({ err: false, text: `Nilai (${scoreNum}) dan catatan evaluasi untuk ${modalPenilaian.mahasiswa.nama} berhasil disimpan!` });
      setModalPenilaian(null);
    } catch (err) {
      setMsg({ err: true, text: 'Gagal menyimpan penilaian: ' + err.message });
    } finally {
      setSavingNilai(false);
    }
  }

  // 3. Aksi Validasi Revisi Mahasiswa per Validator
  async function handleValidasiRevisi(item, statusTarget, note) {
    try {
      if (item.pengajuan?.id && !item.pengajuan.id.startsWith('p-')) {
        await supabase
          .from('revisi')
          .update({
            status: statusTarget,
            catatan_validasi: note || (statusTarget === 'disetujui' ? 'Revisi disetujui' : 'Perlu perbaikan ulang'),
            divalidasi_pada: new Date().toISOString(),
          })
          .eq('pengajuan_id', item.pengajuan.id)
          .eq('dosen_id', profile.id);
      }

      setAntreanRevisi((prev) => prev.filter((a) => a.skripsi.id !== item.skripsi.id));

      if (typeof window !== 'undefined' && item.mahasiswa?.noid === '22/499123/PN/18000') {
        const demoKey = 'siskrip_demo_skripsi_demo-user-id';
        const cur = localStorage.getItem(demoKey);
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed.pengajuanList?.[0]) {
            parsed.pengajuanList[0].status = 'selesai';
            parsed.pengajuanList[0].catatan = 'Seluruh revisi disetujui oleh dosen validator!';
            if (parsed.skripsi.tahap_saat_ini === 'seminar_proposal') parsed.skripsi.tahap_saat_ini = 'seminar_hasil';
            else if (parsed.skripsi.tahap_saat_ini === 'seminar_hasil') parsed.skripsi.tahap_saat_ini = 'ujian';
            else if (parsed.skripsi.tahap_saat_ini === 'ujian') parsed.skripsi.tahap_saat_ini = 'yudisium';

            if (parsed.revisiList) {
              parsed.revisiList = parsed.revisiList.map((r) => ({ ...r, status: statusTarget }));
            }
            parsed.auditLogs = [
              {
                id: 'audit-' + Date.now(),
                pengajuan_id: parsed.pengajuanList[0].id,
                status_lama: 'revisi',
                status_baru: 'selesai',
                catatan: 'Semua poin revisi disetujui dosen validator. Tahap dinyatakan selesai.',
                created_at: new Date().toISOString(),
              },
              ...(parsed.auditLogs || []),
            ];
            localStorage.setItem(demoKey, JSON.stringify(parsed));
          }
        }
      }

      setMsg({ err: false, text: `Validasi revisi mahasiswa ${item.mahasiswa.nama} berhasil disetujui!` });
    } catch (err) {
      setMsg({ err: true, text: 'Gagal memvalidasi revisi: ' + err.message });
    }
  }

  const totalAntrean = antreanProposal.length + antreanPenilaian.length + antreanRevisi.length;

  if (loading) {
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p className="mut">Memuat portal bimbingan dosen & tim penguji...</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: '1000px', padding: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Bimbingan & Pengujian</h2>
          <p className="mut">Persetujuan proposal, pengisian nilai ujian/seminar, dan validasi berkas revisi mahasiswa.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--card)', padding: '0.3rem', borderRadius: '14px', border: '1px solid var(--bd)', flexWrap: 'wrap' }}>
          <button
            className={`btn-action ${activeTab === 'antrean' ? 'btn-approve' : 'btn-neutral'}`}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            onClick={() => setActiveTab('antrean')}
          >
            📋 Proposal ({antreanProposal.length})
          </button>
          <button
            className={`btn-action ${activeTab === 'penilaian' ? 'btn-approve' : 'btn-neutral'}`}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            onClick={() => setActiveTab('penilaian')}
          >
            ⭐ Penilaian Ujian ({antreanPenilaian.length})
          </button>
          <button
            className={`btn-action ${activeTab === 'revisi' ? 'btn-approve' : 'btn-neutral'}`}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            onClick={() => setActiveTab('revisi')}
          >
            ✍️ Validasi Revisi ({antreanRevisi.length})
          </button>
          <button
            className={`btn-action ${activeTab === 'mahasiswa' ? 'btn-approve' : 'btn-neutral'}`}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            onClick={() => setActiveTab('mahasiswa')}
          >
            👥 Mahasiswa ({mahasiswaList.length})
          </button>
        </div>
      </div>

      {/* TAB 1: PERSETUJUAN PROPOSAL */}
      {activeTab === 'antrean' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Antrean Penelaahan Proposal ({antreanProposal.length})
            </h3>
            <span className="mut" style={{ fontSize: '0.82rem' }}>
              Dosen hanya melihat proposal dari mahasiswa bimbingannya
            </span>
          </div>

          {antreanProposal.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🎉</span>
              <h4 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Tidak Ada Proposal Tertunda</h4>
              <p className="mut" style={{ maxWidth: '420px', margin: '0 auto', fontSize: '0.88rem' }}>
                Seluruh pengajuan proposal skripsi mahasiswa bimbingan Anda telah selesai ditinjau.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {antreanProposal.map((item) => (
                <div key={item.skripsi.id} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{item.mahasiswa.nama}</span>
                        <span className="tag">{item.mahasiswa.noid}</span>
                        <span className="tag" style={{ background: 'rgba(11, 58, 99, 0.1)', color: 'var(--pri)', fontWeight: 600 }}>
                          {item.mahasiswa.prodi}
                        </span>
                      </div>
                      <p className="mut" style={{ fontSize: '0.82rem' }}>
                        Peran Anda: <b>{item.peran}</b>
                      </p>
                    </div>
                    <span className="status-badge status-diverifikasi">
                      Admin: Terverifikasi
                    </span>
                  </div>

                  <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--bd)', marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--pri)' }}>
                      📖 {item.skripsi.judul}
                    </h4>
                    <p style={{ fontSize: '0.86rem', color: 'var(--tx)', lineHeight: 1.5, margin: 0 }}>
                      {item.skripsi.abstrak}
                    </p>
                  </div>

                  {item.berkas && item.berkas.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dokumen Naskah:</span>
                      {item.berkas.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '99px',
                            background: 'rgba(11, 58, 99, 0.08)',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: 'var(--pri)',
                          }}
                        >
                          <span>📄 {b.nama}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--bd)', paddingTop: '1rem' }}>
                    <button
                      className="btn-action btn-reject"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                      onClick={() => openActionModal(item, 'tolak')}
                    >
                      ❌ Tolak Proposal
                    </button>
                    <button
                      className="btn-action btn-neutral"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', background: '#ea580c', color: '#fff' }}
                      onClick={() => openActionModal(item, 'revisi')}
                    >
                      ✍️ Minta Revisi
                    </button>
                    <button
                      className="btn-action btn-approve"
                      style={{ padding: '0.6rem 1.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                      onClick={() => openActionModal(item, 'setujui')}
                    >
                      ✅ Setujui Proposal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENILAIAN SEMINAR & UJIAN */}
      {activeTab === 'penilaian' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Ujian & Seminar Siap Dinilai ({antreanPenilaian.length})
            </h3>
            <span className="mut" style={{ fontSize: '0.82rem' }}>
              Dosen penguji & pembimbing menginput nilai (0–100) dan catatan evaluasi
            </span>
          </div>

          {antreanPenilaian.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>⭐</span>
              <h4 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Tidak Ada Jadwal Ujian yang Perlu Dinilai</h4>
              <p className="mut" style={{ maxWidth: '420px', margin: '0 auto', fontSize: '0.88rem' }}>
                Seluruh penilaian seminar proposal, seminar hasil, dan ujian skripsi telah terekap.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {antreanPenilaian.map((item) => (
                <div key={item.skripsi.id} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{item.mahasiswa.nama}</span>
                        <span className="tag">{item.mahasiswa.noid}</span>
                        <span className="tag" style={{ background: 'var(--pri)', color: '#fff', fontWeight: 700 }}>
                          {item.pengajuan?.jenis.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="mut" style={{ fontSize: '0.82rem' }}>
                        Tanggal: <b>{item.pengajuan?.tanggal_pelaksanaan ? new Date(item.pengajuan.tanggal_pelaksanaan).toLocaleDateString('id-ID', { dateStyle: 'full' }) : 'Terjadwal'}</b> · Ruang: <b>{item.pengajuan?.ruangan || 'Ruang Sidang'}</b>
                      </p>
                    </div>
                    <span className="status-badge status-terjadwal">
                      Siap Dinilai
                    </span>
                  </div>

                  <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--bd)', marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--pri)' }}>
                      📖 {item.skripsi.judul}
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--tx)', margin: 0 }}>
                      {item.skripsi.abstrak}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--bd)', paddingTop: '1rem' }}>
                    <button
                      className="btn-action btn-approve"
                      style={{ padding: '0.65rem 1.6rem', fontSize: '0.88rem', fontWeight: 700 }}
                      onClick={() => {
                        setModalPenilaian(item);
                        setInputNilai('85');
                        setCatatanNilai('Pembahasan dan penguasaan materi sangat baik. Lanjutkan sedikit perbaikan pada pustaka.');
                      }}
                    >
                      ⭐ Input Nilai & Catatan Evaluasi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VALIDASI REVISI MAHASISWA */}
      {activeTab === 'revisi' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Antrean Validasi Revisi Pasca Ujian/Seminar ({antreanRevisi.length})
            </h3>
            <span className="mut" style={{ fontSize: '0.82rem' }}>
              Setiap penguji & pembimbing memvalidasi berkas revisi satu per satu
            </span>
          </div>

          {antreanRevisi.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>✅</span>
              <h4 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Tidak Ada Berkas Revisi Tertunda</h4>
              <p className="mut" style={{ maxWidth: '420px', margin: '0 auto', fontSize: '0.88rem' }}>
                Seluruh naskah revisi mahasiswa bimbingan telah divalidasi dan disetujui.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {antreanRevisi.map((item) => (
                <div key={item.skripsi.id} className="card" style={{ padding: '1.5rem', border: '1px solid #ea580c' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{item.mahasiswa.nama}</span>
                        <span className="tag">{item.mahasiswa.noid}</span>
                        <span className="tag" style={{ background: '#ea580c', color: '#fff', fontWeight: 700 }}>
                          REVISI {item.pengajuan?.jenis.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="mut" style={{ fontSize: '0.82rem' }}>
                        Judul: <b>{item.skripsi.judul}</b>
                      </p>
                    </div>
                    <span className="status-badge status-revisi">
                      Menunggu Validasi Anda
                    </span>
                  </div>

                  <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--bd)', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--tx)', marginBottom: '0.35rem' }}>
                      📄 Dokumen Naskah Revisi yang Diunggah Mahasiswa:
                    </p>
                    <span className="tag" style={{ background: 'rgba(11, 58, 99, 0.1)', color: 'var(--pri)', fontWeight: 700 }}>
                      📑 Berkas_Revisi_Terkini.pdf (PDF Terlampir)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--bd)', paddingTop: '1rem' }}>
                    <button
                      className="btn-action btn-reject"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                      onClick={() => handleValidasiRevisi(item, 'perlu_revisi', 'Naskah belum sepenuhnya memenuhi catatan penguji.')}
                    >
                      ↩️ Minta Perbaikan Ulang
                    </button>
                    <button
                      className="btn-action btn-approve"
                      style={{ padding: '0.6rem 1.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                      onClick={() => handleValidasiRevisi(item, 'disetujui', 'Revisi telah diperiksa dan disetujui.')}
                    >
                      ✅ Setujui Revisi Naskah
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SEMUA MAHASISWA */}
      {activeTab === 'mahasiswa' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Daftar Seluruh Mahasiswa Bimbingan & Yang Diuji ({mahasiswaList.length})
          </h3>
          <p className="mut" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            Rekap mahasiswa yang sedang Anda bimbing atau uji beserta tahapan skripsi masing-masing.
          </p>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Peran</th>
                  <th>Judul Skripsi</th>
                  <th>Tahap Saat Ini</th>
                  <th>Status Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {mahasiswaList.map((m) => (
                  <tr key={m.skripsi.id}>
                    <td>
                      <b style={{ display: 'block' }}>{m.mahasiswa.nama}</b>
                      <span className="mut" style={{ fontSize: '0.78rem' }}>
                        {m.mahasiswa.noid} · {m.mahasiswa.prodi}
                      </span>
                    </td>
                    <td><span className="tag">{m.peran}</span></td>
                    <td style={{ maxWidth: '300px', fontSize: '0.85rem', lineHeight: 1.4 }}>{m.skripsi.judul}</td>
                    <td>
                      <span className="tag" style={{ textTransform: 'capitalize', fontWeight: 700 }}>
                        {m.skripsi.tahap_saat_ini.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${m.pengajuan?.status || 'pending'}`}>
                        {m.pengajuan?.status || 'Belum Pengajuan'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Penilaian Seminar / Ujian */}
      {modalPenilaian && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              ⭐ Form Penilaian & Evaluasi
            </h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Peserta: <b>{modalPenilaian.mahasiswa.nama}</b> ({modalPenilaian.mahasiswa.noid}) · Ujian: <b>{modalPenilaian.pengajuan?.jenis.replace('_', ' ').toUpperCase()}</b>
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Nilai Angka (Skala 0 – 100) <span style={{ color: 'var(--bad)' }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={inputNilai}
                onChange={(e) => setInputNilai(e.target.value)}
                style={{ width: '100%', fontSize: '1.1rem', fontWeight: 700 }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Catatan Evaluasi / Poin Revisi Ujian (Wajib jika ada perbaikan)
              </label>
              <textarea
                rows={4}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                placeholder="Tuliskan masukan metodologi, bab pembahasan, atau perbaikan naskah..."
                value={catatanNilai}
                onChange={(e) => setCatatanNilai(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-action btn-neutral"
                onClick={() => setModalPenilaian(null)}
                disabled={savingNilai}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-action btn-approve"
                style={{ padding: '0.6rem 1.4rem', fontWeight: 700 }}
                onClick={handleSubmitPenilaian}
                disabled={savingNilai}
              >
                {savingNilai ? 'Menyimpan…' : 'Kirim Penilaian Ujian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Tindakan Evaluasi Proposal */}
      {actionItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {actionType === 'setujui' ? '✅ Persetujuan Naskah Proposal' : actionType === 'revisi' ? '✍️ Formulir Catatan Revisi' : '❌ Konfirmasi Penolakan Proposal'}
            </h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Mahasiswa: <b>{actionItem.mahasiswa.nama}</b> ({actionItem.mahasiswa.noid})
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Catatan Dosen Pembimbing {actionType !== 'setujui' && <span style={{ color: 'var(--bad)' }}>*(Wajib diisi)</span>}
              </label>
              <textarea
                rows={4}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                placeholder={actionType === 'revisi' ? 'Tuliskan poin bab yang harus diperbaiki mahasiswa...' : 'Catatan tambahan untuk mahasiswa...'}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                required={actionType !== 'setujui'}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-action btn-neutral" onClick={() => setActionItem(null)} disabled={processing}>Batal</button>
              <button
                type="button"
                className={`btn-action ${actionType === 'setujui' ? 'btn-approve' : 'btn-reject'}`}
                style={{ padding: '0.6rem 1.4rem' }}
                onClick={handleConfirmAction}
                disabled={processing}
              >
                {processing ? 'Menyimpan…' : actionType === 'setujui' ? 'Setujui Proposal' : 'Kirim Catatan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`msg ${msg.err ? 'err' : 'ok'}`} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
