/**
 * ============================================================================
 * iManurung - Portal Manajemen Silsilah (Tarombo) & Komunitas Marga
 * Backend Google Apps Script (GAS) Bounded Script
 * Versi: 1.0 (Production Ready)
 * ============================================================================
 */

// Konfigurasi Nama Sheet Database
var SHEETS = {
  MEMBERS: 'Members',
  USERS: 'Users',
  ROLE_PERMISSIONS: 'RolePermissions',
  DUES: 'Dues',
  ARTICLES: 'Articles',
  ACTIVITY_LOG: 'ActivityLog'
};

/**
 * Entry point HTTP GET Web App
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('iManurung - Portal Marga & Silsilah Komunitas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

/**
 * Helper untuk meng-include file HTML parsial (Stylesheet.html & JavaScript.html)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Inisialisasi Google Spreadsheet & Seeding Data Awal (FR-1 & NFR-1)
 * Jalankan fungsi ini sekali dari editor Apps Script atau klik tombol Inisialisasi di UI.
 */
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet: Members
  var sheetMembers = getOrCreateSheet_(ss, SHEETS.MEMBERS);
  if (sheetMembers.getLastRow() === 0) {
    var headersMembers = [
      'MemberID', 'Nama', 'JenisKelamin', 'TanggalLahir', 'TanggalMeninggal',
      'Generasi', 'ParentID', 'SpouseID', 'Alamat', 'NoHP',
      'Email', 'Pekerjaan', 'FotoURL', 'Status', 'CreatedAt', 'UpdatedAt', 'Rumpun', 'BonaPasogit', 'Sektor', 'Kategori'
    ];
    formatHeaderRow_(sheetMembers, headersMembers);
    seedInitialMembers_(sheetMembers);
  }

  // 2. Sheet: Users
  var sheetUsers = getOrCreateSheet_(ss, SHEETS.USERS);
  if (sheetUsers.getLastRow() === 0) {
    var headersUsers = ['Email', 'Nama', 'Role', 'MemberID', 'Status', 'LastLogin', 'Password'];
    formatHeaderRow_(sheetUsers, headersUsers);
    seedInitialUsers_(sheetUsers);
  }

  // 3. Sheet: RolePermissions
  var sheetRoles = getOrCreateSheet_(ss, SHEETS.ROLE_PERMISSIONS);
  if (sheetRoles.getLastRow() === 0) {
    var headersRoles = ['Role', 'MenuAccess'];
    formatHeaderRow_(sheetRoles, headersRoles);
    seedInitialRoles_(sheetRoles);
  }

  // 4. Sheet: Dues
  var sheetDues = getOrCreateSheet_(ss, SHEETS.DUES);
  if (sheetDues.getLastRow() === 0) {
    var headersDues = ['IuranID', 'MemberID', 'Periode', 'Jumlah', 'TanggalBayar', 'Status', 'Catatan', 'InputBy'];
    formatHeaderRow_(sheetDues, headersDues);
    seedInitialDues_(sheetDues);
  }

  // 5. Sheet: Articles
  var sheetArticles = getOrCreateSheet_(ss, SHEETS.ARTICLES);
  if (sheetArticles.getLastRow() === 0) {
    var headersArticles = ['ArticleID', 'Judul', 'Konten', 'Kategori', 'PenulisEmail', 'TanggalPublish', 'Status', 'Thumbnail'];
    formatHeaderRow_(sheetArticles, headersArticles);
    seedInitialArticles_(sheetArticles);
  }

  // 6. Sheet: ActivityLog
  var sheetLogs = getOrCreateSheet_(ss, SHEETS.ACTIVITY_LOG);
  if (sheetLogs.getLastRow() === 0) {
    var headersLogs = ['LogID', 'Email', 'Aksi', 'Detail', 'Timestamp'];
    formatHeaderRow_(sheetLogs, headersLogs);
  }

  logActivity_('SYSTEM', 'SETUP_SPREADSHEET', 'Database iManurung berhasil diinisialisasi');
  return { status: 'success', message: 'Database iManurung berhasil diinisialisasi lengkap dengan 6 sheets dan data silsilah!' };
}

// ============================================================================
// AUTENTIKASI & USER SESSION
// ============================================================================

/**
 * Login dengan email dan password.
 * Password disimpan plain-text di kolom Password sheet Users.
 * Return: { success, user, sessionToken, message }
 * sessionToken = token acak yang disimpan di ScriptProperties + localStorage client,
 * sehingga session bertahan saat refresh (tidak bergantung pada ActiveUserKey).
 */
