// 6B. Engine Auto-Detect & Auto-Crop Dokumen Presisi Ala CamScanner ("Ajaib Pro")
function orderQuadCorners(pts) {
  if (!Array.isArray(pts) || pts.length !== 4) return null;
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  const sortedByAngle = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );

  let tlIdx = 0;
  let minSum = Infinity;
  sortedByAngle.forEach((p, idx) => {
    const s = p.x + p.y;
    if (s < minSum) {
      minSum = s;
      tlIdx = idx;
    }
  });

  return [
    sortedByAngle[tlIdx],
    sortedByAngle[(tlIdx + 1) % 4],
    sortedByAngle[(tlIdx + 2) % 4],
    sortedByAngle[(tlIdx + 3) % 4]
  ];
}

function computeOtsuLuminanceThreshold(lum, w, h) {
  const hist = new Uint32Array(256);
  const x0 = Math.floor(w * 0.05);
  const x1 = Math.ceil(w * 0.95);
  const y0 = Math.floor(h * 0.05);
  const y1 = Math.ceil(h * 0.95);
  let total = 0;

  for (let y = y0; y < y1; y += 1) {
    const rOff = y * w;
    for (let x = x0; x < x1; x += 1) {
      hist[lum[rOff + x]] += 1;
      total += 1;
    }
  }
  if (total === 0) return 145;

  let sumAll = 0;
  for (let i = 0; i < 256; i += 1) {
    sumAll += i * hist[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 145;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const diff = mB - mF;
    const betweenVar = wB * wF * diff * diff;
    if (betweenVar > maxVar) {
      maxVar = betweenVar;
      threshold = t;
    }
  }

  return threshold;
}

function dilateBinaryMask(src, dst, w, h) {
  dst.fill(0);
  for (let y = 1; y < h - 1; y += 1) {
    const rOff = y * w;
    for (let x = 1; x < w - 1; x += 1) {
      if (
        src[rOff - w + x - 1] ||
        src[rOff - w + x] ||
        src[rOff - w + x + 1] ||
        src[rOff + x - 1] ||
        src[rOff + x] ||
        src[rOff + x + 1] ||
        src[rOff + w + x - 1] ||
        src[rOff + w + x] ||
        src[rOff + w + x + 1]
      ) {
        dst[rOff + x] = 1;
      }
    }
  }
}

function erodeBinaryMask(src, dst, w, h) {
  dst.fill(0);
  for (let y = 1; y < h - 1; y += 1) {
    const rOff = y * w;
    for (let x = 1; x < w - 1; x += 1) {
      if (
        src[rOff - w + x - 1] &&
        src[rOff - w + x] &&
        src[rOff - w + x + 1] &&
        src[rOff + x - 1] &&
        src[rOff + x] &&
        src[rOff + x + 1] &&
        src[rOff + w + x - 1] &&
        src[rOff + w + x] &&
        src[rOff + w + x + 1]
      ) {
        dst[rOff + x] = 1;
      }
    }
  }
}

function fitLineToPoints2D(points) {
  const n = points.length;
  if (n < 2) return null;

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += points[i].x;
    my += points[i].y;
  }
  mx /= n;
  my /= n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = points[i].x - mx;
    const dy = points[i].y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  const nx = -vy;
  const ny = vx;
  const c = nx * mx + ny * my;
  return { nx, ny, c };
}

function fitRobustLineToPoints2D(points) {
  const initial = fitLineToPoints2D(points);
  if (!initial || points.length < 8) return initial;

  const residuals = points.map((p) => ({
    pt: p,
    err: Math.abs(initial.nx * p.x + initial.ny * p.y - initial.c)
  }));
  residuals.sort((a, b) => a.err - b.err);

  // Buang 25% titik terluar (sobekan pinggir stiker / bayangan tepi) agar sisi potong lurus sempurna
  const keepCount = Math.max(6, Math.floor(residuals.length * 0.75));
  const inliers = residuals.slice(0, keepCount).map((r) => r.pt);
  return fitLineToPoints2D(inliers) || initial;
}

function intersectLines2D(lineA, lineB) {
  if (!lineA || !lineB) return null;
  const det = lineA.nx * lineB.ny - lineA.ny * lineB.nx;
  if (Math.abs(det) < 1e-6) return null;
  const x = (lineA.c * lineB.ny - lineA.ny * lineB.c) / det;
  const y = (lineA.nx * lineB.c - lineA.c * lineB.nx) / det;
  return { x, y };
}

