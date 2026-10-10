PRD — iManurung

Aplikasi Manajemen Silsilah Keluarga (Tarombo) berbasis Google Apps Script Web App

Versi: 1.0 Tipe proyek: Bounded Script (terikat pada satu Google Spreadsheet sebagai database) Status: Draft untuk pengembangan MVP

1. Latar belakang

Keluarga besar membutuhkan satu sumber data tunggal (single source of truth) untuk mencatat silsilah (tarombo), keanggotaan, dan aktivitas administratif keluarga (iuran, informasi/artikel) yang selama ini tersebar di grup chat, dokumen terpisah, atau ingatan sesepuh keluarga. iManurung dibangun di atas Google Apps Script + Google Sheets agar mudah di-deploy, tidak butuh biaya hosting, dan familiar bagi anggota keluarga yang sudah terbiasa dengan ekosistem Google.

2. Tujuan produk
Menyediakan satu web app yang menampilkan pohon keluarga (family tree) secara visual dan menyeluruh, dari generasi pertama (kakek/nenek moyang) hingga generasi terakhir yang tercatat.
Memudahkan pengurus keluarga (admin) mengelola data anggota, iuran, dan artikel/berita keluarga tanpa perlu keahlian teknis.
Memberi setiap anggota keluarga (member) akses mandiri untuk melihat data keluarga, mencari anggota lain, dan membaca informasi terbaru.
3. Target pengguna & role
Role	Deskripsi	Akses
Admin	Pengurus/sesepuh keluarga yang ditunjuk	Penuh ke semua modul: CRUD member, role management, iuran, artikel, dashboard
Member	Anggota keluarga biasa	Lihat family tree, cari/filter anggota, lihat profil, lihat status iuran pribadi, baca artikel

Login menggunakan Google SSO (Session.getActiveUser()), sehingga tidak perlu sistem password terpisah. Role ditentukan dari tabel Users berdasarkan email Google yang login.

