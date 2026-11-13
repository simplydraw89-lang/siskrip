'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ThemeBtn from '@/components/ThemeBtn';

export default function TopNavbar({ user, onOpenSearch }) {
  const router = useRouter();
  const [showNotif, setShowNotif] = useState(false);
  const [notifList, setNotifList] = useState([]);
  const notifRef = useRef(null);

  useEffect(() => {
    loadNotifications();

    // Close popover when clicked outside
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [user]);

  async function loadNotifications() {
    try {
      if (user?.id) {
        const { data } = await supabase
          .from('notifikasi')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (data && data.length > 0) {
          setNotifList(data);
          return;
        }
      }

      // Default demo notifications based on role
      loadDemoNotifications();
    } catch {
      loadDemoNotifications();
    }
  }

  function loadDemoNotifications() {
    if (user?.role === 'dosen') {
      setNotifList([
        {
          id: 'n-d-1',
          judul: 'Telaah Proposal Mahasiswa',
          pesan: 'Budi Santoso mengajukan proposal "Kajian Efektivitas Probiotik Bacillus sp...". Mohon lakukan penelaahan.',
          link: '/bimbingan',
          dibaca: false,
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'n-d-2',
          judul: 'Penetapan Penguji Ujian',
          pesan: 'Anda telah ditetapkan sebagai Penguji 1 untuk Ujian Skripsi Ahmad Fauzi pada 18 Nov 2026.',
          link: '/bimbingan',
          dibaca: false,
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
      ]);
    } else if (user?.role === 'admin') {
      setNotifList([
        {
          id: 'n-a-1',
          judul: 'Verifikasi Berkas Pengajuan',
          pesan: 'Terdapat naskah proposal baru menunggu verifikasi administrasi departemen.',
          link: '/admin',
          dibaca: false,
          created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        },
        {
          id: 'n-a-2',
          judul: 'Pendaftaran Yudisium Masuk',
          pesan: 'Mahasiswa telah melengkapi 5 berkas syarat yudisium dan siap diverifikasi.',
          link: '/admin',
          dibaca: false,
          created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
      ]);
    } else {
      setNotifList([
        {
          id: 'n-m-1',
          judul: 'Pembaruan Status Proposal',
          pesan: 'Proposal skripsi Anda telah diverifikasi oleh admin dan disetujui dosen pembimbing!',
          link: '/skripsi',
          dibaca: false,
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'n-m-2',
          judul: 'Jadwal Kuota Seminar Dibuka',
          pesan: 'Slot jadwal seminar proposal bulan berjalan telah dibuka. Pastikan memilih kuota.',
          link: '/jadwal',
          dibaca: true,
          created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        },
      ]);
    }
  }

  async function handleMarkAsRead(notif) {
    // Update local state
    setNotifList((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, dibaca: true } : n))
    );

    try {
      if (notif.id && !notif.id.startsWith('n-')) {
        await supabase.from('notifikasi').update({ dibaca: true }).eq('id', notif.id);
      }
    } catch (e) {
      console.warn(e);
    }

    if (notif.link) {
      setShowNotif(false);
      router.push(notif.link);
    }
  }

  async function handleMarkAllRead() {
    setNotifList((prev) => prev.map((n) => ({ ...n, dibaca: true })));
    try {
      if (user?.id) {
        await supabase.from('notifikasi').update({ dibaca: true }).eq('user_id', user.id);
      }
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleLogout() {
    if (typeof window !== 'undefined') localStorage.removeItem('siskrip_demo_role');
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const getInitials = (nama) => {
    if (!nama) return 'U';
    const parts = nama.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const unreadCount = notifList.filter((n) => !n.dibaca).length;

  return (
    <header className="topbar-capsule">
      <div className="topbar-search" onClick={onOpenSearch} role="button" tabIndex={0}>
        <span style={{ fontSize: '0.95rem' }}>🔍</span>
        <span>Cari menu...</span>
        <span className="kbd-shortcut">Ctrl K</span>
      </div>

      <div className="topbar-actions">
        {/* Lonceng Notifikasi Interaktif */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="topbar-icon-btn"
            title="Notifikasi"
            onClick={() => setShowNotif(!showNotif)}
            aria-label="Notifikasi"
          >
            <span style={{ fontSize: '1.15rem' }}>🔔</span>
            {unreadCount > 0 && (
              <span className="notif-count-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Popover Notifikasi */}
          {showNotif && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <div>
                  <b style={{ fontSize: '0.92rem' }}>Notifikasi</b>
                  {unreadCount > 0 && (
                    <span className="tag" style={{ marginLeft: '0.4rem', fontSize: '0.72rem', background: 'rgba(220, 38, 38, 0.15)', color: 'var(--bad)', fontWeight: 700 }}>
                      {unreadCount} baru
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    className="lnk"
                    style={{ fontSize: '0.78rem', margin: 0 }}
                    onClick={handleMarkAllRead}
                  >
                    Tandai dibaca
                  </button>
                )}
              </div>

              <div className="notif-list">
                {notifList.length === 0 ? (
                  <p className="mut" style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                    Belum ada notifikasi.
                  </p>
                ) : (
                  notifList.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.dibaca ? 'unread' : ''}`}
                      onClick={() => handleMarkAsRead(n)}
                    >
                      {!n.dibaca && <div className="notif-unread-dot" />}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.15rem', color: 'var(--tx)' }}>
                          {n.judul}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--mut)', lineHeight: 1.35, marginBottom: '0.3rem' }}>
                          {n.pesan}
                        </p>
                        <span className="mut" style={{ fontSize: '0.72rem' }}>
                          {n.created_at ? new Date(n.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <ThemeBtn />

        <div className="user-avatar" title={`${user?.nama || 'Pengguna'} (${user?.role || ''})`}>
          {getInitials(user?.nama)}
        </div>

        <button className="btn-logout" onClick={handleLogout} title="Keluar">
          <span>🚪</span>
          <span className="logout-text">Keluar</span>
        </button>
      </div>
    </header>
  );
}
