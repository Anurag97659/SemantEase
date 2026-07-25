"use client";

import {
  PointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import { apiFetch } from "../../utils/api";

type ElementKind = "text" | "sticky" | "word" | "table" | "arrow" | "drawing";
type ArrowHandle = "start" | "end" | "control";
type Point = { x: number; y: number };
type CanvasElement = {
  id: string;
  type: ElementKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  wordId?: string;
  word?: string;
  definition?: string;
  rows?: number;
  cols?: number;
  cells?: string[];
  endX?: number;
  endY?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  shape?:
    | "rectangle"
    | "rounded"
    | "pill"
    | "cloud"
    | "speech"
    | "diamond"
    | "hexagon"
    | "parallelogram";
  points?: Point[];
  strokeWidth?: number;
  curved?: boolean;
  controlX?: number;
  controlY?: number;
  startAttachId?: string;
  endAttachId?: string;
  startAnchor?: "left" | "right" | "top" | "bottom";
  endAnchor?: "left" | "right" | "top" | "bottom";
};
type Note = {
  _id: string;
  title: string;
  elements: CanvasElement[];
  backgroundColor?: string;
  updatedAt: string;
};
type SearchWord = {
  _id: string;
  word: string;
  definitions: { partOfSpeech: string; definition: string }[];
};

const CANVAS_WIDTH = 8000;
const CANVAS_HEIGHT = 4750;
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(value, high));
const boxSize = (element: CanvasElement) => ({
  w: element.w || 270,
  h: element.h || (element.type === "word" ? 170 : 180),
});
const anchorPoint = (
  element: CanvasElement,
  anchor: "left" | "right" | "top" | "bottom",
) => {
  const { w, h } = boxSize(element);
  if (anchor === "left") return { x: element.x, y: element.y + h / 2 };
  if (anchor === "right") return { x: element.x + w, y: element.y + h / 2 };
  if (anchor === "top") return { x: element.x + w / 2, y: element.y };
  return { x: element.x + w / 2, y: element.y + h };
};
type Attachment = {
  id: string;
  anchor: "left" | "right" | "top" | "bottom";
  point: Point;
  distance: number;
};

const findAttachment = (
  elements: CanvasElement[],
  x: number,
  y: number,
): Attachment | null => {
  let best: Attachment | null = null;
  const targets = elements.filter(
    (item) => !["arrow", "drawing"].includes(item.type),
  );
  for (const item of targets) {
    const anchors: Array<"left" | "right" | "top" | "bottom"> = [
      "left",
      "right",
      "top",
      "bottom",
    ];
    for (const anchor of anchors) {
      const point = anchorPoint(item, anchor);
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < 42 && (!best || distance < best.distance))
        best = { id: item.id, anchor, point, distance };
    }
  }
  return best;
};

const pointToSegmentDistance = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
  );
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};

const isDrawingTouched = (
  drawing: CanvasElement,
  x: number,
  y: number,
  eraserRadius: number,
) => {
  const points = drawing.points;
  if (!points || points.length === 0) return false;
  const threshold = eraserRadius + (drawing.strokeWidth || 3) / 2;
  if (points.length === 1) {
    return Math.hypot(x - points[0].x, y - points[0].y) <= threshold;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y) <= threshold) {
      return true;
    }
  }
  return false;
};

function DetailedNotesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const noteId = params.get("id");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    handle?: ArrowHandle;
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    minW: number;
    minH: number;
  } | null>(null);
  const drawRef = useRef<string | null>(null);
  const eraseRef = useRef(false);
  const didDragRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<
    Array<{ title: string; elements: CanvasElement[] }>
  >([]);
  const historyIndexRef = useRef(-1);
  const latestSnapshotRef = useRef<{
    title: string;
    elements: CanvasElement[];
  }>({ title: "", elements: [] });
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const [wordQuery, setWordQuery] = useState("");
  const [wordResults, setWordResults] = useState<SearchWord[]>([]);
  const [searching, setSearching] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [penMode, setPenMode] = useState(false);
  const [penColor, setPenColor] = useState("#7c3aed");
  const [penWidth, setPenWidth] = useState(3);
  const [eraserMode, setEraserMode] = useState(false);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [historyState, setHistoryState] = useState({ index: -1, length: 0 });

  useEffect(() => {
    if (!noteId) {
      router.replace("/mynotes-dashboard");
      return;
    }
    apiFetch(`/WoahCab/notes/${noteId}`)
      .then((res) => {
        const loaded = {
          ...res.data,
          elements: res.data.elements || [],
        } as Note;
        setNote(loaded);
        setTitle(loaded.title);
        setBackgroundColor(loaded.backgroundColor || "#ffffff");
        historyRef.current = [
          { title: loaded.title, elements: loaded.elements },
        ];
        historyIndexRef.current = 0;
        setHistoryState({ index: 0, length: 1 });
        latestSnapshotRef.current = {
          title: loaded.title,
          elements: loaded.elements,
        };
      })
      .catch((err) => {
        if (
          err.message?.includes("Unauthorized") ||
          err.message?.includes("401")
        )
          router.push("/login");
        else setError(err.message || "Could not open this note");
      })
      .finally(() => setLoading(false));
  }, [noteId, router]);

  const persist = useCallback(
    async (
      nextTitle: string,
      nextElements: CanvasElement[],
      nextBackgroundColor: string,
    ) => {
      if (!noteId) return;
      setSaveState("saving");
      try {
        const res = await apiFetch(`/WoahCab/notes/${noteId}`, {
          method: "PUT",
          body: JSON.stringify({
            title: nextTitle,
            elements: nextElements,
            backgroundColor: nextBackgroundColor,
          }),
        });
        setNote((current) =>
          current
            ? {
                ...current,
                updatedAt: res.data.updatedAt,
                backgroundColor: nextBackgroundColor,
              }
            : current,
        );
        setSaveState("saved");
      } catch (err: unknown) {
        setSaveState("unsaved");
        setError(
          err instanceof Error ? err.message : "Changes could not be saved",
        );
      }
    },
    [noteId],
  );

  const queueSave = useCallback(
    (
      nextTitle: string,
      nextElements: CanvasElement[],
      nextBackgroundColor = backgroundColor,
    ) => {
      setSaveState("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => persist(nextTitle, nextElements, nextBackgroundColor),
        700,
      );
    },
    [persist, backgroundColor],
  );

  const recordHistory = (nextTitle: string, nextElements: CanvasElement[]) => {
    const current = historyRef.current[historyIndexRef.current];
    const nextSnapshot = {
      title: nextTitle,
      elements: structuredClone(nextElements),
    };
    if (current && JSON.stringify(current) === JSON.stringify(nextSnapshot))
      return;
    historyRef.current = [
      ...historyRef.current.slice(0, historyIndexRef.current + 1),
      nextSnapshot,
    ].slice(-80);
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryState({
      index: historyIndexRef.current,
      length: historyRef.current.length,
    });
  };

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!wordQuery.trim()) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(
          `/WoahCab/words/search?q=${encodeURIComponent(wordQuery.trim())}`,
        );
        setWordResults(res.data || []);
      } catch {
        setWordResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [wordQuery]);

  const updateElements = (
    updater: (elements: CanvasElement[]) => CanvasElement[],
    shouldRecord = true,
  ) => {
    setNote((current) => {
      if (!current) return current;
      const elements = updater(current.elements);
      latestSnapshotRef.current = { title, elements };
      if (shouldRecord) recordHistory(title, elements);
      queueSave(title, elements);
      return { ...current, elements };
    });
  };

  const addElement = (element: CanvasElement) => {
    updateElements((elements) => [...elements, element]);
    setSelectedId(element.id);
  };

  const addText = (kind: "text" | "sticky") =>
    addElement({
      id: makeId(),
      type: kind,
      x: 120 + (note?.elements.length || 0) * 12,
      y: 110 + (note?.elements.length || 0) * 10,
      w: kind === "sticky" ? 240 : 320,
      h: kind === "sticky" ? 180 : 145,
      text:
        kind === "sticky" ? "A thought to remember…" : "Start writing here…",
      color: kind === "sticky" ? "#fef3c7" : undefined,
      fontSize: 15,
      shape: "rectangle",
    });
  const addTable = (rows: number, cols: number) => {
    addElement({
      id: makeId(),
      type: "table",
      x: 180,
      y: 190,
      w: Math.max(330, cols * 120),
      h: Math.max(150, rows * 42 + 36),
      rows,
      cols,
      cells: Array(rows * cols).fill(""),
    });
    setTableDialogOpen(false);
  };
  const addArrow = (curved = false) =>
    addElement({
      id: makeId(),
      type: "arrow",
      x: 350,
      y: 240,
      endX: 560,
      endY: 350,
      curved,
      controlX: 470,
      controlY: curved ? 180 : 295,
    });

  const addWord = (word: SearchWord) => {
    addElement({
      id: makeId(),
      type: "word",
      x: 220,
      y: 120,
      w: 270,
      h: 170,
      wordId: word._id,
      word: word.word,
      definition:
        word.definitions?.[0]?.definition || "Open to view definition",
    });
    setWordQuery("");
    setWordResults([]);
  };

  const startDrag = (
    event: PointerEvent<HTMLElement>,
    element: CanvasElement,
  ) => {
    if ((event.target as HTMLElement).closest("textarea, input, select"))
      return;
    event.preventDefault();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    dragRef.current = {
      id: element.id,
      offsetX: event.clientX - canvasRect.left - element.x,
      offsetY: event.clientY - canvasRect.top - element.y,
    };
    didDragRef.current = false;
    setSelectedId(element.id);
  };

  const startResize = (
    event: PointerEvent<HTMLButtonElement>,
    element: CanvasElement,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const { w, h } = boxSize(element);
    resizeRef.current = {
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      startW: w,
      startH: h,
      minW: element.type === "table" ? (element.cols || 1) * 96 + 20 : 150,
      minH: element.type === "word" ? 130 : element.type === "table" ? 90 : 90,
    };
    didDragRef.current = false;
    setSelectedId(element.id);
  };

  const startArrowHandle = (
    event: PointerEvent<SVGCircleElement>,
    element: CanvasElement,
    handle: ArrowHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { id: element.id, offsetX: 0, offsetY: 0, handle };
    didDragRef.current = false;
    setSelectedId(element.id);
  };

  const startDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!penMode || !canvasRef.current || event.target !== event.currentTarget)
      return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = {
      x: clamp(event.clientX - rect.left, 0, CANVAS_WIDTH),
      y: clamp(event.clientY - rect.top, 0, CANVAS_HEIGHT),
    };
    const drawing: CanvasElement = {
      id: makeId(),
      type: "drawing",
      x: 0,
      y: 0,
      points: [point],
      color: penColor,
      strokeWidth: penWidth,
    };
    drawRef.current = drawing.id;
    didDragRef.current = false;
    updateElements((elements) => [...elements, drawing], false);
    setSelectedId(drawing.id);
  };

  const performErase = useCallback(
    (x: number, y: number) => {
      updateElements((elements) => {
        const hasDrawing = elements.some((el) => el.type === "drawing");
        if (!hasDrawing) return elements;
        const remaining = elements.filter((el) => {
          if (el.type !== "drawing") return true;
          return !isDrawingTouched(el, x, y, eraserWidth);
        });
        if (remaining.length !== elements.length) {
          return remaining;
        }
        return elements;
      }, false);
    },
    [eraserWidth],
  );

  const startErasing = (event: PointerEvent<HTMLDivElement>) => {
    if (!eraserMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = {
      x: clamp(event.clientX - rect.left, 0, CANVAS_WIDTH),
      y: clamp(event.clientY - rect.top, 0, CANVAS_HEIGHT),
    };
    eraseRef.current = true;
    didDragRef.current = false;
    performErase(point.x, point.y);
  };

  const clearAllDrawings = () => {
    updateElements((elements) =>
      elements.filter((el) => el.type !== "drawing"),
    );
  };

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (eraseRef.current && eraserMode) {
        const point = {
          x: clamp(event.clientX - rect.left, 0, CANVAS_WIDTH),
          y: clamp(event.clientY - rect.top, 0, CANVAS_HEIGHT),
        };
        didDragRef.current = true;
        performErase(point.x, point.y);
        return;
      }
      if (resizeRef.current) {
        const resize = resizeRef.current;
        const nextW = clamp(
          resize.startW + event.clientX - resize.startX,
          resize.minW,
          CANVAS_WIDTH - 8,
        );
        const nextH = clamp(
          resize.startH + event.clientY - resize.startY,
          resize.minH,
          CANVAS_HEIGHT - 8,
        );
        didDragRef.current = true;
        updateElements(
          (elements) =>
            elements.map((el) =>
              el.id === resize.id ? { ...el, w: nextW, h: nextH } : el,
            ),
          false,
        );
        return;
      }
      if (drawRef.current) {
        const point = {
          x: clamp(event.clientX - rect.left, 0, CANVAS_WIDTH),
          y: clamp(event.clientY - rect.top, 0, CANVAS_HEIGHT),
        };
        didDragRef.current = true;
        updateElements(
          (elements) =>
            elements.map((el) =>
              el.id === drawRef.current
                ? { ...el, points: [...(el.points || []), point] }
                : el,
            ),
          false,
        );
        return;
      }
      if (!dragRef.current) return;
      const { id, offsetX, offsetY } = dragRef.current;
      const nextX = clamp(
        event.clientX - rect.left - offsetX,
        8,
        CANVAS_WIDTH - 60,
      );
      const nextY = clamp(
        event.clientY - rect.top - offsetY,
        8,
        CANVAS_HEIGHT - 60,
      );
      didDragRef.current = true;
      updateElements(
        (elements) =>
          elements
            .map((el) => {
              if (el.id !== id) return el;
              const handle = dragRef.current?.handle;
              if (handle) {
                if (handle === "control")
                  return {
                    ...el,
                    controlX: nextX,
                    controlY: nextY,
                    curved: true,
                  };
                const attached = findAttachment(
                  elements.filter((item) => item.id !== el.id),
                  nextX,
                  nextY,
                );
                if (handle === "start")
                  return {
                    ...el,
                    x: attached?.point.x || nextX,
                    y: attached?.point.y || nextY,
                    startAttachId: attached?.id,
                    startAnchor: attached?.anchor,
                  };
                return {
                  ...el,
                  endX: attached?.point.x || nextX,
                  endY: attached?.point.y || nextY,
                  endAttachId: attached?.id,
                  endAnchor: attached?.anchor,
                };
              }
              if (el.type === "arrow") {
                const dx = nextX - el.x;
                const dy = nextY - el.y;
                return {
                  ...el,
                  x: nextX,
                  y: nextY,
                  endX: (el.endX || 0) + dx,
                  endY: (el.endY || 0) + dy,
                  controlX: (el.controlX || 0) + dx,
                  controlY: (el.controlY || 0) + dy,
                  startAttachId: undefined,
                  endAttachId: undefined,
                };
              }
              const moved = { ...el, x: nextX, y: nextY };
              return moved;
            })
            .map((el) => {
              const movedTarget = elements.find((item) => item.id === id);
              if (
                !movedTarget ||
                movedTarget.type === "arrow" ||
                movedTarget.type === "drawing"
              )
                return el;
              const moved = { ...movedTarget, x: nextX, y: nextY };
              if (el.startAttachId === id && el.startAnchor)
                return { ...el, ...anchorPoint(moved, el.startAnchor) };
              if (el.endAttachId === id && el.endAnchor)
                return {
                  ...el,
                  endX: anchorPoint(moved, el.endAnchor).x,
                  endY: anchorPoint(moved, el.endAnchor).y,
                };
              return el;
            }),
        false,
      );
    };
    const stop = () => {
      if (didDragRef.current || drawRef.current || eraseRef.current)
        recordHistory(
          latestSnapshotRef.current.title,
          latestSnapshotRef.current.elements,
        );
      dragRef.current = null;
      drawRef.current = null;
      resizeRef.current = null;
      eraseRef.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    // updateElements intentionally reads the current canvas state through its functional setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, queueSave, eraserMode, performErase]);

  const selected = useMemo(
    () => note?.elements.find((item) => item.id === selectedId),
    [note?.elements, selectedId],
  );
  const changeTitle = (value: string) => {
    setTitle(value);
    if (note) {
      latestSnapshotRef.current = { title: value, elements: note.elements };
      recordHistory(value, note.elements);
      queueSave(value, note.elements);
    }
  };
  const changeBackgroundColor = (value: string) => {
    setBackgroundColor(value);
    if (note) queueSave(title, note.elements, value);
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    updateElements((items) => items.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };
  const restoreHistory = (index: number) => {
    const snapshot = historyRef.current[index];
    if (!snapshot) return;
    historyIndexRef.current = index;
    setHistoryState({ index, length: historyRef.current.length });
    const restored = {
      title: snapshot.title,
      elements: structuredClone(snapshot.elements),
    };
    latestSnapshotRef.current = restored;
    setTitle(restored.title);
    setNote((current) =>
      current ? { ...current, elements: restored.elements } : current,
    );
    queueSave(restored.title, restored.elements);
  };
  const undo = () => {
    if (historyIndexRef.current > 0)
      restoreHistory(historyIndexRef.current - 1);
  };
  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1)
      restoreHistory(historyIndexRef.current + 1);
  };
  const deleteNote = async () => {
    if (!noteId || !window.confirm("Delete this note permanently?")) return;
    try {
      await apiFetch(`/WoahCab/notes/${noteId}`, { method: "DELETE" });
      router.push("/mynotes-dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete note");
    }
  };
  const updateElement = (id: string, patch: Partial<CanvasElement>) =>
    updateElements((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  if (loading)
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-violet-500/15 border-t-violet-500 animate-spin" />
        </main>
      </div>
    );
  if (error && !note)
    return (
      <div className="min-h-screen bg-background flex flex-col text-slate-900 dark:text-slate-100">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <h1 className="font-black text-xl">Couldn’t open this note</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <Link
            href="/mynotes-dashboard"
            className="mt-5 text-sm font-bold text-violet-600"
          >
            Back to My Notes
          </Link>
        </main>
      </div>
    );
  if (!note) return null;

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-border bg-background/95 backdrop-blur px-4 py-3 md:px-6 flex flex-wrap items-center gap-3">
          <Link
            href="/mynotes-dashboard"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-card-hover hover:text-violet-600"
            aria-label="Back to My Notes"
          >
            ←
          </Link>
          <input
            value={title}
            onChange={(e) => changeTitle(e.target.value)}
            maxLength={120}
            className="min-w-40 flex-1 bg-transparent text-lg font-black outline-none placeholder:text-slate-400"
            aria-label="Note title"
          />
          <span
            className={`text-xs font-bold ${saveState === "saved" ? "text-emerald-600 dark:text-emerald-400" : saveState === "saving" ? "text-amber-600" : "text-slate-500"}`}
          >
            {saveState === "saved"
              ? "Saved"
              : saveState === "saving"
                ? "Saving…"
                : "Unsaved"}
          </span>
          <button
            onClick={deleteNote}
            className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 cursor-pointer"
          >
            Delete
          </button>
        </div>

        <div className="border-b border-border bg-card/70 px-4 py-3 md:px-6 flex flex-wrap items-center gap-2 shadow-sm z-20">
          <button
            onClick={undo}
            disabled={historyState.index <= 0}
            className="canvas-tool disabled:opacity-35"
            title="Undo"
          >
            ↶<span>Undo</span>
          </button>
          <button
            onClick={redo}
            disabled={historyState.index >= historyState.length - 1}
            className="canvas-tool disabled:opacity-35"
            title="Redo"
          >
            ↷<span>Redo</span>
          </button>
          <div className="h-7 w-px bg-border mx-1" />
          <button
            onClick={() => addText("text")}
            className="canvas-tool"
            title="Text box"
          >
            <b>T</b>
            <span>Text</span>
          </button>
          <button
            onClick={() => addText("sticky")}
            className="canvas-tool"
            title="Sticky note"
          >
            <span className="h-3.5 w-3.5 rounded-sm bg-amber-300 border border-amber-400" />
            <span>Sticky</span>
          </button>
          <button
            onClick={() => setTableDialogOpen(true)}
            className="canvas-tool"
            title="Insert table"
          >
            <span className="grid grid-cols-2 gap-px p-0.5 border border-current rounded-sm">
              <i className="h-1.5 w-1.5 bg-current" />
              <i className="h-1.5 w-1.5 bg-current" />
              <i className="h-1.5 w-1.5 bg-current" />
              <i className="h-1.5 w-1.5 bg-current" />
            </span>
            <span>Table</span>
          </button>
          <button
            onClick={() => addArrow(false)}
            className="canvas-tool"
            title="Add straight arrow"
          >
            <span className="text-base">↗</span>
            <span>Arrow</span>
          </button>
          <button
            onClick={() => addArrow(true)}
            className="canvas-tool"
            title="Add a bendable curved arrow"
          >
            <span className="text-base">⌒</span>
            <span>Curve</span>
          </button>
          <button
            onClick={() => {
              setPenMode((active) => {
                const next = !active;
                if (next) setEraserMode(false);
                return next;
              });
            }}
            className={`canvas-tool ${penMode ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700" : ""}`}
            title="Draw with pen"
          >
            <span className="text-base">✎</span>
            <span>Pen</span>
          </button>
          {penMode && (
            <>
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                title="Pen colour"
                className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent p-1"
              />
              <select
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
                title="Pen width"
                className="h-8 rounded-lg border border-border bg-background px-1 text-xs outline-none"
              >
                <option value={2}>Thin</option>
                <option value={3}>Medium</option>
                <option value={6}>Thick</option>
              </select>
            </>
          )}
          <button
            onClick={() => {
              setEraserMode((active) => {
                const next = !active;
                if (next) setPenMode(false);
                return next;
              });
            }}
            className={`canvas-tool ${eraserMode ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700" : ""}`}
            title="Erase pen drawings"
          >
            <span className="text-base">🧹</span>
            <span>Eraser</span>
          </button>
          {eraserMode && (
            <>
              <select
                value={eraserWidth}
                onChange={(e) => setEraserWidth(Number(e.target.value))}
                title="Eraser size"
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-rose-500"
              >
                <option value={10}>Small Eraser</option>
                <option value={20}>Medium Eraser</option>
                <option value={40}>Large Eraser</option>
              </select>
              <button
                onClick={clearAllDrawings}
                className="canvas-tool text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                title="Clear all pen drawings on canvas"
              >
                <span>Clear Drawings</span>
              </button>
            </>
          )}
          <label className="canvas-tool" title="Canvas background colour">
            <span
              className="h-3.5 w-3.5 rounded border border-current"
              style={{ backgroundColor }}
            />
            <span>Canvas</span>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => changeBackgroundColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
          <div className="h-7 w-px bg-border mx-1" />
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
              />
            </svg>
            <input
              value={wordQuery}
              onChange={(e) => {
                const value = e.target.value;
                setWordQuery(value);
                if (!value.trim()) {
                  setWordResults([]);
                  setSearching(false);
                }
              }}
              placeholder="Search vocabulary and add it to your canvas…"
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs font-medium outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
            />
            {(wordResults.length > 0 || searching) && (
              <div className="absolute top-full mt-2 left-0 right-0 max-h-64 overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl p-1.5 z-50">
                {searching && !wordResults.length ? (
                  <p className="px-3 py-3 text-xs text-slate-500">
                    Finding related words…
                  </p>
                ) : (
                  wordResults.slice(0, 7).map((word) => (
                    <button
                      key={word._id}
                      onClick={() => addWord(word)}
                      className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-violet-500/10 cursor-pointer"
                    >
                      <span className="block text-sm font-bold capitalize text-violet-600 dark:text-violet-400">
                        {word.word}
                      </span>
                      <span className="line-clamp-1 block mt-0.5 text-xs text-slate-500">
                        {word.definitions?.[0]?.definition || "Add to canvas"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {selected &&
            (selected.type === "text" || selected.type === "sticky") && (
              <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
                <button
                  onClick={() =>
                    updateElement(selected.id, { bold: !selected.bold })
                  }
                  className={`canvas-tool !px-2 !py-1 ${selected.bold ? "bg-violet-500/15 text-violet-700" : ""}`}
                  title="Bold"
                >
                  <b>B</b>
                </button>
                <button
                  onClick={() =>
                    updateElement(selected.id, { italic: !selected.italic })
                  }
                  className={`canvas-tool !px-2 !py-1 ${selected.italic ? "bg-violet-500/15 text-violet-700" : ""}`}
                  title="Italic"
                >
                  <i>I</i>
                </button>
                <button
                  onClick={() =>
                    updateElement(selected.id, {
                      underline: !selected.underline,
                    })
                  }
                  className={`canvas-tool !px-2 !py-1 ${selected.underline ? "bg-violet-500/15 text-violet-700" : ""}`}
                  title="Underline"
                >
                  <u>U</u>
                </button>
                <label
                  className="flex items-center gap-1 text-[10px] font-bold text-slate-500"
                  title="Font size from 5 to 30"
                >
                  <span>Size</span>
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={selected.fontSize || 15}
                    onChange={(e) =>
                      updateElement(selected.id, {
                        fontSize: clamp(Number(e.target.value) || 5, 5, 30),
                      })
                    }
                    className="h-7 w-11 rounded-md border border-border bg-transparent px-1 text-center text-xs font-bold outline-none focus:border-violet-500"
                  />
                </label>
                <select
                  value={selected.shape || "rectangle"}
                  onChange={(e) =>
                    updateElement(selected.id, {
                      shape: e.target.value as CanvasElement["shape"],
                    })
                  }
                  className="h-7 max-w-28 rounded-md bg-transparent px-1 text-xs font-bold outline-none"
                  title="Text box shape"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="rounded">Rounded box</option>
                  <option value="pill">Pill</option>
                  <option value="cloud">Cloud</option>
                  <option value="speech">Speech bubble</option>
                  <option value="diamond">Diamond</option>
                  <option value="hexagon">Hexagon</option>
                  <option value="parallelogram">Parallelogram</option>
                </select>
              </div>
            )}
          {selected && (
            <button
              onClick={deleteSelected}
              className="canvas-tool ml-auto text-red-600 hover:bg-red-500/10"
              title="Remove selected text, table, word, arrow, or drawing"
            >
              ⌫<span>Remove</span>
            </button>
          )}
        </div>

        {error && (
          <p className="mx-4 mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950/60 p-5 md:p-8">
          <div
            ref={canvasRef}
            onPointerDown={(event) => {
              if (penMode) startDrawing(event);
              else if (eraserMode) startErasing(event);
              else if (event.target === event.currentTarget)
                setSelectedId(null);
            }}
            className={`relative mx-auto overflow-hidden rounded-[1.75rem] border border-slate-200 dark:border-slate-800 shadow-xl ${penMode ? "cursor-crosshair" : eraserMode ? "cursor-crosshair" : ""}`}
            style={{
              width: CANVAS_WIDTH,
              minHeight: CANVAS_HEIGHT,
              backgroundColor,
              backgroundImage:
                "radial-gradient(circle, rgba(148,163,184,.27) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          >
            <svg
              className="absolute inset-0 pointer-events-none"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            >
              {note.elements
                .filter((el) => el.type === "drawing")
                .map((el) => (
                  <polyline
                    key={el.id}
                    points={(el.points || [])
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={el.color || "#7c3aed"}
                    strokeWidth={el.strokeWidth || 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={
                      eraserMode
                        ? "pointer-events-auto cursor-pointer hover:stroke-rose-500/80 transition-colors"
                        : "pointer-events-none"
                    }
                    onPointerDown={(e) => {
                      if (eraserMode) {
                        e.stopPropagation();
                        updateElements((elements) =>
                          elements.filter((item) => item.id !== el.id),
                        );
                      }
                    }}
                  />
                ))}
              {note.elements
                .filter((el) => el.type === "arrow")
                .map((el) => (
                  <g
                    key={el.id}
                    className="pointer-events-auto cursor-move"
                    onPointerDown={(event) =>
                      startDrag(
                        event as unknown as PointerEvent<HTMLElement>,
                        el,
                      )
                    }
                  >
                    <defs>
                      <marker
                        id={`head-${el.id}`}
                        markerWidth="10"
                        markerHeight="10"
                        refX="8"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8" fill="#7c3aed" />
                      </marker>
                    </defs>
                    {el.curved ? (
                      <path
                        d={`M ${el.x} ${el.y} Q ${el.controlX || (el.x + (el.endX || el.x)) / 2} ${el.controlY || el.y - 80} ${el.endX} ${el.endY}`}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="2.5"
                        markerEnd={`url(#head-${el.id})`}
                      />
                    ) : (
                      <line
                        x1={el.x}
                        y1={el.y}
                        x2={el.endX}
                        y2={el.endY}
                        stroke="#7c3aed"
                        strokeWidth="2.5"
                        markerEnd={`url(#head-${el.id})`}
                      />
                    )}
                    <circle
                      cx={el.x}
                      cy={el.y}
                      r="7"
                      fill="#fff"
                      stroke="#7c3aed"
                      strokeWidth="2"
                      className="cursor-crosshair"
                      onPointerDown={(event) =>
                        startArrowHandle(event, el, "start")
                      }
                    />
                    <circle
                      cx={el.endX}
                      cy={el.endY}
                      r="8"
                      fill="#7c3aed"
                      className="cursor-crosshair"
                      onPointerDown={(event) =>
                        startArrowHandle(event, el, "end")
                      }
                    />
                    {el.curved && (
                      <circle
                        cx={el.controlX}
                        cy={el.controlY}
                        r="7"
                        fill="#fbbf24"
                        stroke="#fff"
                        strokeWidth="2"
                        className="cursor-grab"
                        onPointerDown={(event) =>
                          startArrowHandle(event, el, "control")
                        }
                      />
                    )}
                  </g>
                ))}
            </svg>
            {note.elements
              .filter((el) => !["arrow", "drawing"].includes(el.type))
              .map((element) => {
                const isSelected = selectedId === element.id;
                const dimensions = boxSize(element);
                const base = {
                  left: element.x,
                  top: element.y,
                  width: dimensions.w,
                  height: dimensions.h,
                  zIndex: isSelected ? 10 : 1,
                };
                const resizeHandle = (
                  <button
                    type="button"
                    onPointerDown={(e) => startResize(e, element)}
                    className="absolute bottom-1 right-1 z-20 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-violet-500 shadow-sm"
                    aria-label="Resize box"
                    title="Drag to resize"
                  />
                );
                if (element.type === "word")
                  return (
                    <div
                      key={element.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => startDrag(e, element)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (didDragRef.current) {
                          didDragRef.current = false;
                          return;
                        }
                        router.push(`/words/details?id=${element.wordId}`);
                      }}
                      style={base}
                      className={`absolute flex cursor-grab flex-col overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-4 text-left shadow-lg transition-shadow hover:shadow-xl active:cursor-grabbing ${isSelected ? "border-violet-500 ring-2 ring-violet-500/25" : "border-violet-300 dark:border-violet-500/35"}`}
                    >
                      <span className="shrink-0 text-lg font-black capitalize text-violet-600 dark:text-violet-400">
                        {element.word}
                      </span>
                      <span className="mt-1.5 flex-1 overflow-hidden text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {element.definition}
                      </span>
                      <span className="mt-3 shrink-0 text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        Open word details ↗
                      </span>
                      {resizeHandle}
                    </div>
                  );
                if (element.type === "table")
                  return (
                    <div
                      key={element.id}
                      onPointerDown={(e) => startDrag(e, element)}
                      style={base}
                      className={`absolute cursor-grab overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-2 shadow-lg ${isSelected ? "border-violet-500 ring-2 ring-violet-500/25" : "border-border"}`}
                    >
                      <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Table
                      </div>
                      <div
                        className="grid h-[calc(100%-1.5rem)] w-full overflow-hidden rounded-xl border border-border cursor-default"
                        style={{
                          gridTemplateColumns: `repeat(${element.cols || 3}, minmax(0, 1fr))`,
                          gridTemplateRows: `repeat(${element.rows || 3}, minmax(0, 1fr))`,
                        }}
                      >
                        {Array.from({
                          length: (element.rows || 3) * (element.cols || 3),
                        }).map((_, index) => (
                          <input
                            key={index}
                            value={element.cells?.[index] || ""}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedId(element.id);
                            }}
                            onChange={(e) => {
                              const cells = [...(element.cells || [])];
                              cells[index] = e.target.value;
                              updateElement(element.id, { cells });
                            }}
                            placeholder={
                              index < (element.cols || 3) ? "Heading" : "…"
                            }
                            className="min-h-0 min-w-0 border-r border-b border-border bg-transparent px-2.5 py-2 text-xs outline-none focus:bg-violet-500/5"
                          />
                        ))}
                      </div>
                      {resizeHandle}
                    </div>
                  );
                const sticky = element.type === "sticky";
                const shapeClass =
                  element.shape === "pill"
                    ? "rounded-[2.25rem]"
                    : element.shape === "rounded"
                      ? "rounded-3xl"
                      : element.shape === "cloud"
                        ? "notes-shape-cloud"
                        : element.shape === "speech"
                          ? "notes-shape-speech"
                          : element.shape === "diamond"
                            ? "notes-shape-diamond"
                            : element.shape === "hexagon"
                              ? "notes-shape-hexagon"
                              : element.shape === "parallelogram"
                                ? "notes-shape-parallelogram"
                                : "rounded-lg";
                return (
                  <div
                    key={element.id}
                    onPointerDown={(e) => startDrag(e, element)}
                    style={base}
                    className={`absolute cursor-grab overflow-hidden border shadow-lg ${shapeClass} ${sticky ? "border-amber-300/70 bg-amber-100 dark:bg-amber-300/90" : "border-border bg-white dark:bg-slate-900"} ${isSelected ? "ring-2 ring-violet-500/35" : ""}`}
                  >
                    <div
                      className={`h-7 flex items-center px-3 text-[10px] font-bold uppercase tracking-wider ${sticky ? "text-amber-800/65" : "text-slate-400"}`}
                    >
                      {sticky ? "Sticky note" : "Text note"}
                    </div>
                    <textarea
                      value={element.text || ""}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedId(element.id);
                      }}
                      onChange={(e) =>
                        updateElement(element.id, { text: e.target.value })
                      }
                      style={{
                        fontSize: element.fontSize || 15,
                        fontWeight: element.bold ? 700 : 400,
                        fontStyle: element.italic ? "italic" : "normal",
                        textDecoration: element.underline
                          ? "underline"
                          : "none",
                      }}
                      className={`block h-[calc(100%-1.75rem)] w-full resize-none bg-transparent px-4 pb-4 leading-relaxed outline-none ${sticky ? "text-amber-950 placeholder:text-amber-800/50" : "text-slate-800 dark:text-slate-100"}`}
                      placeholder="Write something…"
                    />
                    {resizeHandle}
                  </div>
                );
              })}
            {!note.elements.length && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 text-3xl">
                  ✦
                </div>
                <h2 className="font-black text-xl">Make this canvas yours</h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  Add text, sticky notes, tables, arrows, or search your
                  vocabulary to drag a word into your study board.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      {tableDialogOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-size-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <h2 id="table-size-title" className="text-lg font-black">
              Insert a table
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose the size before adding it to your canvas.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Rows
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={tableRows}
                  onChange={(e) =>
                    setTableRows(clamp(Number(e.target.value) || 1, 1, 12))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Columns
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(e) =>
                    setTableCols(clamp(Number(e.target.value) || 1, 1, 10))
                  }
                  className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setTableDialogOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-card-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => addTable(tableRows, tableCols)}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
              >
                Add table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DetailedNotesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DetailedNotesContent />
    </Suspense>
  );
}