4. Ruang lingkup (in-scope)
Login & otorisasi berbasis Google SSO + role (admin/member)
Dashboard ringkasan keanggotaan & aktivitas
CRUD data anggota keluarga + profil lengkap + search & filter
Visualisasi family tree interaktif (zoom/pan, dari generasi pertama ke terakhir)
Role management (akses menu per role)
Pencatatan iuran anggota
Manajemen artikel/berita keluarga
5. Di luar ruang lingkup (out of scope, fase 1)
Notifikasi email/WhatsApp otomatis
Pembayaran iuran online (payment gateway)
Multi-keluarga dalam satu instance (1 deployment = 1 keluarga besar)
Aplikasi mobile native
6. Fitur utama & requirement fungsional
6.1 Autentikasi & role
FR-1: User login otomatis via Google Account yang sedang aktif di browser (tapi tetap ada login form manual).
FR-2: Sistem mengecek email user terhadap sheet Users. Jika belum terdaftar, tampilkan halaman "akses belum diberikan, hubungi admin".
FR-3: Role (Admin/Member) menentukan menu yang tampil di sidebar dan fungsi backend yang boleh dipanggil (validasi dilakukan di backend, bukan hanya UI).
6.2 Dashboard
FR-4: Menampilkan jumlah total anggota, jumlah per generasi, jumlah member aktif vs non-aktif.
FR-5: Menampilkan ringkasan iuran (total terkumpul bulan berjalan, jumlah member yang belum bayar).
FR-6: Menampilkan log aktivitas terbaru (siapa menambah/mengubah data, kapan).
6.3 Data anggota (member)
FR-7: Admin dapat menambah, mengubah, menghapus (soft delete) data anggota.
FR-8: Setiap anggota punya profil lengkap: nama, jenis kelamin, tanggal lahir, tanggal meninggal (jika ada), generasi, orang tua (parent), pasangan (spouse), alamat, kontak, pekerjaan, foto.
FR-9: Search berdasarkan nama (partial match) dan filter berdasarkan generasi, status hidup/meninggal, dan cabang keluarga (berdasarkan parent).
FR-10: Member biasa hanya bisa melihat data (read-only), tidak bisa edit/hapus.
6.4 Family tree (konsep inti)
FR-11: Tree ditampilkan secara grafis dan bisa di-zoom/pan, menampilkan seluruh generasi dari leluhur pertama sampai generasi termuda dalam satu tampilan yang bisa dieksplorasi.
FR-12: Klik satu node anggota menampilkan detail profil singkat (popup/panel).
FR-13: Struktur tree dibangun dari relasi ParentID yang dikembalikan backend sebagai data flat (JSON), lalu dirender jadi struktur hierarki di sisi client.
6.5 Role management
FR-14: Admin dapat mengubah role seorang user (Admin/Member).
FR-15: Admin dapat mengatur menu apa saja yang bisa diakses oleh role tertentu (disimpan di sheet RolePermissions).
6.6 Pencatatan iuran
FR-16: Admin mencatat iuran per anggota per periode (bulan/tahun), termasuk jumlah, tanggal bayar, dan status (lunas/belum).
FR-17: Member dapat melihat riwayat & status iuran miliknya sendiri.
FR-18: Admin dapat melihat rekap iuran seluruh anggota, difilter per periode.
6.7 Manajemen artikel
FR-19: Admin dapat membuat, mengedit, menghapus, dan mempublikasikan artikel/berita.
FR-20: Artikel punya status draft/published, kategori, dan tanggal publish.
FR-21: Semua user (admin & member) dapat membaca artikel yang berstatus published.
7. Requirement non-fungsional
NFR-1 (Kuota Apps Script): Minimalkan pemanggilan SpreadsheetApp berulang di dalam loop. Data yang sering dibaca (family tree, daftar member) diambil sekali per sesi lalu diproses di client, bukan query per node.
NFR-2 (Performa): Gunakan CacheService untuk data yang jarang berubah (mis. hasil family tree) dengan TTL beberapa menit.
NFR-3 (Keamanan): Validasi role dilakukan di setiap fungsi backend (Code.gs), bukan hanya menyembunyikan tombol di UI. Function terkait Admin selalu memanggil requireAdmin_() di awal.
NFR-4 (Skalabilitas data): Desain skema mendukung ratusan hingga beberapa ribu anggota tanpa perlu load semua kolom sekaligus (hanya kolom yang perlu ditampilkan di list/tree).
NFR-5 (Auditability): Setiap operasi tulis (add/update/delete) dicatat di sheet ActivityLog.
NFR-6 (Kompatibilitas): UI harus responsif untuk desktop dan tablet (mobile browser sebagai nice-to-have, bukan prioritas MVP).
8. Arsitektur teknis

Model: Bounded script — script terikat langsung ke satu Google Spreadsheet yang berfungsi sebagai database.

User (browser)
   -> Google OAuth SSO (otomatis via Session.getActiveUser)
   -> index.html (HtmlService, di-serve oleh doGet di Code.gs)
        -> Stylesheet.html (CSS, di-inject via include())
        -> JavaScript.html (client logic, di-inject via include())
   -> Code.gs (backend: routing, validasi role, CRUD, business logic)
   -> Spreadsheet DB (bounded, diakses via SpreadsheetApp.getActiveSpreadsheet())

Komunikasi client-backend menggunakan google.script.run (asynchronous, bukan REST API).

9. Struktur file proyek
Code.gs            -> backend: setup spreadsheet, doGet, semua fungsi server-side
index.html          -> shell UI utama (SPA sederhana, single page dengan section switching)
Stylesheet.html      -> seluruh CSS aplikasi, di-include ke index.html
JavaScript.html       -> seluruh JS client-side, di-include ke index.html

Catatan: Apps Script HTML Service tidak mendukung file .css/.js terpisah secara native saat deploy — karena itu CSS dan JS ditulis dalam file .html (Stylesheet.html, JavaScript.html) lalu di-inject ke index.html menggunakan <?!= include('NamaFile'); ?>. Ini adalah pola standar Apps Script.