function refineQuadWithEdgeLines(boundaryPts, rawQuad, w, h) {
  if (!Array.isArray(boundaryPts) || boundaryPts.length < 24 || !rawQuad || rawQuad.length !== 4) {
    return rawQuad;
  }

  const sideBuckets = [[], [], [], []];
  const diagLen = Math.hypot(w, h);
  const maxDist = Math.max(3.5, diagLen * 0.032);

  for (let i = 0; i < boundaryPts.length; i += 1) {
    const pt = boundaryPts[i];
    let bestSide = -1;
    let bestDist = Infinity;

    for (let s = 0; s < 4; s += 1) {
      const a = rawQuad[s];
      const b = rawQuad[(s + 1) % 4];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby;
      if (lenSq < 1) continue;

      const t = ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / lenSq;
      if (t < 0.14 || t > 0.86) continue;

      const projX = a.x + t * abx;
      const projY = a.y + t * aby;
      const dist = Math.hypot(pt.x - projX, pt.y - projY);
      if (dist < bestDist) {
        bestDist = dist;
        bestSide = s;
      }
    }

    if (bestSide >= 0 && bestDist <= maxDist) {
      sideBuckets[bestSide].push(pt);
    }
  }

  const lines = sideBuckets.map((bucket) =>
    bucket.length >= 6 ? fitRobustLineToPoints2D(bucket) : null
  );
  if (lines.some((l) => !l)) {
    return rawQuad;
  }

  const tl = intersectLines2D(lines[3], lines[0]);
  const tr = intersectLines2D(lines[0], lines[1]);
  const br = intersectLines2D(lines[1], lines[2]);
  const bl = intersectLines2D(lines[2], lines[3]);
  const refined = [tl, tr, br, bl];

  for (let i = 0; i < 4; i += 1) {
    const rp = refined[i];
    const op = rawQuad[i];
    if (!rp || !Number.isFinite(rp.x) || !Number.isFinite(rp.y)) return rawQuad;
    if (Math.hypot(rp.x - op.x, rp.y - op.y) > diagLen * 0.08) return rawQuad;
    rp.x = Math.max(0, Math.min(w - 1, rp.x));
    rp.y = Math.max(0, Math.min(h - 1, rp.y));
  }

  return refined;
}