function loginUser(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email dan password wajib diisi.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Auto-init jika database belum ada
  var sheetCheck = ss.getSheetByName(SHEETS.USERS);
  if (!sheetCheck || sheetCheck.getLastRow() <= 1) {
    setupSpreadsheet();
  }

  var sheetUsers = ss.getSheetByName(SHEETS.USERS);
  if (!sheetUsers) {
    return { success: false, message: 'Database belum diinisialisasi.' };
  }

  var usersData = getSheetData_(sheetUsers);
  var foundUser = null;
  for (var i = 0; i < usersData.length; i++) {
    if (String(usersData[i].Email || '').toLowerCase() === String(email).toLowerCase().trim()) {
      foundUser = usersData[i];
      break;
    }
  }

  if (!foundUser) {
    return { success: false, message: 'Email tidak terdaftar sebagai anggota.' };
  }

  if (foundUser.Status === 'NonAktif') {
    return { success: false, message: 'Akun Anda telah dinonaktifkan. Hubungi pengurus.' };
  }

  // Cek password (kolom ke-7, index Password)
  var storedPassword = String(foundUser.Password || 'manurung2025');
  if (storedPassword !== String(password).trim()) {
    return { success: false, message: 'Password salah.' };
  }

  // Simpan session: token acak (bertahan saat refresh) + legacy key (kompatibilitas)
  var sessionToken = null;
  try {
    sessionToken = 'tok_' + Utilities.getUuid().replace(/-/g, '') + '_' + new Date().getTime();
    var props = PropertiesService.getScriptProperties();
    props.setProperty('sess_' + Session.getTemporaryActiveUserKey(), foundUser.Email);
    props.setProperty('tok_' + sessionToken, foundUser.Email);
  } catch(e) {}

  // Update LastLogin
  try {
    var allRows = sheetUsers.getDataRange().getValues();
    for (var r = 1; r < allRows.length; r++) {
      if (String(allRows[r][0]).toLowerCase() === String(email).toLowerCase().trim()) {
        sheetUsers.getRange(r + 1, 6).setValue(new Date());
        break;
      }
    }
  } catch(e) {}

  logActivity_(foundUser.Email, 'LOGIN', 'Login berhasil');

  var userData = buildUserPayload_(foundUser);
  return { success: true, user: userData, sessionToken: sessionToken };
}

/**
 * Logout: hapus session (legacy key + token).
 * Terima token opsional dari client agar session token ikut terhapus.
 */
function logoutUser(sessionToken) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('sess_' + Session.getTemporaryActiveUserKey());
    if (sessionToken) {
      props.deleteProperty('tok_' + sessionToken);
    }
  } catch(e) {}
  return { success: true };
}

/**
 * Cek apakah ada session aktif (dipanggil saat pertama buka halaman / refresh).
 * Terima token opsional dari client (localStorage) — prioritas:
 * 1. token yang dikirim client, 2. legacy ActiveUserKey.
 * Return: { loggedIn, user }
 */
function checkSession(sessionToken) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Auto-init jika database belum ada
  var sheetCheck = ss.getSheetByName(SHEETS.USERS);
  if (!sheetCheck || sheetCheck.getLastRow() <= 1) {
    setupSpreadsheet();
  }

  var sessionEmail = null;
  try {
    var props = PropertiesService.getScriptProperties();
    if (sessionToken) {
      sessionEmail = props.getProperty('tok_' + sessionToken);
    }
    if (!sessionEmail) {
      sessionEmail = props.getProperty('sess_' + Session.getTemporaryActiveUserKey());
    }
  } catch(e) {}

  if (!sessionEmail) {
    return { loggedIn: false };
  }

  var sheetUsers = ss.getSheetByName(SHEETS.USERS);
  if (!sheetUsers) return { loggedIn: false };

  var usersData = getSheetData_(sheetUsers);
  var foundUser = null;
  for (var i = 0; i < usersData.length; i++) {
    if (String(usersData[i].Email || '').toLowerCase() === sessionEmail.toLowerCase()) {
      foundUser = usersData[i];
      break;
    }
  }

  if (!foundUser || foundUser.Status === 'NonAktif') {
    return { loggedIn: false };
  }

  return { loggedIn: true, user: buildUserPayload_(foundUser) };
}

/**
 * Ambil semua data app untuk user yang sudah login
 */
