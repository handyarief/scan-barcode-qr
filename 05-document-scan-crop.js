// 6B. Engine Auto-Focus -> Deteksi 4 Sisi Akurat -> Auto-Crop Tegak Berdiri & Penjernihan Dokumen
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

  const ordered = [
    sortedByAngle[tlIdx],
    sortedByAngle[(tlIdx + 1) % 4],
    sortedByAngle[(tlIdx + 2) % 4],
    sortedByAngle[(tlIdx + 3) % 4]
  ];

  // Pastikan urutan searah jarum jam (TL -> TR -> BR -> BL)
  const cross =
    (ordered[1].x - ordered[0].x) * (ordered[2].y - ordered[0].y) -
    (ordered[1].y - ordered[0].y) * (ordered[2].x - ordered[0].x);
  if (cross < 0) {
    return [ordered[0], ordered[3], ordered[2], ordered[1]];
  }

  return ordered;
}

function quadCornerAngleDeg(prevPt, cornerPt, nextPt) {
  const v1x = prevPt.x - cornerPt.x;
  const v1y = prevPt.y - cornerPt.y;
  const v2x = nextPt.x - cornerPt.x;
  const v2y = nextPt.y - cornerPt.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-5 || n2 < 1e-5) return 0;
  const cosVal = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
  return (Math.acos(cosVal) * 180) / Math.PI;
}

function isValidDocumentQuadGeometry(quad) {
  if (!Array.isArray(quad) || quad.length !== 4) return false;

  for (let i = 0; i < 4; i += 1) {
    const prev = quad[(i + 3) % 4];
    const curr = quad[i];
    const next = quad[(i + 1) % 4];
    const ang = quadCornerAngleDeg(prev, curr, next);
    if (ang < 60 || ang > 120) {
      return false;
    }
  }

  const topW = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const botW = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
  const leftH = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
  const rightH = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);

  if (Math.min(topW, botW) < 0.14 || Math.min(leftH, rightH) < 0.12) {
    return false;
  }

  const widthRatio = Math.max(topW, botW) / Math.max(1e-4, Math.min(topW, botW));
  const heightRatio = Math.max(leftH, rightH) / Math.max(1e-4, Math.min(leftH, rightH));
  if (widthRatio > 1.38 || heightRatio > 1.38) {
    return false;
  }

  // Tolak kotak yang meluber ke pinggir luar layar (penyebab kotak hijau tidak akurat di SS 1)
  let nearOuterBorder = 0;
  for (let i = 0; i < 4; i += 1) {
    if (
      quad[i].x <= 0.035 ||
      quad[i].x >= 0.965 ||
      quad[i].y <= 0.035 ||
      quad[i].y >= 0.965
    ) {
      nearOuterBorder += 1;
    }
  }
  if (nearOuterBorder >= 2) {
    return false;
  }

  return true;
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

function computeConvexHull2D(points) {
  if (!Array.isArray(points) || points.length < 3) return points || [];
  const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i];
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
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
  if (!initial || points.length < 6) return initial;

  const residuals = points.map((p) => ({
    pt: p,
    err: Math.abs(initial.nx * p.x + initial.ny * p.y - initial.c)
  }));
  residuals.sort((a, b) => a.err - b.err);

  const keepCount = Math.max(5, Math.floor(residuals.length * 0.72));
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

function refineQuadWithEdgeLines(edgePts, rawQuad, w, h) {
  if (!Array.isArray(edgePts) || edgePts.length < 20 || !rawQuad || rawQuad.length !== 4) {
    return rawQuad;
  }

  const sideBuckets = [[], [], [], []];
  const diagLen = Math.hypot(w, h);
  const maxDist = Math.max(2.5, diagLen * 0.02);

  for (let i = 0; i < edgePts.length; i += 1) {
    const pt = edgePts[i];
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
      if (t < 0.1 || t > 0.9) continue;

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
    bucket.length >= 5 ? fitRobustLineToPoints2D(bucket) : null
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
    if (Math.hypot(rp.x - op.x, rp.y - op.y) > diagLen * 0.055) return rawQuad;
    rp.x = Math.max(0, Math.min(w - 1, rp.x));
    rp.y = Math.max(0, Math.min(h - 1, rp.y));
  }

  return refined;
}

