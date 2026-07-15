"use client";

import { useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Download,
  Save,
  History,
  Users,
  LogIn,
  MoreHorizontal,
  Pen,
  Pipette,
  PaintBucket,
  Type,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Triangle,
  Layers,
  Sliders,
  Wand2,
  ImagePlus,
  Lasso,
  Droplets,
  Blend,
  FlipHorizontal2,
  Menu,
  Gamepad2,
  Maximize2,
} from "lucide-react";
import { HexColorPicker, HexColorInput } from "react-colorful";

const triggerCls = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
  "text-[#8cb9e0]/70 transition-all duration-150",
  "hover:bg-[#8cb9e0]/10 hover:text-[#8cb9e0] active:scale-95",
  "disabled:pointer-events-none disabled:opacity-40",
);

function ToolBtn({ tooltip, active, onClick, children, disabled = false }) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        disabled={disabled}
        className={cn(
          triggerCls,
          active &&
            "bg-[#8cb9e0]/15 text-[#8cb9e0] shadow-[0_0_12px_rgba(140,185,224,0.2)]",
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-[#141832] border border-[#8cb9e0]/15 text-[#8cb9e0] text-xs z-[200]"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, unit = "" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#8cb9e0]/50 w-16 shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: "#8cb9e0",
          background: `linear-gradient(to right,#8cb9e0 ${((value - min) / (max - min)) * 100}%,rgba(140,185,224,0.15) 0%)`,
        }}
      />
      <span className="text-[11px] text-[#8cb9e0]/50 font-mono w-8 text-right">
        {value}
        {unit}
      </span>
    </div>
  );
}

const SHAPE_ICONS = {
  rect: <Square size={14} />,
  circle: <Circle size={14} />,
  line: <Minus size={14} />,
  arrow: <ArrowRight size={14} />,
  triangle: <Triangle size={14} />,
};

const BRUSH_TYPES = ["pen", "pencil", "marker", "airbrush", "watercolor"];