function loadAppData(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetUsers = ss.getSheetByName(SHEETS.USERS);
  var sheetMembers = ss.getSheetByName(SHEETS.MEMBERS);
  var sheetDues = ss.getSheetByName(SHEETS.DUES);
  var sheetArticles = ss.getSheetByName(SHEETS.ARTICLES);
  var sheetLogs = ss.getSheetByName(SHEETS.ACTIVITY_LOG);
  var sheetRoles = ss.getSheetByName(SHEETS.ROLE_PERMISSIONS);

  var usersData = sheetUsers ? getSheetData_(sheetUsers) : [];
  var foundUser = null;
  for (var i = 0; i < usersData.length; i++) {
    if (String(usersData[i].Email || '').toLowerCase() === String(email).toLowerCase()) {
      foundUser = usersData[i];
      break;
    }
  }
  if (!foundUser) return null;

  var currentUser = buildUserPayload_(foundUser);
  var members = sheetMembers ? getSheetData_(sheetMembers) : [];
  var dues = sheetDues ? getSheetData_(sheetDues) : [];
  var articles = sheetArticles ? getSheetData_(sheetArticles) : [];
  var logs = sheetLogs ? getSheetData_(sheetLogs) : [];
  var roles = sheetRoles ? getSheetData_(sheetRoles) : [];

  var isAdmin = (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');
  var isStaff = isAdmin || (currentUser.role === 'Pengurus');

  var filteredDues = isAdmin ? dues : dues.filter(function(d) {
    return d.MemberID === currentUser.memberId;
  });
  var filteredArticles = isAdmin ? articles : articles.filter(function(a) {
    return a.Status === 'Published';
  });

  // User biasa (Member): hanya lihat aktivitas miliknya sendiri.
  // Pengurus/Admin/Super Admin: lihat 20 log terakhir global.
  var visibleLogs;
  if (isStaff) {
    visibleLogs = logs.slice(-20).reverse();
  } else {
    var myLogs = logs.filter(function(l) {
      return String(l.Email || '').toLowerCase() === String(foundUser.Email || '').toLowerCase();
    });
    visibleLogs = myLogs.slice(-20).reverse();
  }

  var stats = calculateDashboardStats_(members, dues);

  return {
    currentUser: currentUser,
    stats: stats,
    members: members,
    dues: filteredDues,
    articles: filteredArticles,
    logs: visibleLogs,
    roles: roles,
    users: isAdmin ? usersData : []
  };
}

/**
 * Helper: bangun object user dari row data
 */
function buildUserPayload_(foundUser) {
  var permissions = getPermissionsForRole_(foundUser.Role);
  return {
    isRegistered: true,
    email: foundUser.Email,
    name: foundUser.Nama,
    role: foundUser.Role,
    memberId: foundUser.MemberID,
    status: foundUser.Status,
    permissions: permissions
  };
}

/**
 * Mendapatkan daftar menu yang diizinkan untuk role tertentu
 */
function getPermissionsForRole_(role) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetRoles = ss.getSheetByName(SHEETS.ROLE_PERMISSIONS);
  if (!sheetRoles) return ['dashboard', 'data-anggota', 'pohon-silsilah', 'iuran-keuangan', 'artikel-berita'];

  var rolesData = getSheetData_(sheetRoles);
  for (var i = 0; i < rolesData.length; i++) {
    if (String(rolesData[i].Role).toLowerCase() === String(role).toLowerCase()) {
      var menus = String(rolesData[i].MenuAccess || '').split(',');
      return menus.map(function(m) { return m.trim(); });
    }
  }
  return ['dashboard', 'data-anggota', 'pohon-silsilah', 'iuran-keuangan', 'artikel-berita'];
}

/**
 * Middleware: pastikan user admin sebelum operasi CRUD
 */
