'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';

export default function BimbinganPage() {
  const { profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('antrean'); // 'antrean' | 'mahasiswa'
  const [actionItem, setActionItem] = useState(null); // Item yang sedang ditindaklanjuti
  const [actionType, setActionType] = useState(''); // 'setujui' | 'revisi' | 'tolak'
  const [catatan, setCatatan] = useState('');
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState(null);

  // Data bimbingan
  const [antreanList, setAntreanList] = useState([]);
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
        // Ambil data profil mahasiswa terkait
        const mhsIds = skripsiData.map((s) => s.mahasiswa_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nama, noid, prodi')
          .in('id', mhsIds);
        const profileMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p]));

        // Ambil pengajuan terakhir untuk tiap skripsi
        const skripsiIds = skripsiData.map((s) => s.id);
        const { data: pengajuanData } = await supabase
          .from('pengajuan')
          .select('*')
          .in('skripsi_id', skripsiIds)
          .order('dibuat_pada', { ascending: false });

        // Ambil berkas terkait pengajuan
        const pIds = (pengajuanData || []).map((p) => p.id);
        const { data: berkasData } = await supabase
          .from('berkas')
          .select('*')
          .in('pengajuan_id', pIds);

        const berkasMap = {};
        (berkasData || []).forEach((b) => {
          if (!berkasMap[b.pengajuan_id]) berkasMap[b.pengajuan_id] = [];
          berkasMap[b.pengajuan_id].push(b);
        });

        // Susun data mahasiswa bimbingan & antrean
        const mList = [];
        const aList = [];

        skripsiData.forEach((s) => {
          const mhs = profileMap[s.mahasiswa_id] || { nama: 'Mahasiswa', noid: '-', prodi: 'Akuakultur' };
          const pLatest = (pengajuanData || []).find((p) => p.skripsi_id === s.id);
          const berkas = pLatest ? berkasMap[pLatest.id] || [] : [];
          const peran = s.pembimbing1_id === profile.id ? 'Pembimbing Utama' : 'Pembimbing Pendamping';

          const item = {
            skripsi: s,
            mahasiswa: mhs,
            pengajuan: pLatest,
            berkas,
            peran,
          };

          mList.push(item);

          // Masuk antrean jika status diverifikasi admin atau diajukan mahasiswa
          if (pLatest && (pLatest.status === 'diverifikasi' || pLatest.status === 'diajukan')) {
            aList.push(item);
          }
        });

        setMahasiswaList(mList);
        setAntreanList(aList);
      } else {
        // Gunakan demo data jika belum ada data di database
        loadDemoBimbingan();
      }
    } catch {
      loadDemoBimbingan();
    } finally {
      setLoading(false);
    }
  }

  function loadDemoBimbingan() {
    // Ambil data jika tersimpan di localStorage dari submit mahasiswa
    const demoStudentSkripsi = typeof window !== 'undefined' ? localStorage.getItem('siskrip_demo_skripsi_demo-user-id') : null;
    let submittedItem = null;
    if (demoStudentSkripsi) {
      try {
        const parsed = JSON.parse(demoStudentSkripsi);
        if (parsed.skripsi && parsed.pengajuanList?.[0]) {
          submittedItem = {
            skripsi: parsed.skripsi,
            mahasiswa: { nama: 'Budi Santoso', noid: '22/499123/PN/18000', prodi: 'Akuakultur' },
            pengajuan: parsed.pengajuanList[0],
            berkas: parsed.berkasList || [{ id: 'b1', nama: 'Draft_Proposal_Budi_Santoso.pdf', ukuran: 2450000 }],
            peran: 'Pembimbing Utama',
          };
        }
      } catch (e) {
        console.warn(e);
      }
    }

    const defaultItems = [
      submittedItem || {
        skripsi: {
          id: 'sk-1',
          judul: 'Kajian Efektivitas Probiotik Bacillus sp. pada Budidaya Udang Vaname (Litopenaeus vannamei)',
          abstrak: 'Penelitian ini bertujuan untuk menganalisis efektivitas pemberian probiotik terhadap sintasan dan pertumbuhan udang vaname di tambak intensif...',
          tahap_saat_ini: 'proposal',
        },
        mahasiswa: {
          nama: 'Budi Santoso',
          noid: '22/499123/PN/18000',
          prodi: 'Akuakultur',
        },
        pengajuan: {
          id: 'p-1',
          jenis: 'proposal',
          status: 'diverifikasi',
          catatan: 'Berkas administrasi dan format proposal telah diverifikasi lengkap oleh admin departemen.',
          dibuat_pada: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        berkas: [{ id: 'b-1', nama: 'Draf_Proposal_Budi_Santoso.pdf', ukuran: 3200000 }],
        peran: 'Pembimbing Utama',
      },
      {
        skripsi: {
          id: 'sk-2',
          judul: 'Formulasi Pakan Mandiri Berbasis Limbah Pengolahan Ikan Tuna untuk Efisiensi Budidaya Patin',
          abstrak: 'Optimalisasi pemanfaatan limbah perikanan sebagai substitusi tepung ikan guna menekan rasio konversi pakan (FCR)...',
          tahap_saat_ini: 'proposal',
        },
        mahasiswa: {
          nama: 'Siti Rahmawati',
          noid: '22/498765/PN/17988',
          prodi: 'Teknologi Hasil Perikanan',
        },
        pengajuan: {
          id: 'p-2',
          jenis: 'proposal',
          status: 'diajukan',
          catatan: 'Draf proposal baru dikirimkan mahasiswa.',
          dibuat_pada: new Date(Date.now() - 3600000 * 48).toISOString(),
        },
        berkas: [{ id: 'b-2', nama: 'Proposal_Siti_Rahmawati_THP.pdf', ukuran: 1800000 }],
        peran: 'Pembimbing Utama',
      },
      {
        skripsi: {
          id: 'sk-3',
          judul: 'Dinamika Populasi dan Pola Rekrutmen Rajungan (Portunus pelagicus) di Teluk Bintan',
          abstrak: 'Kajian stok sumber daya perikanan menggunakan model surplus produksi Schaefer...',
          tahap_saat_ini: 'seminar_proposal',
        },
        mahasiswa: {
          nama: 'Ahmad Fauzi',
          noid: '21/476543/PN/17120',
          prodi: 'Manajemen Sumberdaya Akuatik',
        },
        pengajuan: {
          id: 'p-3',
          jenis: 'proposal',
          status: 'disetujui',
          catatan: 'Materi kajian dan metodologi disetujui. Siap seminar proposal.',
          dibuat_pada: new Date(Date.now() - 3600000 * 120).toISOString(),
        },
        berkas: [{ id: 'b-3', nama: 'Proposal_Final_Ahmad_Fauzi.pdf', ukuran: 4100000 }],
        peran: 'Pembimbing Pendamping',
      },
    ];

    setMahasiswaList(defaultItems);
    setAntreanList(defaultItems.filter((i) => i.pengajuan?.status === 'diverifikasi' || i.pengajuan?.status === 'diajukan'));
  }

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
      if (pId) {
        // 1. Update status pengajuan di database Supabase
        await supabase
          .from('pengajuan')
          .update({
            status: newStatus,
            catatan: catatan.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pId);

        // 2. Tambah audit log
        await supabase.from('audit_log').insert({
          pengajuan_id: pId,
          user_id: profile?.id,
          status_lama: actionItem.pengajuan?.status,
          status_baru: newStatus,
          catatan: catatan.trim(),
        });
      }

      // Update state lokal
      const updatedAntrean = antreanList.filter((a) => a.skripsi.id !== actionItem.skripsi.id);
      const updatedMahasiswa = mahasiswaList.map((m) => {
        if (m.skripsi.id === actionItem.skripsi.id) {
          return {
            ...m,
            pengajuan: {
              ...m.pengajuan,
              status: newStatus,
              catatan: catatan.trim(),
            },
            skripsi: {
              ...m.skripsi,
              tahap_saat_ini: newStatus === 'disetujui' ? 'seminar_proposal' : m.skripsi.tahap_saat_ini,
            },
          };
        }
        return m;
      });

      setAntreanList(updatedAntrean);
      setMahasiswaList(updatedMahasiswa);

      // Simpan demo state jika mahasiswa yang diupdate sama
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

      setMsg({
        err: false,
        text: `Tindakan ${actionType.toUpperCase()} untuk mahasiswa ${actionItem.mahasiswa.nama} berhasil disimpan!`,
      });
      setActionItem(null);
    } catch (err) {
      setMsg({ err: true, text: 'Gagal memproses persetujuan: ' + err.message });
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p className="mut">Memuat portal bimbingan dosen...</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: '1000px', padding: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Bimbingan Skripsi</h2>
          <p className="mut">Kelola persetujuan naskah proposal mahasiswa bimbingan dan pantau progres tahapan skripsi.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card)', padding: '0.3rem', borderRadius: '14px', border: '1px solid var(--bd)' }}>
          <button
            className={`btn-action ${activeTab === 'antrean' ? 'btn-approve' : 'btn-neutral'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('antrean')}
          >
            🔔 Perlu Tindakan ({antreanList.length})
          </button>
          <button
            className={`btn-action ${activeTab === 'mahasiswa' ? 'btn-approve' : 'btn-neutral'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('mahasiswa')}
          >
            👥 Semua Mahasiswa ({mahasiswaList.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Antrean Perlu Tindakan Anda */}
      {activeTab === 'antrean' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Antrean Pengajuan Menunggu Evaluasi ({antreanList.length})
            </h3>
            <span className="mut" style={{ fontSize: '0.85rem' }}>
              Dosen hanya melihat proposal dari mahasiswa bimbingannya
            </span>
          </div>

          {antreanList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🎉</span>
              <h4 style={{ fontSize: '1.15rem', marginBottom: '0.35rem' }}>Tidak Ada Antrean Tertunda</h4>
              <p className="mut" style={{ maxWidth: '420px', margin: '0 auto', fontSize: '0.88rem' }}>
                Semua pengajuan proposal skripsi dari mahasiswa bimbingan Anda telah selesai ditinjau.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {antreanList.map((item) => (
                <div key={item.skripsi.id} className="card" style={{ padding: '1.5rem' }}>
                  {/* Info Mahasiswa & Status */}
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
                        Peran Anda: <b>{item.peran}</b> · Tanggal Pengajuan:{' '}
                        {item.pengajuan?.dibuat_pada ? new Date(item.pengajuan.dibuat_pada).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-'}
                      </p>
                    </div>
                    <span className={`status-badge status-${item.pengajuan?.status || 'pending'}`}>
                      {item.pengajuan?.status === 'diverifikasi' ? 'Admin: Terverifikasi' : 'Menunggu Telaah'}
                    </span>
                  </div>

                  {/* Judul & Abstrak */}
                  <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--bd)', marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--pri)' }}>
                      📖 {item.skripsi.judul}
                    </h4>
                    <p style={{ fontSize: '0.86rem', color: 'var(--tx)', lineHeight: 1.5, margin: 0 }}>
                      {item.skripsi.abstrak}
                    </p>
                  </div>

                  {/* Dokumen Naskah Proposal PDF */}
                  {item.berkas && item.berkas.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dokumen Pendukung:</span>
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
                          <span className="mut" style={{ fontSize: '0.75rem' }}>
                            ({b.ukuran ? `${(b.ukuran / (1024 * 1024)).toFixed(1)} MB` : 'PDF'})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tombol Aksi Dosen */}
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

      {/* Tab 2: Semua Mahasiswa Bimbingan */}
      {activeTab === 'mahasiswa' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Daftar Seluruh Mahasiswa Bimbingan ({mahasiswaList.length})
          </h3>
          <p className="mut" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            Rekap mahasiswa yang sedang Anda bimbing beserta tahapan skripsi masing-masing.
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
                    <td>
                      <span className="tag" style={{ fontWeight: 600 }}>{m.peran}</span>
                    </td>
                    <td style={{ maxWidth: '320px', lineHeight: 1.4, fontSize: '0.85rem' }}>
                      {m.skripsi.judul}
                    </td>
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

      {/* Modal Dialog Tindakan Evaluasi Pembimbing */}
      {actionItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {actionType === 'setujui'
                ? '✅ Persetujuan Naskah Proposal'
                : actionType === 'revisi'
                ? '✍️ Formulir Catatan Revisi'
                : '❌ Konfirmasi Penolakan Proposal'}
            </h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Mahasiswa: <b>{actionItem.mahasiswa.nama}</b> ({actionItem.mahasiswa.noid})
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Catatan Dosen Pembimbing{' '}
                {actionType !== 'setujui' && <span style={{ color: 'var(--bad)' }}>*(Wajib diisi)</span>}
              </label>
              <textarea
                rows={4}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                placeholder={
                  actionType === 'revisi'
                    ? 'Tuliskan poin-poin bab/subbab yang harus diperbaiki mahasiswa...'
                    : actionType === 'tolak'
                    ? 'Tuliskan alasan penolakan judul/topik penelitian...'
                    : 'Catatan tambahan untuk mahasiswa (opsional)...'
                }
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                required={actionType !== 'setujui'}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-action btn-neutral"
                onClick={() => setActionItem(null)}
                disabled={processing}
              >
                Batal
              </button>
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
