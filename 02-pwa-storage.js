// 1. Pasang Web App Manifest secara dinamis dengan logo lokal & konfigurasi Native PWA
const logoUrl = new URL("./logo.png", window.location.href).href;

const manifestData = {
  name: "Scan Barcode ke QR Code",
  short_name: "Scan2QR",
  description: "Scan barcode 1D/2D, rekap ke Excel (.xlsx), dan ubah teks/foto menjadi QR Code",
  start_url: "./",
  scope: "./",
  display: "standalone",
  display_override: ["standalone", "window-controls-overlay"],
  orientation: "portrait",
  background_color: "#f1f5f9",
  theme_color: "#0f62fe",
  categories: ["utilities", "productivity"],
  icons: [
    {
      src: logoUrl,
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ]
};

const manifestBlob = new Blob([JSON.stringify(manifestData)], {
  type: "application/manifest+json"
});
document.getElementById("pwa-manifest").href = URL.createObjectURL(manifestBlob);

// 2. Tangkap event instalasi PWA (Android / Chrome / Edge)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "inline-block";
});

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = "none";
}

window.addEventListener("appinstalled", () => {
  installBtn.style.display = "none";
});

// 3. Registrasi Service Worker dengan cache aset lokal & CDN utama (Native Offline Ready)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const cacheName = "scan2qr-native-v2";
    const swCode = `
      const CACHE_NAME = "${cacheName}";
      const PRECACHE_URLS = [
        "./",
        "./index.html",
        "./logo.png",
        "./01-base-header.css",
        "./02-home-menu.css",
        "./03-excel-hub-form.css",
        "./04-scanner-camera.css",
        "./05-photo-lens-ocr.css",
        "./06-scanner-controls.css",
        "./07-notes-excel-session.css",
        "./08-sheets-modals.css",
        "./01-core-state.js",
        "./02-pwa-storage.js",
        "./03-navigation-menu.js",
        "./04-excel-tasks-hub.js",
        "./06-photo-lens-ocr.js",
        "./07-qr-notes.js",
        "./08-excel-session-export.js",
        "./09-scan-sheet-qr-modal.js",
        "./10-camera-scanner.js"
      ];

      self.addEventListener("install", (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
        );
        self.skipWaiting();
      });

      self.addEventListener("activate", (event) => {
        event.waitUntil(
          caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
          )
        );
        self.clients.claim();
      });

      self.addEventListener("fetch", (event) => {
        if (event.request.method !== "GET") return;
        event.respondWith(
          caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request)
              .then((response) => {
                if (response && response.status === 200 && response.type !== "opaque") {
                  const clone = response.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
                }
                return response;
              })
              .catch(() => cached);
            return cached || networkFetch;
          })
        );
      });
    `;
    const swBlob = new Blob([swCode], { type: "application/javascript" });
    const swUrl = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}

// 3B. Screen Wake Lock agar layar ponsel tetap menyala saat mode pemindaian aktif
async function requestScreenWakeLock() {
  try {
    if (!("wakeLock" in navigator) || typeof navigator.wakeLock.request !== "function") return;
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    if (wakeLockSentinel && typeof wakeLockSentinel.addEventListener === "function") {
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    }
  } catch (err) {
    wakeLockSentinel = null;
  }
}

async function releaseScreenWakeLock() {
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      await wakeLockSentinel.release();
    }
  } catch (err) {}
  wakeLockSentinel = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && activeAppFeature !== "menu") {
    requestScreenWakeLock();
  } else if (document.visibilityState === "hidden") {
    releaseScreenWakeLock();
  }
});

// 4. Penyimpanan Task Scan to Excel di LocalStorage
function loadExcelTasksFromStorage() {
  try {
    const raw = localStorage.getItem(EXCEL_TASKS_STORAGE_KEY);
    if (!raw) {
      excelTasks = [];
      return;
    }
    const parsed = JSON.parse(raw);
    excelTasks = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    excelTasks = [];
  }
}

function saveExcelTasksToStorage() {
  try {
    localStorage.setItem(EXCEL_TASKS_STORAGE_KEY, JSON.stringify(excelTasks));
  } catch (err) {}
}

function getActiveExcelTask() {
  if (!activeExcelTaskId) return null;
  return excelTasks.find((t) => t.id === activeExcelTaskId) || null;
}

loadExcelTasksFromStorage();