function detectDocumentQuadFromCanvas(srcCanvas, srcW, srcH) {
  const ctx = srcCanvas.getContext("2d");
  if (!ctx || srcW < 40 || srcH < 40) return null;

  try {
    const imgData = ctx.getImageData(0, 0, srcW, srcH).data;
    const totalPixels = srcW * srcH;
    const lum = new Uint8Array(totalPixels);
    const sat = new Uint8Array(totalPixels);

    for (let i = 0, p = 0; i < imgData.length; i += 4, p += 1) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
      lum[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      sat[p] = maxC - minC;
    }

    const otsuThresh = computeOtsuLuminanceThreshold(lum, srcW, srcH);
    const brightThresh = Math.max(106, Math.min(214, otsuThresh + 4));

    const rawMask = new Uint8Array(totalPixels);
    for (let p = 0; p < totalPixels; p += 1) {
      if (lum[p] >= brightThresh && sat[p] <= 80) {
        rawMask[p] = 1;
      }
    }

    const bufA = new Uint8Array(totalPixels);
    const bufB = new Uint8Array(totalPixels);
    dilateBinaryMask(rawMask, bufA, srcW, srcH);
    dilateBinaryMask(bufA, bufB, srcW, srcH);
    erodeBinaryMask(bufB, bufA, srcW, srcH);
    erodeBinaryMask(bufA, bufB, srcW, srcH);
    const closedMask = bufB;

    const labels = new Int32Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let currentLabel = 0;
    let bestComponent = null;
    let bestScore = -1;

    const frameCenterX = srcW * 0.5;
    const frameCenterY = srcH * 0.5;
    const maxCenterDist = Math.hypot(frameCenterX, frameCenterY);

    for (let y = 1; y < srcH - 1; y += 1) {
      const rOff = y * srcW;
      for (let x = 1; x < srcW - 1; x += 1) {
        const startIdx = rOff + x;
        if (!closedMask[startIdx] || labels[startIdx] !== 0) continue;

        currentLabel += 1;
        let qHead = 0;
        let qTail = 0;
        queue[qTail++] = startIdx;
        labels[startIdx] = currentLabel;

        let area = 0;
        let sumX = 0;
        let sumY = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let topEdgeHits = 0;
        let bottomEdgeHits = 0;
        let leftEdgeHits = 0;
        let rightEdgeHits = 0;

        while (qHead < qTail) {
          const idx = queue[qHead++];
          const py = Math.floor(idx / srcW);
          const px = idx - py * srcW;

          area += 1;
          sumX += px;
          sumY += py;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;

          if (py <= 2) topEdgeHits += 1;
          if (py >= srcH - 3) bottomEdgeHits += 1;
          if (px <= 2) leftEdgeHits += 1;
          if (px >= srcW - 3) rightEdgeHits += 1;

          if (px > 1 && closedMask[idx - 1] && labels[idx - 1] === 0) {
            labels[idx - 1] = currentLabel;
            queue[qTail++] = idx - 1;
          }
          if (px < srcW - 2 && closedMask[idx + 1] && labels[idx + 1] === 0) {
            labels[idx + 1] = currentLabel;
            queue[qTail++] = idx + 1;
          }
          if (py > 1 && closedMask[idx - srcW] && labels[idx - srcW] === 0) {
            labels[idx - srcW] = currentLabel;
            queue[qTail++] = idx - srcW;
          }
          if (py < srcH - 2 && closedMask[idx + srcW] && labels[idx + srcW] === 0) {
            labels[idx + srcW] = currentLabel;
            queue[qTail++] = idx + srcW;
          }
        }

        const areaRatio = area / totalPixels;
        if (areaRatio < 0.065 || areaRatio > 0.91) continue;

        const bboxW = maxX - minX + 1;
        const bboxH = maxY - minY + 1;
        const solidity = area / Math.max(1, bboxW * bboxH);
        if (solidity < 0.52) continue;

        let clippedSides = 0;
        if (topEdgeHits > bboxW * 0.35) clippedSides += 1;
        if (bottomEdgeHits > bboxW * 0.35) clippedSides += 1;
        if (leftEdgeHits > bboxH * 0.35) clippedSides += 1;
        if (rightEdgeHits > bboxH * 0.35) clippedSides += 1;
        if (clippedSides >= 3) continue;

        const cx = sumX / area;
        const cy = sumY / area;
        const centerDistNorm = Math.hypot(cx - frameCenterX, cy - frameCenterY) / maxCenterDist;
        const score = areaRatio * solidity * (1.4 - 0.55 * centerDistNorm);

        if (score > bestScore) {
          bestScore = score;
          bestComponent = { label: currentLabel, area, cx, cy };
        }
      }
    }

    if (!bestComponent) return null;

    const winLabel = bestComponent.label;
    const cx = bestComponent.cx;
    const cy = bestComponent.cy;
    let mu20 = 0;
    let mu02 = 0;
    let mu11 = 0;
    const boundaryPts = [];

    for (let y = 1; y < srcH - 1; y += 1) {
      const rOff = y * srcW;
      for (let x = 1; x < srcW - 1; x += 1) {
        const idx = rOff + x;
        if (labels[idx] !== winLabel) continue;

        const dx = x - cx;
        const dy = y - cy;
        mu20 += dx * dx;
        mu02 += dy * dy;
        mu11 += dx * dy;

        if (
          labels[idx - 1] !== winLabel ||
          labels[idx + 1] !== winLabel ||
          labels[idx - srcW] !== winLabel ||
          labels[idx + srcW] !== winLabel
        ) {
          boundaryPts.push({ x, y });
        }
      }
    }

    if (boundaryPts.length < 16) return null;

    const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
    const cosT = Math.cos(-theta);
    const sinT = Math.sin(-theta);

    let ptTL = boundaryPts[0];
    let ptTR = boundaryPts[0];
    let ptBR = boundaryPts[0];
    let ptBL = boundaryPts[0];
    let minSum = Infinity;
    let maxSum = -Infinity;
    let minDiff = Infinity;
    let maxDiff = -Infinity;

    for (let i = 0; i < boundaryPts.length; i += 1) {
      const p = boundaryPts[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const u = dx * cosT - dy * sinT;
      const v = dx * sinT + dy * cosT;
      const sum = u + v;
      const diff = u - v;

      if (sum < minSum) {
        minSum = sum;
        ptTL = p;
      }
      if (sum > maxSum) {
        maxSum = sum;
        ptBR = p;
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        ptTR = p;
      }
      if (diff < minDiff) {
        minDiff = diff;
        ptBL = p;
      }
    }

    const ordered = orderQuadCorners([ptTL, ptTR, ptBR, ptBL]);
    if (!ordered) return null;

    const refined = refineQuadWithEdgeLines(boundaryPts, ordered, srcW, srcH);

    let polyArea = 0;
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      polyArea += refined[i].x * refined[j].y - refined[j].x * refined[i].y;
    }
    polyArea = Math.abs(polyArea) / 2;
    const polyAreaRatio = polyArea / totalPixels;
    if (polyAreaRatio < 0.065 || polyAreaRatio > 0.93) {
      return null;
    }

    // Inset aman ke dalam batas kertas putih agar pinggiran meja gelap & sobekan luar terpotong bersih seperti Gambar 3
    const qCx = (refined[0].x + refined[1].x + refined[2].x + refined[3].x) / 4;
    const qCy = (refined[0].y + refined[1].y + refined[2].y + refined[3].y) / 4;
    const insetFactor = 0.974;

    const normQuad = refined.map((pt) => {
      const ix = qCx + (pt.x - qCx) * insetFactor;
      const iy = qCy + (pt.y - qCy) * insetFactor;
      return {
        x: Math.max(0, Math.min(1, ix / srcW)),
        y: Math.max(0, Math.min(1, iy / srcH))
      };
    });

    const topWidth = Math.hypot(normQuad[1].x - normQuad[0].x, normQuad[1].y - normQuad[0].y);
    const bottomWidth = Math.hypot(normQuad[2].x - normQuad[3].x, normQuad[2].y - normQuad[3].y);
    const leftHeight = Math.hypot(normQuad[3].x - normQuad[0].x, normQuad[3].y - normQuad[0].y);
    const rightHeight = Math.hypot(normQuad[2].x - normQuad[1].x, normQuad[2].y - normQuad[1].y);

    if (
      Math.min(topWidth, bottomWidth) < 0.18 ||
      Math.min(leftHeight, rightHeight) < 0.14
    ) {
      return null;
    }

    return normQuad;
  } catch (err) {
    return null;
  }
}