function requireAdmin_() {
  var sessionEmail = null;
  try {
    sessionEmail = PropertiesService.getScriptProperties().getProperty(
      'sess_' + Session.getTemporaryActiveUserKey()
    );
  } catch(e) {}

  if (!sessionEmail) {
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetUsers = ss.getSheetByName(SHEETS.USERS);
  if (!sheetUsers) throw new Error('Database tidak ditemukan.');

  var usersData = getSheetData_(sheetUsers);
  var foundUser = null;
  for (var i = 0; i < usersData.length; i++) {
    if (String(usersData[i].Email || '').toLowerCase() === sessionEmail.toLowerCase()) {
      foundUser = usersData[i];
      break;
    }
  }

  if (!foundUser) throw new Error('Pengguna tidak ditemukan.');
  if (foundUser.Role !== 'Admin' && foundUser.Role !== 'Super Admin' && foundUser.Role !== 'Pengurus') {
    throw new Error('Akses ditolak. Hanya Admin dan Pengurus yang bisa melakukan tindakan ini.');
  }

  return buildUserPayload_(foundUser);
}


// ============================================================================
// DATA AGREGASI UTAMA
// ============================================================================

/**
 * Helper kalkulasi KPI statistik
 */
function calculateDashboardStats_(members, dues) {
  var totalAnggota = members.length;
  var terverifikasi = 0;
  var pendingReview = 0;
  var rumpunHutagurgur = 0;
  var rumpunHutagaol = 0;
  var rumpunSimanoroni = 0;
  var generasiCount = {};

  for (var i = 0; i < members.length; i++) {
    var m = members[i];
    if (m.Status === 'Aktif' || m.Status === 'Terverifikasi') terverifikasi++;
    else pendingReview++;

    var rumpun = (m.Rumpun || '').toLowerCase();
    if (rumpun.indexOf('hutagurgur') !== -1) rumpunHutagurgur++;
    else if (rumpun.indexOf('hutagaol') !== -1) rumpunHutagaol++;
    else if (rumpun.indexOf('simanoroni') !== -1) rumpunSimanoroni++;

    var gen = m.Generasi || 'Lainnya';
    generasiCount[gen] = (generasiCount[gen] || 0) + 1;
  }

  var totalKas2025 = 0;
  var totalLunas = 0;
  for (var j = 0; j < dues.length; j++) {
    var d = dues[j];
    if (String(d.Periode || '').indexOf('2025') !== -1 && (d.Status === 'Lunas')) {
      totalKas2025 += Number(d.Jumlah) || 0;
      totalLunas++;
    }
  }

  return {
    totalAnggota: totalAnggota,
    terverifikasi: terverifikasi,
    pendingReview: pendingReview,
    persenVerifikasi: totalAnggota > 0 ? Math.round((terverifikasi / totalAnggota) * 100) : 0,
    totalKas2025: totalKas2025,
    kepatuhanIuranPersen: dues.length > 0 ? Math.round((totalLunas / dues.length) * 100) : 84,
    rumpun: {
      hutagurgur: rumpunHutagurgur,
      hutagaol: rumpunHutagaol,
      simanoroni: rumpunSimanoroni
    },
    generasiCount: generasiCount
  };
}

// ============================================================================
// CRUD ANGGOTA KELUARGA (MEMBERS) (FR-7, FR-8, FR-9, FR-10, NFR-5)
// ============================================================================

/**
 * Menyimpan data anggota baru atau update data yang sudah ada
 */
function saveMember(memberData) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MEMBERS);
  if (!sheet) throw new Error('Sheet Members tidak ditemukan.');

  var rows = sheet.getDataRange().getValues();
  var isEdit = false;
  var rowIndex = -1;

  // Generate ID baru jika belum ada
  if (!memberData.MemberID) {
    memberData.MemberID = 'MNR-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyy') + '-' + ('0000' + (rows.length)).slice(-5);
  }

  // Validasi anti-siklis silsilah (NFR-13)
  if (memberData.ParentID && memberData.ParentID === memberData.MemberID) {
    throw new Error('Struktur silsilah tidak valid: Orang tua tidak boleh sama dengan diri sendiri.');
  }

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(memberData.MemberID)) {
      isEdit = true;
      rowIndex = i + 1;
      break;
    }
  }

  var now = new Date();
  var rowValues = [
    memberData.MemberID,
    memberData.Nama || '',
    memberData.JenisKelamin || 'L',
    memberData.TanggalLahir || '',
    memberData.TanggalMeninggal || '',
    Number(memberData.Generasi) || 16,
    memberData.ParentID || '',
    memberData.SpouseID || '',
    memberData.Alamat || '',
    memberData.NoHP || '',
    memberData.Email || '',
    memberData.Pekerjaan || '',
    memberData.FotoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    memberData.Status || 'Aktif',
    isEdit ? rows[rowIndex - 1][14] : now,
    now,
    memberData.Rumpun || 'Hutagurgur',
    memberData.BonaPasogit || 'Bona Pasogit',
    memberData.Sektor || 'Jabodetabek Barat',
    memberData.Kategori || 'manurung'
  ];

  if (isEdit) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    logActivity_(admin.email, 'UPDATE_MEMBER', 'Memperbarui profil anggota: ' + memberData.Nama + ' (' + memberData.MemberID + ')');
  } else {
    sheet.appendRow(rowValues);
    logActivity_(admin.email, 'ADD_MEMBER', 'Menambah anggota baru: ' + memberData.Nama + ' (' + memberData.MemberID + ')');
  }

  clearCache_('family_tree');
  return { status: 'success', memberId: memberData.MemberID };
}

/**
 * Soft delete data anggota (FR-7)
 */
