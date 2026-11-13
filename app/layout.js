import './globals.css';
export const metadata = { title: 'SiSkrip · Departemen Perikanan UGM', description: 'Sistem administrasi skripsi Departemen Perikanan, Fakultas Pertanian UGM' };
export default function RootLayout({ children }) {
  return <html lang="id" suppressHydrationWarning><body>{children}</body></html>;
}
