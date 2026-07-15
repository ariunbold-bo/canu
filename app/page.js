"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import Toolbar from "@/components/Toolbar";
import LayersPanel from "@/components/LayersPanel";
import ZoomControls from "@/components/ZoomControls";
import RoomDialog from "@/components/RoomDialog";
import HistoryDialog from "@/components/HistoryDialog";
import { useRoom } from "@/hooks/useRoom";
import { useDrawingHistory } from "@/hooks/useDrawingHistory";
import { useCanvas } from "@/hooks/useCanvas";
import { useColorSwatches } from "@/hooks/useColorSwatches";

// ── Layer helpers ──────────────────────────────────────────────────────────────
let _layerCounter = 1;
function makeLayer(name) {
  return {
    id: `layer_${Date.now()}_${_layerCounter++}`,
    name: name ?? `Layer ${_layerCounter}`,
    visible: true,
    opacity: 1,
    locked: false,
  };
}

// ── Cursor ────────────────────────────────────────────────────────────────────
function getCursor(tool) {
  switch (tool) {
    case "eraser":
      return "cell";
    case "fill":
      return "crosshair";
    case "eyedropper":
      return "crosshair";
    case "text":
      return "text";
    case "lasso":
      return "crosshair";
    default:
      return "crosshair";
  }
}