function drawDocumentBoundaryOverlay(quad) {
  if (!docDetectCanvas || !scannerViewport) return;
  const rect = scannerViewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(rect.width * dpr);
  const ch = Math.round(rect.height * dpr);
  if (docDetectCanvas.width !== cw || docDetectCanvas.height !== ch) {
    docDetectCanvas.width = cw;
    docDetectCanvas.height = ch;
  }

  const ctx = docDetectCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);

  if (!quad || quad.length !== 4) return;

  const videoEl = document.querySelector("#reader video");
  let offsetX = 0;
  let offsetY = 0;
  let drawW = cw;
  let drawH = ch;

  if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const scale = Math.max(cw / vw, ch / vh);
    drawW = vw * scale;
    drawH = vh * scale;
    offsetX = (cw - drawW) / 2;
    offsetY = (ch - drawH) / 2;
  }

  const pts = quad.map((p) => ({
    x: offsetX + p.x * drawW,
    y: offsetY + p.y * drawH
  }));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();

  ctx.fillStyle = "rgba(16, 185, 129, 0.09)";
  ctx.fill();

  ctx.lineWidth = 2.6 * dpr;
  ctx.strokeStyle = "#10b981";
  ctx.lineJoin = "round";
  ctx.stroke();

  pts.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#34d399";
    ctx.fill();
  });
  ctx.restore();
}

function runDocumentBoundaryFrame() {
  if (
    !isTextPhotoCameraActive() ||
    !isCameraRunning ||
    (photoLensOverlay && photoLensOverlay.classList.contains("open")) ||
    document.visibilityState !== "visible"
  ) {
    return;
  }

  const videoEl = document.querySelector("#reader video");
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return;
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const maxSample = 240;
  const scale = Math.min(1, maxSample / Math.max(vw, vh));
  const sw = Math.max(40, Math.round(vw * scale));
  const sh = Math.max(40, Math.round(vh * scale));

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  const sCtx = sampleCanvas.getContext("2d");
  if (!sCtx) return;

  sCtx.drawImage(videoEl, 0, 0, sw, sh);
  const detectedQuad = detectDocumentQuadFromCanvas(sampleCanvas, sw, sh);

  if (detectedQuad) {
    docDetectMissCount = 0;
    lastDetectedDocQuad = detectedQuad;
    if (!smoothedDocQuad) {
      smoothedDocQuad = detectedQuad.map((p) => ({ ...p }));
    } else {
      const maxJump = Math.max(
        ...detectedQuad.map((p, idx) =>
          Math.hypot(p.x - smoothedDocQuad[idx].x, p.y - smoothedDocQuad[idx].y)
        )
      );
      const alpha = maxJump > 0.14 ? 0.72 : 0.42;
      smoothedDocQuad = smoothedDocQuad.map((prev, idx) => ({
        x: prev.x + (detectedQuad[idx].x - prev.x) * alpha,
        y: prev.y + (detectedQuad[idx].y - prev.y) * alpha
      }));
    }
    drawDocumentBoundaryOverlay(smoothedDocQuad);
  } else {
    docDetectMissCount += 1;
    if (docDetectMissCount > 3) {
      lastDetectedDocQuad = null;
      smoothedDocQuad = null;
      drawDocumentBoundaryOverlay(null);
    }
  }
}

