'use client';
import { useEffect, useState } from 'react';
export default function ThemeBtn() {
  const [t, setT] = useState('light');
  useEffect(() => {
    const s = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setT(s); document.documentElement.dataset.theme = s;
  }, []);
  const tog = () => { const n = t === 'dark' ? 'light' : 'dark'; setT(n); localStorage.setItem('theme', n); document.documentElement.dataset.theme = n; };
  return <button className="ic" onClick={tog} aria-label="Ganti tema">{t === 'dark' ? '☀️' : '🌙'}</button>;
}
