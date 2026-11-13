'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ role }) {
  const pathname = usePathname();

  const roleMenus = {
    mahasiswa: [
      { label: 'Beranda', icon: '🏠', path: '/dashboard' },
      { label: 'Skripsi', icon: '📖', path: '/skripsi' },
      { label: 'Jadwal', icon: '📅', path: '/jadwal' },
      { label: 'Forum', icon: '💬', path: '/forum' },
    ],
    dosen: [
      { label: 'Beranda', icon: '🏠', path: '/dashboard' },
      { label: 'Bimbingan', icon: '👥', path: '/bimbingan' },
      { label: 'Jadwal', icon: '📅', path: '/jadwal' },
      { label: 'Forum', icon: '💬', path: '/forum' },
    ],
    admin: [
      { label: 'Beranda', icon: '🏠', path: '/dashboard' },
      { label: 'Kelola', icon: '⚙️', path: '/kelola' },
      { label: 'Jadwal', icon: '📅', path: '/jadwal' },
      { label: 'Forum', icon: '💬', path: '/forum' },
    ],
  };

  const menus = roleMenus[role] || roleMenus.mahasiswa;

  return (
    <aside className="sidebar-rail" aria-label="Navigasi Utama">
      <div className="rail-brand">
        <img src="/logo.png" alt="UGM" className="rail-logo" />
        <span className="rail-title">SiSkrip</span>
      </div>

      <nav className="rail-nav">
        {menus.map((m) => {
          const isActive = pathname === m.path;
          return (
            <Link
              key={m.path}
              href={m.path}
              className={'rail-link' + (isActive ? ' active' : '')}
              title={m.label}
            >
              <span className="nav-icon">{m.icon}</span>
              <span className="nav-label">{m.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rail-footer">
        <span className="role-pill">{role || 'User'}</span>
      </div>
    </aside>
  );
}
