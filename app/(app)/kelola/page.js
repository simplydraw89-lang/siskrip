'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KelolaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return <p style={{ padding: '2rem 0', color: 'var(--mut)' }}>Mengalihkan ke Panel Admin…</p>;
}
