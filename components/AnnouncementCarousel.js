'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: '1',
    judul: 'Pendaftaran Seminar Proposal Periode November Dibuka',
    isi: 'Bagi mahasiswa Departemen Perikanan yang telah menyelesaikan draf proposal dan disetujui dosen pembimbing, pendaftaran jadwal seminar telah dibuka di SiSkrip.',
    tanggal: '13 November 2026',
  },
  {
    id: '2',
    judul: 'Panduan Penulisan Skripsi Terbaru Departemen Perikanan',
    isi: 'Format dan template resmi penulisan skripsi edisi revisi dapat diunduh melalui portal akademik departemen. Pastikan mengacu pada pedoman terbaru.',
    tanggal: '11 November 2026',
  },
  {
    id: '3',
    judul: 'Sosialisasi Ujian Pendadaran & Bebas Laboratorium',
    isi: 'Mahasiswa tingkat akhir wajib melengkapi surat bebas laboratorium dan verifikasi logbook bimbingan sebelum mengajukan tanggal ujian pendadaran skripsi.',
    tanggal: '08 November 2026',
  },
];

export default function AnnouncementCarousel() {
  const [items, setItems] = useState(DEFAULT_ANNOUNCEMENTS);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const { data, error } = await supabase
          .from('pengumuman')
          .select('*')
          .eq('aktif', true)
          .order('tanggal', { ascending: false });

        if (!error && data && data.length > 0) {
          const formatted = data.map((d) => ({
            id: d.id,
            judul: d.judul,
            isi: d.isi,
            tanggal: new Date(d.tanggal).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          }));
          setItems(formatted);
        }
      } catch (e) {
        // Fallback default announcements
      }
    }
    fetchAnnouncements();
  }, []);

  // Ganti otomatis tiap 6 detik
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + items.length) % items.length);
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % items.length);
  };

  const activeItem = items[current] || items[0];

  return (
    <div className="carousel-card" aria-label="Pengumuman Fakultas">
      <div className="carousel-badge">
        <span>📢</span>
        <span>Pengumuman Fakultas</span>
      </div>

      <div className="carousel-slide" key={activeItem.id}>
        <h3 className="carousel-title">{activeItem.judul}</h3>
        <p className="carousel-body">{activeItem.isi}</p>
        <span className="carousel-date">📅 {activeItem.tanggal}</span>
      </div>

      <div className="carousel-controls">
        <div className="carousel-dots">
          {items.map((item, index) => (
            <button
              key={item.id}
              className={'carousel-dot' + (index === current ? ' active' : '')}
              onClick={() => setCurrent(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="carousel-arrows">
          <button className="carousel-arrow" onClick={prevSlide} aria-label="Sebelumnya">
            ◀
          </button>
          <button className="carousel-arrow" onClick={nextSlide} aria-label="Berikutnya">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