function computeGradientMagnitudeMap(lum, rChan, gChan, bChan, w, h) {
  const grad = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    const rOff = y * w;
    const upOff = (y - 1) * w;
    const dnOff = (y + 1) * w;
    for (let x = 1; x < w - 1; x += 1) {
      const gxL =
        -lum[upOff + x - 1] +
        lum[upOff + x + 1] -
        2 * lum[rOff + x - 1] +
        2 * lum[rOff + x + 1] -
        lum[dnOff + x - 1] +
        lum[dnOff + x + 1];
      const gyL =
        -lum[upOff + x - 1] -
        2 * lum[upOff + x] -
        lum[upOff + x + 1] +
        lum[dnOff + x - 1] +
        2 * lum[dnOff + x] +
        lum[dnOff + x + 1];

      const gxR =
        -rChan[upOff + x - 1] +
        rChan[upOff + x + 1] -
        2 * rChan[rOff + x - 1] +
        2 * rChan[rOff + x + 1] -
        rChan[dnOff + x - 1] +
        rChan[dnOff + x + 1];
      const gyR =
        -rChan[upOff + x - 1] -
        2 * rChan[upOff + x] -
        rChan[upOff + x + 1] +
        rChan[dnOff + x - 1] +
        2 * rChan[dnOff + x] +
        rChan[dnOff + x + 1];

      const gxB =
        -bChan[upOff + x - 1] +
        bChan[upOff + x + 1] -
        2 * bChan[rOff + x - 1] +
        2 * bChan[rOff + x + 1] -
        bChan[dnOff + x - 1] +
        bChan[dnOff + x + 1];
      const gyB =
        -bChan[upOff + x - 1] -
        2 * bChan[upOff + x] -
        bChan[upOff + x + 1] +
        bChan[dnOff + x - 1] +
        2 * bChan[dnOff + x] +
        bChan[dnOff + x + 1];

      const magL = Math.hypot(gxL, gyL);
      const magC = Math.hypot(gxR * 0.5 + gxB * 0.5, gyR * 0.5 + gyB * 0.5);
      grad[rOff + x] = Math.max(magL, magC * 0.85);
    }
  }
  return grad;
}

