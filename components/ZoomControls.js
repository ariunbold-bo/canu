"use client";

import { ZoomIn, ZoomOut, Maximize, RotateCcw } from "lucide-react";

export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  isLightBg = false,
}) {
  const blurBtn = (e) => e.currentTarget?.blur?.();
  return (
    <div className={`zoom-controls ${isLightBg ? 'light-bg' : ''}`}>
      <button onClick={onZoomOut} onPointerDown={blurBtn} title="Zoom out" className="zoom-btn">
        <ZoomOut size={14} />
      </button>
      <span className={`text-[11px] font-mono w-12 text-center select-none ${isLightBg ? 'text-black/60' : 'text-[#8cb9e0]/60'}`}>
        {Math.round((zoom ?? 1) * 100)}%
      </span>
      <button onClick={onZoomIn} onPointerDown={blurBtn} title="Zoom in" className="zoom-btn">
        <ZoomIn size={14} />
      </button>
      <div className={`w-px h-4 mx-1 ${isLightBg ? 'bg-black/15' : 'bg-[#8cb9e0]/15'}`} />
      <button
        onClick={onFitToScreen}
        onPointerDown={blurBtn}
        title="Fit to screen"
        className="zoom-btn"
      >
        <Maximize size={14} />
      </button>
      <button
        onClick={onResetZoom}
        onPointerDown={blurBtn}
        title="Reset zoom (100%)"
        className="zoom-btn"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
