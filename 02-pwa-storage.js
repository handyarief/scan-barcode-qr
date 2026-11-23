// 1. Pasang Web App Manifest secara dinamis dengan logo lokal
const logoUrl = new URL("./logo.png", window.location.href).href;

const manifestData = {
  name: "Scan Barcode ke QR Code",
  short_name: "Scan2QR",
  description: "Scan barcode 1D/2D dan otomatis tampilkan QR Code",
  start_url: "./",
  scope: "./",
  display: "standalone",
  background_color: "#f4f6f9",
  theme_color: "#0f62fe",
  icons: [
    {
      src: logoUrl,
      sizes: "512x512",
      type: "image/png",
      "purpose": "any maskable"
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

// 3. Registrasi Service Worker ringan
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swCode = `
      self.addEventListener("install", () => self.skipWaiting());
      self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
      self.addEventListener("fetch", (event) => {
        event.respondWith(
          fetch(event.request).catch(() => caches.match(event.request))
        );
      });
    `;
    const swBlob = new Blob([swCode], { type: "application/javascript" });
    const swUrl = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}

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
