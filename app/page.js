'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
export default function Home() {
  const r = useRouter();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => r.replace(data.session ? '/dashboard' : '/login')); }, [r]);
  return <p style={{ padding: 20 }}>Memuat…</p>;
}
