'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav({ role }) {
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
    <nav className="mobile-nav" aria-label="Navigasi Mobile">
      {menus.map((m) => {
        const isActive = pathname === m.path;
        return (
          <Link
            key={m.path}
            href={m.path}
            className={'mobile-nav-item' + (isActive ? ' active' : '')}
          >
            <span className="mob-icon">{m.icon}</span>
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