// Mengukur ketajaman gambar untuk memastikan kamera sudah auto-fokus jernih
function measureFrameSharpnessScore(lum, w, h) {
  if (!lum || w < 24 || h < 24) return 0;
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;

  for (let y = 2; y < h - 2; y += 2) {
    const rOff = y * w;
    for (let x = 2; x < w - 2; x += 2) {
      const lap =
        lum[rOff - w + x] +
        lum[rOff + w + x] +
        lum[rOff + x - 1] +
        lum[rOff + x + 1] -
        4 * lum[rOff + x];
      lapSum += lap;
      lapSqSum += lap * lap;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = lapSum / count;
  const variance = Math.max(0, lapSqSum / count - mean * mean);
  return variance;
}

function detectDocumentQuadFromCanvas(srcCanvas, srcW, srcH, outFocusInfo = null) {
  const ctx = srcCanvas.getContext("2d");
  if (!ctx || srcW < 40 || srcH < 40) return null;

  try {
    const imgData = ctx.getImageData(0, 0, srcW, srcH).data;
    const totalPixels = srcW * srcH;
    const lum = new Uint8Array(totalPixels);
    const sat = new Uint8Array(totalPixels);
    const rChan = new Uint8Array(totalPixels);
    const gChan = new Uint8Array(totalPixels);
    const bChan = new Uint8Array(totalPixels);

    let borderLumSum = 0;
    let borderCount = 0;

    for (let i = 0, p = 0; i < imgData.length; i += 4, p += 1) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      rChan[p] = r;
      gChan[p] = g;
      bChan[p] = b;

      const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const lVal = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      lum[p] = lVal;
      sat[p] = maxC - minC;

      const py = Math.floor(p / srcW);
      const px = p - py * srcW;
      if (px < 10 || px >= srcW - 10 || py < 10 || py >= srcH - 10) {
        borderLumSum += lVal;
        borderCount += 1;
      }
    }

    const sharpness = measureFrameSharpnessScore(lum, srcW, srcH);
    const isSharpEnough = sharpness >= 135;
    if (outFocusInfo) {
      outFocusInfo.sharpness = sharpness;
      outFocusInfo.isSharp = isSharpEnough;
    }

    if (!isSharpEnough) {
      return null;
    }

    const avgBorderLum = borderCount > 0 ? borderLumSum / borderCount : 115;
    const grad = computeGradientMagnitudeMap(lum, rChan, gChan, bChan, srcW, srcH);

    // Integral image luminansi untuk mendeteksi kertas/label terang secara akurat
    const integral = new Float64Array((srcW + 1) * (srcH + 1));
    for (let y = 1; y <= srcH; y += 1) {
      let rowSum = 0;
      const rOff = (y - 1) * srcW;
      const iOff = y * (srcW + 1);
      const prevIOff = (y - 1) * (srcW + 1);
      for (let x = 1; x <= srcW; x += 1) {
        rowSum += lum[rOff + (x - 1)];
        integral[iOff + x] = integral[prevIOff + x] + rowSum;
      }
    }

    const halfWin = 9;
    const docMask = new Uint8Array(totalPixels);
    const paperFloor = Math.max(122, Math.min(192, avgBorderLum + 22));

    for (let y = 1; y < srcH - 1; y += 1) {
      const y0 = Math.max(0, y - halfWin);
      const y1 = Math.min(srcH, y + halfWin + 1);
      const rOff = y * srcW;
      for (let x = 1; x < srcW - 1; x += 1) {
        const x0 = Math.max(0, x - halfWin);
        const x1 = Math.min(srcW, x + halfWin + 1);
        const areaWin = Math.max(1, (x1 - x0) * (y1 - y0));
        const localMean =
          (integral[y1 * (srcW + 1) + x1] -
            integral[y0 * (srcW + 1) + x1] -
            integral[y1 * (srcW + 1) + x0] +
            integral[y0 * (srcW + 1) + x0]) /
          areaWin;

        const p = rOff + x;
        const isPaperSheet =
          sat[p] <= 85 &&
          lum[p] >= paperFloor &&
          lum[p] >= localMean - 8;

        if (isPaperSheet) {
          docMask[p] = 1;
        }
      }
    }

    // Erosi ringan dulu untuk membuang serpihan terang kecil pada meja/kain, lalu tutup celah tepi
    const bufA = new Uint8Array(totalPixels);
    const bufB = new Uint8Array(totalPixels);
    erodeBinaryMask(docMask, bufA, srcW, srcH);
    dilateBinaryMask(bufA, bufB, srcW, srcH);
    dilateBinaryMask(bufB, bufA, srcW, srcH);
    erodeBinaryMask(bufA, bufB, srcW, srcH);
    const closedMask = bufB;

    const labels = new Int32Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let currentLabel = 0;
    let bestCandidate = null;
    let bestScore = -1;

    const frameCenterX = srcW * 0.5;
    const frameCenterY = srcH * 0.5;
    const maxCenterDist = Math.hypot(frameCenterX, frameCenterY);

    for (let y = 2; y < srcH - 2; y += 1) {
      const rOff = y * srcW;
      for (let x = 2; x < srcW - 2; x += 1) {
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

          if (py <= 3) topEdgeHits += 1;
          if (py >= srcH - 4) bottomEdgeHits += 1;
          if (px <= 3) leftEdgeHits += 1;
          if (px >= srcW - 4) rightEdgeHits += 1;

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
        if (areaRatio < 0.05 || areaRatio > 0.78) continue;

        const bboxW = maxX - minX + 1;
        const bboxH = maxY - minY + 1;
        const solidity = area / Math.max(1, bboxW * bboxH);
        if (solidity < 0.58) continue;

        let clippedSides = 0;
        if (topEdgeHits > bboxW * 0.18) clippedSides += 1;
        if (bottomEdgeHits > bboxW * 0.18) clippedSides += 1;
        if (leftEdgeHits > bboxH * 0.18) clippedSides += 1;
        if (rightEdgeHits > bboxH * 0.18) clippedSides += 1;
        if (clippedSides >= 1) continue;

        const cx = sumX / area;
        const cy = sumY / area;
        const centerDistNorm = Math.hypot(cx - frameCenterX, cy - frameCenterY) / maxCenterDist;
        const score = areaRatio * (0.7 + 0.55 * solidity) * (1.6 - 0.6 * centerDistNorm);

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = { label: currentLabel, area, cx, cy, minX, maxX, minY, maxY };
        }
      }
    }

    if (!bestCandidate) return null;

    const winLabel = bestCandidate.label;
    const cx = bestCandidate.cx;
    const cy = bestCandidate.cy;
    const boundaryPts = [];
    const highGradEdgePts = [];

    for (let y = Math.max(2, bestCandidate.minY - 1); y < Math.min(srcH - 2, bestCandidate.maxY + 2); y += 1) {
      const rOff = y * srcW;
      for (let x = Math.max(2, bestCandidate.minX - 1); x < Math.min(srcW - 2, bestCandidate.maxX + 2); x += 1) {
        const idx = rOff + x;
        if (labels[idx] !== winLabel) continue;

        const touchesBoundary =
          labels[idx - 1] !== winLabel ||
          labels[idx + 1] !== winLabel ||
          labels[idx - srcW] !== winLabel ||
          labels[idx + srcW] !== winLabel;

        if (touchesBoundary) {
          boundaryPts.push({ x, y });
          if (grad[idx] >= 32) {
            highGradEdgePts.push({ x, y });
          }
        }
      }
    }

    if (boundaryPts.length < 18) return null;

    // Gunakan Convex Hull dari batas dokumen agar sudut mengikuti tepi kertas nyata
    const hull = computeConvexHull2D(boundaryPts);
    const cornerPool = hull.length >= 4 ? hull : boundaryPts;

    let ptTL = cornerPool[0];
    let ptTR = cornerPool[0];
    let ptBR = cornerPool[0];
    let ptBL = cornerPool[0];
    let minSum = Infinity;
    let maxSum = -Infinity;
    let maxDiff = -Infinity;
    let minDiff = Infinity;

    for (let i = 0; i < cornerPool.length; i += 1) {
      const p = cornerPool[i];
      const sum = p.x + p.y;
      const diff = p.x - p.y;
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

    // Jika extreme sum/diff memilih titik yang sama, lengkapi dengan ekstrem relatif terhadap pusat
    const uniqueCorners = [ptTL, ptTR, ptBR, ptBL];
    const hasDup = uniqueCorners.some((p, i) =>
      uniqueCorners.some((q, j) => i !== j && Math.hypot(p.x - q.x, p.y - q.y) < 4)
    );
    if (hasDup) {
      let maxTLScore = -Infinity;
      let maxTRScore = -Infinity;
      let maxBRScore = -Infinity;
      let maxBLScore = -Infinity;
      for (let i = 0; i < cornerPool.length; i += 1) {
        const p = cornerPool[i];
        const dx = p.x - cx;
        const dy = p.y - cy;
        if (-dx - dy > maxTLScore) { maxTLScore = -dx - dy; ptTL = p; }
        if (dx - dy > maxTRScore) { maxTRScore = dx - dy; ptTR = p; }
        if (dx + dy > maxBRScore) { maxBRScore = dx + dy; ptBR = p; }
        if (-dx + dy > maxBLScore) { maxBLScore = -dx + dy; ptBL = p; }
      }
    }

    const ordered = orderQuadCorners([ptTL, ptTR, ptBR, ptBL]);
    if (!ordered) return null;

    const edgePool = highGradEdgePts.length >= 20 ? highGradEdgePts : boundaryPts;
    const refined = refineQuadWithEdgeLines(edgePool, ordered, srcW, srcH);

    let polyArea = 0;
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      polyArea += refined[i].x * refined[j].y - refined[j].x * refined[i].y;
    }
    polyArea = Math.abs(polyArea) / 2;
    const polyAreaRatio = polyArea / totalPixels;
    if (polyAreaRatio < 0.05 || polyAreaRatio > 0.78) {
      return null;
    }

    // Inset halus (0.985) tepat di tepi kertas putih agar tidak memotong huruf/barcode di pinggir
    const qCx = (refined[0].x + refined[1].x + refined[2].x + refined[3].x) / 4;
    const qCy = (refined[0].y + refined[1].y + refined[2].y + refined[3].y) / 4;
    const insetFactor = 0.985;

    const normQuad = refined.map((pt) => {
      const ix = qCx + (pt.x - qCx) * insetFactor;
      const iy = qCy + (pt.y - qCy) * insetFactor;
      return {
        x: Math.max(0.035, Math.min(0.965, ix / srcW)),
        y: Math.max(0.035, Math.min(0.965, iy / srcH))
      };
    });

    if (!isValidDocumentQuadGeometry(normQuad)) {
      return null;
    }

    return normQuad;
  } catch (err) {
    return null;
  }
}

