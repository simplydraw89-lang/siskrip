'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
export default function Reset() {
  const r = useRouter(); const [m, setM] = useState('');
  async function simpan(e) {
    e.preventDefault(); const pw = e.target.pw.value;
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setM(error.message);
    r.replace('/dashboard');
  }
  return (<main className="authwrap"><form className="card" style={{ width: 360 }} onSubmit={simpan}>
    <h2>Password baru</h2><input name="pw" type="password" minLength={6} placeholder="Password baru" required />
    <button className="btn">Simpan</button><p className="mut">{m}</p></form></main>);
}
