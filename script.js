// --- Elemen DOM ---
const dom = {
    currentTime: document.getElementById('currentTime'),
    currentDate: document.getElementById('currentDate'),
    hijriDate: document.getElementById('hijriDate'),
    locationDisplay: document.getElementById('locationDisplay'),
    nextPrayerName: document.getElementById('nextPrayerName'),
    nextPrayerCountdown: document.getElementById('nextPrayerCountdown'),
    prayerTimesContainer: document.getElementById('prayerTimes'),
    status: document.getElementById('status'),
    notification: document.getElementById('notification'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    gamificationStats: document.getElementById('gamificationStats'),
    predicateDisplay: document.getElementById('predicateDisplay'), // DIUBAH

    // Tombol
    refreshBtn: document.getElementById('refreshBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    notifBtn: document.getElementById('notifBtn'),
    detectLocationBtn: document.getElementById('detectLocationBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    saveCheckinBtn: document.getElementById('saveCheckinBtn'),

    // Modal Pengaturan
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    citySelect: document.getElementById('citySelect'),
    methodSelect: document.getElementById('methodSelect'),
    darkModeToggle: document.getElementById('darkModeToggle'),

    // Modal Check-in
    checkinModal: document.getElementById('checkinModal'),
    closeCheckinModal: document.getElementById('closeCheckinModal'),
    checkinPrayerName: document.getElementById('checkinPrayerName'),
    tepatWaktuToggle: document.getElementById('tepatWaktuToggle'),
    berjamaahToggle: document.getElementById('berjamaahToggle'),
    prayerNote: document.getElementById('prayerNote'),
};


// --- State & Konfigurasi Aplikasi ---
let state = {
    prayerTimes: {},
    notificationsEnabled: false,
    lastNotifiedPrayer: null,
    prayerToLog: '',
    settings: {
        city: 'Yogyakarta',
        country: 'Indonesia',
        method: '11',
        latitude: null,
        longitude: null,
        isAutoDetect: false,
        darkMode: false
    }
};

const config = {
    prayerNames: { 'Fajr': 'Subuh', 'Dhuhr': 'Dzuhur', 'Asr': 'Ashar', 'Maghrib': 'Maghrib', 'Isha': 'Isya', 'Sunrise': 'Terbit' },
    prayerIcons: {
        'Fajr': 'bx bxs-sun',
        'Sunrise': 'bx bx-sun',
        'Dhuhr': 'bx bxs-hot',
        'Asr': 'bx bxs-cloud',
        'Maghrib': 'bx bxs-moon',
        'Isha': 'bx bxs-star'
    },
    cities: ['Banda Aceh', 'Bandung', 'Banjarmasin', 'Denpasar', 'Gorontalo', 'Jakarta', 'Jambi', 'Jayapura', 'Makassar', 'Mataram', 'Medan', 'Padang', 'Palembang', 'Pekanbaru', 'Pontianak', 'Samarinda', 'Semarang', 'Surabaya', 'Yogyakarta'],
    methods: { '11': 'Kemenag RI', '20': 'ISNA (Amerika Utara)', '3': 'Muslim World League', '4': 'Umm Al-Qura, Makkah' }
};

// --- Inisialisasi & Event Listeners ---
function initializeApp() {
    populateSelectOptions();
    loadSettings();
    addEventListeners();
    
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    setInterval(updateJurnalUI, 60000);
    updatePredicateDisplay(); // DIUBAH: Memuat predikat saat aplikasi dimulai

    getPrayerTimes();
}

function addEventListeners() {
    dom.settingsBtn.addEventListener('click', () => dom.settingsModal.style.display = 'block');
    dom.closeSettingsModal.addEventListener('click', () => dom.settingsModal.style.display = 'none');
    
    dom.closeCheckinModal.addEventListener('click', () => dom.checkinModal.style.display = 'none');
    dom.saveCheckinBtn.addEventListener('click', saveCheckin);
    
    window.addEventListener('click', (e) => {
        if (e.target == dom.settingsModal) dom.settingsModal.style.display = 'none';
        if (e.target == dom.checkinModal) dom.checkinModal.style.display = 'none';
    });

    dom.saveSettingsBtn.addEventListener('click', () => saveAndApplySettings(true));
    dom.refreshBtn.addEventListener('click', () => getPrayerTimes(true));
    dom.notifBtn.addEventListener('click', toggleNotifications);
    dom.darkModeToggle.addEventListener('change', toggleDarkMode);
    dom.detectLocationBtn.addEventListener('click', detectLocation);
}


// --- Logika Inti & Pengambilan Data ---
async function getPrayerTimes(forceRefresh = false) {
    showLoading();
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `prayerData-${state.settings.city || 'auto'}-${state.settings.method}-${today}`;
    
    try {
        const cachedData = JSON.parse(localStorage.getItem(cacheKey));
        if (cachedData && !forceRefresh) {
            updateStatus('Jadwal dimuat dari cache');
            processPrayerData(cachedData);
        } else {
            updateStatus('Mengambil jadwal dari server...');
            let apiUrl;
            if (state.settings.isAutoDetect && state.settings.latitude) {
                apiUrl = `https://api.aladhan.com/v1/timings/${today}?latitude=${state.settings.latitude}&longitude=${state.settings.longitude}&method=${state.settings.method}`;
            } else {
                apiUrl = `https://api.aladhan.com/v1/timingsByCity/${today}?city=${state.settings.city}&country=${state.settings.country}&method=${state.settings.method}`;
            }
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.code === 200) {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                processPrayerData(data);
                updateStatus('Jadwal berhasil dimuat');
            } else {
                throw new Error('API response not successful');
            }
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        updateStatus('Gagal memuat jadwal. Cek koneksi internet.');
        dom.prayerTimesContainer.innerHTML = '<p style="text-align:center;">Tidak dapat memuat jadwal.</p>';
    } finally {
        hideLoading();
    }
}


function processPrayerData(data) {
    state.prayerTimes = data.data.timings;
    displayPrayerTimes();
    updateHijriDate(data.data.date.hijri);
    updateJurnalUI();
}

function displayPrayerTimes() {
    dom.prayerTimesContainer.innerHTML = '';
    const prayersToShow = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Sunrise'];
    
    prayersToShow.forEach(prayer => {
        const time = state.prayerTimes[prayer];
        if (!time) return;

        const card = document.createElement('div');
        card.className = 'prayer-card';
        card.id = `prayer-${prayer}`;
        card.innerHTML = `
            <i class='prayer-icon ${config.prayerIcons[prayer]}'></i>
            <div class="prayer-name">${config.prayerNames[prayer]}</div>
            <div class="prayer-time">${time.substring(0, 5)}</div>
            <div class="checkin-container" id="checkin-${prayer}"></div>
        `;
        dom.prayerTimesContainer.appendChild(card);
    });
}


// --- Fungsi Waktu & Countdown ---
function updateCurrentTime() {
    const now = new Date();
    dom.currentTime.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    dom.currentDate.textContent = now.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    updateNextPrayerCountdown();
}

function updateNextPrayerCountdown() {
    if (Object.keys(state.prayerTimes).length === 0) return;

    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    let nextPrayerName = null;
    let nextPrayerTimeInMinutes = Infinity;
    let currentActivePrayer = null;
    const prayerOrder = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const prayer of prayerOrder) {
        const [h, m] = state.prayerTimes[prayer].split(':');
        const prayerTime = parseInt(h) * 60 + parseInt(m);
        if (prayerTime > currentTimeInMinutes && prayerTime < nextPrayerTimeInMinutes) {
            nextPrayerTimeInMinutes = prayerTime;
            nextPrayerName = prayer;
        }
        if (Math.abs(currentTimeInMinutes - prayerTime) <= 1) {
            currentActivePrayer = prayer;
        }
    }

    if (!nextPrayerName) {
        nextPrayerName = 'Fajr';
        const [h, m] = state.prayerTimes['Fajr'].split(':');
        nextPrayerTimeInMinutes = parseInt(h) * 60 + parseInt(m) + (24 * 60);
    }

    const diff = nextPrayerTimeInMinutes - currentTimeInMinutes;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    
    dom.nextPrayerName.textContent = config.prayerNames[nextPrayerName];
    dom.nextPrayerCountdown.textContent = `${hours} jam ${minutes} menit`;

    document.querySelectorAll('.prayer-card.active').forEach(c => c.classList.remove('active'));
    if (currentActivePrayer) {
        const activeCard = document.getElementById(`prayer-${currentActivePrayer}`);
        if (activeCard) activeCard.classList.add('active');
        checkAndSendNotification(currentActivePrayer);
    }
}

function updateHijriDate(hijri) {
    dom.hijriDate.textContent = `${hijri.day} ${hijri.month.en} ${hijri.year} H`;
}


// --- Fungsi Notifikasi ---
function checkAndSendNotification(prayer) {
    if (!state.notificationsEnabled) return;
    const now = new Date();
    const currentMinute = `${now.getHours()}:${now.getMinutes()}`;
    if (state.lastNotifiedPrayer !== `${prayer}-${currentMinute}`) {
        showNotification(prayer);
        state.lastNotifiedPrayer = `${prayer}-${currentMinute}`;
    }
}

function showNotification(prayer) {
    const prayerName = config.prayerNames[prayer];
    const body = `Saatnya melaksanakan shalat ${prayerName}`;
    const icon = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🕌</text></svg>';
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Waktu ${prayerName}`, { body, icon });
    }
    dom.notification.innerHTML = `<i class='bx bxs-bell-ring'></i> <div><strong>Waktu ${prayerName}</strong><br>${body}</div>`;
    dom.notification.classList.add('show');
    setTimeout(() => dom.notification.classList.remove('show'), 5000);
    playNotificationSound();
}

function playNotificationSound() {
    try {
        const audio = new Audio('adhan.mp3');
        audio.play().catch(e => console.error('Gagal memutar suara:', e));
    } catch (e) { console.error('Audio tidak didukung:', e); }
}

// --- Logika Jurnal Ibadah & Predikat ---
function openCheckinModal(prayerName) {
    state.prayerToLog = prayerName;
    dom.checkinPrayerName.innerHTML = `<i class='bx bx-edit'></i> Catat Shalat ${config.prayerNames[prayerName]}`;
    dom.tepatWaktuToggle.checked = false;
    dom.berjamaahToggle.checked = false;
    dom.prayerNote.value = '';
    dom.checkinModal.style.display = 'block';
}

function saveCheckin() {
    const todayStr = new Date().toISOString().split('T')[0];
    const jurnal = JSON.parse(localStorage.getItem('jurnalIbadah')) || {};
    if (!jurnal[todayStr]) jurnal[todayStr] = {};
    
    const note = dom.prayerNote.value.trim();
    
    jurnal[todayStr][state.prayerToLog] = {
        dilaksanakan: true,
        tepatWaktu: dom.tepatWaktuToggle.checked,
        berjamaah: dom.berjamaahToggle.checked,
        catatan: note
    };
    
    localStorage.setItem('jurnalIbadah', JSON.stringify(jurnal));
    dom.checkinModal.style.display = 'none';
    
    updateJurnalUI();
    updatePredicateDisplay(); // DIUBAH: Panggil fungsi update predikat
}

function updateJurnalUI() {
    if (Object.keys(state.prayerTimes).length === 0) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const jurnal = JSON.parse(localStorage.getItem('jurnalIbadah')) || {};
    const jurnalHariIni = jurnal[todayStr] || {};

    for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
        const container = document.getElementById(`checkin-${prayer}`);
        if (!container) continue;
        
        const [h, m] = state.prayerTimes[prayer].split(':');
        const prayerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        
        if (now > prayerTime) {
            if (jurnalHariIni[prayer]?.dilaksanakan) {
                container.innerHTML = '<span class="checked-in"><i class="bx bx-check-double"></i>Tercatat</span>';
            } else {
                container.innerHTML = `<button class="btn-checkin" onclick="openCheckinModal('${prayer}')">Catat</button>`;
            }
        } else {
            container.innerHTML = '';
        }
    }
}

// DIUBAH: Fungsi untuk menghitung dan menampilkan Predikat
function updatePredicateDisplay() {
    const jurnal = JSON.parse(localStorage.getItem('jurnalIbadah')) || {};
    let totalPrayersLogged = 0;

    // Hitung total shalat yang tercatat
    for (const date in jurnal) {
        totalPrayersLogged += Object.keys(jurnal[date]).length;
    }

    let predicate = 'Hamba Pembelajar'; // Default
    if (totalPrayersLogged > 300) {
        predicate = 'Hamba Mabrur';
    } else if (totalPrayersLogged > 150) {
        predicate = 'Ahli Ibadah';
    } else if (totalPrayersLogged > 50) {
        predicate = 'Pejuang Istiqomah';
    } else if (totalPrayersLogged > 10) {
        predicate = 'Insan Bertaqwa';
    }

    dom.predicateDisplay.textContent = predicate; // Tampilkan predikat di UI
}


// --- Pengaturan & Fungsi Bantuan ---
function populateSelectOptions() {
    config.cities.forEach(city => dom.citySelect.add(new Option(city, city)));
    for (const [key, value] of Object.entries(config.methods)) {
        dom.methodSelect.add(new Option(value, key));
    }
}

function saveAndApplySettings(isManualSave = false) {
    // Jika penyimpanan ini berasal dari tombol "Simpan" manual
    if (isManualSave) {
        state.settings.isAutoDetect = false; // Nonaktifkan mode otomatis
        state.settings.city = dom.citySelect.value; // Ambil kota dari dropdown
    }
    
    // Selalu perbarui metode perhitungan
    state.settings.method = dom.methodSelect.value;
    
    // Lanjutkan proses penyimpanan dan pembaruan seperti biasa
    localStorage.setItem('prayerSettings', JSON.stringify(state.settings));
    dom.settingsModal.style.display = 'none';
    updateLocationDisplay();
    getPrayerTimes(true);
}

function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('prayerSettings'));
    if (savedSettings) {
        state.settings = { ...state.settings, ...savedSettings };
    }
    applySettings();
}


function applySettings() {
    dom.citySelect.value = state.settings.city;
    dom.methodSelect.value = state.settings.method;
    if (state.settings.darkMode) {
        document.body.classList.add('dark-mode');
        dom.darkModeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        dom.darkModeToggle.checked = false;
    }
    if (Notification.permission === 'granted' && state.notificationsEnabled) {
        dom.notifBtn.textContent = 'Nonaktifkan Notifikasi';
        dom.notifBtn.classList.add('active');
    } else {
        dom.notifBtn.textContent = 'Aktifkan Notifikasi';
        dom.notifBtn.classList.remove('active');
    }
    updateLocationDisplay();
}


function updateLocationDisplay() {
    dom.locationDisplay.textContent = state.settings.isAutoDetect ? 'Lokasi Saat Ini (Otomatis)' : state.settings.city;
}

async function toggleNotifications() {
    if (!('Notification' in window)) return alert('Browser Anda tidak mendukung notifikasi.');

    if (Notification.permission === 'granted') {
        state.notificationsEnabled = !state.notificationsEnabled;
        updateStatus(state.notificationsEnabled ? 'Notifikasi diaktifkan.' : 'Notifikasi dinonaktifkan.');
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            state.notificationsEnabled = true;
            updateStatus('Notifikasi berhasil diaktifkan.');
        } else {
            alert('Izin notifikasi tidak diberikan.');
        }
    } else {
        alert('Notifikasi diblokir. Harap aktifkan dari pengaturan browser Anda.');
    }
    applySettings();
}


function toggleDarkMode() {
    state.settings.darkMode = dom.darkModeToggle.checked;
    localStorage.setItem('prayerSettings', JSON.stringify(state.settings));
    applySettings();
}

function detectLocation() {
    if (!navigator.geolocation) return alert("Geolocation tidak didukung oleh browser ini.");
    showLoading();
    updateStatus("Mendeteksi lokasi Anda...");
    navigator.geolocation.getCurrentPosition(
        position => {
            state.settings.latitude = position.coords.latitude;
            state.settings.longitude = position.coords.longitude;
            state.settings.isAutoDetect = true;
            dom.settingsModal.style.display = 'none';
            saveAndApplySettings(false);
        },
        () => {
            hideLoading();
            alert("Tidak dapat mengambil lokasi. Pastikan Anda telah memberikan izin akses lokasi pada browser.");
            updateStatus("Deteksi lokasi gagal.");
        }
    );
}

function showLoading() { dom.loadingOverlay.classList.add('show'); }
function hideLoading() { dom.loadingOverlay.classList.remove('show'); }
function updateStatus(message) { dom.status.textContent = message; }

// --- Inisialisasi Aplikasi ---
document.addEventListener('DOMContentLoaded', initializeApp);