function drawRoundedQuadPath(ctx, pts, radiusPx) {
  if (!Array.isArray(pts) || pts.length !== 4) return;
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const prev = pts[(i + 3) % 4];
    const curr = pts[i];
    const next = pts[(i + 1) % 4];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const r = Math.min(radiusPx, len1 * 0.25, len2 * 0.25);

    const pStartX = curr.x + (v1x / Math.max(1, len1)) * r;
    const pStartY = curr.y + (v1y / Math.max(1, len1)) * r;
    const pEndX = curr.x + (v2x / Math.max(1, len2)) * r;
    const pEndY = curr.y + (v2y / Math.max(1, len2)) * r;

    if (i === 0) {
      ctx.moveTo(pStartX, pStartY);
    } else {
      ctx.lineTo(pStartX, pStartY);
    }
    ctx.quadraticCurveTo(curr.x, curr.y, pEndX, pEndY);
  }
  ctx.closePath();
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

  if (!quad || quad.length !== 4 || !isDocCameraFocused) {
    return;
  }

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

  const isLocked = docStableHits >= 3;

  ctx.save();
  drawRoundedQuadPath(ctx, pts, 10 * dpr);
  ctx.fillStyle = isLocked ? "rgba(16, 185, 129, 0.14)" : "rgba(52, 211, 153, 0.06)";
  ctx.fill();

  drawRoundedQuadPath(ctx, pts, 10 * dpr);
  ctx.lineWidth = (isLocked ? 3.2 : 2.5) * dpr;
  ctx.strokeStyle = isLocked ? "#10b981" : "#34d399";
  ctx.lineJoin = "round";
  ctx.stroke();

  pts.forEach((pt, idx) => {
    const prev = pts[(idx + 3) % 4];
    const next = pts[(idx + 1) % 4];
    const v1x = prev.x - pt.x;
    const v1y = prev.y - pt.y;
    const v2x = next.x - pt.x;
    const v2y = next.y - pt.y;
    const l1 = Math.max(1, Math.hypot(v1x, v1y));
    const l2 = Math.max(1, Math.hypot(v2x, v2y));
    const arm = 18 * dpr;

    ctx.beginPath();
    ctx.moveTo(pt.x + (v1x / l1) * arm, pt.y + (v1y / l1) * arm);
    ctx.lineTo(pt.x, pt.y);
    ctx.lineTo(pt.x + (v2x / l2) * arm, pt.y + (v2y / l2) * arm);
    ctx.lineWidth = 4 * dpr;
    ctx.strokeStyle = "#34d399";
    ctx.lineCap = "round";
    ctx.stroke();
  });

  ctx.restore();
}