function deleteMember(memberId) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MEMBERS);
  if (!sheet) throw new Error('Sheet Members tidak ditemukan.');

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(memberId)) {
      sheet.getRange(i + 1, 14).setValue('NonAktif');
      logActivity_(admin.email, 'DELETE_MEMBER', 'Menonaktifkan anggota ID: ' + memberId);
      clearCache_('family_tree');
      return { status: 'success', message: 'Data anggota berhasil dinonaktifkan.' };
    }
  }
  throw new Error('Data anggota dengan ID tersebut tidak ditemukan.');
}

// ============================================================================
// FAMILY TREE / HIERARKI TAROMBO (FR-11, FR-12, FR-13, NFR-2)
// ============================================================================

/**
 * Mengambil struktur pohon silsilah lengkap (dengan Caching)
 */
function getFamilyTreeData(rootMemberId) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'family_tree_' + (rootMemberId || 'all');
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.MEMBERS);
  if (!sheet) return null;

  var members = getSheetData_(sheet).filter(function(m) {
    return m.Status !== 'NonAktif';
  });

  var result = {
    members: members,
    rootId: rootMemberId || (members.length > 0 ? members[0].MemberID : null)
  };

  try {
    cache.put(cacheKey, JSON.stringify(result), 300); // 5 menit cache
  } catch (err) {}

  return result;
}

// ============================================================================
// PENCATATAN & VERIFIKASI IURAN (FR-16, FR-17, FR-18)
// ============================================================================

/**
 * Simpan atau verifikasi iuran anggota
 */
function saveDuesRecord(duesData) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.DUES);
  if (!sheet) throw new Error('Sheet Dues tidak ditemukan.');

  if (!duesData.IuranID) {
    duesData.IuranID = 'IUR-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMM') + '-' + ('000' + Math.floor(Math.random() * 999)).slice(-3);
  }

  var rowValues = [
    duesData.IuranID,
    duesData.MemberID || '',
    duesData.Periode || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM'),
    Number(duesData.Jumlah) || 50000,
    duesData.TanggalBayar || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd'),
    duesData.Status || 'Lunas',
    duesData.Catatan || '',
    admin.email
  ];

  sheet.appendRow(rowValues);
  logActivity_(admin.email, 'ADD_DUES', 'Mencatat iuran ID ' + duesData.IuranID + ' untuk anggota ' + duesData.MemberID);
  return { status: 'success', iuranId: duesData.IuranID };
}

// ============================================================================
// MANAJEMEN ARTIKEL & WARTA ADAT (FR-19, FR-20, FR-21)
// ============================================================================

/**
 * Menyimpan artikel baru atau update artikel yang ada
 */
function saveArticle(articleData) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ARTICLES);
  if (!sheet) throw new Error('Sheet Articles tidak ditemukan.');

  var rows = sheet.getDataRange().getValues();
  var isEdit = false;
  var rowIndex = -1;

  if (!articleData.ArticleID) {
    articleData.ArticleID = 'ART-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd') + '-' + ('000' + (rows.length)).slice(-3);
  }

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(articleData.ArticleID)) {
      isEdit = true;
      rowIndex = i + 1;
      break;
    }
  }

  var now = new Date();
  var rowValues = [
    articleData.ArticleID,
    articleData.Judul || 'Tanpa Judul',
    articleData.Konten || '',
    articleData.Kategori || 'Warta Adat',
    admin.email,
    now,
    articleData.Status || 'Published',
    articleData.Thumbnail || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80'
  ];

  if (isEdit) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    logActivity_(admin.email, 'UPDATE_ARTICLE', 'Memperbarui artikel: ' + articleData.Judul);
  } else {
    sheet.appendRow(rowValues);
    logActivity_(admin.email, 'ADD_ARTICLE', 'Menerbitkan artikel baru: ' + articleData.Judul);
  }

  return { status: 'success', articleId: articleData.ArticleID };
}

/**
 * Menghapus artikel
 */
function deleteArticle(articleId) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ARTICLES);
  if (!sheet) throw new Error('Sheet Articles tidak ditemukan.');

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(articleId)) {
      sheet.deleteRow(i + 1);
      logActivity_(admin.email, 'DELETE_ARTICLE', 'Menghapus artikel ID: ' + articleId);
      return { status: 'success', message: 'Artikel berhasil dihapus.' };
    }
  }
  throw new Error('Artikel tidak ditemukan.');
}

// ============================================================================
// ROLE MANAGEMENT & PERMISSIONS (FR-14, FR-15)
// ============================================================================

/**
 * Mengubah role pengguna
 */
