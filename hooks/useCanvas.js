"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_UNDO = 50;
export const WORLD_W = 1920;
export const WORLD_H = 1080;
const DEFAULT_BG_COLOR = "#0d1020";
const MIN_SCALE = 0.05;
const MAX_SCALE = 40;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function ptDist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function ptMid(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

// Stack-based flood fill
function floodFill(imageData, sx, sy, fillRgb, tolerance) {
  const { data, width, height } = imageData;
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;
  const si = (sy * width + sx) * 4;
  const [tr, tg, tb, ta] = [data[si], data[si + 1], data[si + 2], data[si + 3]];
  const [fr, fg, fb] = fillRgb;
  if (tr === fr && tg === fg && tb === fb && ta === 255) return;
  const maxDist = tolerance * 10.2;
  const visited = new Uint8ClampedArray(width * height);
  const stack = [sx + sy * width];
  while (stack.length) {
    const idx = stack.pop();
    if (visited[idx]) continue;
    visited[idx] = 1;
    const x = idx % width,
      y = (idx / width) | 0;
    const pi = idx * 4;
    if (
      Math.abs(data[pi] - tr) +
        Math.abs(data[pi + 1] - tg) +
        Math.abs(data[pi + 2] - tb) +
        Math.abs(data[pi + 3] - ta) >
      maxDist
    )
      continue;
    data[pi] = fr;
    data[pi + 1] = fg;
    data[pi + 2] = fb;
    data[pi + 3] = 255;
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }
}

let scratchCanvas = null;
function getScratchCanvas(w, h) {
  if (!scratchCanvas) scratchCanvas = document.createElement("canvas");
  if (scratchCanvas.width !== w) scratchCanvas.width = w;
  if (scratchCanvas.height !== h) scratchCanvas.height = h;
  return scratchCanvas;
}

// Angle between three points in radians (0 = straight, PI = sharp reversal)
function angleBetween(a, b, c) {
  const v1x = a.x - b.x,
    v1y = a.y - b.y;
  const v2x = c.x - b.x,
    v2y = c.y - b.y;
  const d1 = Math.hypot(v1x, v1y),
    d2 = Math.hypot(v2x, v2y);
  if (d1 < 0.001 || d2 < 0.001) return 0;
  return Math.acos(
    clamp((v1x * v2x + v1y * v2y) / (d1 * d2), -1, 1),
  );
}

// Smooth path — uses line segments on sharp turns, curves on gentle arcs
function renderSmoothPath(ctx, pts, strokeStyle, lineWidth, alpha, comp) {
  if (!pts || pts.length < 2) return;

  const sc = getScratchCanvas(ctx.canvas.width, ctx.canvas.height);
  const sctx = sc.getContext("2d");
  sctx.clearRect(0, 0, sc.width, sc.height);

  sctx.strokeStyle = strokeStyle;
  sctx.lineWidth = lineWidth;
  sctx.lineCap = "round";
  sctx.lineJoin = "round";
  sctx.beginPath();
  sctx.moveTo(pts[0].x, pts[0].y);

  if (pts.length === 2) {
    sctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1],
        curr = pts[i],
        next = pts[i + 1];
      const ang = angleBetween(prev, curr, next);
      // Sharp turns (> ~55°) get straight segments to avoid corner bulging
      if (ang > 0.95) {
        sctx.lineTo(curr.x, curr.y);
      } else {
        const mx = (curr.x + next.x) / 2,
          my = (curr.y + next.y) / 2;
        sctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
    }
    sctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  sctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = comp || "source-over";
  ctx.globalAlpha = alpha ?? 1;
  ctx.drawImage(sc, 0, 0);
  ctx.restore();
}

function renderAirbrush(ctx, pts, color, radius, opacity) {
  if (!pts || !pts.length) return;
  const [r, g, b] = hexToRgb(color);
  ctx.save();
  for (const pt of pts) {
    const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${opacity * 0.35})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${opacity * 0.12})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShapeOnCtx(
  ctx,
  shapeType,
  x1,
  y1,
  x2,
  y2,
  strokeStyle,
  lineWidth,
  shiftKey,
) {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let w = x2 - x1,
    h = y2 - y1;
  if (shiftKey) {
    const s = Math.min(Math.abs(w), Math.abs(h));
    w = Math.sign(w) * s;
    h = Math.sign(h) * s;
  }
  ctx.beginPath();
  switch (shapeType) {
    case "rect":
      ctx.strokeRect(x1, y1, w, h);
      break;
    case "circle":
      ctx.ellipse(
        x1 + w / 2,
        y1 + h / 2,
        Math.abs(w / 2),
        Math.abs(h / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    case "line":
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    case "arrow": {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.hypot(x2 - x1, y2 - y1);
      const hl = Math.min(len * 0.25, lineWidth * 6 + 20);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - hl * Math.cos(ang - Math.PI / 6),
        y2 - hl * Math.sin(ang - Math.PI / 6),
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - hl * Math.cos(ang + Math.PI / 6),
        y2 - hl * Math.sin(ang + Math.PI / 6),
      );
      ctx.stroke();
      break;
    }
    case "triangle":
      ctx.moveTo((x1 + x2) / 2, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x1, y2);
      ctx.closePath();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useCanvas({
  tool = "pen",
  color = "#8cb9e0",
  strokeWidth = 4,
  brushType = "pen",
  brushOpacity = 1,
  smoothing = 0,
  shapeType = "rect",
  fillTolerance = 30,
  symmetryMode = null,
  simulatePressure = false,
  worldBgColor = "white",
  layers,
  activeLayerIndex = 0,
  isConnected = false,
  broadcastStroke,
  broadcastClear,
  onColorPicked,
  textFont = "Poppins, sans-serif",
  textSize = 24,
  textBold = false,
  textItalic = false,
  worldW = WORLD_W,
  worldH = WORLD_H,
} = {}) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const layerCanvasesRef = useRef({});
  const overlayRef = useRef(null);

  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [zoom, setZoom] = useState(1);

  const pointerCacheRef = useRef(new Map());
  const isDrawingRef = useRef(false);
  const isPinchingRef = useRef(false);
  const isPanningRef = useRef(false);
  const isMovingImageRef = useRef(false);
  const movingImageRef = useRef(null);
  const imageMoveStartRef = useRef({ x: 0, y: 0 });
  const imageObjectsRef = useRef([]);
  const panStartRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);
  const lastPinchDistRef = useRef(0);
  const lastPinchMidRef = useRef({ x: 0, y: 0 });
  const pointerPressureRef = useRef(0.5);

  const currentPtsRef = useRef([]);
  const smoothBufRef = useRef([]);
  const prevPtRef = useRef(null);
  const lastTimeRef = useRef(0);
  const lastDistRef = useRef(0);
  const stabilizerAnchorRef = useRef(null);

  const worldWRef = useRef(worldW);
  const worldHRef = useRef(worldH);

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const pathHistoryRef = useRef([]);

  const shapeStartRef = useRef(null);
  const shapeShiftRef = useRef(false);
  const lassoRef = useRef([]);
  const lassoPathRef = useRef(null);

  const [textState, setTextState] = useState({
    active: false,
    x: 0,
    y: 0,
    value: "",
  });
  const textStateRef = useRef({ active: false, x: 0, y: 0, value: "" });
  const [selectionState, setSelectionState] = useState({
    active: false,
    bounds: null,
  });

  const rafRef = useRef(null);
  const needsRedrawRef = useRef(false);
  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  const activeLayerIndexRef = useRef(activeLayerIndex);
  useEffect(() => {
    activeLayerIndexRef.current = activeLayerIndex;
  }, [activeLayerIndex]);

  // Refs for props used in callbacks (avoid stale closures)
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  const colorRef = useRef(color);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  const strokeWidthRef = useRef(strokeWidth);
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  const brushTypeRef = useRef(brushType);
  useEffect(() => {
    brushTypeRef.current = brushType;
  }, [brushType]);
  const brushOpacityRef = useRef(brushOpacity);
  useEffect(() => {
    brushOpacityRef.current = brushOpacity;
  }, [brushOpacity]);
  const smoothingRef = useRef(smoothing);
  useEffect(() => {
    smoothingRef.current = smoothing;
  }, [smoothing]);
  const shapeTypeRef = useRef(shapeType);
  useEffect(() => {
    shapeTypeRef.current = shapeType;
  }, [shapeType]);
  const fillToleranceRef = useRef(fillTolerance);
  useEffect(() => {
    fillToleranceRef.current = fillTolerance;
  }, [fillTolerance]);
  const symmetryModeRef = useRef(symmetryMode);
  useEffect(() => {
    symmetryModeRef.current = symmetryMode;
  }, [symmetryMode]);
  const simulatePressureRef = useRef(simulatePressure);
  useEffect(() => {
    simulatePressureRef.current = simulatePressure;
  }, [simulatePressure]);
  const worldBgColorRef = useRef(worldBgColor);
  useEffect(() => {
    worldBgColorRef.current = worldBgColor;
  }, [worldBgColor]);

  const getBgColor = useCallback(() => worldBgColorRef.current || DEFAULT_BG_COLOR, []);
  const textFontRef = useRef(textFont);
  useEffect(() => {
    textFontRef.current = textFont;
  }, [textFont]);
  const textSizeRef = useRef(textSize);
  useEffect(() => {
    textSizeRef.current = textSize;
  }, [textSize]);
  const textBoldRef = useRef(textBold);
  useEffect(() => {
    textBoldRef.current = textBold;
  }, [textBold]);
  const textItalicRef = useRef(textItalic);
  useEffect(() => {
    textItalicRef.current = textItalic;
  }, [textItalic]);

  // ── Space key for pan mode ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        !e.target.closest("input, textarea, select, button")
      ) {
        e.preventDefault();
        spaceHeldRef.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        spaceHeldRef.current = false;
        if (canvasRef.current && !isPanningRef.current)
          canvasRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── Layer helpers ─────────────────────────────────────────────────────────────
  const ensureLayerCanvas = useCallback((id) => {
    if (!layerCanvasesRef.current[id]) {
      const c = document.createElement("canvas");
      c.width = worldWRef.current;
      c.height = worldHRef.current;
      layerCanvasesRef.current[id] = c;
    }
    return layerCanvasesRef.current[id];
  }, []);

  const getLayerCanvas = useCallback(
    (id) => layerCanvasesRef.current[id] ?? null,
    [],
  );
  const initLayerCanvas = useCallback(
    (id) => {
      const c = ensureLayerCanvas(id);
      c.getContext("2d").clearRect(0, 0, worldWRef.current, worldHRef.current);
    },
    [ensureLayerCanvas],
  );
  const deleteLayerCanvas = useCallback((id) => {
    delete layerCanvasesRef.current[id];
  }, []);

  const updateTransform = useCallback((t) => {
    transformRef.current = t;
    setTransform(t);
    setZoom(t.scale);
  }, []);

  const getBackgroundLayerId = useCallback(() => {
    const ls = layersRef.current;
    return ls?.[0]?.id ?? null;
  }, []);

  // ── Composite ─────────────────────────────────────────────────────────────────
  const composite = useCallback(() => {
    const canvas = canvasRef.current,
      ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { scale, offsetX, offsetY } = transformRef.current;
    const ls = layersRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.fillStyle = getBgColor();
    ctx.fillRect(0, 0, worldWRef.current, worldHRef.current);

    if (ls) {
      for (const l of ls) {
        if (!l.visible) continue;
        const lc = layerCanvasesRef.current[l.id];
        if (!lc) continue;
        ctx.globalAlpha = l.opacity;
        ctx.drawImage(lc, 0, 0);
      }
    }
    ctx.globalAlpha = 1;
    const ov = overlayRef.current;
    if (ov) ctx.drawImage(ov, 0, 0);

    // Imported images (movable overlays)
    for (const imgObj of imageObjectsRef.current) {
      ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
    }

    const sm = symmetryModeRef.current;
    if (sm) {
      ctx.save();
      ctx.strokeStyle = "rgba(140,185,224,0.45)";
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([6 / scale, 6 / scale]);
      if (sm === "h" || sm === "both") {
        ctx.beginPath();
        ctx.moveTo(worldWRef.current / 2, 0);
        ctx.lineTo(worldWRef.current / 2, worldHRef.current);
        ctx.stroke();
      }
      if (sm === "v" || sm === "both") {
        ctx.beginPath();
        ctx.moveTo(0, worldHRef.current / 2);
        ctx.lineTo(worldWRef.current, worldHRef.current / 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [getBgColor]);

  const scheduleRedraw = useCallback(() => {
    needsRedrawRef.current = true;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (needsRedrawRef.current) {
          needsRedrawRef.current = false;
          composite();
        }
      });
    }
  }, [composite]);

  // ── Init ──────────────────────────────────────────────────────────────────────
  const initCanvas = useCallback(
    (el) => {
      if (!el) return;
      canvasRef.current = el;
      el.width = window.innerWidth;
      el.height = window.innerHeight;
      const ctx = el.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      const ov = document.createElement("canvas");
      ov.width = worldWRef.current;
      ov.height = worldHRef.current;
      overlayRef.current = ov;
      const s =
        Math.min(el.width / worldWRef.current, el.height / worldHRef.current) *
        0.92;
      updateTransform({
        scale: s,
        offsetX: (el.width - worldWRef.current * s) / 2,
        offsetY: (el.height - worldHRef.current * s) / 2,
      });
      const ls = layersRef.current;
      if (ls) {
        ls.forEach((l, i) => {
          ensureLayerCanvas(l.id);
          if (i === 0) {
            const lc = layerCanvasesRef.current[l.id];
            const lctx = lc.getContext("2d");
            lctx.fillStyle = getBgColor();
            lctx.fillRect(0, 0, worldWRef.current, worldHRef.current);
          }
        });
      }
      composite();
      const onResize = () => {
        el.width = window.innerWidth;
        el.height = window.innerHeight;
        scheduleRedraw();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    },
    [ensureLayerCanvas, composite, scheduleRedraw, getBgColor, updateTransform],
  );

  useEffect(() => {
    if (!layers) return;
    layers.forEach((l) => ensureLayerCanvas(l.id));
    scheduleRedraw();
  }, [layers, ensureLayerCanvas, scheduleRedraw]);

  // ── Transform ─────────────────────────────────────────────────────────────────
  const screenToWorld = useCallback((sx, sy) => {
    const { scale, offsetX, offsetY } = transformRef.current;
    return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
  }, []);

  const worldToScreen = useCallback((wx, wy) => {
    const { scale, offsetX, offsetY } = transformRef.current;
    return { x: wx * scale + offsetX, y: wy * scale + offsetY };
  }, []);

  const hitTestImage = useCallback((wx, wy) => {
    const imgs = imageObjectsRef.current;
    for (let i = imgs.length - 1; i >= 0; i--) {
      const img = imgs[i];
      if (
        wx >= img.x &&
        wx <= img.x + img.w &&
        wy >= img.y &&
        wy <= img.y + img.h
      )
        return img;
    }
    return null;
  }, []);

  // ── Undo/Redo ─────────────────────────────────────────────────────────────────
  const getActiveLayerId = useCallback(() => {
    const ls = layersRef.current;
    return ls?.[activeLayerIndexRef.current]?.id ?? null;
  }, []);

  const isBackgroundLayer = useCallback(() => {
    return getActiveLayerId() === getBackgroundLayerId();
  }, [getActiveLayerId, getBackgroundLayerId]);

  const pushUndo = useCallback(() => {
    const id = getActiveLayerId();
    if (!id) return;
    const lc = layerCanvasesRef.current[id];
    if (!lc) return;
    const imageData = lc
      .getContext("2d")
      .getImageData(0, 0, worldWRef.current, worldHRef.current);
    undoStackRef.current.push({ layerId: id, imageData });
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, [getActiveLayerId]);

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    const lc = layerCanvasesRef.current[entry.layerId];
    if (!lc) return;
    const lctx = lc.getContext("2d");
    redoStackRef.current.push({
      layerId: entry.layerId,
      imageData: lctx.getImageData(0, 0, worldWRef.current, worldHRef.current),
    });
    lctx.putImageData(entry.imageData, 0, 0);
    scheduleRedraw();
  }, [scheduleRedraw]);

  const redo = useCallback(() => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    const lc = layerCanvasesRef.current[entry.layerId];
    if (!lc) return;
    const lctx = lc.getContext("2d");
    undoStackRef.current.push({
      layerId: entry.layerId,
      imageData: lctx.getImageData(0, 0, worldWRef.current, worldHRef.current),
    });
    lctx.putImageData(entry.imageData, 0, 0);
    scheduleRedraw();
  }, [scheduleRedraw]);

  // ── Drawing primitives ────────────────────────────────────────────────────────
  const getActiveCtx = useCallback(() => {
    const id = getActiveLayerId();
    if (!id) return null;
    const lc = layerCanvasesRef.current[id];
    return lc ? lc.getContext("2d") : null;
  }, [getActiveLayerId]);

  const drawPathToCtx = useCallback(
    (ctx, pts, opts) => {
      const { color: c, width: w, opacity: op, erase, brushType: bt, eraseToBg } =
        opts;
      if (!ctx || !pts || pts.length < 2) return;
      if (bt === "airbrush" && !erase) {
        renderAirbrush(ctx, pts, c, w * 2, op);
        return;
      }
      let sw = w,
        alpha = op,
        comp = "source-over",
        ss = c;
      if (erase) {
        if (eraseToBg) {
          comp = "source-over";
          ss = getBgColor();
        } else {
          comp = "destination-out";
          ss = "rgba(0,0,0,1)";
        }
        sw = w * 2.5;
        alpha = 1;
      } else
        switch (bt) {
          case "pencil":
            alpha = op * 0.55;
            sw = w * 0.8;
            break;
          case "marker":
            alpha = op * 0.85;
            sw = w * 1.4;
            break;
          case "watercolor":
            alpha = op * 0.12;
            sw = w * 1.3;
            break;
        }
      renderSmoothPath(ctx, pts, ss, sw, alpha, comp);
      if (bt === "watercolor" && !erase)
        renderSmoothPath(ctx, pts, ss, sw * 1.8, alpha * 0.4, comp);
    },
    [getBgColor],
  );

  const clearOverlay = useCallback(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    ov.getContext("2d").clearRect(0, 0, worldWRef.current, worldHRef.current);
  }, []);

  const commitStroke = useCallback(
    (pts, opts) => {
      const ctx = getActiveCtx();
      if (!ctx) return;
      drawPathToCtx(ctx, pts, opts);
      const sm = symmetryModeRef.current;
      if (sm && !opts.erase) {
        const mirrors = [];
        if (sm === "h" || sm === "both")
          mirrors.push(
            pts.map((p) => ({ x: worldWRef.current - p.x, y: p.y })),
          );
        if (sm === "v" || sm === "both")
          mirrors.push(
            pts.map((p) => ({ x: p.x, y: worldHRef.current - p.y })),
          );
        if (sm === "both")
          mirrors.push(
            pts.map((p) => ({
              x: worldWRef.current - p.x,
              y: worldHRef.current - p.y,
            })),
          );
        for (const mp of mirrors) drawPathToCtx(ctx, mp, opts);
      }
    },
    [getActiveCtx, drawPathToCtx],
  );

  // ── Stabilizer (pulled-string / lazy brush) ────────────────────────────────────
  const getSmoothedPt = useCallback((rawPt) => {
    const strength = smoothingRef.current;
    if (strength <= 0) return rawPt;

    // Dead zone radius scales with smoothing (1–100 → 2–40px)
    const deadZone = 2 + (strength / 100) * 38;

    if (!stabilizerAnchorRef.current) {
      stabilizerAnchorRef.current = { x: rawPt.x, y: rawPt.y };
      return rawPt;
    }

    const anchor = stabilizerAnchorRef.current;
    const dx = rawPt.x - anchor.x;
    const dy = rawPt.y - anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= deadZone) return { ...anchor, pressure: rawPt.pressure };

    // Pull toward cursor, leaving deadZone gap
    const pull = (dist - deadZone) / dist;
    anchor.x += dx * pull;
    anchor.y += dy * pull;

    return { x: anchor.x, y: anchor.y, pressure: rawPt.pressure };
  }, []);

  const getPressureWidth = useCallback((base, pressure) => {
    if (!simulatePressureRef.current) return base;
    const p = pressure ?? pointerPressureRef.current;
    // Real stylus/tablet pressure (0–1); 0.5 is the mouse default
    if (p > 0 && p < 1 && Math.abs(p - 0.5) > 0.02) {
      return base * clamp(p * 1.8, 0.3, 2.5);
    }
    // Mouse fallback: thin when fast, thick when slow
    const now = performance.now();
    const dt = Math.max(now - lastTimeRef.current, 1);
    lastTimeRef.current = now;
    const speed = lastDistRef.current / dt;
    lastDistRef.current = 0;
    return base * clamp(1.4 - speed * 0.06, 0.35, 1.8);
  }, []);

  // ── Wheel zoom ────────────────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const { scale, offsetX, offsetY } = transformRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      const sx = e.clientX - (rect?.left ?? 0),
        sy = e.clientY - (rect?.top ?? 0);
      const wx = (sx - offsetX) / scale,
        wy = (sy - offsetY) / scale;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const ns = clamp(scale * delta, MIN_SCALE, MAX_SCALE);
      updateTransform({
        scale: ns,
        offsetX: sx - wx * ns,
        offsetY: sy - wy * ns,
      });
      scheduleRedraw();
    },
    [scheduleRedraw, updateTransform],
  );

  // ── Pointer Down ──────────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      const nx = e.clientX - (rect?.left ?? 0),
        ny = e.clientY - (rect?.top ?? 0);
      pointerCacheRef.current.set(e.pointerId, { clientX: nx, clientY: ny });

      if (pointerCacheRef.current.size === 2) {
        isPinchingRef.current = true;
        isDrawingRef.current = false;
        clearOverlay();
        scheduleRedraw();
        const pts = [...pointerCacheRef.current.values()];
        lastPinchDistRef.current = ptDist(pts[0], pts[1]);
        lastPinchMidRef.current = ptMid(pts[0], pts[1]);
        return;
      }
      if (pointerCacheRef.current.size > 1) return;

      const { x: wx, y: wy } = screenToWorld(nx, ny);

      // Middle mouse on image → move image; otherwise pan
      if (e.button === 1) {
        const hit = hitTestImage(wx, wy);
        if (hit) {
          isMovingImageRef.current = true;
          movingImageRef.current = hit;
          imageMoveStartRef.current = { x: wx - hit.x, y: wy - hit.y };
          canvasRef.current?.setPointerCapture(e.pointerId);
          if (canvasRef.current) canvasRef.current.style.cursor = "move";
          return;
        }
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        canvasRef.current?.setPointerCapture(e.pointerId);
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        return;
      }

      // Space + click → pan only (no tool action)
      if (spaceHeldRef.current) {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        canvasRef.current?.setPointerCapture(e.pointerId);
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        return;
      }

      pointerPressureRef.current = e.pressure || 0.5;
      const t = toolRef.current;

      if (t === "text") {
        const ns = { active: true, x: wx, y: wy, value: "" };
        textStateRef.current = ns;
        setTextState(ns);
        return;
      }

      if (t === "fill") {
        pushUndo();
        const id = getActiveLayerId();
        if (!id) return;
        const lc = layerCanvasesRef.current[id];
        if (!lc) return;
        const lctx = lc.getContext("2d");
        const imgData = lctx.getImageData(
          0,
          0,
          worldWRef.current,
          worldHRef.current,
        );
        const fillRgb = isBackgroundLayer()
          ? hexToRgb(getBgColor())
          : hexToRgb(colorRef.current);
        floodFill(
          imgData,
          wx,
          wy,
          fillRgb,
          fillToleranceRef.current,
        );
        lctx.putImageData(imgData, 0, 0);
        scheduleRedraw();
        return;
      }

      if (t === "eyedropper") {
        const tmp = document.createElement("canvas");
        tmp.width = worldWRef.current;
        tmp.height = worldHRef.current;
        const tctx = tmp.getContext("2d");
        tctx.fillStyle = getBgColor();
        tctx.fillRect(0, 0, worldWRef.current, worldHRef.current);
        const ls = layersRef.current;
        if (ls) {
          for (const l of ls) {
            if (!l.visible) continue;
            const lc = layerCanvasesRef.current[l.id];
            if (lc) {
              tctx.globalAlpha = l.opacity;
              tctx.drawImage(lc, 0, 0);
            }
          }
        }
        tctx.globalAlpha = 1;
        const px = Math.floor(wx),
          py = Math.floor(wy);
        if (
          px >= 0 &&
          px < worldWRef.current &&
          py >= 0 &&
          py < worldHRef.current
        ) {
          const d = tctx.getImageData(px, py, 1, 1).data;
          onColorPicked?.(rgbToHex(d[0], d[1], d[2]));
        }
        return;
      }

      if (t === "shape") {
        pushUndo();
        shapeStartRef.current = { x: wx, y: wy };
        shapeShiftRef.current = e.shiftKey;
        isDrawingRef.current = true;
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }

      if (t === "lasso") {
        lassoRef.current = [{ x: wx, y: wy }];
        isDrawingRef.current = true;
        clearOverlay();
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }

      pushUndo();
      isDrawingRef.current = true;
      currentPtsRef.current = [{ x: wx, y: wy }];
      smoothBufRef.current = [{ x: wx, y: wy }];
      stabilizerAnchorRef.current = null;
      prevPtRef.current = { x: wx, y: wy };
      lastTimeRef.current = performance.now();
      lastDistRef.current = 0;
      clearOverlay();
      canvasRef.current?.setPointerCapture(e.pointerId);
    },
    [
      screenToWorld,
      hitTestImage,
      pushUndo,
      getActiveLayerId,
      isBackgroundLayer,
      getBgColor,
      clearOverlay,
      scheduleRedraw,
      onColorPicked,
    ],
  );

  // ── Pointer Move ──────────────────────────────────────────────────────────────
  const onPointerMove = useCallback(
    (e) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      const nx = e.clientX - (rect?.left ?? 0),
        ny = e.clientY - (rect?.top ?? 0);
      pointerCacheRef.current.set(e.pointerId, { clientX: nx, clientY: ny });

      if (isPinchingRef.current && pointerCacheRef.current.size === 2) {
        const pts = [...pointerCacheRef.current.values()];
        const newDist = ptDist(pts[0], pts[1]),
          newMid = ptMid(pts[0], pts[1]);
        const { scale, offsetX, offsetY } = transformRef.current;
        const ratio = newDist / (lastPinchDistRef.current || newDist);
        const ns = clamp(scale * ratio, MIN_SCALE, MAX_SCALE);
        const wx = (newMid.x - offsetX) / scale,
          wy = (newMid.y - offsetY) / scale;
        const panDx = newMid.x - lastPinchMidRef.current.x,
          panDy = newMid.y - lastPinchMidRef.current.y;
        updateTransform({
          scale: ns,
          offsetX: newMid.x - wx * ns + panDx * 0.3,
          offsetY: newMid.y - wy * ns + panDy * 0.3,
        });
        lastPinchDistRef.current = newDist;
        lastPinchMidRef.current = newMid;
        scheduleRedraw();
        return;
      }

      // Moving imported image with middle mouse
      if (isMovingImageRef.current && movingImageRef.current) {
        const { x: wx, y: wy } = screenToWorld(nx, ny);
        movingImageRef.current.x = wx - imageMoveStartRef.current.x;
        movingImageRef.current.y = wy - imageMoveStartRef.current.y;
        scheduleRedraw();
        return;
      }

      // Panning with middle mouse / space+drag
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        updateTransform({
          ...transformRef.current,
          offsetX: transformRef.current.offsetX + dx,
          offsetY: transformRef.current.offsetY + dy,
        });
        panStartRef.current = { x: e.clientX, y: e.clientY };
        scheduleRedraw();
        return;
      }

      if (spaceHeldRef.current) return;

      if (!isDrawingRef.current) return;
      pointerPressureRef.current = e.pressure || 0.5;
      const { x: wx, y: wy } = screenToWorld(nx, ny);
      const t = toolRef.current;

      if (t === "shape" && shapeStartRef.current) {
        const ov = overlayRef.current?.getContext("2d");
        if (ov) {
          ov.clearRect(0, 0, worldWRef.current, worldHRef.current);
          drawShapeOnCtx(
            ov,
            shapeTypeRef.current,
            shapeStartRef.current.x,
            shapeStartRef.current.y,
            wx,
            wy,
            colorRef.current,
            strokeWidthRef.current,
            e.shiftKey || shapeShiftRef.current,
          );
          scheduleRedraw();
        }
        return;
      }

      if (t === "lasso") {
        lassoRef.current.push({ x: wx, y: wy });
        const ov = overlayRef.current?.getContext("2d");
        if (ov) {
          ov.clearRect(0, 0, worldWRef.current, worldHRef.current);
          ov.save();
          ov.strokeStyle = "rgba(140,185,224,0.8)";
          ov.lineWidth = 1.5;
          ov.setLineDash([5, 5]);
          ov.beginPath();
          const lpts = lassoRef.current;
          ov.moveTo(lpts[0].x, lpts[0].y);
          for (let i = 1; i < lpts.length; i++) ov.lineTo(lpts[i].x, lpts[i].y);
          ov.stroke();
          ov.restore();
          scheduleRedraw();
        }
        return;
      }

      const rawPt = { x: wx, y: wy, pressure: e.pressure || 0.5 };
      const pt = getSmoothedPt(rawPt);
      const prev = prevPtRef.current;
      const minDist = Math.max(0.1, strokeWidthRef.current * 0.05);
      if (
        prev &&
        Math.abs(pt.x - prev.x) < minDist &&
        Math.abs(pt.y - prev.y) < minDist
      ) {
        return;
      }
      if (prev) lastDistRef.current += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      const w = getPressureWidth(strokeWidthRef.current, pt.pressure);

      if (t === "smudge") {
        const lc = layerCanvasesRef.current[getActiveLayerId()];
        if (lc && prev) {
          const lctx = lc.getContext("2d");
          const r = Math.ceil(strokeWidthRef.current * 2);
          const x0 = Math.max(0, Math.floor(prev.x - r)),
            y0 = Math.max(0, Math.floor(prev.y - r));
          const pw = Math.min(r * 2, worldWRef.current - x0),
            ph = Math.min(r * 2, worldHRef.current - y0);
          if (pw > 0 && ph > 0) {
            const patch = lctx.getImageData(x0, y0, pw, ph);
            const tmp = document.createElement("canvas");
            tmp.width = pw;
            tmp.height = ph;
            const tc = tmp.getContext("2d");
            tc.imageSmoothingEnabled = true;
            tc.imageSmoothingQuality = "high";
            tc.putImageData(patch, 0, 0);
            lctx.save();
            lctx.imageSmoothingEnabled = true;
            lctx.imageSmoothingQuality = "high";
            lctx.globalAlpha = 0.3;
            lctx.filter = "blur(0.5px)";
            lctx.drawImage(tmp, Math.floor(pt.x - r), Math.floor(pt.y - r));
            lctx.restore();
          }
        }
        prevPtRef.current = pt;
        scheduleRedraw();
        return;
      }

      if (t === "blur") {
        const lc = layerCanvasesRef.current[getActiveLayerId()];
        if (lc) {
          const lctx = lc.getContext("2d");
          const r = Math.ceil(strokeWidthRef.current * 1.5);
          const x0 = Math.max(0, Math.floor(pt.x - r)),
            y0 = Math.max(0, Math.floor(pt.y - r));
          const rw = Math.min(r * 2, worldWRef.current - x0),
            rh = Math.min(r * 2, worldHRef.current - y0);
          if (rw > 0 && rh > 0) {
            const patch = lctx.getImageData(x0, y0, rw, rh);
            const d = patch.data,
              out = new Uint8ClampedArray(d.length);
            for (let py = 0; py < rh; py++)
              for (let px = 0; px < rw; px++) {
                let ra = 0,
                  ga = 0,
                  ba = 0,
                  aa = 0,
                  cnt = 0;
                for (let ky = -1; ky <= 1; ky++)
                  for (let kx = -1; kx <= 1; kx++) {
                    const nx2 = px + kx,
                      ny2 = py + ky;
                    if (nx2 >= 0 && nx2 < rw && ny2 >= 0 && ny2 < rh) {
                      const ki = (ny2 * rw + nx2) * 4;
                      ra += d[ki];
                      ga += d[ki + 1];
                      ba += d[ki + 2];
                      aa += d[ki + 3];
                      cnt++;
                    }
                  }
                const oi = (py * rw + px) * 4;
                out[oi] = ra / cnt;
                out[oi + 1] = ga / cnt;
                out[oi + 2] = ba / cnt;
                out[oi + 3] = aa / cnt;
              }
            patch.data.set(out);
            lctx.putImageData(patch, x0, y0);
          }
        }
        prevPtRef.current = pt;
        scheduleRedraw();
        return;
      }

      currentPtsRef.current.push(pt);
      const ov = overlayRef.current?.getContext("2d");
      if (ov) {
        ov.clearRect(0, 0, worldWRef.current, worldHRef.current);
        const opts = {
          color: colorRef.current,
          width: w,
          opacity: brushOpacityRef.current,
          erase: t === "eraser",
          eraseToBg: t === "eraser" && isBackgroundLayer(),
          brushType: brushTypeRef.current,
        };
        if (t === "eraser") {
          // Draw directly to layer for real-time eraser feedback
          const lctx = getActiveCtx();
          if (lctx && currentPtsRef.current.length >= 2) {
            drawPathToCtx(lctx, currentPtsRef.current.slice(-2), opts);
          }
        } else {
          drawPathToCtx(ov, currentPtsRef.current, opts);
        }
        const sm = symmetryModeRef.current;
        if (sm && !opts.erase) {
          const mpts = currentPtsRef.current;
          if (sm === "h" || sm === "both")
            drawPathToCtx(
              ov,
              mpts.map((p) => ({ x: worldWRef.current - p.x, y: p.y })),
              opts,
            );
          if (sm === "v" || sm === "both")
            drawPathToCtx(
              ov,
              mpts.map((p) => ({ x: p.x, y: worldHRef.current - p.y })),
              opts,
            );
          if (sm === "both")
            drawPathToCtx(
              ov,
              mpts.map((p) => ({
                x: worldWRef.current - p.x,
                y: worldHRef.current - p.y,
              })),
              opts,
            );
        }
      }
      prevPtRef.current = pt;
      scheduleRedraw();
    },
    [
      screenToWorld,
      updateTransform,
      getSmoothedPt,
      getPressureWidth,
      getActiveLayerId,
      isBackgroundLayer,
      drawPathToCtx,
      scheduleRedraw,
    ],
  );

  // ── Pointer Up ────────────────────────────────────────────────────────────────
  const onPointerUp = useCallback(
    (e) => {
      e?.preventDefault?.();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (e) pointerCacheRef.current.delete(e.pointerId);
      if (pointerCacheRef.current.size < 2) isPinchingRef.current = false;
      if (isMovingImageRef.current) {
        isMovingImageRef.current = false;
        movingImageRef.current = null;
        if (canvasRef.current)
          canvasRef.current.style.cursor = spaceHeldRef.current ? "grab" : "";
        return;
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        if (canvasRef.current)
          canvasRef.current.style.cursor = spaceHeldRef.current ? "grab" : "";
        return;
      }
      if (pointerCacheRef.current.size === 1) return;
      if (!isDrawingRef.current) {
        isDrawingRef.current = false;
        return;
      }
      isDrawingRef.current = false;
      clearOverlay();
      const t = toolRef.current;

      if (t === "shape" && shapeStartRef.current) {
        const nx = (e?.clientX ?? 0) - (rect?.left ?? 0),
          ny = (e?.clientY ?? 0) - (rect?.top ?? 0);
        const { x: wx, y: wy } = screenToWorld(nx, ny);
        const ctx = getActiveCtx();
        if (ctx)
          drawShapeOnCtx(
            ctx,
            shapeTypeRef.current,
            shapeStartRef.current.x,
            shapeStartRef.current.y,
            wx,
            wy,
            colorRef.current,
            strokeWidthRef.current,
            e?.shiftKey || shapeShiftRef.current,
          );
        shapeStartRef.current = null;
        scheduleRedraw();
        return;
      }

      if (t === "lasso") {
        const lpts = lassoRef.current;
        if (lpts.length > 3) {
          const xs = lpts.map((p) => p.x),
            ys = lpts.map((p) => p.y);
          const bounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys),
          };
          lassoPathRef.current = lpts;
          setSelectionState({ active: true, bounds });
          const ov = overlayRef.current?.getContext("2d");
          if (ov) {
            ov.clearRect(0, 0, worldWRef.current, worldHRef.current);
            ov.save();
            ov.strokeStyle = "#8cb9e0";
            ov.lineWidth = 1.5;
            ov.setLineDash([5, 5]);
            ov.beginPath();
            ov.moveTo(lpts[0].x, lpts[0].y);
            for (let i = 1; i < lpts.length; i++)
              ov.lineTo(lpts[i].x, lpts[i].y);
            ov.closePath();
            ov.stroke();
            ov.restore();
          }
        }
        scheduleRedraw();
        return;
      }

      const pts = currentPtsRef.current;
      if (pts.length > 1) {
        const w = strokeWidthRef.current;
        const opts = {
          color: colorRef.current,
          width: w,
          opacity: brushOpacityRef.current,
          erase: t === "eraser",
          eraseToBg: t === "eraser" && isBackgroundLayer(),
          brushType: brushTypeRef.current,
        };
        // Eraser was already drawn to layer in real-time; skip commitStroke
        if (t !== "eraser") {
          commitStroke(pts, opts);
        }
        const path = { points: pts, ...opts };
        pathHistoryRef.current.push(path);
        if (isConnected && broadcastStroke) broadcastStroke({ path });
      }
      currentPtsRef.current = [];
      smoothBufRef.current = [];
      stabilizerAnchorRef.current = null;
      scheduleRedraw();
    },
    [
      screenToWorld,
      getActiveCtx,
      commitStroke,
      clearOverlay,
      scheduleRedraw,
      isConnected,
      broadcastStroke,
    ],
  );

  // ── Text ──────────────────────────────────────────────────────────────────────
  const setTextValue = useCallback((v) => {
    const ns = { ...textStateRef.current, value: v };
    textStateRef.current = ns;
    setTextState(ns);
  }, []);

  const commitText = useCallback(() => {
    const { active, x, y, value } = textStateRef.current;
    if (!active || !value.trim()) {
      const ns = { active: false, x: 0, y: 0, value: "" };
      textStateRef.current = ns;
      setTextState(ns);
      return;
    }
    pushUndo();
    const ctx = getActiveCtx();
    if (ctx) {
      const style = `${textItalicRef.current ? "italic " : ""}${textBoldRef.current ? "bold " : ""}${textSizeRef.current}px ${textFontRef.current}`;
      ctx.save();
      ctx.font = style;
      ctx.fillStyle = colorRef.current;
      ctx.globalAlpha = brushOpacityRef.current;
      ctx.fillText(value, x, y + textSizeRef.current);
      ctx.restore();
    }
    const ns = { active: false, x: 0, y: 0, value: "" };
    textStateRef.current = ns;
    setTextState(ns);
    scheduleRedraw();
  }, [pushUndo, getActiveCtx, scheduleRedraw]);

  const cancelText = useCallback(() => {
    const ns = { active: false, x: 0, y: 0, value: "" };
    textStateRef.current = ns;
    setTextState(ns);
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    lassoPathRef.current = null;
    setSelectionState({ active: false, bounds: null });
    clearOverlay();
    scheduleRedraw();
  }, [clearOverlay, scheduleRedraw]);

  const deleteSelection = useCallback(() => {
    const pts = lassoPathRef.current;
    if (!pts || pts.length < 3) return;
    pushUndo();
    const ctx = getActiveCtx();
    if (ctx) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      if (isBackgroundLayer()) {
        ctx.fillStyle = getBgColor();
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.globalCompositeOperation = "destination-out";
      }
      ctx.fill();
      ctx.restore();
    }
    clearSelection();
  }, [pushUndo, getActiveCtx, clearSelection, isBackgroundLayer, getBgColor]);

  // ── Zoom controls ─────────────────────────────────────────────────────────────
  const applyZoom = useCallback(
    (ns, cx, cy) => {
      const { scale, offsetX, offsetY } = transformRef.current;
      cx = cx ?? canvasRef.current?.width / 2 ?? 0;
      cy = cy ?? canvasRef.current?.height / 2 ?? 0;
      const wx = (cx - offsetX) / scale,
        wy = (cy - offsetY) / scale;
      const s = clamp(ns, MIN_SCALE, MAX_SCALE);
      updateTransform({
        scale: s,
        offsetX: cx - wx * s,
        offsetY: cy - wy * s,
      });
      scheduleRedraw();
    },
    [scheduleRedraw, updateTransform],
  );

  const zoomIn = useCallback(
    () => applyZoom(transformRef.current.scale * 1.25),
    [applyZoom],
  );
  const zoomOut = useCallback(
    () => applyZoom(transformRef.current.scale * 0.8),
    [applyZoom],
  );
  const resetZoom = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    updateTransform({
      scale: 1,
      offsetX: (c.width - worldWRef.current) / 2,
      offsetY: (c.height - worldHRef.current) / 2,
    });
    scheduleRedraw();
  }, [scheduleRedraw, updateTransform]);
  const fitToScreen = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const s =
      Math.min(c.width / worldWRef.current, c.height / worldHRef.current) *
      0.92;
    updateTransform({
      scale: s,
      offsetX: (c.width - worldWRef.current * s) / 2,
      offsetY: (c.height - worldHRef.current * s) / 2,
    });
    scheduleRedraw();
  }, [scheduleRedraw, updateTransform]);

  // ── Clear ─────────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    pushUndo();
    const ls = layersRef.current;
    if (ls) {
      for (const l of ls) {
        const lc = layerCanvasesRef.current[l.id];
        if (!lc) continue;
        const lctx = lc.getContext("2d");
        lctx.clearRect(0, 0, worldWRef.current, worldHRef.current);
        if (l.id === ls[0]?.id) {
          lctx.fillStyle = getBgColor();
          lctx.fillRect(0, 0, worldWRef.current, worldHRef.current);
        }
      }
    }
    pathHistoryRef.current = [];
    clearOverlay();
    scheduleRedraw();
    if (isConnected && broadcastClear) broadcastClear();
  }, [pushUndo, clearOverlay, scheduleRedraw, isConnected, broadcastClear]);

  // ── Export ────────────────────────────────────────────────────────────────────
  const exportPng = useCallback(() => {
    const tmp = document.createElement("canvas");
    tmp.width = worldWRef.current;
    tmp.height = worldHRef.current;
    const tctx = tmp.getContext("2d");
    tctx.fillStyle = getBgColor();
    tctx.fillRect(0, 0, worldWRef.current, worldHRef.current);
    const ls = layersRef.current;
    if (ls) {
      for (const l of ls) {
        if (!l.visible) continue;
        const lc = layerCanvasesRef.current[l.id];
        if (lc) {
          tctx.globalAlpha = l.opacity;
          tctx.drawImage(lc, 0, 0);
        }
      }
    }
    tctx.globalAlpha = 1;
    return tmp.toDataURL("image/png");
  }, []);

  // ── Import image ──────────────────────────────────────────────────────────────
  const importImage = useCallback(
    (dataUrl) => {
      pushUndo();
      const img = new Image();
      img.onload = () => {
        const ctx = getActiveCtx();
        if (!ctx) return;
        // Scale to fit if larger than 80% of world
        let w = img.width,
          h = img.height;
        const maxW = worldWRef.current * 0.8,
          maxH = worldHRef.current * 0.8;
        if (w > maxW || h > maxH) {
          const s = Math.min(maxW / w, maxH / h);
          w *= s;
          h *= s;
        }
        // Center on current viewport
        const t = transformRef.current;
        const canvas = canvasRef.current;
        const cx = (canvas.width / 2 - t.offsetX) / t.scale;
        const cy = (canvas.height / 2 - t.offsetY) / t.scale;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
        scheduleRedraw();
      };
      img.src = dataUrl;
    },
    [pushUndo, getActiveCtx, scheduleRedraw],
  );

  // ── Flip layer ────────────────────────────────────────────────────────────────
  const flipLayerH = useCallback(
    (layerId) => {
      const lc = layerCanvasesRef.current[layerId];
      if (!lc) return;
      pushUndo();
      const lctx = lc.getContext("2d");
      const tmp = document.createElement("canvas");
      tmp.width = worldWRef.current;
      tmp.height = worldHRef.current;
      const tctx = tmp.getContext("2d");
      tctx.translate(worldWRef.current, 0);
      tctx.scale(-1, 1);
      tctx.drawImage(lc, 0, 0);
      lctx.clearRect(0, 0, worldWRef.current, worldHRef.current);
      lctx.drawImage(tmp, 0, 0);
      scheduleRedraw();
    },
    [pushUndo, scheduleRedraw],
  );

  const flipLayerV = useCallback(
    (layerId) => {
      const lc = layerCanvasesRef.current[layerId];
      if (!lc) return;
      pushUndo();
      const lctx = lc.getContext("2d");
      const tmp = document.createElement("canvas");
      tmp.width = worldWRef.current;
      tmp.height = worldHRef.current;
      const tctx = tmp.getContext("2d");
      tctx.translate(0, worldHRef.current);
      tctx.scale(1, -1);
      tctx.drawImage(lc, 0, 0);
      lctx.clearRect(0, 0, worldWRef.current, worldHRef.current);
      lctx.drawImage(tmp, 0, 0);
      scheduleRedraw();
    },
    [pushUndo, scheduleRedraw],
  );

  // ── Collaboration ─────────────────────────────────────────────────────────────
  const getPaths = useCallback(() => pathHistoryRef.current, []);
  const loadPaths = useCallback(
    (paths) => {
      if (!paths) return;
      pathHistoryRef.current = paths;
      const ls = layersRef.current;
      const layerId = ls?.[0]?.id;
      if (!layerId) return;
      const lc = ensureLayerCanvas(layerId);
      const lctx = lc.getContext("2d");
      lctx.fillStyle = getBgColor();
      lctx.fillRect(0, 0, worldWRef.current, worldHRef.current);
      for (const p of paths) drawPathToCtx(lctx, p.points, p);
      scheduleRedraw();
    },
    [ensureLayerCanvas, drawPathToCtx, scheduleRedraw, getBgColor],
  );

  const applyRemoteStroke = useCallback(
    (path) => {
      const ls = layersRef.current;
      const layerId = ls?.[0]?.id;
      if (!layerId) return;
      const lc = ensureLayerCanvas(layerId);
      const lctx = lc.getContext("2d");
      drawPathToCtx(lctx, path.points, { ...path, remote: true });
      pathHistoryRef.current.push({ ...path, remote: true });
      scheduleRedraw();
    },
    [ensureLayerCanvas, drawPathToCtx, scheduleRedraw],
  );

  const applyRemoteClear = useCallback(() => {
    const ls = layersRef.current;
    if (!ls) return;
    for (const l of ls) {
      const lc = layerCanvasesRef.current[l.id];
      if (!lc) continue;
      const lctx = lc.getContext("2d");
      lctx.clearRect(0, 0, worldWRef.current, worldHRef.current);
      if (l.id === ls[0]?.id) {
        lctx.fillStyle = getBgColor();
        lctx.fillRect(0, 0, worldWRef.current, worldHRef.current);
      }
    }
    pathHistoryRef.current = [];
    scheduleRedraw();
  }, [scheduleRedraw, getBgColor]);

  const applyRemoteUndo = useCallback(() => {
    const idx = [...pathHistoryRef.current]
      .reverse()
      .findIndex((p) => p.remote);
    if (idx === -1) return;
    pathHistoryRef.current.splice(pathHistoryRef.current.length - 1 - idx, 1);
    loadPaths(pathHistoryRef.current);
  }, [loadPaths]);

  // ── Resize world ──────────────────────────────────────────────────────────────
  const resizeWorld = useCallback(
    (newW, newH) => {
      worldWRef.current = newW;
      worldHRef.current = newH;
      // Resize all layer canvases, preserving content
      for (const [id, lc] of Object.entries(layerCanvasesRef.current)) {
        const tmp = document.createElement("canvas");
        tmp.width = lc.width;
        tmp.height = lc.height;
        tmp.getContext("2d").drawImage(lc, 0, 0);
        lc.width = newW;
        lc.height = newH;
        lc.getContext("2d").drawImage(tmp, 0, 0);
      }
      // Resize overlay
      if (overlayRef.current) {
        overlayRef.current.width = newW;
        overlayRef.current.height = newH;
      }
      undoStackRef.current = [];
      redoStackRef.current = [];
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  return {
    canvasRef,
    initCanvas,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    undo,
    redo,
    clear,
    exportPng,
    getPaths,
    loadPaths,
    applyRemoteStroke,
    applyRemoteClear,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToScreen,
    getLayerCanvas,
    initLayerCanvas,
    deleteLayerCanvas,
    flipLayerH,
    flipLayerV,
    textState,
    setTextValue,
    commitText,
    cancelText,
    selectionState,
    clearSelection,
    deleteSelection,
    importImage,
    scheduleRedraw,
    resizeWorld,
  };
}