export default function Toolbar({
  // Tool
  tool,
  onToolChange,
  // Color
  color,
  onColorChange,
  // Brush settings
  strokeWidth,
  onStrokeWidthChange,
  brushType,
  onBrushTypeChange,
  brushOpacity,
  onBrushOpacityChange,
  smoothing,
  onSmoothingChange,
  // Shape
  shapeType,
  onShapeTypeChange,
  // Fill
  fillTolerance,
  onFillToleranceChange,
  // Symmetry
  symmetryMode,
  onSymmetryChange,
  // Pressure
  simulatePressure,
  onSimulatePressureChange,
  // Color swatches
  colorSwatches,
  onSaveColorSwatch,
  onLoadColorSwatch,
  // Text
  textFont,
  onTextFontChange,
  textSize,
  onTextSizeChange,
  textBold,
  onTextBoldChange,
  textItalic,
  onTextItalicChange,
  // Actions
  onClear,
  onUndo,
  onRedo,
  onDownload,
  onSave,
  onHistoryOpen,
  onRoomOpen,
  onSignUp,
  // Layers
  onLayersToggle,
  isLayersPanelOpen,
  // Import
  onImportImage,
  // Zoom
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  // Room/auth
  isSignedIn,
  isInRoom,
  roomCode,
  userAvatar,
  // Canvas size
  onCanvasSizeOpen,
}) {
  const importRef = useRef(null);
  const [activePopover, setActivePopover] = useState(null);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onImportImage?.(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Brush settings popover content
  const brushSettings = (
    <div className="flex flex-col gap-3 p-1 min-w-[220px]">
      <div className="text-[11px] text-[#8cb9e0]/50 font-semibold uppercase tracking-wider">
        Brush Settings
      </div>
      <SliderRow
        label="Size"
        value={strokeWidth}
        min={1}
        max={200}
        onChange={onStrokeWidthChange}
        unit="px"
      />
      <SliderRow
        label="Opacity"
        value={Math.round(brushOpacity * 100)}
        min={0}
        max={100}
        onChange={(v) => onBrushOpacityChange(v / 100)}
        unit="%"
      />
      <SliderRow
        label="Smoothing"
        value={smoothing}
        min={0}
        max={100}
        onChange={onSmoothingChange}
        unit="%"
      />
      <SliderRow
        label="Fill Tol."
        value={fillTolerance}
        min={0}
        max={100}
        onChange={onFillToleranceChange}
        unit="%"
      />

      {/* Brush type */}
      <div>
        <div className="text-[10px] text-[#8cb9e0]/50 mb-1.5">Brush type</div>
        <div className="flex flex-wrap gap-1">
          {BRUSH_TYPES.map((bt) => (
            <button
              key={bt}
              onClick={() => onBrushTypeChange(bt)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] capitalize transition-all",
                brushType === bt
                  ? "bg-[#8cb9e0]/20 text-[#8cb9e0] border border-[#8cb9e0]/30"
                  : "text-[#8cb9e0]/50 border border-[#8cb9e0]/10 hover:border-[#8cb9e0]/25",
              )}
            >
              {bt}
            </button>
          ))}
        </div>
      </div>

      {/* Pressure simulation */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={simulatePressure}
          onChange={(e) => onSimulatePressureChange(e.target.checked)}
          className="accent-[#8cb9e0]"
        />
        <span className="text-[11px] text-[#8cb9e0]/60">
          Pressure simulation
        </span>
      </label>

      {/* Symmetry */}
      <div>
        <div className="text-[10px] text-[#8cb9e0]/50 mb-1.5">
          Mirror / Symmetry
        </div>
        <div className="flex gap-1">
          {[
            ["off", null],
            ["H", "h"],
            ["V", "v"],
            ["H+V", "both"],
          ].map(([label, val]) => (
            <button
              key={label}
              onClick={() => onSymmetryChange(val)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] transition-all",
                symmetryMode === val
                  ? "bg-[#8cb9e0]/20 text-[#8cb9e0] border border-[#8cb9e0]/30"
                  : "text-[#8cb9e0]/50 border border-[#8cb9e0]/10 hover:border-[#8cb9e0]/25",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Text settings popover
  const textSettings = (
    <div className="flex flex-col gap-3 p-1 min-w-[200px]">
      <div className="text-[11px] text-[#8cb9e0]/50 font-semibold uppercase tracking-wider">
        Text Tool
      </div>
      <SliderRow
        label="Size"
        value={textSize}
        min={8}
        max={200}
        onChange={onTextSizeChange}
        unit="px"
      />
      <div>
        <div className="text-[10px] text-[#8cb9e0]/50 mb-1.5">Font</div>
        <select
          value={textFont}
          onChange={(e) => onTextFontChange(e.target.value)}
          className="w-full bg-[#0d1020] text-[#8cb9e0] text-xs rounded px-2 py-1 border border-[#8cb9e0]/15 outline-none"
        >
          <option value="Poppins, sans-serif">Poppins</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
          <option value="cursive">Cursive</option>
          <option value="Georgia, serif">Georgia</option>
        </select>
      </div>
      <div className="flex gap-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={textBold}
            onChange={(e) => onTextBoldChange(e.target.checked)}
            className="accent-[#8cb9e0]"
          />
          <span className="text-[11px] text-[#8cb9e0]/60 font-bold">Bold</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={textItalic}
            onChange={(e) => onTextItalicChange(e.target.checked)}
            className="accent-[#8cb9e0]"
          />
          <span className="text-[11px] text-[#8cb9e0]/60 italic">Italic</span>
        </label>
      </div>
    </div>
  );

  const shapeSelector = (
    <div className="flex flex-col gap-2 p-1">
      <div className="text-[11px] text-[#8cb9e0]/50 font-semibold uppercase tracking-wider mb-1">
        Shape
      </div>
      {Object.entries(SHAPE_ICONS).map(([key, icon]) => (
        <button
          key={key}
          onClick={() => {
            onShapeTypeChange(key);
            onToolChange("shape");
          }}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded text-[11px] capitalize transition-all",
            shapeType === key && tool === "shape"
              ? "bg-[#8cb9e0]/20 text-[#8cb9e0]"
              : "text-[#8cb9e0]/60 hover:bg-[#8cb9e0]/10 hover:text-[#8cb9e0]",
          )}
        >
          {icon} {key}
        </button>
      ))}
    </div>
  );

  const renderSecondaryTools = (inPopover = false) => (
    <>
      <ToolBtn tooltip="Download image" onClick={onDownload}>
        <Download size={17} />
      </ToolBtn>
      {isSignedIn && (
        <>
          <ToolBtn tooltip="Save drawing" onClick={onSave}>
            <Save size={17} />
          </ToolBtn>
          <ToolBtn tooltip="Drawing history" onClick={onHistoryOpen}>
            <History size={17} />
          </ToolBtn>
        </>
      )}
    </>
  );

  return (
    <div className="floating-toolbar">
      {/* ── Main Menu ── */}
      <Popover>
        <PopoverTrigger className={cn(triggerCls)}>
          <Menu size={17} />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={14}
          className="bg-[#141832]/95 backdrop-blur-xl border border-[#8cb9e0]/15 w-56 p-2 rounded-2xl shadow-2xl z-[150]"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] uppercase tracking-wider text-[#8cb9e0]/40 px-3 pt-1 pb-1.5 font-medium">Menu</p>
            {isSignedIn && (
              <button
                onClick={onRoomOpen}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                  isInRoom
                    ? "bg-[#8cb9e0]/15 text-[#8cb9e0]"
                    : "text-[#c7d8ec]/80 hover:bg-[#8cb9e0]/10 hover:text-[#c7d8ec]"
                )}
              >
                <Users size={16} />
                <span>{isInRoom ? `Room: ${roomCode}` : "Rooms"}</span>
                {isInRoom && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            )}
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c7d8ec]/80 hover:bg-[#8cb9e0]/10 hover:text-[#c7d8ec] transition-all"
              disabled
            >
              <Gamepad2 size={16} />
              <span>Games</span>
              <span className="ml-auto text-[10px] text-[#8cb9e0]/40 font-medium">Soon</span>
            </button>
            <button
              onClick={onCanvasSizeOpen}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#c7d8ec]/80 hover:bg-[#8cb9e0]/10 hover:text-[#c7d8ec] transition-all"
            >
              <Maximize2 size={16} />
              <span>Canvas Size</span>
            </button>
            {!isSignedIn && (
              <>
                <div className="h-px bg-[#8cb9e0]/10 my-1" />
                <button
                  onClick={onSignUp}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8cb9e0] hover:bg-[#8cb9e0]/15 transition-all font-medium"
                >
                  <LogIn size={16} />
                  <span>Sign In</span>
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div className="toolbar-divider" />

      {/* ── Color swatch ── */}
      <Dialog>
        <DialogTrigger className="flex shrink-0 items-center justify-center w-9 h-10 rounded-lg hover:bg-[#8cb9e0]/10 transition-all active:scale-95">
          <span
            className="block rounded-full border-2 border-[#8cb9e0]/30 transition-transform hover:scale-110"
            style={{ background: color, width: 20, height: 20 }}
          />
        </DialogTrigger>
        <DialogContent className="sm:max-w-xs bg-[#141832]/95 backdrop-blur-xl border-[#8cb9e0]/20 shadow-2xl flex flex-col items-center p-6 pt-10 z-[250]">
          <DialogTitle className="sr-only">Color Picker</DialogTitle>
          <DialogDescription className="sr-only">
            Select drawing color
          </DialogDescription>
          <div className="w-full flex justify-center mb-4 mt-1">
            <HexColorPicker
              color={color}
              onChange={(c) => {
                onColorChange(c);
                if (tool === "eraser") onToolChange("pen");
              }}
            />
          </div>
          <div className="flex items-center gap-3 w-full bg-[#0d1020]/50 p-2.5 rounded-xl border border-[#8cb9e0]/10">
            <div
              className="w-6 h-6 rounded-md border border-[#8cb9e0]/40 shrink-0"
              style={{ background: color }}
            />
            <HexColorInput
              color={color}
              onChange={(c) => {
                onColorChange(c);
                if (tool === "eraser") onToolChange("pen");
              }}
              prefixed
              className="w-20 bg-transparent text-sm text-[#8cb9e0]/90 font-mono tracking-wider uppercase outline-none"
            />
          </div>
          {/* Color swatches */}
          {colorSwatches && (
            <div className="w-full mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#8cb9e0]/50 uppercase tracking-wider">
                  Swatches
                </span>
                <button
                  onClick={() => onSaveColorSwatch?.(color)}
                  className="text-[10px] text-[#8cb9e0]/50 hover:text-[#8cb9e0] transition-colors"
                >
                  + Save
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colorSwatches.map((sw, i) => (
                  <button
                    key={i}
                    onClick={() => onLoadColorSwatch?.(sw)}
                    title={sw}
                    className="w-6 h-6 rounded-full border-2 border-transparent hover:border-[#8cb9e0]/50 transition-all hover:scale-110"
                    style={{ background: sw }}
                  />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="toolbar-divider" />

      {/* ── Drawing tools ── */}
      <Popover
        open={activePopover === "pen"}
        onOpenChange={(open) => {
          if (open && tool !== "pen") return;
          setActivePopover(open ? "pen" : null);
        }}
      >
        <PopoverTrigger
          onClick={() => {
            if (tool !== "pen") onToolChange("pen");
          }}
          className={cn(
            triggerCls,
            tool === "pen" &&
              "bg-[#8cb9e0]/15 text-[#8cb9e0] shadow-[0_0_12px_rgba(140,185,224,0.2)]",
          )}
        >
          <Pen size={17} />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={14}
          className="bg-[#141832]/95 backdrop-blur-xl border border-[#8cb9e0]/15 w-auto p-3 rounded-2xl shadow-2xl z-[150]"
        >
          {brushSettings}
        </PopoverContent>
      </Popover>
      <Popover
        open={activePopover === "eraser"}
        onOpenChange={(open) => {
          if (open && tool !== "eraser") return;
          setActivePopover(open ? "eraser" : null);
        }}
      >
        <PopoverTrigger
          onClick={() => {
            if (tool !== "eraser") onToolChange("eraser");
          }}
          className={cn(
            triggerCls,
            tool === "eraser" &&
              "bg-[#8cb9e0]/15 text-[#8cb9e0] shadow-[0_0_12px_rgba(140,185,224,0.2)]",
          )}
        >
          <Eraser size={17} />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={14}
          className="bg-[#141832]/95 backdrop-blur-xl border border-[#8cb9e0]/15 w-auto p-3 rounded-2xl shadow-2xl z-[150]"
        >
          <div className="flex flex-col gap-3 p-1 min-w-[220px]">
            <div className="text-[11px] text-[#8cb9e0]/50 font-semibold uppercase tracking-wider">
              Eraser Settings
            </div>
            <SliderRow
              label="Size"
              value={strokeWidth}
              min={1}
              max={200}
              onChange={onStrokeWidthChange}
              unit="px"
            />
            <SliderRow
              label="Opacity"
              value={Math.round(brushOpacity * 100)}
              min={0}
              max={100}
              onChange={(v) => onBrushOpacityChange(v / 100)}
              unit="%"
            />
          </div>
        </PopoverContent>
      </Popover>
      <ToolBtn
        tooltip="Eyedropper"
        active={tool === "eyedropper"}
        onClick={() => onToolChange("eyedropper")}
      >
        <Pipette size={17} />
      </ToolBtn>
      <ToolBtn
        tooltip="Fill bucket"
        active={tool === "fill"}
        onClick={() => onToolChange("fill")}
      >
        <PaintBucket size={17} />
      </ToolBtn>
      <ToolBtn
        tooltip="Smudge"
        active={tool === "smudge"}
        onClick={() => onToolChange("smudge")}
      >
        <Droplets size={17} />
      </ToolBtn>
      <ToolBtn
        tooltip="Blur"
        active={tool === "blur"}
        onClick={() => onToolChange("blur")}
      >
        <Blend size={17} />
      </ToolBtn>
      <ToolBtn
        tooltip="Lasso select"
        active={tool === "lasso"}
        onClick={() => onToolChange("lasso")}
      >
        <Lasso size={17} />
      </ToolBtn>

      {/* Shape tool with popover */}
      <Popover
        open={activePopover === "shape"}
        onOpenChange={(open) => {
          if (open && tool !== "shape") return;
          setActivePopover(open ? "shape" : null);
        }}
      >
        <PopoverTrigger
          onClick={() => {
            if (tool !== "shape") onToolChange("shape");
          }}
          className={cn(
            triggerCls,
            tool === "shape" &&
              "bg-[#8cb9e0]/15 text-[#8cb9e0] shadow-[0_0_12px_rgba(140,185,224,0.2)]",
          )}
        >
          {SHAPE_ICONS[shapeType] ?? <Square size={17} />}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={14}
          className="bg-[#141832]/95 backdrop-blur-xl border border-[#8cb9e0]/15 w-auto p-3 rounded-2xl shadow-2xl z-[150]"
        >
          {shapeSelector}
        </PopoverContent>
      </Popover>

      {/* Text tool with popover */}
      <Popover>
        <PopoverTrigger
          className={cn(
            triggerCls,
            tool === "text" &&
              "bg-[#8cb9e0]/15 text-[#8cb9e0] shadow-[0_0_12px_rgba(140,185,224,0.2)]",
          )}
          onClick={() => onToolChange("text")}
        >
          <Type size={17} />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          sideOffset={14}
          className="bg-[#141832]/95 backdrop-blur-xl border border-[#8cb9e0]/15 w-auto p-3 rounded-2xl shadow-2xl z-[150]"
        >
          {textSettings}
        </PopoverContent>
      </Popover>



      {/* ── History ── */}
      <ToolBtn tooltip="Undo  Ctrl+Z" onClick={onUndo}>
        <Undo2 size={17} />
      </ToolBtn>
      <ToolBtn tooltip="Redo  Ctrl+Y" onClick={onRedo}>
        <Redo2 size={17} />
      </ToolBtn>
      <ToolBtn tooltip="Clear canvas" onClick={onClear}>
        <Trash2 size={17} />
      </ToolBtn>

      <div className="toolbar-divider" />

      {/* ── Layers ── */}
      <ToolBtn
        tooltip="Layers"
        active={isLayersPanelOpen}
        onClick={onLayersToggle}
      >
        <Layers size={17} />
      </ToolBtn>

      {/* ── Import image ── */}
      <input
        ref={importRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImport}
      />
      <ToolBtn
        tooltip="Import image"
        onClick={() => importRef.current?.click()}
      >
        <ImagePlus size={17} />
      </ToolBtn>

      <div className="hidden md:flex items-center gap-1.5">
        {renderSecondaryTools(false)}
      </div>
      <div className="flex md:hidden items-center">
        <Popover>
          <PopoverTrigger className={triggerCls}>
            <MoreHorizontal size={17} />
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={14}
            className="bg-[#141832]/95 backdrop-blur-xl border border-[#8cb9e0]/15 w-auto p-2.5 flex items-center gap-1.5 rounded-2xl shadow-2xl z-[150]"
          >
            {renderSecondaryTools(true)}
          </PopoverContent>
        </Popover>
      </div>

      {userAvatar && (
        <>
          <div className="toolbar-divider" />
          <div className="flex items-center justify-center w-8 h-8 ml-1 scale-90 origin-center shrink-0">
            {userAvatar}
          </div>
        </>
      )}
    </div>
  );
}