function updateUserRole(targetEmail, newRole) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) throw new Error('Sheet Users tidak ditemukan.');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(targetEmail).toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(newRole);
      logActivity_(admin.email, 'UPDATE_ROLE', 'Mengubah role ' + targetEmail + ' menjadi ' + newRole);
      return { status: 'success' };
    }
  }
  throw new Error('Pengguna tidak ditemukan.');
}

/**
 * Update info pengguna (Nama, Status, MemberID) — hanya Admin/Super Admin.
 * Password TIDAK bisa diubah lewat fungsi ini.
 */
function updateUserInfo(targetEmail, infoData) {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) throw new Error('Sheet Users tidak ditemukan.');

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(targetEmail).toLowerCase()) {
      if (infoData.Nama !== undefined) sheet.getRange(i + 1, 2).setValue(infoData.Nama);
      if (infoData.MemberID !== undefined) sheet.getRange(i + 1, 4).setValue(infoData.MemberID);
      if (infoData.Status !== undefined) sheet.getRange(i + 1, 5).setValue(infoData.Status);
      logActivity_(admin.email, 'UPDATE_USER', 'Memperbarui info pengguna ' + targetEmail);
      return { status: 'success' };
    }
  }
  throw new Error('Pengguna tidak ditemukan.');
}

/**
 * Reset password pengguna — hanya Admin/Super Admin.
 */
function resetUserPassword(targetEmail, newPassword) {
  var admin = requireAdmin_();
  if (!newPassword || String(newPassword).length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) throw new Error('Sheet Users tidak ditemukan.');

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(targetEmail).toLowerCase()) {
      sheet.getRange(i + 1, 7).setValue(String(newPassword));
      logActivity_(admin.email, 'RESET_PASSWORD', 'Mereset password pengguna ' + targetEmail);
      return { status: 'success' };
    }
  }
  throw new Error('Pengguna tidak ditemukan.');
}

/**
 * Ambil riwayat login (aksi LOGIN) — hanya Admin/Super Admin.
 * Return: array log terbaru, max 100.
 */
function getLoginLogs() {
  var admin = requireAdmin_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ACTIVITY_LOG);
  if (!sheet) return [];
  var logs = getSheetData_(sheet);
  var result = [];
  for (var i = logs.length - 1; i >= 0 && result.length < 100; i--) {
    if (String(logs[i].Aksi || '').toUpperCase() === 'LOGIN') {
      result.push(logs[i]);
    }
  }
  return result;
}

// ============================================================================
// HELPER FUNCTIONS & SEEDING SILSILAH BATAK (PATAMBOR)
// ============================================================================

function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatHeaderRow_(sheet, headers) {
  sheet.appendRow(headers);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight('bold');
  range.setBackground('#0E243A');
  range.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
}

function getSheetData_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'GMT+7', 'yyyy-MM-dd HH:mm:ss');
      }
      obj[headers[j]] = val;
    }
    result.push(obj);
  }
  return result;
}

function logActivity_(email, aksi, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.ACTIVITY_LOG);
    if (sheet) {
      var logId = 'LOG-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 100);
      sheet.appendRow([logId, email, aksi, detail, new Date()]);
    }
  } catch (err) {}
}

function clearCache_(prefix) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(prefix);
  } catch (e) {}
}

/**
 * Seeding Data Silsilah Marga Manurung: Ompu Silau Raja & 3 Rumpun
 */