function measureQuadDisplacement(quadA, quadB) {
  if (!quadA || !quadB || quadA.length !== 4 || quadB.length !== 4) return Infinity;
  let sumDist = 0;
  for (let i = 0; i < 4; i += 1) {
    sumDist += Math.hypot(quadA[i].x - quadB[i].x, quadA[i].y - quadB[i].y);
  }
  return sumDist / 4;
}

function updateDocumentAutoScanStability(quad) {
  if (!quad || docAutoScanTriggered) return;

  if (!docLastStableQuad) {
    docLastStableQuad = quad.map((p) => ({ ...p }));
    docStableHits = 1;
    return;
  }

  const avgMove = measureQuadDisplacement(docLastStableQuad, quad);
  if (avgMove <= 0.018) {
    docStableHits += 1;
    docLastStableQuad = quad.map((p, idx) => ({
      x: p.x * 0.5 + docLastStableQuad[idx].x * 0.5,
      y: p.y * 0.5 + docLastStableQuad[idx].y * 0.5
    }));
  } else {
    docLastStableQuad = quad.map((p) => ({ ...p }));
    docStableHits = 1;
  }
}

function runDocumentBoundaryFrame() {
  if (
    !isTextPhotoCameraActive() ||
    !isCameraRunning ||
    docAutoScanTriggered ||
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
  const maxSample = 320;
  const scale = Math.min(1, maxSample / Math.max(vw, vh));
  const sw = Math.max(40, Math.round(vw * scale));
  const sh = Math.max(40, Math.round(vh * scale));

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sw;
  sampleCanvas.height = sh;
  const sCtx = sampleCanvas.getContext("2d");
  if (!sCtx) return;

  sCtx.drawImage(videoEl, 0, 0, sw, sh);
  const focusInfo = { sharpness: 0, isSharp: false };
  const detectedQuad = detectDocumentQuadFromCanvas(sampleCanvas, sw, sh, focusInfo);

  const now = Date.now();
  if (!focusInfo.isSharp) {
    docFocusStableFrames = 0;
    isDocCameraFocused = false;
    lastDetectedDocQuad = null;
    smoothedDocQuad = null;
    docLastStableQuad = null;
    docStableHits = 0;
    drawDocumentBoundaryOverlay(null);

    if (now - docLastFocusTriggerAt > 1100 && typeof triggerAutoFocus === "function") {
      docLastFocusTriggerAt = now;
      triggerAutoFocus(false);
    }
    return;
  }

  docFocusStableFrames += 1;
  if (docFocusStableFrames >= 2) {
    isDocCameraFocused = true;
  }

  if (detectedQuad && isDocCameraFocused) {
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
      const alpha = maxJump > 0.1 ? 0.72 : 0.48;
      smoothedDocQuad = smoothedDocQuad.map((prev, idx) => ({
        x: prev.x + (detectedQuad[idx].x - prev.x) * alpha,
        y: prev.y + (detectedQuad[idx].y - prev.y) * alpha
      }));
    }
    drawDocumentBoundaryOverlay(smoothedDocQuad);
    updateDocumentAutoScanStability(detectedQuad);
  } else {
    docDetectMissCount += 1;
    docStableHits = Math.max(0, docStableHits - 1);
    if (docDetectMissCount > 4) {
      lastDetectedDocQuad = null;
      smoothedDocQuad = null;
      docLastStableQuad = null;
      docStableHits = 0;
      drawDocumentBoundaryOverlay(null);
    }
  }
}

