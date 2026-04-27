'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Archive, X, Pin, Search, RotateCcw, LayoutGrid } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { zhCN } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker.css';
import {
  archiveNoteRecord,
  arrangeNotesInGrid,
  bringNoteToFront,
  createNote,
  filterArchivedNotes,
  formatDateKey,
  getNextZIndex,
  parseDateKey,
  readNotesFromStorage,
  restoreNoteRecord,
  type Note,
} from '../lib/notes';

interface DragState {
  type: 'MOVE' | 'RESIZE' | 'PAN';
  id?: string;
  pointerId: number;
  startX: number;
  startY: number;
  initialX?: number;
  initialY?: number;
  initialW?: number;
  initialH?: number;
  initialViewportX?: number;
  initialViewportY?: number;
}

const NOTE_COLORS = [
  { id: 'yellow', bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200/60', dot: 'bg-amber-400', scrollThumb: '#f59e0b', scrollTrack: '#fef3c7' },
  { id: 'blue', bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200/60', dot: 'bg-blue-400', scrollThumb: '#60a5fa', scrollTrack: '#dbeafe' },
  { id: 'green', bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200/60', dot: 'bg-emerald-400', scrollThumb: '#34d399', scrollTrack: '#d1fae5' },
  { id: 'rose', bg: 'bg-rose-50', text: 'text-rose-900', border: 'border-rose-200/60', dot: 'bg-rose-400', scrollThumb: '#fb7185', scrollTrack: '#ffe4e6' },
  { id: 'purple', bg: 'bg-violet-50', text: 'text-violet-900', border: 'border-violet-200/60', dot: 'bg-violet-400', scrollThumb: '#a78bfa', scrollTrack: '#ede9fe' },
  { id: 'gray', bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200/60', dot: 'bg-gray-400', scrollThumb: '#9ca3af', scrollTrack: '#e5e7eb' },
] as const;

const STORAGE_KEY = 'mind-sticky-data';
const VIEWPORT_STORAGE_KEY = 'mind-sticky-viewport';

const readViewportFromStorage = (storageValue: string | null) => {
  if (!storageValue) {
    return { x: 0, y: 0 };
  }

  const parsed = JSON.parse(storageValue);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof parsed.x === 'number' &&
    Number.isFinite(parsed.x) &&
    typeof parsed.y === 'number' &&
    Number.isFinite(parsed.y)
  ) {
    return { x: parsed.x, y: parsed.y };
  }

  return { x: 0, y: 0 };
};

const formatNoteDateTime = (value: string) => {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isTrashActive, setIsTrashActive] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [filterDate, setFilterDate] = useState(() => formatDateKey(new Date()));

  const trashRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<Note[]>([]);
  const viewportRef = useRef(viewport);
  const dragStateRef = useRef<DragState | null>(null);
  const hasLoadedNotesRef = useRef(false);
  const isTrashActiveRef = useRef(false);
  const pendingFrameRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{
    id: string;
    type: DragState['type'];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    let initialNotes: Note[] = [];
    let initialViewport = { x: 0, y: 0 };

    try {
      initialNotes = readNotesFromStorage(localStorage.getItem(STORAGE_KEY));
      initialViewport = readViewportFromStorage(localStorage.getItem(VIEWPORT_STORAGE_KEY));
    } catch (error) {
      console.error('Failed to read saved canvas data from localStorage.', error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VIEWPORT_STORAGE_KEY);
    }

    const loadTimer = window.setTimeout(() => {
      setNotes(initialNotes);
      setViewport(initialViewport);
      hasLoadedNotesRef.current = true;
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedNotesRef.current || dragState) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
    }, 150);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [notes, viewport, dragState]);

  useEffect(() => {
    return () => {
      if (pendingFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingFrameRef.current);
      }
    };
  }, []);

  const applyPendingDragUpdate = useCallback(() => {
    const update = pendingUpdateRef.current;
    if (!update) {
      return;
    }

    pendingUpdateRef.current = null;
    setNotes((prev) =>
      prev.map((note) => {
        if (note.id !== update.id) {
          return note;
        }

        if (update.type === 'MOVE') {
          return {
            ...note,
            x: update.x ?? note.x,
            y: update.y ?? note.y,
          };
        }

        return {
          ...note,
          width: update.width ?? note.width,
          height: update.height ?? note.height,
        };
      })
    );
  }, []);

  const scheduleDragUpdate = useCallback((update: NonNullable<typeof pendingUpdateRef.current>) => {
    pendingUpdateRef.current = update;

    if (pendingFrameRef.current !== null) {
      return;
    }

    pendingFrameRef.current = window.requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      applyPendingDragUpdate();
    });
  }, [applyPendingDragUpdate]);

  const bringToFront = (id: string) => {
    setNotes((prev) => bringNoteToFront(prev, id));
  };

  const addNote = () => {
    setNotes((prev) => [
      ...prev,
      {
        ...createNote(window.innerWidth, window.innerHeight, getNextZIndex(prev)),
        x:
          window.innerWidth / 2 - 130 - viewportRef.current.x,
        y:
          window.innerHeight / 2 - 110 - viewportRef.current.y,
      },
    ]);
  };

  const updateNote = (id: string, fields: Partial<Note>) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...fields } : note)));
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  const restoreNote = (id: string) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? restoreNoteRecord(note) : note))
    );
  };

  const archiveNote = (id: string) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? archiveNoteRecord(note) : note))
    );
  };

  const organizeNotes = () => {
    setNotes((prev) => {
      const activeCount = prev.filter((note) => !note.isArchived).length;
      const columns = Math.max(
        1,
        Math.min(4, Math.ceil(Math.sqrt(activeCount || 1)))
      );
      const arranged = arrangeNotesInGrid(prev, { columns });

      if (arranged.bounds) {
        setViewport({
          x: 48 - arranged.bounds.minX,
          y: 96 - arranged.bounds.minY,
        });
      }

      return arranged.notes;
    });
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    note: Note,
    type: 'MOVE' | 'RESIZE'
  ) => {
    if (note.isPinned && type === 'MOVE') {
      return;
    }

    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
    e.stopPropagation();

    e.currentTarget.setPointerCapture?.(e.pointerId);
    bringToFront(note.id);

    const nextDragState: DragState = {
      type,
      id: note.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: note.x,
      initialY: note.y,
      initialW: note.width,
      initialH: note.height,
    };

    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target !== e.currentTarget) {
      return;
    }

    e.preventDefault();

    const nextDragState: DragState = {
      type: 'PAN',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialViewportX: viewportRef.current.x,
      initialViewportY: viewportRef.current.y,
    };

    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    dragStateRef.current = dragState;

    const handlePointerMove = (e: PointerEvent) => {
      const activeDrag = dragStateRef.current;
      if (!activeDrag || e.pointerId !== activeDrag.pointerId) {
        return;
      }

      const deltaX = e.clientX - activeDrag.startX;
      const deltaY = e.clientY - activeDrag.startY;

      if (activeDrag.type === 'PAN') {
        setViewport({
          x: (activeDrag.initialViewportX ?? 0) + deltaX,
          y: (activeDrag.initialViewportY ?? 0) + deltaY,
        });
        return;
      }

      if (activeDrag.type === 'MOVE') {
        scheduleDragUpdate({
          id: activeDrag.id!,
          type: 'MOVE',
          x: (activeDrag.initialX ?? 0) + deltaX,
          y: (activeDrag.initialY ?? 0) + deltaY,
        });

        if (trashRef.current) {
          const trashRect = trashRef.current.getBoundingClientRect();
          const isOver =
            e.clientX >= trashRect.left &&
            e.clientX <= trashRect.right &&
            e.clientY >= trashRect.top &&
            e.clientY <= trashRect.bottom;

          isTrashActiveRef.current = isOver;
          setIsTrashActive(isOver);
        }
      } else {
        scheduleDragUpdate({
          id: activeDrag.id!,
          type: 'RESIZE',
          width: Math.max(350, (activeDrag.initialW ?? 350) + deltaX),
          height: Math.max(340, (activeDrag.initialH ?? 340) + deltaY),
        });
      }
    };

    const finishDrag = (pointerId?: number) => {
      const activeDrag = dragStateRef.current;
      if (!activeDrag || (pointerId !== undefined && activeDrag.pointerId !== pointerId)) {
        return;
      }

      if (pendingFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
        applyPendingDragUpdate();
      }

      if (activeDrag.type === 'MOVE' && isTrashActiveRef.current && activeDrag.id) {
        deleteNote(activeDrag.id);
      }

      pendingUpdateRef.current = null;
      dragStateRef.current = null;
      isTrashActiveRef.current = false;
      setDragState(null);
      setIsTrashActive(false);
    };

    const handlePointerUp = (e: PointerEvent) => {
      finishDrag(e.pointerId);
    };

    const handlePointerCancel = (e: PointerEvent) => {
      finishDrag(e.pointerId);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [applyPendingDragUpdate, dragState, scheduleDragUpdate]);

  const archivedNotes = useMemo(() => filterArchivedNotes(notes, filterDate), [notes, filterDate]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50 font-sans text-gray-800">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      <div className="absolute top-6 left-6 z-[1000000] flex flex-col gap-3">
        <button
          onClick={addNote}
          className="group relative flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3.5 text-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-105 hover:bg-gray-50 active:scale-95"
          title="新建便签"
        >
          <Plus size={22} strokeWidth={2.5} />
          <div className="pointer-events-none absolute left-full ml-3 rounded-md bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
            新建便签
          </div>
        </button>

        <button
          onClick={() => setViewport({ x: 0, y: 0 })}
          className="group relative flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3.5 text-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-105 hover:bg-gray-50 active:scale-95"
          title="回到中心"
        >
          <RotateCcw size={20} strokeWidth={2.2} />
          <div className="pointer-events-none absolute left-full ml-3 rounded-md bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
            回到中心
          </div>
        </button>

        <button
          onClick={organizeNotes}
          className="group relative flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3.5 text-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-105 hover:bg-gray-50 active:scale-95"
          title="一键整理"
        >
          <LayoutGrid size={20} strokeWidth={2.2} />
          <div className="pointer-events-none absolute left-full ml-3 rounded-md bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
            一键整理
          </div>
        </button>

        <button
          onClick={() => setShowArchive(true)}
          className="group relative flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3.5 text-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-105 hover:bg-gray-50 active:scale-95"
          title="归档"
        >
          <Archive size={22} strokeWidth={2} />
          <div className="pointer-events-none absolute left-full ml-3 rounded-md bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">
            归档
          </div>
        </button>
      </div>

      <div
        ref={canvasRef}
        className={`relative h-full w-full ${dragState?.type === 'PAN' ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={handleCanvasPointerDown}
      >
        {notes.filter((note) => !note.isArchived).map((note) => {
          const styleConfig = NOTE_COLORS.find((color) => color.id === note.color) ?? NOTE_COLORS[0];
          const isDragging = dragState?.id === note.id;

          return (
            <div
              key={note.id}
              style={{
                left: note.x + viewport.x,
                top: note.y + viewport.y,
                width: note.width,
                height: note.height,
                zIndex: isDragging ? 999999 : note.zIndex,
                touchAction: 'none',
                ['--note-scrollbar-thumb' as string]: styleConfig.scrollThumb,
                ['--note-scrollbar-track' as string]: styleConfig.scrollTrack,
              }}
              className={`
                group absolute flex flex-col rounded-xl border
                transition-shadow duration-200 ease-out
                ${styleConfig.bg} ${styleConfig.text} ${styleConfig.border}
                ${isDragging ? 'scale-[1.01] cursor-grabbing shadow-2xl' : 'shadow-md hover:shadow-lg'}
                ${note.isPinned ? 'shadow-xl' : ''}
              `}
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (
                  target.tagName !== 'INPUT' &&
                  target.tagName !== 'TEXTAREA' &&
                  target.tagName !== 'BUTTON'
                ) {
                  handlePointerDown(e, note, 'MOVE');
                } else {
                  bringToFront(note.id);
                }
              }}
            >
              <div className="flex select-none items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => updateNote(note.id, { isPinned: !note.isPinned })}
                    className={`
                      rounded p-1 transition-colors hover:bg-black/5
                      ${note.isPinned ? 'text-red-500' : 'text-black/20 hover:text-black/50'}
                    `}
                    title={note.isPinned ? '取消固定' : '固定'}
                  >
                    <Pin size={14} fill={note.isPinned ? 'currentColor' : 'none'} />
                  </button>
                  <span className="text-[10px] font-medium opacity-40">
                    {formatNoteDateTime(note.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {NOTE_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => updateNote(note.id, { color: color.id })}
                        className={`
                          h-4 w-4 rounded-full border border-black/5 transition-transform hover:scale-110
                          ${color.dot}
                          ${note.color === color.id ? 'scale-110 ring-2 ring-black/20' : ''}
                        `}
                        title="更改颜色"
                      />
                    ))}
                  </div>

                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => archiveNote(note.id)}
                    className="ml-1 rounded p-1 text-black/30 transition-colors hover:bg-black/5 hover:text-black/70"
                    title="归档"
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 cursor-text flex-col overflow-hidden px-4 pt-1 pb-4">
                <input
                  type="text"
                  value={note.title}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => updateNote(note.id, { title: e.target.value })}
                  placeholder="标题"
                  className="mb-1 w-full bg-transparent text-lg font-bold placeholder-black/20 focus:outline-none"
                />
                <textarea
                  value={note.content}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => updateNote(note.id, { content: e.target.value })}
                  placeholder="在此输入内容..."
                  className="note-scrollbar flex-1 w-full resize-none overflow-y-auto bg-transparent pr-1 text-[14px] leading-relaxed placeholder-black/30 selection:bg-black/10 focus:outline-none"
                />
              </div>

              <div
                onPointerDown={(e) => handlePointerDown(e, note, 'RESIZE')}
                className="absolute right-0 bottom-0 flex h-6 w-6 cursor-nwse-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-black/10 hover:bg-black/30" />
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={trashRef}
        className={`fixed right-8 bottom-8 z-40 flex items-center justify-center rounded-2xl border transition-all duration-300
          ${
            isTrashActive
              ? 'h-28 w-28 scale-110 border-red-200 bg-red-100/90 text-red-500 shadow-lg backdrop-blur'
              : dragState?.type === 'MOVE'
                ? 'h-20 w-20 translate-y-0 border-gray-200 bg-white/90 text-gray-400 opacity-100 shadow-xl backdrop-blur'
                : 'pointer-events-none h-16 w-16 translate-y-20 opacity-0'
          }
        `}
      >
        <Trash2
          size={isTrashActive ? 40 : 28}
          className={`transition-transform duration-300 ${isTrashActive ? 'scale-110' : ''}`}
        />
      </div>

      {showArchive && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setShowArchive(false)}
          />

          <div className="relative flex h-full w-80 flex-col border-l border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <Archive size={18} className="text-gray-500" />
                归档管理
              </h2>
              <button
                onClick={() => setShowArchive(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200/50 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="border-b border-gray-100 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">筛选日期</label>
                <button
                  onClick={() => setFilterDate(formatDateKey(new Date()))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  今天
                </button>
              </div>

              <DatePicker
                selected={filterDate ? parseDateKey(filterDate) : null}
                onChange={(date: Date | null) => {
                  if (date) {
                    setFilterDate(formatDateKey(date));
                  }
                }}
                dateFormat="yyyy年 M月 d日"
                locale={zhCN}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                placeholderText="选择日期"
                maxDate={new Date()}
                inline={false}
                calendarClassName="custom-datepicker rounded-lg border border-gray-200 shadow-lg"
                renderCustomHeader={({
                  date,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
                }) => (
                  <div className="flex items-center justify-between px-1 py-2">
                    <button
                      onClick={decreaseMonth}
                      disabled={prevMonthButtonDisabled}
                      className="rounded-md p-1 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-gray-900">
                      {date.getFullYear()}
                      年
                      {date.getMonth() + 1}
                      月
                    </span>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      className="rounded-md p-1 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
                formatWeekDay={(day) =>
                  ['日', '一', '二', '三', '四', '五', '六'][
                    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
                  ]
                }
              />
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50/30 p-5">
              {archivedNotes.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <Search size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">暂无归档</p>
                </div>
              ) : (
                archivedNotes.map((note) => {
                  const styleConfig = NOTE_COLORS.find((color) => color.id === note.color) ?? NOTE_COLORS[0];
                  return (
                    <div
                      key={note.id}
                      className={`group relative rounded-xl border p-4 transition-transform hover:scale-[1.02] ${styleConfig.bg} ${styleConfig.border}`}
                    >
                      <h3 className="mb-1 truncate text-sm font-bold text-gray-800">
                        {note.title || '无标题'}
                      </h3>
                      <p className="line-clamp-2 text-xs text-gray-600/80">
                        {note.content || '(无内容)'}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-medium text-black/30">
                        <span>{formatNoteDateTime(note.createdAt)}</span>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => restoreNote(note.id)}
                            className="rounded-md bg-white/60 p-1.5 text-blue-600 shadow-sm transition-all hover:bg-white"
                            title="还原"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="rounded-md bg-white/60 p-1.5 text-red-500 shadow-sm transition-all hover:bg-white"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
