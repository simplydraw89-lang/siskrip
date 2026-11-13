'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '../layout';

export default function ForumPage() {
  const { profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('fakultas'); // 'fakultas' | 'alumni'
  const [selectedKategori, setSelectedKategori] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [msg, setMsg] = useState(null);

  // Data Forum
  const [categories, setCategories] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null); // Detail thread aktif
  const [posts, setPosts] = useState([]); // Balasan pada thread aktif
  const [likesMap, setLikesMap] = useState({}); // thread_id -> boolean

  // Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formJudul, setFormJudul] = useState('');
  const [formIsi, setFormIsi] = useState('');
  const [formKategori, setFormKategori] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [submittingThread, setSubmittingThread] = useState(false);

  // Form Balas State
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Modal Laporkan State
  const [reportTarget, setReportTarget] = useState(null); // { thread, post }
  const [alasanLaporan, setAlasanLaporan] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isAlumni = profile?.status === 'alumni' || isAdmin;

  useEffect(() => {
    loadForumData();
  }, [profile, activeTab]);

  async function loadForumData() {
    setLoading(true);
    try {
      // 1. Ambil kategori
      const { data: catData } = await supabase
        .from('forum_kategori')
        .select('*')
        .eq('tipe', activeTab)
        .order('urutan', { ascending: true });

      let cats = catData || [];
      if (cats.length === 0) {
        cats = activeTab === 'fakultas' ? [
          { id: 'cat-1', slug: 'akademik', nama: 'Akademik & Perkuliahan', tipe: 'fakultas' },
          { id: 'cat-2', slug: 'beasiswa', nama: 'Informasi Beasiswa', tipe: 'fakultas' },
          { id: 'cat-3', slug: 'lomba', nama: 'Kompetisi & Lomba Ilmiah', tipe: 'fakultas' },
          { id: 'cat-4', slug: 'tanya_skripsi', nama: 'Tanya-Jawab Skripsi & Riset', tipe: 'fakultas' },
        ] : [
          { id: 'cat-5', slug: 'loker', nama: 'Lowongan Kerja & Magang', tipe: 'alumni' },
          { id: 'cat-6', slug: 'cerita_karier', nama: 'Cerita Karier & Pengalaman', tipe: 'alumni' },
          { id: 'cat-7', slug: 'jejaring', nama: 'Jejaring Alumni & Silaturahmi', tipe: 'alumni' },
        ];
      }
      setCategories(cats);
      if (cats.length > 0 && !formKategori) {
        setFormKategori(cats[0].id);
      }

      // 2. Ambil thread
      const { data: tData } = await supabase
        .from('forum_thread')
        .select('*, profiles:penulis_id(nama, role, status, noid), forum_kategori:kategori_id(nama, slug, tipe)')
        .order('disematkan', { ascending: false })
        .order('created_at', { ascending: false });

      if (tData && tData.length > 0) {
        // Filter sesuai tab aktif
        const filtered = tData.filter((t) => t.forum_kategori?.tipe === activeTab);
        setThreads(filtered);
      } else {
        loadDemoThreads();
      }
    } catch {
      loadDemoThreads();
    } finally {
      setLoading(false);
    }
  }

  function loadDemoThreads() {
    if (activeTab === 'fakultas') {
      setThreads([
        {
          id: 't-1',
          judul: '📌 Tata Cara Pengajuan Kuota Seminar Proposal & Ujian Skripsi Semester Gasal',
          isi: 'Diberitahukan kepada seluruh mahasiswa Departemen Perikanan yang telah siap mengajukan Seminar Proposal dan Ujian Skripsi, harap memperhatikan kuota per hari (Selasa dan Kamis maks. 5 peserta). Pendaftaran berkas dibuka setiap pekan melalui sistem SiSkrip.',
          disematkan: true,
          dikunci: true,
          kategori: { slug: 'akademik', nama: 'Akademik & Perkuliahan' },
          penulis: { nama: 'Super Admin', role: 'admin', status: 'aktif' },
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
          likesCount: 18,
          repliesCount: 4,
        },
        {
          id: 't-2',
          judul: 'Sharing Info Beasiswa Riset Skripsi Kementerian Kelautan dan Perikanan (KKP) 2026',
          isi: 'Halo rekan-rekan perikanan! KKP kembali membuka beasiswa bantuan dana riset skripsi untuk mahasiswa tingkat akhir program sarjana dengan topik budidaya cerdas, konservasi pesisir, dan pascapanen. Syarat utama proposal disetujui pembimbing.',
          disematkan: false,
          dikunci: false,
          kategori: { slug: 'beasiswa', nama: 'Informasi Beasiswa' },
          penulis: { nama: 'Budi Santoso', role: 'mahasiswa', status: 'aktif' },
          created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
          likesCount: 12,
          repliesCount: 6,
        },
        {
          id: 't-3',
          judul: 'Tanya Analisis Proksimat & Uji Organoleptik di Lab Teknologi Hasil Perikanan',
          isi: 'Izin bertanya kepada dosen atau rekan mahasiswa THP, untuk pengujian kadar protein dan lemak pakan formulasi apakah alat Kjeldahl dan Soxhlet di lab sedang dapat digunakan pekan depan?',
          disematkan: false,
          dikunci: false,
          kategori: { slug: 'tanya_skripsi', nama: 'Tanya-Jawab Skripsi & Riset' },
          penulis: { nama: 'Siti Rahmawati', role: 'mahasiswa', status: 'aktif' },
          created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
          likesCount: 5,
          repliesCount: 2,
        },
      ]);
    } else {
      setThreads([
        {
          id: 't-4',
          judul: '📌 [Lowongan Kerja] Aquaculture Specialist - PT Charoen Pokphand Indonesia (Divisi Akuakultur)',
          isi: 'Dibutuhkan segera lulusan S1 Akuakultur / Budidaya Perairan Fakultas Pertanian UGM untuk posisi Aquaculture Specialist. Penempatan di tambak intensif Lampung dan Banyuwangi. Kirimkan CV dan SKL/Ijazah ke recruitment-aquaculture@cp.co.id.',
          disematkan: true,
          dikunci: false,
          kategori: { slug: 'loker', nama: 'Lowongan Kerja & Magang' },
          penulis: { nama: 'Ir. Hendra Wijaya, S.Pi.', role: 'mahasiswa', status: 'alumni' },
          created_at: new Date(Date.now() - 3600000 * 30).toISOString(),
          likesCount: 24,
          repliesCount: 8,
        },
        {
          id: 't-5',
          judul: 'Cerita Karier: Dari Mahasiswa Perikanan UGM hingga Membangun Startup Budidaya Ikan Nila Bioflok',
          isi: 'Sharing santai untuk adik-adik mahasiswa tingkat akhir. Setelah lulus 3 tahun lalu, berbekal ilmu dari mata kuliah rekayasa akuakultur, saya merintis budidaya kolam bundar bioflok. Kuncinya adalah manajemen kualitas air dan FCR pakan mandiri.',
          disematkan: false,
          dikunci: false,
          kategori: { slug: 'cerita_karier', nama: 'Cerita Karier & Pengalaman' },
          penulis: { nama: 'Rian Pratama, S.Pi.', role: 'mahasiswa', status: 'alumni' },
          created_at: new Date(Date.now() - 3600000 * 15).toISOString(),
          likesCount: 31,
          repliesCount: 11,
        },
      ]);
    }
  }

  // Buka detail thread & balasan
  async function handleOpenThread(t) {
    setSelectedThread(t);
    setReplyText('');

    try {
      if (t.id && !t.id.startsWith('t-')) {
        const { data } = await supabase
          .from('forum_post')
          .select('*, profiles:penulis_id(nama, role, status)')
          .eq('thread_id', t.id)
          .order('created_at', { ascending: true });
        setPosts(data || []);
      } else {
        // Balasan demo
        setPosts([
          {
            id: 'p-demo-1',
            penulis: { nama: 'Dr. Ir. Budi Wibowo, M.Sc.', role: 'dosen', status: 'aktif' },
            isi: 'Informasi yang sangat bermanfaat. Mahasiswa yang ingin konsultasi riset terkait dapat menemui saya di ruang departemen.',
            created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          },
          {
            id: 'p-demo-2',
            penulis: { nama: 'Ahmad Fauzi', role: 'mahasiswa', status: 'aktif' },
            isi: 'Terima kasih informasinya Pak, sangat membantu persiapan draf penelitian skripsi saya.',
            created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
          },
        ]);
      }
    } catch {
      setPosts([]);
    }
  }

  // Toggle Suka / Like
  function handleToggleLike(threadId, e) {
    if (e) e.stopPropagation();
    const isLiked = !!likesMap[threadId];
    setLikesMap((prev) => ({ ...prev, [threadId]: !isLiked }));

    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, likesCount: (t.likesCount || 0) + (isLiked ? -1 : 1) } : t))
    );
  }

  // Kirim Thread Baru
  async function handleCreateThread(e) {
    e.preventDefault();
    if (!formJudul.trim() || !formIsi.trim()) {
      return setMsg({ err: true, text: 'Judul dan isi thread wajib diisi.' });
    }

    // Aturan akses Forum Alumni: hanya alumni atau admin yang boleh menulis
    if (activeTab === 'alumni' && !isAlumni) {
      return setMsg({
        err: true,
        text: 'Akses Ditolak: Forum Alumni dikhususkan untuk ditulis oleh Alumni terverifikasi. Mahasiswa aktif hanya diperkenankan membaca.',
      });
    }

    setSubmittingThread(true);
    try {
      const { data: newT, error } = await supabase
        .from('forum_thread')
        .insert({
          judul: formJudul.trim(),
          isi: formIsi.trim(),
          kategori_id: formKategori || categories[0]?.id,
          penulis_id: profile?.id,
          disematkan: isAdmin ? formPinned : false,
        })
        .select('*, profiles:penulis_id(nama, role, status), forum_kategori:kategori_id(nama, slug, tipe)')
        .single();

      const created = newT || {
        id: 't-new-' + Date.now(),
        judul: formJudul.trim(),
        isi: formIsi.trim(),
        disematkan: isAdmin && formPinned,
        dikunci: false,
        kategori: categories.find((c) => c.id === formKategori) || { nama: 'Umum' },
        penulis: { nama: profile?.nama || 'Pengguna', role: profile?.role || 'mahasiswa', status: profile?.status || 'aktif' },
        created_at: new Date().toISOString(),
        likesCount: 1,
        repliesCount: 0,
      };

      setThreads((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setFormJudul('');
      setFormIsi('');
      setFormPinned(false);
      setMsg({ err: false, text: 'Thread diskusi baru berhasil diterbitkan!' });
    } catch (err) {
      setMsg({ err: true, text: 'Gagal membuat thread: ' + err.message });
    } finally {
      setSubmittingThread(false);
    }
  }

  // Kirim Balasan Komentar
  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;

    if (activeTab === 'alumni' && !isAlumni) {
      return setMsg({ err: true, text: 'Hanya alumni atau admin yang dapat membalas di Forum Alumni.' });
    }

    setSubmittingReply(true);
    try {
      const { data: newPost } = await supabase
        .from('forum_post')
        .insert({
          thread_id: selectedThread.id,
          penulis_id: profile?.id,
          isi: replyText.trim(),
        })
        .select('*, profiles:penulis_id(nama, role, status)')
        .single();

      const createdPost = newPost || {
        id: 'p-new-' + Date.now(),
        isi: replyText.trim(),
        penulis: { nama: profile?.nama || 'Pengguna', role: profile?.role || 'mahasiswa', status: profile?.status || 'aktif' },
        created_at: new Date().toISOString(),
      };

      setPosts((prev) => [...prev, createdPost]);
      setThreads((prev) =>
        prev.map((t) => (t.id === selectedThread.id ? { ...t, repliesCount: (t.repliesCount || 0) + 1 } : t))
      );
      setReplyText('');
      setMsg({ err: false, text: 'Balasan komentar berhasil dikirimkan.' });
    } catch (err) {
      setMsg({ err: true, text: 'Gagal mengirim balasan: ' + err.message });
    } finally {
      setSubmittingReply(false);
    }
  }

  // Aksi Moderator Admin (Pin, Kunci, Hapus)
  async function handleModerationAction(action, thread) {
    try {
      if (action === 'pin') {
        const newPin = !thread.disematkan;
        await supabase.from('forum_thread').update({ disematkan: newPin }).eq('id', thread.id);
        setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, disematkan: newPin } : t)));
        if (selectedThread?.id === thread.id) setSelectedThread((prev) => ({ ...prev, disematkan: newPin }));
        setMsg({ err: false, text: newPin ? 'Thread berhasil disematkan di atas.' : 'Sematan thread dilepas.' });
      } else if (action === 'lock') {
        const newLock = !thread.dikunci;
        await supabase.from('forum_thread').update({ dikunci: newLock }).eq('id', thread.id);
        setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, dikunci: newLock } : t)));
        if (selectedThread?.id === thread.id) setSelectedThread((prev) => ({ ...prev, dikunci: newLock }));
        setMsg({ err: false, text: newLock ? 'Thread berhasil dikunci dari balasan baru.' : 'Thread kembali dibuka.' });
      } else if (action === 'delete') {
        if (!confirm(`Hapus thread "${thread.judul}"? Tindakan ini permanen.`)) return;
        await supabase.from('forum_thread').delete().eq('id', thread.id);
        setThreads((prev) => prev.filter((t) => t.id !== thread.id));
        if (selectedThread?.id === thread.id) setSelectedThread(null);
        setMsg({ err: false, text: 'Thread berhasil dihapus.' });
      }
    } catch (err) {
      setMsg({ err: true, text: 'Gagal menjalankan aksi moderator: ' + err.message });
    }
  }

  // Kirim Laporan Pelanggaran
  async function handleSubmitReport(e) {
    e.preventDefault();
    if (!alasanLaporan.trim()) return setMsg({ err: true, text: 'Wajib mengisi alasan pelaporan.' });

    setSubmittingReport(true);
    try {
      await supabase.from('forum_laporan').insert({
        thread_id: reportTarget?.id,
        pelapor_id: profile?.id,
        alasan: alasanLaporan.trim(),
        status: 'pending',
      });
      setMsg({ err: false, text: 'Laporan Anda telah diteruskan ke moderator admin departemen untuk ditinjau.' });
      setReportTarget(null);
      setAlasanLaporan('');
    } catch (err) {
      setMsg({ err: true, text: 'Gagal mengirim laporan: ' + err.message });
    } finally {
      setSubmittingReport(false);
    }
  }

  // Filter Thread
  const filteredThreads = threads.filter((t) => {
    const matchCategory = selectedKategori === 'all' || (t.forum_kategori?.slug === selectedKategori || t.kategori?.slug === selectedKategori);
    const matchSearch = (t.judul || '').toLowerCase().includes(searchQuery.toLowerCase()) || (t.isi || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="wrap" style={{ maxWidth: '1000px', padding: 0 }}>
      {/* Header Forum */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Forum Departemen & Alumni</h2>
          <p className="mut">Ruang diskusi akademik, beasiswa, info lomba, skripsi, serta jejaring lowongan kerja alumni Perikanan UGM.</p>
        </div>
        <button
          className="btn"
          style={{ width: 'auto', padding: '0.65rem 1.4rem', fontWeight: 700 }}
          onClick={() => setShowCreateModal(true)}
        >
          ✍️ Buat Thread Baru
        </button>
      </div>

      {/* Tab Switch: Forum Fakultas vs Forum Alumni */}
      <div className="forum-tabs">
        <button
          className={`forum-tab-btn ${activeTab === 'fakultas' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('fakultas');
            setSelectedKategori('all');
            setSelectedThread(null);
          }}
        >
          <span>🏛️</span>
          <span>Forum Fakultas (Mahasiswa & Dosen)</span>
        </button>
        <button
          className={`forum-tab-btn ${activeTab === 'alumni' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('alumni');
            setSelectedKategori('all');
            setSelectedThread(null);
          }}
        >
          <span>🎓</span>
          <span>Forum Alumni & Karier</span>
          {isAlumni && <span className="tag" style={{ background: '#16a34a', color: '#fff', fontSize: '0.7rem' }}>Akses Penuh</span>}
        </button>
      </div>

      {/* Notice Akses Khusus Forum Alumni */}
      {activeTab === 'alumni' && !isAlumni && (
        <div style={{ padding: '0.85rem 1.2rem', background: 'rgba(240, 180, 41, 0.12)', border: '1px solid var(--acc)', borderRadius: '14px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>👀</span>
          <p style={{ fontSize: '0.86rem', color: 'var(--tx)', margin: 0 }}>
            <b>Mode Baca (Mahasiswa Aktif):</b> Anda dapat membaca informasi lowongan kerja, tips karier, dan jejaring alumni. Penulisan thread dikhususkan untuk alumni resmi UGM.
          </p>
        </div>
      )}

      {/* Detail Thread Terpilih (View Thread Diskusi & Balasan) */}
      {selectedThread ? (
        <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--bd)', paddingBottom: '0.75rem' }}>
            <button
              className="lnk"
              style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}
              onClick={() => setSelectedThread(null)}
            >
              ← Kembali ke Daftar Thread
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="tag" style={{ background: 'var(--pri)', color: '#fff', fontWeight: 600 }}>
                {selectedThread.kategori?.nama || selectedThread.forum_kategori?.nama || 'Umum'}
              </span>
              {selectedThread.disematkan && <span className="tag" style={{ background: 'var(--acc)', color: '#000', fontWeight: 700 }}>📌 Pinned</span>}
              {selectedThread.dikunci && <span className="tag" style={{ background: 'var(--bad)', color: '#fff', fontWeight: 700 }}>🔒 Dikunci</span>}
            </div>
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.4 }}>
            {selectedThread.judul}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div className="user-avatar" style={{ width: 34, height: 34, fontSize: '0.82rem' }}>
              {(selectedThread.penulis?.nama || selectedThread.profiles?.nama || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <b style={{ fontSize: '0.88rem' }}>{selectedThread.penulis?.nama || selectedThread.profiles?.nama}</b>
                <span className={`status-badge status-${selectedThread.penulis?.role === 'admin' ? 'aktif' : selectedThread.penulis?.status === 'alumni' ? 'disetujui' : 'draft'}`} style={{ fontSize: '0.68rem' }}>
                  {selectedThread.penulis?.role === 'admin' ? 'ADMIN' : selectedThread.penulis?.status === 'alumni' ? 'ALUMNI' : selectedThread.penulis?.role?.toUpperCase()}
                </span>
              </div>
              <span className="mut" style={{ fontSize: '0.75rem' }}>
                {selectedThread.created_at ? new Date(selectedThread.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : ''}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--tx)', whiteSpace: 'pre-wrap', marginBottom: '1.5rem' }}>
            {selectedThread.isi}
          </p>

          {/* Action Bar Thread: Like, Laporkan, Moderator Admin */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', borderTop: '1px solid var(--bd)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                className={`forum-meta-btn ${likesMap[selectedThread.id] ? 'liked' : ''}`}
                onClick={() => handleToggleLike(selectedThread.id)}
              >
                <span>❤️</span>
                <span>{selectedThread.likesCount || 0} Suka</span>
              </button>
              <button
                className="forum-meta-btn"
                onClick={() => setReportTarget(selectedThread)}
              >
                <span>🚩</span>
                <span>Laporkan</span>
              </button>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-action btn-neutral"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => handleModerationAction('pin', selectedThread)}
                >
                  {selectedThread.disematkan ? '📌 Lepas Sematan' : '📌 Sematkan'}
                </button>
                <button
                  className="btn-action btn-neutral"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => handleModerationAction('lock', selectedThread)}
                >
                  {selectedThread.dikunci ? '🔓 Buka Kunci' : '🔒 Kunci Thread'}
                </button>
                <button
                  className="btn-action btn-reject"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => handleModerationAction('delete', selectedThread)}
                >
                  🗑️ Hapus
                </button>
              </div>
            )}
          </div>

          {/* Bagian Balasan Komentar (forum_post) */}
          <div style={{ borderTop: '2px dashed var(--bd)', paddingTop: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
              💬 Balasan Komentar ({posts.length})
            </h4>

            {posts.length === 0 ? (
              <p className="mut" style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                Belum ada balasan pada diskusi ini. Jadilah yang pertama memberikan tanggapan!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                {posts.map((p) => (
                  <div key={p.id} className="forum-post-bubble">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <b style={{ fontSize: '0.85rem' }}>{p.penulis?.nama || p.profiles?.nama || 'Pengguna'}</b>
                        <span className="tag" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                          {p.penulis?.status === 'alumni' ? 'Alumni' : p.penulis?.role || 'Member'}
                        </span>
                      </div>
                      <span className="mut" style={{ fontSize: '0.72rem' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--tx)', margin: 0, lineHeight: 1.45 }}>
                      {p.isi}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Form Kirim Balasan */}
            {!selectedThread.dikunci ? (
              <form onSubmit={handleSendReply}>
                <textarea
                  rows={3}
                  placeholder={
                    activeTab === 'alumni' && !isAlumni
                      ? 'Hanya alumni atau admin yang dapat mengirim balasan di Forum Alumni.'
                      : 'Tuliskan tanggapan, jawaban, atau pertanyaan Anda…'
                  }
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={activeTab === 'alumni' && !isAlumni || submittingReply}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', marginBottom: '0.75rem' }}
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn"
                    style={{ width: 'auto', padding: '0.6rem 1.4rem' }}
                    disabled={activeTab === 'alumni' && !isAlumni || submittingReply}
                  >
                    {submittingReply ? 'Mengirim…' : 'Kirim Tanggapan'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ padding: '0.85rem', background: 'rgba(220, 38, 38, 0.08)', borderRadius: '10px', border: '1px solid var(--bad)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--bad)' }}>
                  🔒 Thread ini telah dikunci oleh moderator. Balasan baru dinonaktifkan.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Daftar Thread Forum */
        <div>
          {/* Kategori Chips Filter & Pencarian */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
            <div className="category-chips" style={{ margin: 0 }}>
              <button
                className={`category-chip ${selectedKategori === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedKategori('all')}
              >
                Semua Kategori
              </button>
              {categories.map((c) => (
                <button
                  key={c.id || c.slug}
                  className={`category-chip ${selectedKategori === c.slug ? 'active' : ''}`}
                  onClick={() => setSelectedKategori(c.slug)}
                >
                  {c.nama}
                </button>
              ))}
            </div>

            <div style={{ minWidth: '220px', flex: 1, maxWidth: '320px' }}>
              <input
                type="text"
                placeholder="Cari topik diskusi…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', marginBottom: 0 }}
              />
            </div>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p className="mut">Memuat topik diskusi forum…</p>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>💬</span>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>Belum Ada Diskusi</h4>
              <p className="mut" style={{ maxWidth: '420px', margin: '0 auto', fontSize: '0.88rem' }}>
                Belum ada thread diskusi pada kategori ini. Klik "Buat Thread Baru" untuk memulai percakapan.
              </p>
            </div>
          ) : (
            <div>
              {filteredThreads.map((t) => (
                <div
                  key={t.id}
                  className={`forum-thread-card ${t.disematkan ? 'pinned' : ''}`}
                  onClick={() => handleOpenThread(t)}
                >
                  {/* Header Thread */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="tag" style={{ background: 'var(--pri)', color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>
                        {t.kategori?.nama || t.forum_kategori?.nama || 'Umum'}
                      </span>
                      {t.disematkan && (
                        <span className="tag" style={{ background: 'var(--acc)', color: '#000', fontWeight: 700, fontSize: '0.72rem' }}>
                          📌 Disematkan Admin
                        </span>
                      )}
                      {t.dikunci && (
                        <span className="tag" style={{ background: 'var(--bad)', color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}>
                          🔒 Dikunci
                        </span>
                      )}
                    </div>
                    <span className="mut" style={{ fontSize: '0.75rem' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : ''}
                    </span>
                  </div>

                  {/* Judul & Cuplikan Isi */}
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.45rem', lineHeight: 1.4, color: 'var(--tx)' }}>
                    {t.judul}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--mut)', lineHeight: 1.5, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.isi}
                  </p>

                  {/* Footer Penulis & Metrik Interaksi */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div className="user-avatar" style={{ width: 26, height: 26, fontSize: '0.7rem' }}>
                        {(t.penulis?.nama || t.profiles?.nama || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {t.penulis?.nama || t.profiles?.nama}
                      </span>
                      <span className="mut" style={{ fontSize: '0.75rem' }}>
                        ({t.penulis?.status === 'alumni' ? 'Alumni' : t.penulis?.role || 'Member'})
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        className={`forum-meta-btn ${likesMap[t.id] ? 'liked' : ''}`}
                        onClick={(e) => handleToggleLike(t.id, e)}
                      >
                        <span>❤️</span>
                        <span>{t.likesCount || 0}</span>
                      </button>
                      <span className="forum-meta-btn" style={{ cursor: 'default' }}>
                        <span>💬</span>
                        <span>{t.repliesCount || 0} Balasan</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog Buat Thread Baru */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '580px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              ✍️ Buat Thread Diskusi Baru
            </h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Saluran: <b>{activeTab === 'fakultas' ? '🏛️ Forum Fakultas' : '🎓 Forum Alumni'}</b>
            </p>

            <form onSubmit={handleCreateThread}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Kategori Thread <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <select
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id || c.slug} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Judul Topik Diskusi <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Info Pembagian Dosen Penguji Seminar Proposal..."
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Isi Pembahasan <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="Tuliskan latar belakang pertanyaan, informasi lengkap, atau rincian lowongan kerja..."
                  value={formIsi}
                  onChange={(e) => setFormIsi(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                  required
                />
              </div>

              {/* Opsi Pin Khusus Admin */}
              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', padding: '0.65rem 0.85rem', background: 'rgba(240, 180, 41, 0.1)', borderRadius: '10px' }}>
                  <input
                    type="checkbox"
                    id="chk-pin"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="chk-pin" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    📌 Sematkan Thread ini di Paling Atas (Pin Pengumuman)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-action btn-neutral"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submittingThread}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-action btn-approve"
                  style={{ padding: '0.65rem 1.6rem', fontWeight: 700 }}
                  disabled={submittingThread}
                >
                  {submittingThread ? 'Menerbitkan…' : 'Terbitkan Thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog Laporkan Pelanggaran */}
      {reportTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              🚩 Laporkan Konten Diskusi
            </h3>
            <p className="mut" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Judul: <b>{reportTarget.judul}</b>
            </p>

            <form onSubmit={handleSubmitReport}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Alasan Pelaporan <span style={{ color: 'var(--bad)' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Jelaskan indikasi spam, ujaran tidak pantas, atau informasi palsu..."
                  value={alasanLaporan}
                  onChange={(e) => setAlasanLaporan(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-action btn-neutral"
                  onClick={() => setReportTarget(null)}
                  disabled={submittingReport}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-action btn-reject"
                  style={{ padding: '0.65rem 1.4rem' }}
                  disabled={submittingReport}
                >
                  {submittingReport ? 'Mengirim…' : 'Kirim Laporan'}
                </button>
              </div>
            </form>
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
