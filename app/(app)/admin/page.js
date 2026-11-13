'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';

const HARI_OPTIONS = [
  { val: 0, label: 'Minggu' },
  { val: 1, label: 'Senin' },
  { val: 2, label: 'Selasa' },
  { val: 3, label: 'Rabu' },
  { val: 4, label: 'Kamis' },
  { val: 5, label: 'Jumat' },
  { val: 6, label: 'Sabtu' },
];

export default function AdminPage() {
  const router = useRouter();
  const { profile } = useUser();
  const [tab, setTab] = useState('jadwal');
  const [msg, setMsg] = useState(null);

  // Guard: Hanya admin yang boleh mengakses
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  // Tab 1: Pengaturan Jadwal
  const [kuota, setKuota] = useState(5);
  const [selectedHari, setSelectedHari] = useState([2, 4]); // Default Sel & Kam
  const [savingJadwal, setSavingJadwal] = useState(false);

  // Tab 2: Verifikasi Dosen
  const [dosenList, setDosenList] = useState([]);
  const [loadingDosen, setLoadingDosen] = useState(false);

  // Tab 3: Daftar Peserta Jadwal
  const [pesertaList, setPesertaList] = useState([]);
  const [filterTanggal, setFilterTanggal] = useState('');
  const [loadingPeserta, setLoadingPeserta] = useState(false);

  // Tab 4: Kelola Pengumuman
  const [pengumumanList, setPengumumanList] = useState([]);
  const [loadingPengumuman, setLoadingPengumuman] = useState(false);
  const [formPengumuman, setFormPengumuman] = useState(null); // { id, judul, isi, aktif }

  // Tab 5: Kelola Pengguna
  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Tab 6: Verifikasi Berkas Pengajuan
  const [antreanBerkas, setAntreanBerkas] = useState([]);
  const [loadingBerkas, setLoadingBerkas] = useState(false);
  const [modalBerkas, setModalBerkas] = useState(null); // { item, tipe }
  const [catatanAdmin, setCatatanAdmin] = useState('');
  const [processingBerkas, setProcessingBerkas] = useState(false);

  // Load Initial Data
  useEffect(() => {
    loadSettings();
    loadDosen();
    loadPeserta();
    loadPengumuman();
    loadUsers();
    loadAntreanBerkas();
  }, []);

  async function loadSettings() {
    try {
      const { data } = await supabase.from('pengaturan_jadwal').select('*').single();
      if (data) {
        setKuota(data.kuota);
        setSelectedHari(data.hari || [2, 4]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadDosen() {
    setLoadingDosen(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'dosen')
        .order('created_at', { ascending: false });
      setDosenList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDosen(false);
    }
  }

  async function loadPeserta() {
    setLoadingPeserta(true);
    try {
      // Ambil daftar jadwal beserta data profil pemohon
      const { data: jadwalData } = await supabase
        .from('pendaftaran_jadwal')
        .select('*')
        .order('tanggal', { ascending: true });

      if (jadwalData && jadwalData.length > 0) {
        const userIds = [...new Set(jadwalData.map((j) => j.user_id))];
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, nama, noid, prodi')
          .in('id', userIds);

        const profileMap = Object.fromEntries((profData || []).map((p) => [p.id, p]));
        const merged = jadwalData.map((j) => ({
          ...j,
          user: profileMap[j.user_id] || { nama: 'Pengguna', noid: '-' },
        }));
        setPesertaList(merged);
      } else {
        setPesertaList([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPeserta(false);
    }
  }

  async function loadPengumuman() {
    setLoadingPengumuman(true);
    try {
      const { data } = await supabase
        .from('pengumuman')
        .select('*')
        .order('tanggal', { ascending: false });
      setPengumumanList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPengumuman(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsersList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Aksi 1: Simpan Pengaturan Jadwal
  async function handleSaveSettings(e) {
    e.preventDefault();
    if (selectedHari.length === 0) {
      setMsg({ e: 1, t: 'Pilih minimal 1 hari pelaksanaan seminar/ujian.' });
      return;
    }
    setSavingJadwal(true);
    const { error } = await supabase
      .from('pengaturan_jadwal')
      .update({ kuota: Number(kuota), hari: selectedHari })
      .eq('id', 1);
    setSavingJadwal(false);
    if (error) {
      setMsg({ e: 1, t: error.message });
    } else {
      setMsg({ t: 'Pengaturan jadwal berhasil disimpan!' });
    }
  }

  function toggleHari(dayVal) {
    if (selectedHari.includes(dayVal)) {
      setSelectedHari(selectedHari.filter((h) => h !== dayVal));
    } else {
      setSelectedHari([...selectedHari, dayVal].sort());
    }
  }

  // Aksi 2: Verifikasi Dosen (Setujui / Tolak)
  async function handleVerifyDosen(id, newStatus) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      setMsg({ e: 1, t: error.message });
    } else {
      setMsg({ t: `Status akun dosen berhasil diubah menjadi ${newStatus}.` });
      loadDosen();
      loadUsers();
    }
  }

  // Aksi 3: Admin Batalkan Pendaftaran Peserta
  async function handleBatalPeserta(id, nama, jenis) {
    if (!confirm(`Batalkan pendaftaran ${jenis} untuk ${nama}?`)) return;
    const { error } = await supabase.from('pendaftaran_jadwal').delete().eq('id', id);
    if (error) {
      setMsg({ e: 1, t: error.message });
    } else {
      setMsg({ t: `Pendaftaran ${jenis} untuk ${nama} berhasil dibatalkan.` });
      loadPeserta();
    }
  }

  // Aksi 4: Kelola Pengumuman
  async function handleSavePengumuman(e) {
    e.preventDefault();
    const f = formPengumuman;
    if (!f.judul || !f.isi) return;

    if (f.id) {
      // Update
      const { error } = await supabase
        .from('pengumuman')
        .update({ judul: f.judul, isi: f.isi, aktif: f.aktif })
        .eq('id', f.id);
      if (error) setMsg({ e: 1, t: error.message });
      else setMsg({ t: 'Pengumuman berhasil diperbarui.' });
    } else {
      // Create
      const { error } = await supabase
        .from('pengumuman')
        .insert({ judul: f.judul, isi: f.isi, aktif: f.aktif !== false });
      if (error) setMsg({ e: 1, t: error.message });
      else setMsg({ t: 'Pengumuman baru berhasil diterbitkan.' });
    }
    setFormPengumuman(null);
    loadPengumuman();
  }

  async function handleTogglePengumuman(p) {
    const { error } = await supabase
      .from('pengumuman')
      .update({ aktif: !p.aktif })
      .eq('id', p.id);
    if (error) setMsg({ e: 1, t: error.message });
    else loadPengumuman();
  }

  async function handleDeletePengumuman(id, judul) {
    if (!confirm(`Hapus pengumuman "${judul}"?`)) return;
    const { error } = await supabase.from('pengumuman').delete().eq('id', id);
    if (error) setMsg({ e: 1, t: error.message });
    else {
      setMsg({ t: 'Pengumuman berhasil dihapus.' });
      loadPengumuman();
    }
  }

  // Pengelolaan Antrean Verifikasi Berkas Pengajuan
  async function loadAntreanBerkas() {
    setLoadingBerkas(true);
    try {
      const { data: pData } = await supabase
        .from('pengajuan')
        .select('*')
        .eq('status', 'diajukan')
        .order('dibuat_pada', { ascending: false });

      if (pData && pData.length > 0) {
        const skripsiIds = pData.map((p) => p.skripsi_id);
        const { data: sData } = await supabase.from('skripsi').select('*').in('id', skripsiIds);
        const skripsiMap = Object.fromEntries((sData || []).map((s) => [s.id, s]));

        const mhsIds = (sData || []).map((s) => s.mahasiswa_id);
        const pembIds = (sData || []).map((s) => s.pembimbing1_id).filter(Boolean);
        const userIds = [...new Set([...mhsIds, ...pembIds])];

        const { data: profData } = await supabase.from('profiles').select('id, nama, noid, prodi').in('id', userIds);
        const profMap = Object.fromEntries((profData || []).map((p) => [p.id, p]));

        const pIds = pData.map((p) => p.id);
        const { data: bData } = await supabase.from('berkas').select('*').in('pengajuan_id', pIds);
        const berkasMap = {};
        (bData || []).forEach((b) => {
          if (!berkasMap[b.pengajuan_id]) berkasMap[b.pengajuan_id] = [];
          berkasMap[b.pengajuan_id].push(b);
        });

        const list = pData.map((p) => {
          const s = skripsiMap[p.skripsi_id] || { judul: 'Draf Proposal', abstrak: '' };
          const mhs = profMap[s.mahasiswa_id] || { nama: 'Mahasiswa', noid: '-', prodi: 'Akuakultur' };
          const pemb = profMap[s.pembimbing1_id] || { nama: 'Dosen Pembimbing' };
          const berkas = berkasMap[p.id] || [];
          return { pengajuan: p, skripsi: s, mahasiswa: mhs, pembimbing: pemb, berkas };
        });

        setAntreanBerkas(list);
      } else {
        loadDemoBerkas();
      }
    } catch {
      loadDemoBerkas();
    } finally {
      setLoadingBerkas(false);
    }
  }

  function loadDemoBerkas() {
    let dynamicDemo = null;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('siskrip_demo_skripsi_demo-user-id');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.pengajuanList?.[0] && parsed.pengajuanList[0].status === 'diajukan') {
            dynamicDemo = {
              pengajuan: parsed.pengajuanList[0],
              skripsi: parsed.skripsi,
              mahasiswa: { nama: 'Budi Santoso', noid: '22/499123/PN/18000', prodi: 'Akuakultur' },
              pembimbing: { nama: 'Dr. Ir. Budi Wibowo, M.Sc.' },
              berkas: parsed.berkasList || [{ id: 'b-demo', nama: 'Draft_Proposal_Budi_Santoso.pdf', ukuran: 2450000 }],
            };
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }

    const defaultItems = [
      dynamicDemo || {
        pengajuan: {
          id: 'p-demo-1',
          jenis: 'proposal',
          status: 'diajukan',
          catatan: 'Pengajuan draf proposal baru oleh mahasiswa',
          dibuat_pada: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
        skripsi: {
          id: 'sk-demo-1',
          judul: 'Kajian Efektivitas Probiotik Bacillus sp. pada Budidaya Udang Vaname (Litopenaeus vannamei)',
          abstrak: 'Penelitian ini bertujuan untuk menganalisis efektivitas pemberian probiotik terhadap sintasan dan pertumbuhan udang vaname di tambak intensif...',
          tahap_saat_ini: 'proposal',
        },
        mahasiswa: {
          nama: 'Budi Santoso',
          noid: '22/499123/PN/18000',
          prodi: 'Akuakultur',
        },
        pembimbing: {
          nama: 'Dr. Ir. Budi Wibowo, M.Sc.',
        },
        berkas: [{ id: 'b-1', nama: 'Draf_Proposal_Budi_Santoso.pdf', ukuran: 3200000 }],
      },
      {
        pengajuan: {
          id: 'p-demo-2',
          jenis: 'proposal',
          status: 'diajukan',
          catatan: 'Pengajuan proposal skripsi mahasiswa THP',
          dibuat_pada: new Date(Date.now() - 3600000 * 36).toISOString(),
        },
        skripsi: {
          id: 'sk-demo-2',
          judul: 'Formulasi Pakan Mandiri Berbasis Limbah Pengolahan Ikan Tuna untuk Efisiensi Budidaya Patin',
          abstrak: 'Optimalisasi pemanfaatan limbah perikanan sebagai substitusi tepung ikan guna menekan rasio konversi pakan (FCR)...',
          tahap_saat_ini: 'proposal',
        },
        mahasiswa: {
          nama: 'Siti Rahmawati',
          noid: '22/498765/PN/17988',
          prodi: 'Teknologi Hasil Perikanan',
        },
        pembimbing: {
          nama: 'Prof. Dr. Ir. Murwantoko, M.Si.',
        },
        berkas: [{ id: 'b-2', nama: 'Proposal_Siti_Rahmawati_THP.pdf', ukuran: 1800000 }],
      },
    ];

    setAntreanBerkas(defaultItems);
  }

  async function handleAksiBerkas(item, statusTarget, catatan) {
    setProcessingBerkas(true);
    try {
      if (item.pengajuan?.id) {
        await supabase
          .from('pengajuan')
          .update({
            status: statusTarget,
            catatan: catatan || (statusTarget === 'diverifikasi' ? 'Berkas proposal telah diverifikasi lengkap oleh admin departemen.' : 'Perlu revisi berkas'),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.pengajuan.id);

        await supabase.from('audit_log').insert({
          pengajuan_id: item.pengajuan.id,
          user_id: profile?.id,
          status_lama: item.pengajuan.status,
          status_baru: statusTarget,
          catatan: catatan || (statusTarget === 'diverifikasi' ? 'Berkas diverifikasi admin' : 'Berkas dikembalikan'),
        });
      }

      setAntreanBerkas((prev) => prev.filter((a) => a.pengajuan.id !== item.pengajuan.id));

      if (typeof window !== 'undefined') {
        const demoKey = 'siskrip_demo_skripsi_demo-user-id';
        const cur = localStorage.getItem(demoKey);
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed.pengajuanList?.[0]) {
            parsed.pengajuanList[0].status = statusTarget;
            parsed.pengajuanList[0].catatan = catatan || 'Berkas telah diverifikasi admin departemen.';
            parsed.auditLogs = [
              {
                id: 'audit-' + Date.now(),
                pengajuan_id: parsed.pengajuanList[0].id,
                status_lama: 'diajukan',
                status_baru: statusTarget,
                catatan: catatan || 'Berkas diverifikasi admin departemen',
                created_at: new Date().toISOString(),
              },
              ...(parsed.auditLogs || []),
            ];
            localStorage.setItem(demoKey, JSON.stringify(parsed));
          }
        }
      }

      setMsg({
        t: statusTarget === 'diverifikasi'
          ? `Berkas proposal mahasiswa ${item.mahasiswa.nama} berhasil diverifikasi dan diteruskan ke Dosen Pembimbing!`
          : `Berkas proposal dikembalikan ke mahasiswa ${item.mahasiswa.nama} dengan catatan revisi.`,
      });
      setModalBerkas(null);
    } catch (err) {
      setMsg({ e: 1, t: 'Gagal memproses berkas: ' + err.message });
    } finally {
      setProcessingBerkas(false);
    }
  }

  if (!profile || profile.role !== 'admin') {
    return <p style={{ padding: '2rem 0', color: 'var(--mut)' }}>Memverifikasi hak akses admin…</p>;
  }

  const pendingDosen = dosenList.filter((d) => d.status === 'pending');

  const filteredPeserta = pesertaList.filter((p) =>
    filterTanggal ? p.tanggal === filterTanggal : true
  );

  const filteredUsers = usersList.filter((u) => {
    const matchQuery =
      (u.nama || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.noid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.prodi || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchQuery && matchRole && matchStatus;
  });

  return (
    <div className="wrap" style={{ maxWidth: '1000px', padding: 0 }}>
      {/* Header Admin */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Panel Admin Departemen</h2>
        <p className="mut" style={{ marginTop: '0.2rem' }}>
          Kelola jadwal seminar/ujian, verifikasi dosen, pengumuman, dan data pengguna SiSkrip.
        </p>
      </div>

      {msg && (
        <div
          className={'msg ' + (msg.e ? 'err' : 'ok')}
          onClick={() => setMsg(null)}
          style={{ cursor: 'pointer' }}
        >
          {msg.t} (klik untuk tutup)
        </div>
      )}

      {/* Navigasi Tab Fitur Admin */}
      <div className="admin-tabs">
        <button
          className={'admin-tab-btn' + (tab === 'jadwal' ? ' active' : '')}
          onClick={() => setTab('jadwal')}
        >
          <span>⚙️</span>
          <span>Pengaturan Jadwal</span>
        </button>

        <button
          className={'admin-tab-btn' + (tab === 'berkas' ? ' active' : '')}
          onClick={() => setTab('berkas')}
        >
          <span>📑</span>
          <span>Verifikasi Berkas</span>
          {antreanBerkas.length > 0 && <span className="tab-badge">{antreanBerkas.length}</span>}
        </button>

        <button
          className={'admin-tab-btn' + (tab === 'verifikasi' ? ' active' : '')}
          onClick={() => setTab('verifikasi')}
        >
          <span>👨‍🏫</span>
          <span>Verifikasi Dosen</span>
          {pendingDosen.length > 0 && <span className="tab-badge">{pendingDosen.length}</span>}
        </button>

        <button
          className={'admin-tab-btn' + (tab === 'peserta' ? ' active' : '')}
          onClick={() => setTab('peserta')}
        >
          <span>📅</span>
          <span>Peserta Jadwal</span>
        </button>

        <button
          className={'admin-tab-btn' + (tab === 'pengumuman' ? ' active' : '')}
          onClick={() => setTab('pengumuman')}
        >
          <span>📢</span>
          <span>Kelola Pengumuman</span>
        </button>

        <button
          className={'admin-tab-btn' + (tab === 'pengguna' ? ' active' : '')}
          onClick={() => setTab('pengguna')}
        >
          <span>👥</span>
          <span>Kelola Pengguna</span>
        </button>
      </div>

      {/* TAB 1: PENGATURAN JADWAL */}
      {tab === 'jadwal' && (
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>Pengaturan Kuota & Hari Pelaksanaan</h3>
          <p className="mut" style={{ fontSize: '0.88rem', marginBottom: '1.2rem' }}>
            Atur kuota mahasiswa yang dapat mendaftar per hari dan tentukan hari seminar proposal / ujian pendadaran.
          </p>

          <form onSubmit={handleSaveSettings}>
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                Kuota Maksimal Per Hari (Mahasiswa):
              </label>
              <input
                type="number"
                min={1}
                max={30}
                style={{ maxWidth: '180px' }}
                value={kuota}
                onChange={(e) => setKuota(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Pilihan Hari Pelaksanaan:</label>
                <span className="mut" style={{ fontSize: '0.8rem' }}>Disarankan 2 hari/pekan</span>
              </div>

              <div className="days-grid">
                {HARI_OPTIONS.map((h) => {
                  const isSel = selectedHari.includes(h.val);
                  return (
                    <div
                      key={h.val}
                      className={'day-checkbox-label' + (isSel ? ' selected' : '')}
                      onClick={() => toggleHari(h.val)}
                    >
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => {}}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span>{h.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="btn" style={{ width: 'auto', padding: '0.65rem 1.6rem' }} disabled={savingJadwal}>
              {savingJadwal ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
          </form>
        </div>
      )}

      {/* TAB VERIFIKASI BERKAS PENGAJUAN */}
      {tab === 'berkas' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>
              Antrean Verifikasi Berkas Pengajuan ({antreanBerkas.length})
            </h3>
            <p className="mut" style={{ fontSize: '0.88rem' }}>
              Periksa kelengkapan naskah dan format proposal mahasiswa. Verifikasi berkas untuk meneruskan ke Dosen Pembimbing, atau kembalikan dengan catatan perbaikan.
            </p>
          </div>

          {loadingBerkas ? (
            <p className="mut">Memuat antrean berkas pengajuan…</p>
          ) : antreanBerkas.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <span style={{ fontSize: '2.5rem' }}>📑</span>
              <h4 style={{ marginTop: '0.6rem' }}>Tidak Ada Berkas Menunggu Verifikasi</h4>
              <p className="mut" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                Seluruh pengajuan draf proposal saat ini telah diverifikasi atau diproses dosen pembimbing.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {antreanBerkas.map((item) => (
                <div key={item.pengajuan.id} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{item.mahasiswa.nama}</span>
                        <span className="tag">{item.mahasiswa.noid}</span>
                        <span className="tag" style={{ background: 'rgba(11, 58, 99, 0.1)', color: 'var(--pri)', fontWeight: 600 }}>
                          {item.mahasiswa.prodi}
                        </span>
                      </div>
                      <p className="mut" style={{ fontSize: '0.82rem' }}>
                        Dosen Pembimbing: <b>{item.pembimbing.nama}</b> · Diajukan pada:{' '}
                        {item.pengajuan?.dibuat_pada ? new Date(item.pengajuan.dibuat_pada).toLocaleDateString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                      </p>
                    </div>
                    <span className="status-badge status-diajukan">
                      Menunggu Verifikasi Admin
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

                  {/* Berkas Proposal Terlampir */}
                  {item.berkas && item.berkas.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Berkas Proposal (PDF):</span>
                      {item.berkas.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '99px',
                            background: 'rgba(14, 124, 143, 0.1)',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#0e7c8f',
                          }}
                        >
                          <span>📄 {b.nama}</span>
                          <span className="mut" style={{ fontSize: '0.75rem' }}>
                            ({b.ukuran ? `${(b.ukuran / (1024 * 1024)).toFixed(1)} MB` : 'PDF 10MB'})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tombol Aksi Verifikasi Admin */}
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid var(--bd)', paddingTop: '1rem' }}>
                    <button
                      className="btn-action btn-reject"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                      onClick={() => {
                        setModalBerkas(item);
                        setCatatanAdmin('');
                      }}
                    >
                      ↩️ Kembalikan / Minta Revisi
                    </button>
                    <button
                      className="btn-action btn-approve"
                      style={{ padding: '0.6rem 1.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                      onClick={() => handleAksiBerkas(item, 'diverifikasi')}
                      disabled={processingBerkas}
                    >
                      {processingBerkas ? 'Memproses…' : '✅ Verifikasi Berkas & Teruskan ke Pembimbing'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VERIFIKASI DOSEN */}
      {tab === 'verifikasi' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>Daftar Dosen Menunggu Verifikasi</h3>
            <p className="mut" style={{ fontSize: '0.88rem' }}>
              Dosen berstatus <i>pending</i> tidak dapat mengakses fitur departemen sebelum disetujui admin.
            </p>
          </div>

          {loadingDosen ? (
            <p className="mut">Memuat daftar dosen…</p>
          ) : pendingDosen.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <span style={{ fontSize: '2.5rem' }}>✅</span>
              <h4 style={{ marginTop: '0.6rem' }}>Tidak Ada Pendaftaran Dosen yang Pending</h4>
              <p className="mut" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                Seluruh akun dosen yang terdaftar saat ini sudah berstatus aktif atau terverifikasi.
              </p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nama Dosen</th>
                    <th>NIDN / NIP</th>
                    <th>Status</th>
                    <th>Tanggal Daftar</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDosen.map((d) => (
                    <tr key={d.id}>
                      <td><b>{d.nama || 'Tanpa Nama'}</b></td>
                      <td>{d.noid || '-'}</td>
                      <td><span className="status-badge status-pending">Pending</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--mut)' }}>
                        {new Date(d.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn-action btn-approve"
                            onClick={() => handleVerifyDosen(d.id, 'aktif')}
                          >
                            Setujui
                          </button>
                          <button
                            className="btn-action btn-reject"
                            onClick={() => handleVerifyDosen(d.id, 'ditolak')}
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DAFTAR PESERTA JADWAL */}
      {tab === 'peserta' && (
        <div>
          <div className="card" style={{ marginBottom: '1.2rem' }}>
            <div className="row">
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>Peserta Seminar & Ujian Terdaftar</h3>
                <p className="mut" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Pantau peserta dan batalkan pendaftaran bila terdapat kendala administrasi.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Tanggal:</span>
                <input
                  type="date"
                  value={filterTanggal}
                  onChange={(e) => setFilterTanggal(e.target.value)}
                  style={{ marginBottom: 0, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                />
                {filterTanggal && (
                  <button className="btn-action btn-neutral" onClick={() => setFilterTanggal('')}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {loadingPeserta ? (
            <p className="mut">Memuat peserta…</p>
          ) : filteredPeserta.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <span style={{ fontSize: '2.5rem' }}>📅</span>
              <h4 style={{ marginTop: '0.6rem' }}>Tidak Ada Peserta Terdaftar</h4>
              <p className="mut" style={{ fontSize: '0.85rem' }}>
                {filterTanggal ? `Tidak ada jadwal pendaftaran untuk tanggal ${filterTanggal}.` : 'Belum ada mahasiswa yang mendaftar seminar maupun ujian.'}
              </p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Nama Mahasiswa</th>
                    <th>NIM</th>
                    <th>Program Studi</th>
                    <th>Kegiatan</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeserta.map((p) => (
                    <tr key={p.id}>
                      <td><b>{p.tanggal}</b></td>
                      <td>{p.user?.nama || '-'}</td>
                      <td>{p.user?.noid || '-'}</td>
                      <td>{p.user?.prodi || '-'}</td>
                      <td>
                        <span className={'tag' + (p.jenis === 'ujian' ? ' full' : '')} style={{ textTransform: 'capitalize' }}>
                          {p.jenis}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-action btn-reject"
                          onClick={() => handleBatalPeserta(p.id, p.user?.nama, p.jenis)}
                        >
                          Batalkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KELOLA PENGUMUMAN */}
      {tab === 'pengumuman' && (
        <div>
          <div className="card" style={{ marginBottom: '1.2rem' }}>
            <div className="row">
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>Manajemen Pengumuman Fakultas</h3>
                <p className="mut" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Pengumuman aktif akan otomatis tampil pada carousel Beranda seluruh pengguna.
                </p>
              </div>
              <button
                className="btn"
                style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                onClick={() => setFormPengumuman({ judul: '', isi: '', aktif: true })}
              >
                + Buat Pengumuman Baru
              </button>
            </div>
          </div>

          {/* Form Modal / Inline Pengumuman */}
          {formPengumuman && (
            <div className="card" style={{ border: '2px solid var(--pri)', marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.8rem' }}>
                {formPengumuman.id ? 'Edit Pengumuman' : 'Tulis Pengumuman Baru'}
              </h4>
              <form onSubmit={handleSavePengumuman}>
                <input
                  placeholder="Judul Pengumuman"
                  value={formPengumuman.judul}
                  onChange={(e) => setFormPengumuman({ ...formPengumuman, judul: e.target.value })}
                  required
                />
                <textarea
                  placeholder="Isi Pengumuman lengkap…"
                  rows={4}
                  value={formPengumuman.isi}
                  onChange={(e) => setFormPengumuman({ ...formPengumuman, isi: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '12px',
                    border: '1px solid var(--bd)',
                    background: 'var(--bg)',
                    font: 'inherit',
                    color: 'inherit',
                    marginBottom: '0.8rem',
                  }}
                  required
                />
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <input
                    type="checkbox"
                    id="chk-aktif"
                    checked={formPengumuman.aktif !== false}
                    onChange={(e) => setFormPengumuman({ ...formPengumuman, aktif: e.target.checked })}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="chk-aktif" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                    Tayangkan Pengumuman (Aktif)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button className="btn" style={{ width: 'auto' }}>
                    {formPengumuman.id ? 'Simpan Perubahan' : 'Terbitkan'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost2"
                    style={{ width: 'auto' }}
                    onClick={() => setFormPengumuman(null)}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          {loadingPengumuman ? (
            <p className="mut">Memuat pengumuman…</p>
          ) : pengumumanList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p className="mut">Belum ada data pengumuman di database.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Judul</th>
                    <th>Tanggal</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pengumumanList.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.judul}</b>
                        <p className="mut" style={{ fontSize: '0.8rem', marginTop: '0.2rem', maxWidth: '450px' }}>
                          {p.isi}
                        </p>
                      </td>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{p.tanggal}</td>
                      <td>
                        <button
                          className={'btn-action ' + (p.aktif ? 'btn-approve' : 'btn-neutral')}
                          onClick={() => handleTogglePengumuman(p)}
                          title="Klik untuk ubah status"
                        >
                          {p.aktif ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn-action btn-neutral"
                            onClick={() => setFormPengumuman({ id: p.id, judul: p.judul, isi: p.isi, aktif: p.aktif })}
                          >
                            Ubah
                          </button>
                          <button
                            className="btn-action btn-reject"
                            onClick={() => handleDeletePengumuman(p.id, p.judul)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: KELOLA PENGGUNA */}
      {tab === 'pengguna' && (
        <div>
          <div className="card" style={{ marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>Daftar Pengguna Sistem SiSkrip</h3>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input
                placeholder="Cari nama, NIM, NIDN, atau prodi…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ width: 'auto', marginBottom: 0 }}
              >
                <option value="all">Semua Peran</option>
                <option value="mahasiswa">Mahasiswa</option>
                <option value="dosen">Dosen</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: 'auto', marginBottom: 0 }}
              >
                <option value="all">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="pending">Pending</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>
          </div>

          {loadingUsers ? (
            <p className="mut">Memuat pengguna…</p>
          ) : filteredUsers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p className="mut">Tidak ditemukan pengguna yang sesuai dengan pencarian.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NIM / NIDN</th>
                    <th>Peran</th>
                    <th>Program Studi</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.nama || 'Tanpa Nama'}</b></td>
                      <td>{u.noid || '-'}</td>
                      <td>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>{u.role}</span>
                      </td>
                      <td>{u.prodi || '-'}</td>
                      <td>
                        <span className={'status-badge status-' + (u.status || 'aktif')}>
                          {u.status || 'aktif'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-action btn-neutral"
                          onClick={() => setSelectedUser(u)}
                        >
                          Lihat Profil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal Detail Profil Pengguna */}
          {selectedUser && (
            <div className="cmd-overlay" onClick={() => setSelectedUser(null)}>
              <div className="cmd-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--bd)' }}>
                  <h3>Detail Profil Pengguna</h3>
                </div>
                <div style={{ padding: '1.2rem 1.5rem' }}>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <span className="mut" style={{ fontSize: '0.8rem' }}>Nama Lengkap</span>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selectedUser.nama || '-'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                    <div>
                      <span className="mut" style={{ fontSize: '0.8rem' }}>NIM / NIDN</span>
                      <div style={{ fontWeight: 600 }}>{selectedUser.noid || '-'}</div>
                    </div>
                    <div>
                      <span className="mut" style={{ fontSize: '0.8rem' }}>Peran</span>
                      <div>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>{selectedUser.role}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <span className="mut" style={{ fontSize: '0.8rem' }}>Program Studi</span>
                    <div>{selectedUser.prodi || '-'}</div>
                  </div>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <span className="mut" style={{ fontSize: '0.8rem' }}>Status Akun</span>
                    <div>
                      <span className={'status-badge status-' + (selectedUser.status || 'aktif')}>
                        {selectedUser.status || 'aktif'}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '0.4rem' }}>
                    <span className="mut" style={{ fontSize: '0.8rem' }}>Terdaftar Sejak</span>
                    <div style={{ fontSize: '0.85rem' }}>{new Date(selectedUser.created_at).toLocaleString('id-ID')}</div>
                  </div>
                </div>
                <div style={{ padding: '0.8rem 1.5rem', borderTop: '1px solid var(--bd)', textAlign: 'right' }}>
                  <button className="btn ghost2" onClick={() => setSelectedUser(null)}>
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog Kembalikan Berkas */}
      {modalBerkas && (
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
              ↩️ Kembalikan Berkas Pengajuan
            </h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Mahasiswa: <b>{modalBerkas.mahasiswa.nama}</b> ({modalBerkas.mahasiswa.noid})
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Catatan Kekurangan / Arahan Revisi Admin <span style={{ color: 'var(--bad)' }}>*(Wajib diisi)</span>
              </label>
              <textarea
                rows={4}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                placeholder="Contoh: Format lembar pengesahan belum ditandatangani, atau lampiran transkrip nilai belum lengkap..."
                value={catatanAdmin}
                onChange={(e) => setCatatanAdmin(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-action btn-neutral"
                onClick={() => setModalBerkas(null)}
                disabled={processingBerkas}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-action btn-reject"
                style={{ padding: '0.6rem 1.4rem' }}
                onClick={() => {
                  if (!catatanAdmin.trim()) {
                    setMsg({ e: 1, t: 'Wajib mengisi catatan kekurangan berkas sebelum mengembalikan.' });
                    return;
                  }
                  handleAksiBerkas(modalBerkas, 'revisi', catatanAdmin.trim());
                }}
                disabled={processingBerkas}
              >
                {processingBerkas ? 'Memproses…' : 'Kembalikan ke Mahasiswa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