function startDocumentBoundaryDetector() {
  stopDocumentBoundaryDetector();
  if (docDetectCanvas) {
    docDetectCanvas.classList.add("active");
  }
  docDetectTimer = setInterval(runDocumentBoundaryFrame, 95);
}

function stopDocumentBoundaryDetector() {
  if (docDetectTimer) {
    clearInterval(docDetectTimer);
    docDetectTimer = null;
  }
  lastDetectedDocQuad = null;
  smoothedDocQuad = null;
  docDetectMissCount = 0;
  if (docDetectCanvas) {
    const ctx = docDetectCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, docDetectCanvas.width, docDetectCanvas.height);
    }
    docDetectCanvas.classList.remove("active");
  }
}

function solveLinearSystem8x8(A, b) {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) {
        pivotRow = r;
      }
    }
    if (Math.abs(M[pivotRow][col]) < 1e-9) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const pivotVal = M[col][col];
    for (let c = col; c <= n; c += 1) {
      M[col][c] /= pivotVal;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c += 1) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row) => row[n]);
}

function computeHomographyFromRectToQuad(dstW, dstH, srcQuadPx) {
  const dstPts = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH }
  ];

  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const u = dstPts[i].x;
    const v = dstPts[i].y;
    const x = srcQuadPx[i].x;
    const y = srcQuadPx[i].y;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  return solveLinearSystem8x8(A, b);
}