function seedInitialMembers_(sheet) {
  var now = new Date();
  var sampleMembers = [
    // Generasi 1: Leluhur Utama
    ['MNR-ROOT-001', 'Ompu Silau Raja', 'L', '1350-01-01', '1420-01-01', 1, '', '', 'Bona Pasogit Sibisa', '', '', 'Tokoh Marga Leluhur', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Silau Raja', 'Sibisa', 'Bona Pasogit', 'manurung'],
    
    // Generasi 2: 3 Rumpun Utama Manurung
    ['MNR-RUMPUN-01', 'Raja Palti (Hutagurgur)', 'L', '1380-01-01', '1450-01-01', 2, 'MNR-ROOT-001', '', 'Sibisa, Toba', '', '', 'Raja Manurung 1', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagurgur', 'Sibisa', 'Bona Pasogit', 'manurung'],
    ['MNR-RUMPUN-02', 'Tuan Sori (Hutagaol)', 'L', '1382-01-01', '1455-01-01', 2, 'MNR-ROOT-001', '', 'Porsea, Toba', '', '', 'Raja Manurung 2', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagaol', 'Porsea', 'Bona Pasogit', 'manurung'],
    ['MNR-RUMPUN-03', 'Raja Mual (Simanoroni)', 'L', '1385-01-01', '1460-01-01', 2, 'MNR-ROOT-001', '', 'Ajibata, Toba', '', '', 'Raja Manurung 3', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Simanoroni', 'Ajibata', 'Bona Pasogit', 'manurung'],

    // Garis Hutagurgur Menuju Ricardo Manurung (Sundut 14, 15, 16, 17)
    ['MNR-G14-001', 'Ompu Tahan Manurung', 'L', '1910-03-12', '1985-08-19', 14, 'MNR-RUMPUN-01', 'Nai Tahan br. Sitorus', 'Bona Pasogit Sibisa', '08112233445', '', 'Petani & Tokoh Adat', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagurgur', 'Sibisa', 'Bona Pasogit', 'manurung'],
    ['MNR-G15-001', 'St. Marulam Manurung', 'L', '1941-06-20', '2018-11-04', 15, 'MNR-G14-001', 'Dra. Tioria br. Sitorus', 'Sibisa / Jakarta Barat', '08123456789', 'marulam.m@gmail.com', 'Pensiunan Guru & Sintua', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagurgur', 'Sibisa', 'Jabodetabek Barat', 'manurung'],
    ['MNR-2022-00012', 'St. Ricardo Manurung, M.Si', 'L', '1973-04-15', '', 16, 'MNR-G15-001', 'Tiurma br. Simanjuntak', 'Jl. Kebon Jeruk No. 45, Jakarta Barat', '081299998888', 'ricardo.manurung@gmail.com', 'Dosen & Admin DPP', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagurgur', 'Sibisa, Kec. Ajibata', 'Jabodetabek Barat', 'manurung'],
    ['MNR-2024-00101', 'Drs. Togar Manurung', 'L', '1975-09-10', '', 16, 'MNR-G15-001', 'Erna br. Panjaitan', 'Tangerang Kota', '081388776655', 'togar@imanurung.or.id', 'Wiraswasta', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagurgur', 'Sibisa', 'Jabodetabek Barat', 'manurung'],
    ['MNR-2024-00102', 'Yohanes Manurung, S.Kom', 'L', '2001-02-14', '', 17, 'MNR-2022-00012', '', 'Jakarta Barat', '085711223344', 'yohanes.m@gmail.com', 'Software Engineer', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagurgur', 'Sibisa', 'Jabodetabek Barat', 'manurung'],

    // Garis Hutagaol
    ['MNR-2024-01844', 'Kapten (Laut) Edward Manurung', 'L', '1978-08-17', '', 16, 'MNR-RUMPUN-02', 'Ria br. Nababan', 'Krembangan, Surabaya', '081277665544', 'edward.m@tni-al.mil.id', 'Perwira TNI AL', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagaol', 'Porsea', 'Surabaya & Jatim', 'manurung'],
    ['MNR-2024-03102', 'Bona Ventura Manurung', 'L', '1998-11-20', '', 17, 'MNR-2024-01844', '', 'Porsea, Kab. Toba', '082144556677', 'bonaventura@gmail.com', 'Mahasiswa', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Hutagaol', 'Porsea', 'Toba & Bona Pasogit', 'manurung'],

    // Garis Simanoroni
    ['MNR-2024-02319', 'dr. Grace Yohana br. Manurung, Sp.A', 'P', '1985-05-12', '', 17, 'MNR-RUMPUN-03', 'dr. Antonius Hutabarat, Sp.PD', 'Medan Baru, Kota Medan', '08119988776', 'grace.yohana@rsu.co.id', 'Dokter Spesialis Anak', 'https://images.unsplash.com/photo-1594824813627-24831804f3ae?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Simanoroni', 'Ajibata', 'Medan & Deli', 'boru'],
    ['MNR-2021-00450', 'Drs. Poltak Manurung', 'L', '1962-12-05', '', 15, 'MNR-RUMPUN-03', 'Murni br. Sinaga', 'Rawamangun, Jakarta Timur', '081355443322', 'poltak.m@gmail.com', 'Pensiunan BUMN', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80', 'Aktif', now, now, 'Simanoroni', 'Ajibata', 'Jabodetabek Timur', 'manurung']
  ];

  sheet.getRange(2, 1, sampleMembers.length, sampleMembers[0].length).setValues(sampleMembers);
}

function seedInitialUsers_(sheet) {
  var now = new Date();
  // Kolom: Email | Nama | Role | MemberID | Status | LastLogin | Password
  var sampleUsers = [
    ['ricardo.manurung@gmail.com', 'St. Ricardo Manurung, M.Si', 'Admin',       'MNR-2022-00012',  'Aktif', now, 'manurung2025'],
    ['admin@imanurung.or.id',      'Sekretariat DPP Patambor',   'Super Admin', 'MNR-ROOT-001',    'Aktif', now, 'admin2025'],
    ['edward.m@tni-al.mil.id',     'Kapten Edward Manurung',     'Pengurus',    'MNR-2024-01844',  'Aktif', now, 'manurung2025'],
    ['grace.yohana@rsu.co.id',     'dr. Grace Yohana Manurung',  'Member',      'MNR-2024-02319',  'Aktif', now, 'manurung2025'],
    ['warga@imanurung.or.id',      'Warga Marga Terdaftar',      'Member',      'MNR-2024-00102',  'Aktif', now, 'manurung2025']
  ];
  sheet.getRange(2, 1, sampleUsers.length, sampleUsers[0].length).setValues(sampleUsers);
}

function seedInitialRoles_(sheet) {
  var sampleRoles = [
    ['Super Admin', 'dashboard,data-anggota,pohon-silsilah,iuran-keuangan,artikel-berita,role-management,pengaturan'],
    ['Admin', 'dashboard,data-anggota,pohon-silsilah,iuran-keuangan,artikel-berita,role-management'],
    ['Pengurus', 'dashboard,data-anggota,pohon-silsilah,iuran-keuangan,artikel-berita'],
    ['Member', 'dashboard,data-anggota,pohon-silsilah,iuran-keuangan,artikel-berita']
  ];
  sheet.getRange(2, 1, sampleRoles.length, sampleRoles[0].length).setValues(sampleRoles);
}

function seedInitialDues_(sheet) {
  var sampleDues = [
    ['IUR-202501-001', 'MNR-2022-00012', '2025-01', 100000, '2025-01-05', 'Lunas', 'Iuran Wajib Tahunan 2025 & Kas Kasih', 'admin@imanurung.or.id'],
    ['IUR-202501-002', 'MNR-2024-01844', '2025-01', 50000, '2025-01-10', 'Lunas', 'Iuran Rutin Semester 1', 'admin@imanurung.or.id'],
    ['IUR-202501-003', 'MNR-2024-02319', '2025-01', 150000, '2025-01-15', 'Lunas', 'Iuran Tahunan & Donasi Sosial Duka', 'admin@imanurung.or.id'],
    ['IUR-202502-001', 'MNR-2024-00101', '2025-02', 50000, '2025-02-03', 'Lunas', 'Iuran Kas Sektor Barat', 'ricardo.manurung@gmail.com'],
    ['IUR-202502-002', 'MNR-2024-00102', '2025-02', 25000, '', 'BelumLunas', 'Iuran Pemuda Naposobulung', 'admin@imanurung.or.id']
  ];
  sheet.getRange(2, 1, sampleDues.length, sampleDues[0].length).setValues(sampleDues);
}

function seedInitialArticles_(sheet) {
  var now = new Date();
  var sampleArticles = [
    [
      'ART-20250101-001',
      'Warta Partangiangan Bona Taon 2025 Marga Manurung Se-Indonesia',
      'Punguan Pomparan Ompu Silau Raja (Patambor) Indonesia mengundang seluruh dongan tubu, boru, bere, dan ibebere untuk menghadiri Ibadah Syukur Bona Taon 2025 yang akan diselenggarakan secara serentak di 8 Sektor Wilayah.',
      'Warta Adat',
      'ricardo.manurung@gmail.com',
      now,
      'Published',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80'
    ],
    [
      'ART-20250105-002',
      'Penelusuran Silsilah Tarombo: Mengenal 3 Rumpun Utama Marga Manurung',
      'Marga Manurung berasal dari Ompu Silau Raja yang memiliki tiga anak utama: Raja Palti (Hutagurgur), Tuan Sori (Hutagaol), dan Raja Mual (Simanoroni). Dokumentasi digital ini dibuat demi menjaga kemurnian silsilah antargenerasi.',
      'Sejarah & Tarombo',
      'admin@imanurung.or.id',
      now,
      'Published',
      'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80'
    ],
    [
      'ART-20250110-003',
      'Laporan Pertanggungjawaban Kas Iuran dan Dana Abadi Patambor 2024',
      'Audit kas tahun 2024 telah rampung dengan status Wajar Tanpa Pengecualian (WTP). Saldo kas gotong royong terhimpun Rp 348.650.000 dialokasikan untuk santunan duka dan beasiswa anak berprestasi.',
      'Pengumuman Resmi',
      'ricardo.manurung@gmail.com',
      now,
      'Published',
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'
    ]
  ];
  sheet.getRange(2, 1, sampleArticles.length, sampleArticles[0].length).setValues(sampleArticles);
}
