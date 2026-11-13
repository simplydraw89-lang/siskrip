'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ThemeBtn from '@/components/ThemeBtn';

export default function TopNavbar({ user, onOpenSearch }) {
  const router = useRouter();

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

  return (
    <header className="topbar-capsule">
      <div className="topbar-search" onClick={onOpenSearch} role="button" tabIndex={0}>
        <span style={{ fontSize: '0.95rem' }}>🔍</span>
        <span>Cari menu...</span>
        <span className="kbd-shortcut">Ctrl K</span>
      </div>

      <div className="topbar-actions">
        <button
          className="topbar-icon-btn"
          title="Notifikasi"
          onClick={() => alert('Belum ada notifikasi baru.')}
          aria-label="Notifikasi"
        >
          <span style={{ fontSize: '1.15rem' }}>🔔</span>
          <span className="notif-badge" />
        </button>

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