function warpDocumentQuadToCanvas(img, normQuad) {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  const srcQuadPx = normQuad.map((p) => ({
    x: p.x * naturalW,
    y: p.y * naturalH
  }));

  const topW = Math.hypot(srcQuadPx[1].x - srcQuadPx[0].x, srcQuadPx[1].y - srcQuadPx[0].y);
  const botW = Math.hypot(srcQuadPx[2].x - srcQuadPx[3].x, srcQuadPx[2].y - srcQuadPx[3].y);
  const leftH = Math.hypot(srcQuadPx[3].x - srcQuadPx[0].x, srcQuadPx[3].y - srcQuadPx[0].y);
  const rightH = Math.hypot(srcQuadPx[2].x - srcQuadPx[1].x, srcQuadPx[2].y - srcQuadPx[1].y);

  let targetW = Math.max(160, Math.round((topW + botW) / 2));
  let targetH = Math.max(160, Math.round((leftH + rightH) / 2));

  const maxOutDim = 2048;
  if (Math.max(targetW, targetH) > maxOutDim) {
    const scale = maxOutDim / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const h = computeHomographyFromRectToQuad(targetW, targetH, srcQuadPx);
  if (!h) return null;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = naturalW;
  srcCanvas.height = naturalH;
  const sCtx = srcCanvas.getContext("2d");
  if (!sCtx) return null;
  sCtx.drawImage(img, 0, 0, naturalW, naturalH);
  const srcData = sCtx.getImageData(0, 0, naturalW, naturalH).data;

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = targetW;
  dstCanvas.height = targetH;
  const dCtx = dstCanvas.getContext("2d");
  if (!dCtx) return null;
  const dstImgData = dCtx.createImageData(targetW, targetH);
  const dstData = dstImgData.data;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = h;
  const maxSx = naturalW - 1.001;
  const maxSy = naturalH - 1.001;

  for (let v = 0; v < targetH; v += 1) {
    const rowBase = v * targetW * 4;
    const h1v_h2 = h1 * v + h2;
    const h4v_h5 = h4 * v + h5;
    const h7v_1 = h7 * v + 1;

    for (let u = 0; u < targetW; u += 1) {
      const denom = h6 * u + h7v_1;
      const invDenom = denom !== 0 ? 1 / denom : 1;
      const sx = Math.max(0, Math.min(maxSx, (h0 * u + h1v_h2) * invDenom));
      const sy = Math.max(0, Math.min(maxSy, (h3 * u + h4v_h5) * invDenom));

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;
      const oneMinusFx = 1 - fx;
      const oneMinusFy = 1 - fy;

      const w00 = oneMinusFx * oneMinusFy;
      const w10 = fx * oneMinusFy;
      const w01 = oneMinusFx * fy;
      const w11 = fx * fy;

      const idx00 = (y0 * naturalW + x0) * 4;
      const idx10 = (y0 * naturalW + x1) * 4;
      const idx01 = (y1 * naturalW + x0) * 4;
      const idx11 = (y1 * naturalW + x1) * 4;

      const dIdx = rowBase + u * 4;
      dstData[dIdx] = Math.round(
        srcData[idx00] * w00 + srcData[idx10] * w10 + srcData[idx01] * w01 + srcData[idx11] * w11
      );
      dstData[dIdx + 1] = Math.round(
        srcData[idx00 + 1] * w00 +
          srcData[idx10 + 1] * w10 +
          srcData[idx01 + 1] * w01 +
          srcData[idx11 + 1] * w11
      );
      dstData[dIdx + 2] = Math.round(
        srcData[idx00 + 2] * w00 +
          srcData[idx10 + 2] * w10 +
          srcData[idx01 + 2] * w01 +
          srcData[idx11 + 2] * w11
      );
      dstData[dIdx + 3] = 255;
    }
  }

  dCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

function separableMorphOp1D(src, w, h, radius, isMax) {
  const temp = new Uint8Array(w * h);
  const dst = new Uint8Array(w * h);
  const deque = new Int32Array(Math.max(w, h) + 4);

  // Horizontal pass
  for (let y = 0; y < h; y += 1) {
    const rOff = y * w;
    let head = 0;
    let tail = 0;
    for (let x = 0; x < w + radius; x += 1) {
      if (x < w) {
        const val = src[rOff + x];
        while (
          head < tail &&
          (isMax ? src[rOff + deque[tail - 1]] <= val : src[rOff + deque[tail - 1]] >= val)
        ) {
          tail -= 1;
        }
        deque[tail++] = x;
      }
      const outX = x - radius;
      if (outX >= 0) {
        while (head < tail && deque[head] < outX - radius) {
          head += 1;
        }
        temp[rOff + outX] = src[rOff + deque[head]];
      }
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x += 1) {
    let head = 0;
    let tail = 0;
    for (let y = 0; y < h + radius; y += 1) {
      if (y < h) {
        const val = temp[y * w + x];
        while (
          head < tail &&
          (isMax ? temp[deque[tail - 1] * w + x] <= val : temp[deque[tail - 1] * w + x] >= val)
        ) {
          tail -= 1;
        }
        deque[tail++] = y;
      }
      const outY = y - radius;
      if (outY >= 0) {
        while (head < tail && deque[head] < outY - radius) {
          head += 1;
        }
        dst[outY * w + x] = temp[deque[head] * w + x];
      }
    }
  }

  return dst;
}

function separableBoxBlurFloat(src, w, h, radius) {
  const temp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const winSize = radius * 2 + 1;

  for (let y = 0; y < h; y += 1) {
    const rOff = y * w;
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const cx = Math.max(0, Math.min(w - 1, k));
      sum += src[rOff + cx];
    }
    temp[rOff] = sum / winSize;

    for (let x = 1; x < w; x += 1) {
      const addX = Math.min(w - 1, x + radius);
      const subX = Math.max(0, x - radius - 1);
      sum += src[rOff + addX] - src[rOff + subX];
      temp[rOff + x] = sum / winSize;
    }
  }

  for (let x = 0; x < w; x += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const cy = Math.max(0, Math.min(h - 1, k));
      sum += temp[cy * w + x];
    }
    dst[x] = sum / winSize;

    for (let y = 1; y < h; y += 1) {
      const addY = Math.min(h - 1, y + radius);
      const subY = Math.max(0, y - radius - 1);
      sum += temp[addY * w + x] - temp[subY * w + x];
      dst[y * w + x] = sum / winSize;
    }
  }

  return dst;
}

function cleanWarpedDocumentBorders(toneBuf, w, h) {
  // Bersihkan sisa bayangan/bingkai gelap yang menempel pada tepi terluar hasil auto-crop
  const maxBorderDepthX = Math.max(12, Math.round(w * 0.045));
  const maxBorderDepthY = Math.max(12, Math.round(h * 0.045));
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0;
  let qTail = 0;

  const trySeed = (x, y) => {
    const idx = y * w + x;
    if (!visited[idx] && toneBuf[idx] < 238) {
      visited[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < w; x += 1) {
    trySeed(x, 0);
    trySeed(x, 1);
    trySeed(x, h - 1);
    trySeed(x, h - 2);
  }
  for (let y = 0; y < h; y += 1) {
    trySeed(0, y);
    trySeed(1, y);
    trySeed(w - 1, y);
    trySeed(w - 2, y);
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const py = Math.floor(idx / w);
    const px = idx - py * w;
    toneBuf[idx] = 255;

    if (px > 0 && px - 1 < maxBorderDepthX && !visited[idx - 1] && toneBuf[idx - 1] < 238) {
      visited[idx - 1] = 1;
      queue[qTail++] = idx - 1;
    }
    if (
      px < w - 1 &&
      w - 1 - (px + 1) < maxBorderDepthX &&
      !visited[idx + 1] &&
      toneBuf[idx + 1] < 238
    ) {
      visited[idx + 1] = 1;
      queue[qTail++] = idx + 1;
    }
    if (py > 0 && py - 1 < maxBorderDepthY && !visited[idx - w] && toneBuf[idx - w] < 238) {
      visited[idx - w] = 1;
      queue[qTail++] = idx - w;
    }
    if (
      py < h - 1 &&
      h - 1 - (py + 1) < maxBorderDepthY &&
      !visited[idx + w] &&
      toneBuf[idx + w] < 238
    ) {
      visited[idx + w] = 1;
      queue[qTail++] = idx + w;
    }
  }
}

function applyCamScannerDocumentFilter(canvas, wasCropped = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return;

  try {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const total = w * h;
    const rawLum = new Uint8Array(total);

    // 1. Ekstraksi luminance monokrom bersih tanpa bias warna
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      rawLum[p] = Math.round(0.26 * data[i] + 0.59 * data[i + 1] + 0.15 * data[i + 2]);
    }

    // 2. Denoising 3x3 ringan pada area kertas agar bintik kamera hilang tanpa menumpulkan huruf mikro
    const lum = new Uint8Array(total);
    lum.set(rawLum);
    for (let y = 1; y < h - 1; y += 1) {
      const rOff = y * w;
      for (let x = 1; x < w - 1; x += 1) {
        const p = rOff + x;
        const c = rawLum[p];
        if (c > 110) {
          const avg =
            (rawLum[p - w - 1] +
              2 * rawLum[p - w] +
              rawLum[p - w + 1] +
              2 * rawLum[p - 1] +
              4 * c +
              2 * rawLum[p + 1] +
              rawLum[p + w - 1] +
              2 * rawLum[p + w] +
              rawLum[p + w + 1]) >>
            4;
          if (Math.abs(c - avg) < 22) {
            lum[p] = avg;
          }
        }
      }
    }

    // 3. Peta pencahayaan kertas (Morphological Closing + Blur) untuk menghapus bayangan/lipatan abu-abu 100%
    const hw = Math.max(20, Math.ceil(w / 2));
    const hh = Math.max(20, Math.ceil(h / 2));
    const halfLum = new Uint8Array(hw * hh);
    for (let hy = 0; hy < hh; hy += 1) {
      const sy = Math.min(h - 1, hy * 2);
      const sOff = sy * w;
      const dOff = hy * hw;
      for (let hx = 0; hx < hw; hx += 1) {
        const sx = Math.min(w - 1, hx * 2);
        halfLum[dOff + hx] = lum[sOff + sx];
      }
    }

    const dilateRadius = Math.max(12, Math.round(Math.min(hw, hh) / 26));
    const erodeRadius = Math.max(4, Math.round(dilateRadius * 0.35));
    const blurRadius = Math.max(8, Math.round(dilateRadius * 0.65));

    const dilated = separableMorphOp1D(halfLum, hw, hh, dilateRadius, true);
    const closed = separableMorphOp1D(dilated, hw, hh, erodeRadius, false);
    const smoothBg = separableBoxBlurFloat(closed, hw, hh, blurRadius);

    // 4. Flat-Field Division + Kurva Kontras "Ajaib Pro" (Kertas #FFFFFF murni, teks/barcode/QR hitam pekat)
    const toneBuf = new Uint8Array(total);
    const blackPt = 0.54;
    const whitePt = 0.84;
    const invRange = 1 / (whitePt - blackPt);

    for (let y = 0; y < h; y += 1) {
      const hy = Math.min(hh - 1.001, y * 0.5);
      const hy0 = Math.floor(hy);
      const hy1 = Math.min(hh - 1, hy0 + 1);
      const wy = hy - hy0;
      const oneMinusWy = 1 - wy;
      const rOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const hx = Math.min(hw - 1.001, x * 0.5);
        const hx0 = Math.floor(hx);
        const hx1 = Math.min(hw - 1, hx0 + 1);
        const wx = hx - hx0;
        const oneMinusWx = 1 - wx;

        const b00 = smoothBg[hy0 * hw + hx0];
        const b10 = smoothBg[hy0 * hw + hx1];
        const b01 = smoothBg[hy1 * hw + hx0];
        const b11 = smoothBg[hy1 * hw + hx1];
        const localIllum =
          (b00 * oneMinusWx + b10 * wx) * oneMinusWy +
          (b01 * oneMinusWx + b11 * wx) * wy;

        const p = rOff + x;
        const ratio = lum[p] / Math.max(68, localIllum);

        let outGray;
        if (ratio >= whitePt) {
          outGray = 255;
        } else if (ratio <= blackPt) {
          outGray = Math.max(0, Math.round((ratio / blackPt) * 10));
        } else {
          const t = (ratio - blackPt) * invRange;
          const curved = Math.pow(t, 1.38);
          outGray = Math.round(10 + 245 * curved);
        }
        toneBuf[p] = outGray;
      }
    }

    // 5. Penajaman tepi anti-aliased tanpa mengikis huruf kecil (S/N, P/N, DESC, QTY)
    const sharpBuf = new Uint8Array(toneBuf);
    for (let y = 1; y < h - 1; y += 1) {
      const rOff = y * w;
      const yPrev = rOff - w;
      const yNext = rOff + w;
      for (let x = 1; x < w - 1; x += 1) {
        const center = toneBuf[rOff + x];
        if (center > 12 && center < 242) {
          const blur =
            (toneBuf[yPrev + x - 1] +
              2 * toneBuf[yPrev + x] +
              toneBuf[yPrev + x + 1] +
              2 * toneBuf[rOff + x - 1] +
              4 * center +
              2 * toneBuf[rOff + x + 1] +
              toneBuf[yNext + x - 1] +
              2 * toneBuf[yNext + x] +
              toneBuf[yNext + x + 1]) >>
            4;
          const sharpened = center + 0.34 * (center - blur);
          sharpBuf[rOff + x] =
            sharpened >= 246 ? 255 : Math.max(0, Math.min(255, Math.round(sharpened)));
        }
      }
    }

    if (wasCropped) {
      cleanWarpedDocumentBorders(sharpBuf, w, h);
    }

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const val = sharpBuf[p];
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {}
}

async function processDocumentAutoCropAndEnhance(rawImageUrl, preDetectedQuad = null) {
  const img = await loadImageElement(rawImageUrl);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  let quadToUse = preDetectedQuad;
  if (!quadToUse) {
    const maxSample = 320;
    const scale = Math.min(1, maxSample / Math.max(naturalW, naturalH));
    const sw = Math.max(40, Math.round(naturalW * scale));
    const sh = Math.max(40, Math.round(naturalH * scale));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sCtx = sampleCanvas.getContext("2d");
    if (sCtx) {
      sCtx.drawImage(img, 0, 0, sw, sh);
      quadToUse = detectDocumentQuadFromCanvas(sampleCanvas, sw, sh);
    }
  }

  let outputCanvas = null;
  let wasCropped = false;
  if (quadToUse) {
    outputCanvas = warpDocumentQuadToCanvas(img, quadToUse);
    if (outputCanvas) {
      wasCropped = true;
    }
  }

  if (!outputCanvas) {
    const maxOutDim = 2048;
    const scale =
      Math.max(naturalW, naturalH) > maxOutDim
        ? maxOutDim / Math.max(naturalW, naturalH)
        : 1;
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.max(1, Math.round(naturalW * scale));
    outputCanvas.height = Math.max(1, Math.round(naturalH * scale));
    const oCtx = outputCanvas.getContext("2d");
    if (oCtx) {
      oCtx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
    }
  }

  applyCamScannerDocumentFilter(outputCanvas, wasCropped);
  return outputCanvas.toDataURL("image/jpeg", 0.97);
}
