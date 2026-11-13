'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CommandPalette({ isOpen, onClose, role }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Daftar navigasi berdasarkan role
  const roleMenus = {
    mahasiswa: [
      { id: 'beranda', label: 'Beranda', icon: '🏠', path: '/dashboard', desc: 'Halaman utama & pengumuman' },
      { id: 'skripsi', label: 'Skripsi', icon: '📖', path: '/skripsi', desc: 'Pengajuan judul & progres skripsi' },
      { id: 'jadwal', label: 'Jadwal', icon: '📅', path: '/jadwal', desc: 'Daftar jadwal seminar & ujian' },
      { id: 'forum', label: 'Forum', icon: '💬', path: '/forum', desc: 'Diskusi & informasi departemen' },
    ],
    dosen: [
      { id: 'beranda', label: 'Beranda', icon: '🏠', path: '/dashboard', desc: 'Halaman utama & pengumuman' },
      { id: 'bimbingan', label: 'Bimbingan', icon: '👥', path: '/bimbingan', desc: 'Daftar mahasiswa bimbingan' },
      { id: 'jadwal', label: 'Jadwal', icon: '📅', path: '/jadwal', desc: 'Jadwal seminar & ujian mahasiswa' },
      { id: 'forum', label: 'Forum', icon: '💬', path: '/forum', desc: 'Diskusi & informasi departemen' },
    ],
    admin: [
      { id: 'beranda', label: 'Beranda', icon: '🏠', path: '/dashboard', desc: 'Halaman utama & pengumuman' },
      { id: 'kelola', label: 'Kelola', icon: '⚙️', path: '/kelola', desc: 'Kelola user, jadwal & pengumuman' },
      { id: 'jadwal', label: 'Jadwal', icon: '📅', path: '/jadwal', desc: 'Master kuota & pendaftaran' },
      { id: 'forum', label: 'Forum', icon: '💬', path: '/forum', desc: 'Moderasi diskusi departemen' },
    ],
  };

  const currentRoleMenus = roleMenus[role] || roleMenus.mahasiswa;

  const actions = [
    ...currentRoleMenus,
    {
      id: 'theme',
      label: 'Ganti Tema',
      icon: '🌓',
      desc: 'Beralih antara mode gelap / terang',
      action: () => {
        const cur = document.documentElement.dataset.theme;
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('theme', next);
      },
    },
    {
      id: 'logout',
      label: 'Keluar',
      icon: '🚪',
      desc: 'Keluar dari akun SiSkrip',
      action: async () => {
        if (typeof window !== 'undefined') localStorage.removeItem('siskrip_demo_role');
        await supabase.auth.signOut();
        router.replace('/login');
      },
    },
  ];

  const filtered = actions.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.desc.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  function handleSelect(item) {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      router.push(item.path);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span style={{ fontSize: '1.2rem', color: 'var(--mut)' }}>🔍</span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Ketik untuk mencari menu atau perintah..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="kbd-shortcut" style={{ margin: 0 }}>ESC</span>
        </div>

        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div className="cmd-empty">Tidak ada hasil untuk "{query}"</div>
          ) : (
            filtered.map((item, index) => (
              <div
                key={item.id}
                className={'cmd-item' + (index === selectedIndex ? ' selected' : '')}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--mut)' }}>{item.desc}</div>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--mut)' }}>↵</span>
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <span>Gunakan panah ↑ ↓ untuk navigasi, Enter untuk memilih</span>
          <span>SiSkrip Palette</span>
        </div>
      </div>
    </div>
  );
}
