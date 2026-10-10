# Panduan Lengkap Deployment iManurung ke Google Apps Script (GAS)

Dokumen ini berisi panduan komprehensif langkah demi langkah untuk men-deploy aplikasi web **iManurung** ke **Google Apps Script (GAS)** dengan basis data **Google Sheets**.

---

## 1. Arsitektur Teknis Bounded Script

Aplikasi iManurung dirancang mengikuti pola standar resmi Google Apps Script HTML Service:

```
Proyek Apps Script:
├── Code.gs             -> Backend: routing, otentikasi Google SSO, RBAC server-side, CRUD
├── index.html          -> Shell antarmuka pengguna utama (SPA)
├── Stylesheet.html     -> CSS design system, tema modern clan, dan styling pohon silsilah
└── JavaScript.html    -> Client runtime, D3.js interactive tree, filtering, modal & chart
```

Spreadsheet bertindak sebagai database relasional dengan **6 Sheet**:
1. `Members`: Data profil anggota keluarga & relasi orang tua (ParentID)
2. `Users`: Hak akses akun berbasis email Google SSO
3. `RolePermissions`: Matriks akses menu per role
4. `Dues`: Pencatatan kas & iuran berkala anggota
5. `Articles`: CMS artikel warta adat, sejarah silsilah & berita duka/sukacita
6. `ActivityLog`: Rekam jejak audit aktivitas (audit trail)

---

## 2. Langkah 1: Siapkan Google Spreadsheet Baru

1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet: **`Database iManurung`**.
3. Biarkan spreadsheet dalam keadaan kosong (sistem akan membuat seluruh 6 tab secara otomatis lewat skrip setup).

---

## 3. Langkah 2: Buka Google Apps Script Editor

1. Pada menu navigasi atas Google Sheets, klik **Ekstensi (Extensions)** > **Apps Script**.
2. Tab baru editor Apps Script akan terbuka.
3. Ubah nama proyek di pojok kiri atas (dari *Untitled project*) menjadi **`iManurung Web App`**.

---

## 4. Langkah 3: Salin File Kode Proyek

Anda perlu menyiapkan **4 file** di dalam editor Apps Script:

### 4.1. File `Code.gs` (Script)
1. Pilih file default `Code.gs`.
2. Hapus seluruh isi default, lalu salin dan tempelkan seluruh isi file [`Code.gs`](file:///Users/winnermanurung/Documents/project/manurung/app/Code.gs).
3. Tekan `Ctrl + S` (atau `Cmd + S` di Mac) untuk menyimpan.

### 4.2. File `index.html` (HTML)
1. Di panel kiri, klik tombol **`+`** (Tambahkan file) > pilih **HTML**.
2. Beri nama file: **`index`** (jangan tambahkan `.html`, Apps Script otomatis menambahkannya).
3. Salin dan tempelkan seluruh isi file [`index.html`](file:///Users/winnermanurung/Documents/project/manurung/app/index.html).
4. Simpan file.

### 4.3. File `Stylesheet.html` (HTML)
1. Klik tombol **`+`** > pilih **HTML**.
2. Beri nama file persis: **`Stylesheet`**.
3. Salin dan tempelkan seluruh isi file [`Stylesheet.html`](file:///Users/winnermanurung/Documents/project/manurung/app/Stylesheet.html).
4. Simpan file.

### 4.4. File `JavaScript.html` (HTML)
1. Klik tombol **`+`** > pilih **HTML**.
2. Beri nama file persis: **`JavaScript`**.
3. Salin dan tempelkan seluruh isi file [`JavaScript.html`](file:///Users/winnermanurung/Documents/project/manurung/app/JavaScript.html).
4. Simpan file.

---

## 5. Langkah 4: Jalankan Inisialisasi Database Otomatis

1. Di bilah menu atas editor Apps Script, cari dropdown pilihan fungsi di sebelah tombol **Jalankan (Run)**.
2. Pilih fungsi: **`setupSpreadsheet`**.
3. Klik tombol **Jalankan (Run)**.
4. Pada saat pertama kali dijalankan, Google akan meminta **Izin Otorisasi (Authorization Required)**:
   - Klik **Tinjau Izin (Review permissions)**.
   - Pilih akun Google Anda.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced** (Lanjutan) lalu klik **Go to iManurung Web App (unsafe)**.
   - Klik **Allow** (Izinkan).
5. Tunggu hingga log eksekusi menampilkan:
   `"Database iManurung berhasil diinisialisasi lengkap dengan 6 sheets dan data silsilah!"`
6. Periksa kembali tab Google Spreadsheet Anda: seluruh 6 sheet beserta baris header bercorak biru navy (`#0E243A`) dan data silsilah Ompu Silau Raja (3 Rumpun) sudah terisi dengan rapi!

---

## 6. Langkah 5: Deploy Sebagai Web App

1. Di pojok kanan atas editor Apps Script, klik tombol biru **Terapkan (Deploy)** > pilih **Penerapan Baru (New deployment)**.
2. Klik ikon gerigi (Pilih jenis penerapan) di sebelah kiri > pilih **Aplikasi Web (Web app)**.
3. Isi konfigurasi sebagai berikut:
   - **Deskripsi**: `iManurung Versi 1.0`
   - **Jalankan sebagai (Execute as)**: `Saya (emailanda@gmail.com)` atau `Pengguna yang mengakses aplikasi web`
   - **Siapa yang memiliki akses (Who has access)**: 
     - Pilih `Siapa saja yang memiliki Akun Google` (Anyone with Google account) agar email login anggota terbaca otomatis via `Session.getActiveUser()`.
4. Klik **Terapkan (Deploy)**.
5. Salin **URL Aplikasi Web (Web app URL)** yang diberikan.
6. Buka URL tersebut di browser Anda: portal iManurung siap digunakan oleh seluruh keluarga besar!

---

## 7. Pengujian Instan Tanpa Deploy (Mode Standalone)

Jika Anda ingin mendemokan atau menguji tampilan aplikasi secara langsung di laptop/komputer tanpa membuka Google Sheets:
- Cukup buka file [`imanurung_app_full.html`](file:///Users/winnermanurung/Documents/project/manurung/app/imanurung_app_full.html) di browser apa saja (Google Chrome, Safari, Firefox).
- Aplikasi secara cerdas beralih ke mode **Smart Demo Bridge** dengan database mock lokal interaktif lengkap.

---

## 8. Pertanyaan Umum & Pemecahan Masalah (FAQ)

### Q: Kenapa `Session.getActiveUser().getEmail()` mengembalikan string kosong?
**A:** Jika Web App dideploy dengan opsi *Who has access: Anyone* (tanpa login Google) atau diakses di luar domain Google Workspace, Apps Script tidak dapat membaca email pengunjung demi privasi. Solusinya:
1. Pastikan opsi deployment adalah **Anyone with Google account**, ATAU
2. Pengguna dapat menggunakan form login manual / Quick Demo Switcher yang sudah disediakan di halaman login.

### Q: Bagaimana cara menambah anggota admin baru?
**A:** Cukup buka sheet **`Users`** di Google Sheets Anda, tambahkan baris baru berisi Email Google mereka dan atur kolom Role menjadi **`Admin`** atau **`Super Admin`**. Atau ubah langsung lewat menu **Role Management** di dalam aplikasi web.