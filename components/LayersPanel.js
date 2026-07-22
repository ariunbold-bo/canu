"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FlipHorizontal,
  FlipVertical,
  Merge,
} from "lucide-react";
import { cn } from "@/lib/utils";

function LayerRow({
  layer,
  index,
  isActive,
  total,
  onSelect,
  onToggleVisibility,
  onSetOpacity,
  onDelete,
  onRename,
  onMoveUp,
  onMoveDown,
  isLightBg,
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(layer.name);

  const textActive = isLightBg ? "text-black" : "text-[#8cb9e0]";
  const textNormal = isLightBg ? "text-black/60" : "text-[#8cb9e0]/60";
  const textMuted = isLightBg ? "text-black/40 hover:text-black" : "text-[#8cb9e0]/40 hover:text-[#8cb9e0]";
  const rowActive = isLightBg ? "bg-black/10 border-black/20" : "bg-[#8cb9e0]/15 border-[#8cb9e0]/30";
  const rowHover = isLightBg ? "hover:bg-black/5" : "hover:bg-[#8cb9e0]/5";
  const borderCol = isLightBg ? "border-black/40" : "border-[#8cb9e0]/40";
  const accent = isLightBg ? "#000000" : "#8cb9e0";
  const thumbBg = isLightBg ? "bg-black/5 border-black/10" : "bg-[#0d1020]/60 border-[#8cb9e0]/10";

  return (
    <div
      onClick={() => onSelect(index)}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all select-none",
        isActive ? rowActive : cn(rowHover, "border-transparent"),
      )}
    >
      {/* Visibility */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility(index);
        }}
        className={cn("shrink-0 transition-colors", textMuted)}
      >
        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>

      {/* Thumbnail placeholder */}
      <div className={cn("w-8 h-6 rounded border shrink-0", thumbBg)} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              onRename(index, draftName);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(index, draftName);
                setEditing(false);
              }
              if (e.key === "Escape") {
                setDraftName(layer.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn("w-full bg-transparent text-xs outline-none border-b", textActive, borderCol)}
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className={cn(
              "text-xs truncate block",
              isActive ? textActive : textNormal,
            )}
          >
            {layer.name}
          </span>
        )}
      </div>

      {/* Opacity */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={layer.opacity}
        onChange={(e) => {
          e.stopPropagation();
          onSetOpacity(index, Number(e.target.value));
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-12 h-1 appearance-none rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ accentColor: accent }}
        title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
      />

      {/* Move */}
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(index);
          }}
          disabled={index === 0}
          className={cn("disabled:opacity-20", textMuted)}
        >
          <ChevronUp size={10} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(index);
          }}
          disabled={index === total - 1}
          className={cn("disabled:opacity-20", textMuted)}
        >
          <ChevronDown size={10} />
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
        disabled={total <= 1}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/50 hover:text-red-400 disabled:opacity-20"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function LayersPanel({
  layers,
  activeLayerIndex,
  onAddLayer,
  onDeleteLayer,
  onToggleVisibility,
  onSetOpacity,
  onRenameLayer,
  onSetActiveLayer,
  onMoveLayerUp,
  onMoveLayerDown,
  onFlipLayerH,
  onFlipLayerV,
  onMergeLayerDown,
  open,
  onClose,
  isLightBg = false,
}) {
  if (!open) return null;

  const titleCol = isLightBg ? "text-black" : "text-[#8cb9e0]";
  const btnCol = isLightBg ? "text-black/50 hover:text-black" : "text-[#8cb9e0]/50 hover:text-[#8cb9e0]";
  const btnPrimary = isLightBg ? "text-black/70 hover:text-black" : "text-[#8cb9e0]/70 hover:text-[#8cb9e0]";
  const accent = isLightBg ? "#000000" : "#8cb9e0";
  const borderCol = isLightBg ? "border-black/10" : "border-[#8cb9e0]/10";
  const subtitleCol = isLightBg ? "text-black/50" : "text-[#8cb9e0]/50";
  const valCol = isLightBg ? "text-black/70" : "text-[#8cb9e0]/70";

  return (
    <div className={`layers-panel ${isLightBg ? 'light-bg' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn("text-sm font-semibold", titleCol)}>Layers</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onFlipLayerH}
            title="Flip H"
            className={cn("p-1 transition-colors", btnCol)}
          >
            <FlipHorizontal size={13} />
          </button>
          <button
            onClick={onFlipLayerV}
            title="Flip V"
            className={cn("p-1 transition-colors", btnCol)}
          >
            <FlipVertical size={13} />
          </button>
          <button
            onClick={() => onMergeLayerDown(activeLayerIndex)}
            title="Merge down"
            className={cn("p-1 transition-colors", btnCol)}
            disabled={activeLayerIndex >= layers.length - 1}
          >
            <Merge size={13} />
          </button>
          <button
            onClick={onAddLayer}
            title="Add layer"
            className={cn("p-1 transition-colors", btnPrimary)}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Layer list — reversed so top layer is at top */}
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {[...layers].reverse().map((layer, revIdx) => {
          const index = layers.length - 1 - revIdx;
          return (
            <LayerRow
              key={layer.id}
              layer={layer}
              index={index}
              isActive={index === activeLayerIndex}
              total={layers.length}
              onSelect={onSetActiveLayer}
              onToggleVisibility={onToggleVisibility}
              onSetOpacity={onSetOpacity}
              onDelete={onDeleteLayer}
              onRename={onRenameLayer}
              onMoveUp={onMoveLayerUp}
              onMoveDown={onMoveLayerDown}
              isLightBg={isLightBg}
            />
          );
        })}
      </div>

      {/* Active layer opacity */}
      <div className={cn("mt-3 pt-3 border-t", borderCol)}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-[10px] uppercase tracking-wider", subtitleCol)}>
            Opacity
          </span>
          <span className={cn("text-[11px] font-mono", valCol)}>
            {Math.round((layers[activeLayerIndex]?.opacity ?? 1) * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={layers[activeLayerIndex]?.opacity ?? 1}
          onChange={(e) =>
            onSetOpacity(activeLayerIndex, Number(e.target.value))
          }
          className="w-full h-1 appearance-none rounded cursor-pointer"
          style={{ accentColor: accent }}
        />
      </div>
    </div>
  );
}