10. Skema data (Google Sheets)
Sheet: Members
Kolom	Tipe	Keterangan
MemberID	string	ID unik (UUID)
Nama	string	Nama lengkap
JenisKelamin	string	L / P
TanggalLahir	date	
TanggalMeninggal	date	kosong jika masih hidup
Generasi	number	urutan generasi (1 = leluhur pertama)
ParentID	string	MemberID orang tua (kosong untuk generasi 1)
SpouseID	string	MemberID pasangan (opsional)
Alamat	string	
NoHP	string	
Email	string	
Pekerjaan	string	
FotoURL	string	link foto profil
Status	string	Aktif / NonAktif (soft delete)
CreatedAt	datetime	
UpdatedAt	datetime	
Sheet: Users
Kolom	Tipe	Keterangan
Email	string	email Google login (key)
Nama	string	
Role	string	Admin / Member
MemberID	string	link ke sheet Members
Status	string	Aktif / NonAktif
LastLogin	datetime	
Sheet: RolePermissions
Kolom	Tipe	Keterangan
Role	string	Admin / Member
MenuAccess	string	daftar menu dipisah koma, mis. "dashboard,members,tree,dues,articles"
Sheet: Dues (Iuran)
Kolom	Tipe	Keterangan
IuranID	string	ID unik
MemberID	string	
Periode	string	format "YYYY-MM"
Jumlah	number	
TanggalBayar	date	
Status	string	Lunas / BelumLunas
Catatan	string	
InputBy	string	email admin yang input
Sheet: Articles
Kolom	Tipe	Keterangan
ArticleID	string	
Judul	string	
Konten	string	
Kategori	string	
PenulisEmail	string	
TanggalPublish	datetime	
Status	string	Draft / Published
Thumbnail	string	URL gambar (opsional)
Sheet: ActivityLog
Kolom	Tipe	Keterangan
LogID	string	
Email	string	
Aksi	string	mis. "add_member", "update_dues"
Detail	string	
Timestamp	datetime	
11. User flow ringkas
User membuka URL web app -> Google minta izin akses (jika pertama kali) -> doGet mengecek email di Users.
Jika tidak terdaftar -> tampil halaman "belum terdaftar, hubungi admin".
Jika terdaftar -> tampil Dashboard sesuai role, sidebar menu mengikuti RolePermissions.
Member menjelajah family tree / mencari anggota / membaca artikel.
Admin mengelola data lewat menu Members, Role Management, Iuran, Artikel — setiap perubahan tercatat di ActivityLog.
12. Fase pengembangan (roadmap MVP)
Fase	Cakupan
Fase 1	Setup spreadsheet otomatis, autentikasi & role, shell UI (index.html + include CSS/JS)
Fase 2	CRUD member + search/filter + dashboard
Fase 3	Family tree visual (interaktif, zoom/pan)
Fase 4	Role management + pencatatan iuran
Fase 5	Manajemen artikel + polish UI + testing lintas role
13. Risiko & mitigasi
Risiko	Mitigasi
Kuota SpreadsheetApp terlampaui pada keluarga besar	Batasi query, gunakan CacheService, fetch data list sekali per load
Role hanya divalidasi di UI (celah keamanan)	Semua fungsi backend admin wajib memanggil pengecekan role di server
Struktur ParentID salah/siklik merusak tree	Validasi saat input: parent tidak boleh sama dengan diri sendiri / anak dari dirinya sendiri
Data sensitif (iuran) bocor ke member lain	Fungsi getDues hanya mengembalikan data milik member yang login, kecuali dipanggil oleh Admin
14. Kriteria sukses MVP
Admin bisa setup spreadsheet dari nol hanya dengan menjalankan satu fungsi (setupSpreadsheet).
Family tree tampil benar dari generasi 1 hingga generasi terakhir tanpa data terputus.
Search anggota memberi hasil relevan dalam < 1 detik untuk data hingga ~1000 anggota.
Role admin dan member terpisah dengan jelas, tidak ada kebocoran fungsi admin ke member.