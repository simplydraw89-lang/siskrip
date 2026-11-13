'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import TopNavbar from '@/components/TopNavbar';
import MobileNav from '@/components/MobileNav';
import CommandPalette from '@/components/CommandPalette';

export const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

export default function AppLayout({ children }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  async function loadUser() {
    // Mode demo / pratinjau untuk pengujian tampilan visual tanpa harus verifikasi email
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const demoParam = params.get('demo') || localStorage.getItem('siskrip_demo_role');
      if (demoParam) {
        const demoRole = ['dosen', 'admin'].includes(demoParam) ? demoParam : 'mahasiswa';
        localStorage.setItem('siskrip_demo_role', demoRole);
        setProfile({
          id: 'demo-user-id',
          nama: demoRole === 'dosen' ? 'Dr. Ir. Budi Wibowo, M.Sc.' : demoRole === 'admin' ? 'Admin Departemen' : 'Budi Santoso',
          role: demoRole,
          noid: demoRole === 'dosen' ? '198203152008121002' : demoRole === 'admin' ? 'ADM-PRK-01' : '22/499123/PN/18000',
          prodi: 'Akuakultur',
          status: 'aktif',
        });
        setLoading(false);
        return;
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !data) {
      // Fallback profil dari user metadata jika row profile belum terbentuk sempurna
      setProfile({
        id: session.user.id,
        nama: session.user.user_metadata?.nama || session.user.email?.split('@')[0],
        role: session.user.user_metadata?.role || 'mahasiswa',
        noid: session.user.user_metadata?.noid || '',
        prodi: session.user.user_metadata?.prodi || '',
        status: 'aktif',
      });
    } else {
      setProfile(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const isDemo = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('demo') || localStorage.getItem('siskrip_demo_role'));
      if (!isDemo && (event === 'SIGNED_OUT' || !session)) {
        router.replace('/login');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Shortcut global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="UGM" style={{ width: 64, height: 64, animation: 'pulse 1.5s infinite ease-in-out' }} />
          <p style={{ marginTop: '1rem', color: 'var(--mut)', fontSize: '0.9rem' }}>Memuat SiSkrip…</p>
        </div>
      </div>
    );
  }

  const role = profile?.role || 'mahasiswa';

  return (
    <UserContext.Provider value={{ profile, reloadProfile: loadUser }}>
      <div className="app-layout">
        <Sidebar role={role} />

        <div className="app-main">
          <TopNavbar user={profile} onOpenSearch={() => setIsCmdOpen(true)} />
          <main>{children}</main>
        </div>

        <MobileNav role={role} />

        <CommandPalette
          isOpen={isCmdOpen}
          onClose={() => setIsCmdOpen(false)}
          role={role}
        />
      </div>
    </UserContext.Provider>
  );
}
