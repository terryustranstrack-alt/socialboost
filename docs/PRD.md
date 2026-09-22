# PROMPT: Perencanaan & Penyusunan Aplikasi Penjadwalan & Monitoring Media Sosial

## 1. Konteks & Latar Belakang
- Organisasi: TransTRACK (fleet management & logistics tech — Indonesia, Singapura, Malaysia, Australia)
- Kebutuhan: alat internal untuk menjadwalkan konten sosial media dan memonitor performanya, dengan potensi dipakai ulang oleh Racik Digital (agensi digital UMKM) sebagai layanan ke klien di kemudian hari
- Pendekatan: dibangun custom, dikerjakan tim marketing dibantu AI coding tool
- Hosting: Vercel

## 2. Tujuan Proyek
- Definisikan 3-5 tujuan bisnis utama (contoh: efisiensi waktu tim konten, konsistensi jadwal posting, visibilitas performa konten, kolaborasi lintas tim)
- Definisikan tujuan yang bisa diukur (bukan sekadar "lebih efisien")

## 3. Product Owner & Tim
- Product Owner & tim pelaksana: Terry + tim marketing TransTRACK
- Metode development: dibantu AI coding tool (bukan tim engineering dedicated)

## 4. Target Pengguna
- Admin/Owner (kontrol penuh, multi-akun/multi-brand)
- Content Creator/Editor (buat & jadwalkan draft)
- Approver (satu level approval, tidak berlapis)
- Viewer/Stakeholder (lihat kalender & laporan saja)

## 5. Ruang Lingkup (Scope)
- Brand/akun yang didukung: transtrack.co dan transtrack.academy (2 brand di MVP)
- Platform prioritas MVP (3 hari): Instagram, Facebook — via Meta app Development Mode (akun sendiri sebagai admin/tester, tanpa App Review penuh)
- Platform menyusul di luar MVP: LinkedIn — menunggu approval LinkedIn Marketing Developer Platform (proses > 3 hari)
- Batasan eksplisit MVP: tanpa analytics mendalam, tanpa content library penuh — fokus penjadwalan + kalender + approval dasar

## 6. Fitur Utama (Core Features)

### 6.1 Penjadwalan Multi-Platform
- MVP: buat post sekali, jadwalkan ke Instagram & Facebook untuk transtrack.co dan/atau transtrack.academy
- Menyusul: tambah LinkedIn setelah approval API selesai
- Preview tampilan post per platform sebelum publish
- Draft, jadwal, antrian (queue)
- Switch akun/brand dalam satu dashboard (transtrack.co ↔ transtrack.academy)

### 6.2 Monitoring & Analytics
- MVP: status publish (berhasil/gagal) per post
- Fase berikutnya: engagement (likes, comment, share, reach, impression) per post/platform/brand, ringkasan performa mingguan/bulanan, export laporan

### 6.3 Kolaborasi Tim & Approval
- Alur kerja MVP: draft → 1x approve → terjadwal → publish (tidak berlapis)
- Notifikasi untuk approver saat ada draft menunggu
- Role-based access: Admin, Creator, Approver, Viewer

### 6.4 Content Calendar & Library
- MVP: kalender visual (bulanan/mingguan) untuk kedua brand, filter per akun/platform/status
- Fase berikutnya: pustaka aset (gambar/video/caption) yang bisa dipakai ulang, tagging/kategori konten

## 7. Kebutuhan Non-Fungsional
- Keamanan: token Instagram/Facebook disimpan terenkripsi (mis. Vercel env vars atau secret manager terintegrasi database), akses dibatasi per role
- Skalabilitas: skema data multi-brand sejak awal (brand_id di setiap tabel) agar siap ditambah LinkedIn dan brand/klien baru (Racik Digital) tanpa migrasi besar
- Reliabilitas: penanganan jika publish gagal (retry, notifikasi error) — penting karena tanpa tim engineering dedicated, error handling perlu jelas dan mudah didiagnosis
- Kepatuhan rate limit Meta Graph API

## 8. Integrasi Platform
- Meta Graph API (Instagram & Facebook) — mode Development, akun TransTRACK sebagai admin/tester app, cukup untuk MVP 3 hari
- LinkedIn API (Marketing Developer Platform) — ajukan approval paralel sejak hari ini agar siap saat fase berikutnya
- OAuth token per platform, per brand (terpisah untuk transtrack.co dan transtrack.academy)

## 9. Stack Teknis (disesuaikan untuk MVP 3 hari di Vercel)
- Frontend + Backend: Next.js (App Router) di Vercel — cocok untuk tim non-engineering dibantu AI coding tool karena dokumentasi & convention luas
- Database: Vercel Postgres atau Supabase (Postgres) — schema dengan brand_id sejak awal
- Job scheduler untuk auto-publish: Vercel Cron Jobs (memicu fungsi publish sesuai jadwal post)
- Auth internal tim: solusi siap pakai (mis. Clerk/NextAuth) agar tidak perlu dibangun dari nol
- Penyimpanan media (gambar/video post): Vercel Blob atau Supabase Storage

## 10. Metrik Keberhasilan (KPI)
- MVP berjalan dan dipakai tim marketing dalam 3 hari pertama
- Ketepatan waktu publish sesuai jadwal di Instagram & Facebook
- Pengurangan waktu manual posting untuk transtrack.co dan transtrack.academy
- (Fase berikutnya) akurasi data monitoring vs data asli platform

## 11. Roadmap Bertahap
- Fase 1 (MVP, target selesai 2026-09-25 — 3 hari dari sekarang): penjadwalan IG+FB (Development Mode), kalender, approval 1 level, untuk transtrack.co & transtrack.academy
- Fase 2 [unknown tanggal]: tambah LinkedIn setelah approval API selesai; monitoring/analytics dasar
- Fase 3 [unknown tanggal]: content library penuh, analytics mendalam, social listening
- Fase 4 [unknown tanggal]: persiapan multi-tenant untuk Racik Digital (branding klien, isolasi data)

## 12. Asumsi & Batasan
- Tim pelaksana = Terry + tim marketing TransTRACK, dibantu AI coding tool, tanpa tim engineering dedicated
- Hosting di Vercel — anggaran plan Vercel (Pro jika dibutuhkan untuk Cron Jobs/Blob storage skala tim) belum dikonfirmasi
- LinkedIn tidak akan siap di MVP 3 hari karena proses approval API — perlu diajukan sesegera mungkin agar tidak jadi bottleneck di Fase 2
- Approval hanya 1 level — perlu dipastikan siapa role Approver dari awal

## 13. Pertanyaan Terbuka yang Masih Perlu Diputuskan
- Siapa yang berperan sebagai Approver tunggal untuk konten transtrack.co dan transtrack.academy?
- Siapa pemegang akun Meta Business Suite (admin) untuk setup app Instagram & Facebook?
- Apakah akan langsung ajukan LinkedIn Marketing Developer Platform hari ini agar Fase 2 tidak tertunda?
- Plan Vercel yang dipakai: Hobby (gratis, terbatas) atau Pro (mendukung Cron Jobs lebih fleksibel dan Blob storage lebih besar)?
