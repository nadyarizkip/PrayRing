// Nama cache. Ganti nama ini jika Anda membuat perubahan besar pada file-file aplikasi.
const CACHE_NAME = 'prayring-cache-v3';

// Daftar file inti yang perlu disimpan untuk mode offline.
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css',
  'prayring.png',
  'prayring.png'
  // Jika Anda punya file adhan.mp3, tambahkan juga di sini: 'adhan.mp3'
];

// Event 'install': Dijalankan saat service worker pertama kali di-install.
self.addEventListener('install', (event) => {
  // Tunggu sampai proses caching selesai.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache dibuka. Menambahkan file inti ke cache...');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Event 'fetch': Dijalankan setiap kali ada permintaan resource (misal: buka halaman, ambil gambar).
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Coba cari resource di cache terlebih dahulu.
    caches.match(event.request)
      .then((response) => {
        // Jika resource ditemukan di cache, kembalikan dari cache.
        if (response) {
          return response;
        }
        // Jika tidak ada di cache, coba ambil dari jaringan (internet).
        return fetch(event.request);
      })
  );
});