function startDocumentBoundaryDetector() {
  stopDocumentBoundaryDetector();
  docAutoScanTriggered = false;
  docStableHits = 0;
  docLastStableQuad = null;
  isDocCameraFocused = false;
  docFocusStableFrames = 0;
  docLastFocusTriggerAt = Date.now();
  if (docDetectCanvas) {
    docDetectCanvas.classList.add("active");
  }
  if (typeof triggerAutoFocus === "function") {
    triggerAutoFocus(true);
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
  docLastStableQuad = null;
  docStableHits = 0;
  docAutoScanTriggered = false;
  docDetectMissCount = 0;
  isDocCameraFocused = false;
  docFocusStableFrames = 0;
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

// Auto-crop perspektif agar hasil berdiri tegak lurus (portrait/upright) & bersih
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

  let targetW = Math.max(240, Math.round((topW + botW) / 2));
  let targetH = Math.max(240, Math.round((leftH + rightH) / 2));

  // Jika dokumen lebih tinggi daripada lebarnya (berdiri), pertahankan orientasi berdiri
  if (targetH > targetW * 1.15 && naturalH >= naturalW) {
    const minSide = Math.max(targetW, 1100);
    const ratio = targetH / Math.max(1, targetW);
    targetW = minSide;
    targetH = Math.round(minSide * ratio);
  } else {
    const minClearDim = 1400;
    if (Math.max(targetW, targetH) < minClearDim) {
      const upScale = minClearDim / Math.max(targetW, targetH);
      targetW = Math.round(targetW * upScale);
      targetH = Math.round(targetH * upScale);
    }
  }

  const maxOutDim = 2100;
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

// Filter dokumen bersih putih jernih & teks/barcode tajam tanpa bercak hitam kasar (perbaikan SS 2)
function applyCamScannerDocumentFilter(canvas, wasCropped = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return;

  try {
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const total = w * h;
    const lum = new Uint8Array(total);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      lum[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    const hw = Math.max(64, Math.min(w, Math.round(w * 0.5)));
    const hh = Math.max(64, Math.min(h, Math.round(h * 0.5)));
    const gridLum = new Uint8Array(hw * hh);
    const xRatio = w / hw;
    const yRatio = h / hh;

    for (let gy = 0; gy < hh; gy += 1) {
      const sy = Math.min(h - 1, Math.round(gy * yRatio));
      const sOff = sy * w;
      const dOff = gy * hw;
      for (let gx = 0; gx < hw; gx += 1) {
        const sx = Math.min(w - 1, Math.round(gx * xRatio));
        gridLum[dOff + gx] = lum[sOff + sx];
      }
    }

    const dilateRadius = Math.max(16, Math.round(Math.min(hw, hh) / 18));
    const erodeRadius = Math.max(6, Math.round(dilateRadius * 0.45));
    const blurRadius = Math.max(20, Math.round(dilateRadius * 1.4));

    const dilated = separableMorphOp1D(gridLum, hw, hh, dilateRadius, true);
    const closed = separableMorphOp1D(dilated, hw, hh, erodeRadius, false);
    const bgMap = separableBoxBlurFloat(closed, hw, hh, blurRadius);

    // Pemutihan lembut agar latar kertas bersih putih & tinta teks/barcode tetap pekat alami
    const toneBuf = new Uint8Array(total);
    const darkFloorRatio = 0.34;
    const whiteCeilRatio = 0.88;
    const invSpan = 1 / (whiteCeilRatio - darkFloorRatio);

    for (let y = 0; y < h; y += 1) {
      const gy = Math.min(hh - 1.001, y / yRatio);
      const gy0 = Math.floor(gy);
      const gy1 = Math.min(hh - 1, gy0 + 1);
      const wy = gy - gy0;
      const oneMinusWy = 1 - wy;
      const rOff = y * w;

      for (let x = 0; x < w; x += 1) {
        const gx = Math.min(hw - 1.001, x / xRatio);
        const gx0 = Math.floor(gx);
        const gx1 = Math.min(hw - 1, gx0 + 1);
        const wx = gx - gx0;
        const oneMinusWx = 1 - wx;

        const b00 = bgMap[gy0 * hw + gx0];
        const b10 = bgMap[gy0 * hw + gx1];
        const b01 = bgMap[gy1 * hw + gx0];
        const b11 = bgMap[gy1 * hw + gx1];
        const localBg = Math.max(
          110,
          (b00 * oneMinusWx + b10 * wx) * oneMinusWy + (b01 * oneMinusWx + b11 * wx) * wy
        );

        const p = rOff + x;
        const rawLum = lum[p];
        const ratio = rawLum / localBg;

        let outVal;
        if (ratio >= whiteCeilRatio || rawLum >= 226) {
          outVal = 255;
        } else if (ratio <= darkFloorRatio) {
          outVal = Math.max(0, Math.round(rawLum * 0.45));
        } else {
          const t = (ratio - darkFloorRatio) * invSpan;
          const curved = Math.pow(t, 1.28);
          // Angkat nilai tengah sedikit agar abu-abu bayangan ikut bersih putih
          const lifted = Math.min(1, curved * 1.08);
          outVal = Math.round(255 * lifted);
        }
        toneBuf[p] = outVal;
      }
    }

    // Penajaman halus pada huruf, angka & barcode tanpa memicu bercak hitam
    const sharpBuf = new Uint8Array(toneBuf);
    for (let y = 1; y < h - 1; y += 1) {
      const rOff = y * w;
      const yPrev = rOff - w;
      const yNext = rOff + w;
      for (let x = 1; x < w - 1; x += 1) {
        const center = toneBuf[rOff + x];
        if (center < 245) {
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
          const sharpened = center + 0.35 * (center - blur);
          sharpBuf[rOff + x] =
            sharpened >= 238 ? 255 : Math.max(0, Math.min(255, Math.round(sharpened)));
        }
      }
    }

    if (wasCropped) {
      const borderPx = Math.max(2, Math.round(Math.min(w, h) * 0.005));
      for (let y = 0; y < h; y += 1) {
        const rOff = y * w;
        const nearY = y < borderPx || y >= h - borderPx;
        for (let x = 0; x < w; x += 1) {
          if (nearY || x < borderPx || x >= w - borderPx) {
            sharpBuf[rOff + x] = 255;
          }
        }
      }
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
    const maxSample = 380;
    const scale = Math.min(1, maxSample / Math.max(naturalW, naturalH));
    const sw = Math.max(40, Math.round(naturalW * scale));
    const sh = Math.max(40, Math.round(naturalH * scale));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sCtx = sampleCanvas.getContext("2d");
    if (sCtx) {
      sCtx.drawImage(img, 0, 0, sw, sh);
      quadToUse = detectDocumentQuadFromCanvas(sampleCanvas, sw, sh, null);
    }
  }

  let outputCanvas = null;
  let wasCropped = false;
  if (quadToUse && isValidDocumentQuadGeometry(quadToUse)) {
    outputCanvas = warpDocumentQuadToCanvas(img, quadToUse);
    if (outputCanvas) {
      wasCropped = true;
    }
  }

  if (!outputCanvas) {
    const maxDim = Math.max(naturalW, naturalH, 1);
    const targetDim = maxDim < 1400 ? 1550 : Math.min(2100, maxDim);
    const scale = targetDim / maxDim;
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.max(1, Math.round(naturalW * scale));
    outputCanvas.height = Math.max(1, Math.round(naturalH * scale));
    const oCtx = outputCanvas.getContext("2d");
    if (oCtx) {
      oCtx.imageSmoothingEnabled = true;
      oCtx.imageSmoothingQuality = "high";
      oCtx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
    }
  }

  applyCamScannerDocumentFilter(outputCanvas, wasCropped);
  return outputCanvas.toDataURL("image/jpeg", 0.99);
}
