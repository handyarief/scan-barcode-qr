// 7B. Fitur Notes Hasil Scan dengan Checklist (Menu 1D to QR)
function showQrNotesFeedback(msg, isWarning = false) {
  if (!qrNotesFeedback) return;
  qrNotesFeedback.textContent = msg;
  qrNotesFeedback.classList.toggle("warn", Boolean(isWarning));
  qrNotesFeedback.classList.add("visible");
  if (qrNotesFeedbackTimer) {
    clearTimeout(qrNotesFeedbackTimer);
  }
  qrNotesFeedbackTimer = setTimeout(() => {
    qrNotesFeedback.classList.remove("visible");
  }, 1800);
}

function addQrScanNote(rawText) {
  const cleanText = String(rawText || "").trim();
  if (!cleanText) return;
  qrScanNotes.push({
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: cleanText,
    checked: false
  });
  renderQrScanNotes();
}

function toggleQrNoteChecked(noteId) {
  const item = qrScanNotes.find((n) => n.id === noteId);
  if (!item) return;
  item.checked = !item.checked;
  renderQrScanNotes();
}

function removeQrNoteById(noteId) {
  qrScanNotes = qrScanNotes.filter((n) => n.id !== noteId);
  renderQrScanNotes();
}

function clearAllQrNotes() {
  if (qrScanNotes.length === 0) return;
  qrScanNotes = [];
  renderQrScanNotes();
  showQrNotesFeedback("Semua notes hasil scan dihapus.", false);
}

function copyAllQrNotes() {
  if (qrScanNotes.length === 0) return;
  qrScanNotes.forEach((item) => {
    item.checked = true;
  });
  renderQrScanNotes();
  const payload = qrScanNotes.map((item) => item.text).join("\n");
  writeTextToClipboardSafe(payload);
  showQrNotesFeedback(`Semua (${qrScanNotes.length}) hasil scan dicentang & disalin!`, false);
}

function copySelectedQrNotes() {
  if (qrScanNotes.length === 0) return;
  const selectedItems = qrScanNotes.filter((item) => item.checked);
  if (selectedItems.length === 0) {
    showQrNotesFeedback("Centang minimal 1 kotak hasil scan terlebih dahulu.", true);
    return;
  }
  const payload = selectedItems.map((item) => item.text).join("\n");
  writeTextToClipboardSafe(payload);
  showQrNotesFeedback(`${selectedItems.length} hasil scan pilihan disalin!`, false);
}

function renderQrScanNotes() {
  const totalCount = qrScanNotes.length;
  const checkedCount = qrScanNotes.filter((item) => item.checked).length;

  if (qrNotesCount) {
    qrNotesCount.textContent = `${totalCount} item`;
  }
  if (qrCopyAllBtn) {
    qrCopyAllBtn.disabled = totalCount === 0;
  }
  if (qrCopySelectedBtn) {
    qrCopySelectedBtn.disabled = checkedCount === 0;
    qrCopySelectedBtn.textContent = checkedCount > 0 ? `Salin Pilihan (${checkedCount})` : "Salin Pilihan";
  }
  if (qrClearNotesBtn) {
    qrClearNotesBtn.disabled = totalCount === 0;
  }
  if (!qrNotesList) return;

  if (totalCount === 0) {
    qrNotesList.innerHTML =
      '<div class="qr-notes-empty">Belum ada hasil scan. Hasil scan akan muncul berurutan ke bawah di sini.</div>';
    return;
  }

  qrNotesList.innerHTML = qrScanNotes
    .map((item, index) => {
      const safeId = escapeHtmlSafe(item.id);
      const checkedAttr = item.checked ? "checked" : "";
      const rowClass = item.checked ? "qr-note-item checked" : "qr-note-item";
      return `<div class="${rowClass}">
        <input
          type="checkbox"
          id="chk_${safeId}"
          class="qr-note-checkbox"
          ${checkedAttr}
          onchange="toggleQrNoteChecked('${safeId}')"
        />
        <label for="chk_${safeId}" class="qr-note-label">
          <span class="qr-note-num">${index + 1}.</span>
          <span class="qr-note-text">${escapeHtmlSafe(item.text)}</span>
        </label>
        <button type="button" class="qr-note-del-btn" onclick="removeQrNoteById('${safeId}')" aria-label="Hapus item">✕</button>
      </div>`;
    })
    .join("");

  qrNotesList.scrollTop = qrNotesList.scrollHeight;
}