export default function HomePage() {
  // ── Drawing state ─────────────────────────────────────────────────────────────
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#8cb9e0");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [brushType, setBrushType] = useState("pen");
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [smoothing, setSmoothing] = useState(0);
  const [shapeType, setShapeType] = useState("rect");
  const [fillTolerance, setFillTolerance] = useState(30);
  const [symmetryMode, setSymmetryMode] = useState(null);
  const [simulatePressure, setSimulatePressure] = useState(false);
  const [textFont, setTextFont] = useState("Poppins, sans-serif");
  const [textSize, setTextSize] = useState(24);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);

  // ── Layer state ───────────────────────────────────────────────────────────────
  const [layers, setLayers] = useState(() => [makeLayer("Background")]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────────
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [canvasSizeDialogOpen, setCanvasSizeDialogOpen] = useState(false);
  const [worldW, setWorldW] = useState(1920);
  const [worldH, setWorldH] = useState(1080);
  const [worldBgColor, setWorldBgColor] = useState("#0d1020");
  const [toast, setToast] = useState(null);

  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id ?? null;
  const userName = user?.fullName || user?.firstName || "Anonymous";

  const { swatches, addSwatch } = useColorSwatches();

  const {
    roomCode,
    isConnected,
    members,
    error: roomError,
    createRoom,
    joinRoom,
    leaveRoom,
    broadcastStroke,
    broadcastClear,
    onStrokeReceived,
    onClearReceived,
  } = useRoom(userId, userName);

  const {
    history,
    loading: historyLoading,
    saveDrawing,
    loadHistory,
    loadDrawing,
    deleteDrawing,
  } = useDrawingHistory(userId);

  const {
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
  } = useCanvas({
    tool,
    color,
    strokeWidth,
    brushType,
    brushOpacity,
    smoothing,
    shapeType,
    fillTolerance,
    symmetryMode,
    simulatePressure,
    worldBgColor,
    layers,
    activeLayerIndex,
    isConnected,
    broadcastStroke,
    broadcastClear,
    onColorPicked: (c) => {
      setColor(c);
      setTool("pen");
    },
    textFont,
    textSize,
    textBold,
    textItalic,
    worldW,
    worldH,
  });

  const canvasCallbackRef = useCallback(
    (el) => {
      if (el) {
        canvasRef.current = el;
        initCanvas(el);
      }
    },
    [initCanvas],
  );

  useEffect(() => {
    onStrokeReceived(({ path }) => path && applyRemoteStroke(path));
    onClearReceived(() => applyRemoteClear());
  }, [onStrokeReceived, onClearReceived]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Escape") {
        cancelText();
        clearSelection();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionState?.active) deleteSelection();
      }
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "p") setTool("pen");
        if (e.key === "e") setTool("eraser");
        if (e.key === "f") setTool("fill");
        if (e.key === "i") setTool("eyedropper");
        if (e.key === "t") setTool("text");
        if (e.key === "s") setTool("shape");
        if (e.key === "l") setTool("lasso");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, cancelText, clearSelection, deleteSelection, selectionState]);

  // Prevent browser pinch-to-zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e) => {
      if (e.touches?.length >= 2) e.preventDefault();
    };
    el.addEventListener("touchstart", prevent, { passive: false });
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      el.removeEventListener("touchstart", prevent);
      el.removeEventListener("touchmove", prevent);
    };
  }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Tool handlers ─────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const url = exportPng();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "canu_drawing.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Image downloaded!");
  };

  const handleSave = async () => {
    if (!userId) return;
    const paths = getPaths();
    const thumbnail = exportPng();
    const result = await saveDrawing(paths, thumbnail);
    showToast(result ? "Drawing saved!" : "Failed to save");
  };

  const handleHistoryOpen = async () => {
    setHistoryDialogOpen(true);
    await loadHistory();
  };

  const handleLoadDrawing = async (id) => {
    const paths = await loadDrawing(id);
    if (paths) {
      loadPaths(paths);
      setHistoryDialogOpen(false);
      showToast("Drawing loaded!");
    }
  };

  const handleDeleteDrawing = async (id) => {
    await deleteDrawing(id);
    showToast("Drawing deleted");
  };

  const handleCreateRoom = () => {
    const code = createRoom();
    showToast(`Room created: ${code}`);
  };

  const handleJoinRoom = async (code) => {
    const ok = await joinRoom(code);
    if (ok) showToast(`Joined room ${code}`);
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    setRoomDialogOpen(false);
    showToast("Left room");
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    showToast("Room code copied!");
  };

  const handleImportImage = (dataUrl) => {
    importImage(dataUrl);
    showToast("Image imported!");
  };

  const handleCanvasResize = (w, h) => {
    setWorldW(w);
    setWorldH(h);
    resizeWorld(w, h);
    setCanvasSizeDialogOpen(false);
    showToast(`Canvas: ${w}×${h}`);
  };

  // ── Layer operations ──────────────────────────────────────────────────────────
  const handleAddLayer = useCallback(() => {
    const newLayer = makeLayer(`Layer ${layers.length + 1}`);
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerIndex(layers.length);
  }, [layers.length]);

  const handleDeleteLayer = useCallback(
    (index) => {
      if (layers.length <= 1) return;
      deleteLayerCanvas(layers[index].id);
      setLayers((prev) => prev.filter((_, i) => i !== index));
      setActiveLayerIndex((prev) => Math.min(prev, layers.length - 2));
    },
    [layers, deleteLayerCanvas],
  );

  const handleToggleVisibility = useCallback(
    (index) => {
      setLayers((prev) =>
        prev.map((l, i) => (i === index ? { ...l, visible: !l.visible } : l)),
      );
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  const handleSetOpacity = useCallback(
    (index, opacity) => {
      setLayers((prev) =>
        prev.map((l, i) => (i === index ? { ...l, opacity } : l)),
      );
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  const handleRenameLayer = useCallback((index, name) => {
    setLayers((prev) => prev.map((l, i) => (i === index ? { ...l, name } : l)));
  }, []);

  const handleMoveLayerUp = useCallback(
    (index) => {
      if (index >= layers.length - 1) return;
      setLayers((prev) => {
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      });
      setActiveLayerIndex((prev) =>
        prev === index ? index + 1 : prev === index + 1 ? index : prev,
      );
      scheduleRedraw();
    },
    [layers.length, scheduleRedraw],
  );

  const handleMoveLayerDown = useCallback(
    (index) => {
      if (index <= 0) return;
      setLayers((prev) => {
        const next = [...prev];
        [next[index], next[index - 1]] = [next[index - 1], next[index]];
        return next;
      });
      setActiveLayerIndex((prev) =>
        prev === index ? index - 1 : prev === index - 1 ? index : prev,
      );
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  const handleMergeLayerDown = useCallback(
    (index) => {
      if (index <= 0) return;
      const topLayer = layers[index];
      const bottomLayer = layers[index - 1];
      const topCanvas = getLayerCanvas(topLayer.id);
      const bottomCanvas = getLayerCanvas(bottomLayer.id);
      if (!topCanvas || !bottomCanvas) return;
      const bctx = bottomCanvas.getContext("2d");
      bctx.globalAlpha = topLayer.opacity;
      bctx.drawImage(topCanvas, 0, 0);
      bctx.globalAlpha = 1;
      deleteLayerCanvas(topLayer.id);
      setLayers((prev) => prev.filter((_, i) => i !== index));
      setActiveLayerIndex(Math.max(0, index - 1));
      scheduleRedraw();
      showToast("Layers merged");
    },
    [layers, getLayerCanvas, deleteLayerCanvas, scheduleRedraw, showToast],
  );

  const handleFlipLayerH = useCallback(() => {
    const id = layers[activeLayerIndex]?.id;
    if (id) {
      flipLayerH(id);
      showToast("Layer flipped horizontally");
    }
  }, [layers, activeLayerIndex, flipLayerH, showToast]);

  const handleFlipLayerV = useCallback(() => {
    const id = layers[activeLayerIndex]?.id;
    if (id) {
      flipLayerV(id);
      showToast("Layer flipped vertically");
    }
  }, [layers, activeLayerIndex, flipLayerV, showToast]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span className="text-[#8cb9e0]/40 text-sm font-medium">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <>
      {/* ── Canvas ── */}
      <canvas
        ref={canvasCallbackRef}
        style={{
          display: "block",
          cursor: getCursor(tool),
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />

      {/* ── Text input overlay ── */}
      {textState.active &&
        (() => {
          const { scale, offsetX, offsetY } = canvasRef.current
            ? (() => {
                // Get transform from canvas (approximate via zoom state)
                return { scale: zoom, offsetX: 0, offsetY: 0 };
              })()
            : { scale: 1, offsetX: 0, offsetY: 0 };
          const screenX =
            textState.x * zoom +
            (canvasRef.current ? (window.innerWidth - 1920 * zoom) / 2 : 0);
          const screenY =
            textState.y * zoom +
            (canvasRef.current ? (window.innerHeight - 1080 * zoom) / 2 : 0);
          return (
            <div
              style={{
                position: "fixed",
                left: screenX,
                top: screenY,
                zIndex: 300,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <textarea
                autoFocus
                value={textState.value}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  }
                  if (e.key === "Escape") cancelText();
                }}
                style={{
                  font: `${textItalic ? "italic " : ""}${textBold ? "bold " : ""}${textSize}px ${textFont}`,
                  color,
                  background: "rgba(13,16,32,0.6)",
                  border: "1px dashed rgba(140,185,224,0.5)",
                  outline: "none",
                  resize: "none",
                  padding: "4px 6px",
                  borderRadius: 4,
                  minWidth: 80,
                  backdropFilter: "blur(4px)",
                }}
                rows={1}
                placeholder="Type here…"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={commitText}
                  className="px-2 py-0.5 rounded bg-[#8cb9e0]/20 text-[#8cb9e0] text-xs hover:bg-[#8cb9e0]/30"
                >
                  ✓
                </button>
                <button
                  onClick={cancelText}
                  className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })()}

      {/* ── Selection toolbar ── */}
      {selectionState.active && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#141832]/90 border border-[#8cb9e0]/20 backdrop-blur-xl"
        >
          <span className="text-[11px] text-[#8cb9e0]/60">
            Selection active
          </span>
          <button
            onClick={deleteSelection}
            className="text-[11px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-400/10"
          >
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="text-[11px] text-[#8cb9e0]/60 hover:text-[#8cb9e0] px-2 py-0.5 rounded hover:bg-[#8cb9e0]/10"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Presence bar ── */}
      {isConnected && (
        <div className="presence-bar">
          <Badge className="bg-[#8cb9e0]/10 text-[#8cb9e0] border-[#8cb9e0]/20 font-mono tracking-wider text-xs">
            {roomCode}
          </Badge>
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m, i) => (
              <div
                key={m.userId || i}
                title={m.userName}
                className="w-7 h-7 rounded-full bg-[#8cb9e0]/20 border-2 border-[#141832] flex items-center justify-center text-[10px] text-[#8cb9e0] font-semibold"
              >
                {(m.userName || "?")[0].toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-[11px] text-[#8cb9e0]/40">
            {members.length}/5
          </span>
        </div>
      )}

      {/* ── Zoom controls ── */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onFitToScreen={fitToScreen}
      />

      {/* ── Layers panel ── */}
      <LayersPanel
        open={layersPanelOpen}
        onClose={() => setLayersPanelOpen(false)}
        layers={layers}
        activeLayerIndex={activeLayerIndex}
        onAddLayer={handleAddLayer}
        onDeleteLayer={handleDeleteLayer}
        onToggleVisibility={handleToggleVisibility}
        onSetOpacity={handleSetOpacity}
        onRenameLayer={handleRenameLayer}
        onSetActiveLayer={setActiveLayerIndex}
        onMoveLayerUp={handleMoveLayerUp}
        onMoveLayerDown={handleMoveLayerDown}
        onMergeLayerDown={handleMergeLayerDown}
        onFlipLayerH={handleFlipLayerH}
        onFlipLayerV={handleFlipLayerV}
      />

      {/* ── Toolbar ── */}
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        brushType={brushType}
        onBrushTypeChange={setBrushType}
        brushOpacity={brushOpacity}
        onBrushOpacityChange={setBrushOpacity}
        smoothing={smoothing}
        onSmoothingChange={setSmoothing}
        shapeType={shapeType}
        onShapeTypeChange={setShapeType}
        fillTolerance={fillTolerance}
        onFillToleranceChange={setFillTolerance}
        symmetryMode={symmetryMode}
        onSymmetryChange={setSymmetryMode}
        simulatePressure={simulatePressure}
        onSimulatePressureChange={setSimulatePressure}
        colorSwatches={swatches}
        onSaveColorSwatch={addSwatch}
        onLoadColorSwatch={(c) => {
          setColor(c);
          setTool("pen");
        }}
        textFont={textFont}
        onTextFontChange={setTextFont}
        textSize={textSize}
        onTextSizeChange={setTextSize}
        textBold={textBold}
        onTextBoldChange={setTextBold}
        textItalic={textItalic}
        onTextItalicChange={setTextItalic}
        onClear={clear}
        onUndo={undo}
        onRedo={redo}
        onDownload={handleDownload}
        onSave={handleSave}
        onHistoryOpen={handleHistoryOpen}
        onRoomOpen={() => setRoomDialogOpen(true)}
        onSignUp={() => router.push("/sign-up")}
        onLayersToggle={() => setLayersPanelOpen((p) => !p)}
        isLayersPanelOpen={layersPanelOpen}
        onImportImage={handleImportImage}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        isSignedIn={isSignedIn}
        isInRoom={isConnected}
        roomCode={roomCode}
        userAvatar={isSignedIn ? <UserButton /> : null}
        onCanvasSizeOpen={() => setCanvasSizeDialogOpen(true)}
      />

      {/* ── Dialogs ── */}
      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        roomCode={roomCode}
        isConnected={isConnected}
        members={members}
        error={roomError}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        onCopyCode={handleCopyCode}
      />

      <HistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        history={history}
        loading={historyLoading}
        onLoadDrawing={handleLoadDrawing}
        onDeleteDrawing={handleDeleteDrawing}
      />

      {toast && <div className="toast">{toast}</div>}

      {/* ── Canvas Size Dialog ── */}
      {canvasSizeDialogOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#141832] border border-[#8cb9e0]/15 rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-[#c7d8ec] text-lg font-semibold mb-4">
              Canvas Settings
            </h3>
            <div className="mb-4">
              <label className="block text-[#c7d8ec]/70 text-xs font-semibold mb-2 uppercase tracking-wider">
                Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={worldBgColor}
                  onChange={(e) => setWorldBgColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
                />
                <span className="text-[#c7d8ec] font-mono text-sm">
                  {worldBgColor.toUpperCase()}
                </span>
              </div>
            </div>
            <label className="block text-[#c7d8ec]/70 text-xs font-semibold mb-2 uppercase tracking-wider">
              Canvas Size
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                [1920, 1080, "1920×1080"],
                [2560, 1440, "2560×1440"],
                [3840, 2160, "4K"],
                [1080, 1080, "Square"],
                [1080, 1920, "Portrait"],
                [4096, 4096, "4096²"],
              ].map(([w, h, label]) => (
                <button
                  key={label}
                  onClick={() => handleCanvasResize(w, h)}
                  className={`px-3 py-2.5 rounded-xl text-sm transition-all ${
                    worldW === w && worldH === h
                      ? "bg-[#8cb9e0]/20 text-[#8cb9e0] border border-[#8cb9e0]/30"
                      : "text-[#c7d8ec]/70 hover:bg-[#8cb9e0]/10 border border-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={worldW}
                onChange={(e) => setWorldW(Number(e.target.value))}
                className="w-full bg-[#0d1020] border border-[#8cb9e0]/15 rounded-lg px-3 py-2 text-sm text-[#c7d8ec] outline-none focus:border-[#8cb9e0]/40"
                placeholder="Width"
              />
              <span className="text-[#8cb9e0]/40">×</span>
              <input
                type="number"
                value={worldH}
                onChange={(e) => setWorldH(Number(e.target.value))}
                className="w-full bg-[#0d1020] border border-[#8cb9e0]/15 rounded-lg px-3 py-2 text-sm text-[#c7d8ec] outline-none focus:border-[#8cb9e0]/40"
                placeholder="Height"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCanvasSizeDialogOpen(false)}
                className="flex-1 px-4 py-2 rounded-xl text-sm text-[#c7d8ec]/60 hover:bg-[#8cb9e0]/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCanvasResize(worldW, worldH)}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-[#8cb9e0]/15 text-[#8cb9e0] hover:bg-[#8cb9e0]/25 transition-all font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
