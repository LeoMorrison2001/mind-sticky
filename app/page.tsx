'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Archive,
  X,
  Pin,
  Search,
  RotateCcw
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import { zhCN } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker.css';

// Types
interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  zIndex: number;
}

interface DragState {
  type: 'MOVE' | 'RESIZE';
  id: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW?: number;
  initialH?: number;
}

/**
 * Utility: Generate a random ID
 */
const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * Constants: Modern Pastel Colors
 */
const NOTE_COLORS = [
  { id: 'yellow', bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200/60', dot: 'bg-amber-400' },
  { id: 'blue', bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200/60', dot: 'bg-blue-400' },
  { id: 'green', bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200/60', dot: 'bg-emerald-400' },
  { id: 'rose', bg: 'bg-rose-50', text: 'text-rose-900', border: 'border-rose-200/60', dot: 'bg-rose-400' },
  { id: 'purple', bg: 'bg-violet-50', text: 'text-violet-900', border: 'border-violet-200/60', dot: 'bg-violet-400' },
  { id: 'gray', bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200/60', dot: 'bg-gray-400' },
];

const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 220;


export default function Home() {
  // --- State ---
  const [isClient, setIsClient] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  // Ensure we're on client side before accessing localStorage
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('mind-sticky-data');
    if (saved) {
      setNotes(JSON.parse(saved));
    }
  }, []);

  const [dragState, setDragState] = useState<DragState | null>(null); // { type: 'MOVE' | 'RESIZE', id, startX, startY, initial... }
  const [isTrashActive, setIsTrashActive] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  // Archive Filter State
  const [filterDate, setFilterDate] = useState(() => {
    if (typeof window !== 'undefined') {
      return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }
    return '';
  });

  // Refs for Trash detection
  const trashRef = useRef(null);

  // --- Persistence ---
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('mind-sticky-data', JSON.stringify(notes));
    }
  }, [notes, isClient]);

  // --- Helpers ---
  const bringToFront = (id) => {
    setNotes(prev => {
      const target = prev.find(n => n.id === id);
      if (!target) return prev;
      const others = prev.filter(n => n.id !== id);
      return [...others, target];
    });
  };

  const addNote = () => {
    if (!isClient) return;

    const newNote = {
      id: generateId(),
      x: Math.random() * (window.innerWidth - 400) + 50,
      y: Math.random() * (window.innerHeight - 400) + 50,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      title: '思维贴',
      content: '',
      color: 'yellow',
      isPinned: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
      zIndex: Date.now()
    };
    setNotes(prev => [...prev, newNote]);
  };

  const updateNote = (id, fields) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...fields } : n));
  };

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const restoreNote = (id) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, isArchived: false } : n));
  };

  // --- Event Handlers (Global) ---

  // Mouse Down - Start Drag or Resize
  const handleMouseDown = (e: React.MouseEvent, note: Note, type: 'MOVE' | 'RESIZE') => {
    if (note.isPinned && type === 'MOVE') return;

    // Ensure we don't block input focus, but stop drag propagation
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault(); // Prevents text selection while dragging container
    }
    e.stopPropagation();

    bringToFront(note.id);

    setDragState({
      type,
      id: note.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: note.x,
      initialY: note.y,
      initialW: note.width,
      initialH: note.height
    });
  };

  // Global Mouse Move
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      if (dragState.type === 'MOVE') {
        // Move Logic
        setNotes(prev => prev.map(n => {
          if (n.id !== dragState.id) return n;
          return {
            ...n,
            x: dragState.initialX + deltaX,
            y: dragState.initialY + deltaY
          };
        }));

        // Trash Detection Logic
        if (trashRef.current) {
          const trashRect = trashRef.current.getBoundingClientRect();
          const isOver = (
            e.clientX >= trashRect.left &&
            e.clientX <= trashRect.right &&
            e.clientY >= trashRect.top &&
            e.clientY <= trashRect.bottom
          );
          setIsTrashActive(isOver);
        }

      } else if (dragState.type === 'RESIZE') {
        // Resize Logic
        setNotes(prev => prev.map(n => {
          if (n.id !== dragState.id) return n;
          return {
            ...n,
            width: Math.max(200, (dragState.initialW || n.width) + deltaX), // Min width
            height: Math.max(150, (dragState.initialH || n.height) + deltaY) // Min height
          };
        }));
      }
    };

    const handleMouseUp = () => {
      if (!dragState) return;

      if (dragState.type === 'MOVE' && isTrashActive) {
        deleteNote(dragState.id);
      }

      setDragState(null);
      setIsTrashActive(false);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, isTrashActive]);


  // --- Filtered Notes for Archive ---
  const archivedNotes = useMemo(() => {
    return notes.filter(n => {
      if (!n.isArchived) return false;
      const noteDate = n.createdAt.split('T')[0];
      return noteDate === filterDate;
    });
  }, [notes, filterDate]);

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-50 relative font-sans text-gray-800">

      {/* --- Background Pattern: Subtle Grid --- */}
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* --- Toolbar --- */}
      <div className="absolute top-6 left-6 z-50 flex flex-col gap-3">
        <button
          onClick={addNote}
          className="bg-white hover:bg-gray-50 text-gray-800 p-3.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-gray-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center group relative"
          title="新建便签"
        >
          <Plus size={22} strokeWidth={2.5} />
          <div className="absolute left-full ml-3 bg-gray-800 text-white px-2 py-1 rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            新建便签
          </div>
        </button>

        <button
          onClick={() => setShowArchive(true)}
          className="bg-white hover:bg-gray-50 text-gray-800 p-3.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-gray-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center group relative"
          title="归档"
        >
          <Archive size={22} strokeWidth={2} />
           <div className="absolute left-full ml-3 bg-gray-800 text-white px-2 py-1 rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            归档
          </div>
        </button>
      </div>

      {/* --- Canvas Area (Active Notes) --- */}
      <div className="w-full h-full relative">
        {isClient && notes.filter(n => !n.isArchived).map((note) => {
          const styleConfig = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
          const isDragging = dragState?.id === note.id;

          return (
            <div
              key={note.id}
              style={{
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
                zIndex: isDragging ? 999 : 1, // Simple stacking
              }}
              // Modern Card: Micro-rounded (rounded-xl), subtle border, nice shadow
              className={`
                absolute flex flex-col
                rounded-xl border
                transition-shadow duration-200 ease-out
                ${styleConfig.bg} ${styleConfig.text} ${styleConfig.border}
                ${isDragging ? 'shadow-2xl cursor-grabbing scale-[1.01]' : 'shadow-md hover:shadow-lg'}
                ${note.isPinned ? 'shadow-xl' : ''}
              `}
              onMouseDown={(e) => {
                // Clicking anywhere on the note brings it to front (unless interacting with controls)
                 const target = e.target as HTMLElement;
                 if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON') {
                   handleMouseDown(e, note, 'MOVE');
                 } else {
                   // Even if clicking input, bring to front
                   bringToFront(note.id);
                 }
              }}
            >
              {/* Note Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1 select-none">
                {/* Left: Date & Pin */}
                <div className="flex items-center gap-2">
                   <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => updateNote(note.id, { isPinned: !note.isPinned })}
                    className={`
                      transition-colors p-1 rounded hover:bg-black/5
                      ${note.isPinned ? 'text-red-500' : 'text-black/20 hover:text-black/50'}
                    `}
                    title={note.isPinned ? "取消固定" : "固定"}
                  >
                    <Pin size={14} fill={note.isPinned ? "currentColor" : "none"} />
                  </button>
                  <span className="text-[10px] font-medium opacity-40">
                    {new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>

                {/* Right: Actions (Always Visible now for better UX) */}
                <div className="flex items-center gap-2">
                  {/* Color Picker - Clearer Hit Targets */}
                  <div className="flex gap-1">
                    {NOTE_COLORS.map(c => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => updateNote(note.id, { color: c.id })}
                        className={`
                          w-4 h-4 rounded-full transition-transform hover:scale-110
                          ${c.dot} border border-black/5
                          ${note.color === c.id ? 'ring-2 ring-black/20 scale-110' : ''}
                        `}
                        title="更改颜色"
                      />
                    ))}
                  </div>

                  {/* Archive Button */}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => updateNote(note.id, { isArchived: true })}
                    className="text-black/30 hover:text-black/70 p-1 rounded hover:bg-black/5 transition-colors ml-1"
                    title="归档"
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </div>

              {/* Note Body */}
              <div className="flex-1 flex flex-col px-4 pb-4 pt-1 overflow-hidden cursor-text">
                <input
                  type="text"
                  value={note.title}
                  onMouseDown={(e) => e.stopPropagation()} // Allow text selection without drag
                  onChange={(e) => updateNote(note.id, { title: e.target.value })}
                  placeholder="标题"
                  className="bg-transparent font-bold text-lg mb-1 focus:outline-none placeholder-black/20 w-full"
                />
                <textarea
                  value={note.content}
                  onMouseDown={(e) => e.stopPropagation()} // Allow text selection without drag
                  onChange={(e) => updateNote(note.id, { content: e.target.value })}
                  placeholder="在此输入内容..."
                  className="flex-1 bg-transparent resize-none focus:outline-none text-[14px] leading-relaxed placeholder-black/30 w-full selection:bg-black/10"
                />
              </div>

              {/* Resize Handle */}
              <div
                onMouseDown={(e) => handleMouseDown(e, note, 'RESIZE')}
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
              >
                 <div className="w-1.5 h-1.5 rounded-full bg-black/10 hover:bg-black/30" />
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Trash Zone --- */}
      <div
        ref={trashRef}
        className={`fixed bottom-8 right-8 transition-all duration-300 z-40 rounded-2xl flex items-center justify-center border
          ${isTrashActive
            ? 'w-28 h-28 bg-red-100/90 backdrop-blur border-red-200 text-red-500 scale-110 shadow-lg'
            : dragState?.type === 'MOVE'
              ? 'w-20 h-20 bg-white/90 backdrop-blur border-gray-200 text-gray-400 translate-y-0 opacity-100 shadow-xl'
              : 'w-16 h-16 opacity-0 translate-y-20 pointer-events-none'
          }
        `}
      >
        <Trash2 size={isTrashActive ? 40 : 28} className={`transition-transform duration-300 ${isTrashActive ? 'scale-110' : ''}`} />
      </div>

      {/* --- Archive Sidebar --- */}
      {showArchive && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px] transition-opacity"
            onClick={() => setShowArchive(false)}
          />

          {/* Sidebar Panel */}
          <div className="relative w-80 h-full bg-white shadow-2xl transform transition-transform flex flex-col border-l border-gray-100">
            <div className="p-5 flex items-center justify-between bg-gray-50/50 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Archive size={18} className="text-gray-500"/>
                归档箱
              </h2>
              <button
                onClick={() => setShowArchive(false)}
                className="p-1.5 hover:bg-gray-200/50 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Section */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">筛选日期</label>
                <button
                  onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  今天
                </button>
              </div>

              {/* Date Picker */}
              <DatePicker
                selected={filterDate ? new Date(filterDate) : null}
                onChange={(date: Date) => {
                  if (date) {
                    setFilterDate(date.toISOString().split('T')[0]);
                  }
                }}
                dateFormat="yyyy年MM月dd日"
                locale={zhCN}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholderText="选择日期"
                maxDate={new Date()}
                showMonthYearPicker={false}
                inline={false}
                calendarClassName="custom-datepicker shadow-lg border border-gray-200 rounded-lg"
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
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-gray-900">
                      {date.getFullYear()}年{date.getMonth() + 1}月
                    </span>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
                formatWeekDay={(day) => ['日', '一', '二', '三', '四', '五', '六'][['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)]}
              />

            </div>

            {/* List Section */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/30">
              {archivedNotes.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Search size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">暂无归档</p>
                </div>
              ) : (
                archivedNotes.map(note => {
                  const styleConfig = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
                  return (
                    <div key={note.id} className={`p-4 rounded-xl border transition-transform hover:scale-[1.02] group relative ${styleConfig.bg} ${styleConfig.border}`}>
                      <h3 className="font-bold text-gray-800 truncate text-sm mb-1">
                        {note.title || '无标题'}
                      </h3>
                      <p className="text-xs text-gray-600/80 line-clamp-2">
                        {note.content || '(无内容)'}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-medium text-black/30">
                        <span>{new Date(note.createdAt).toLocaleTimeString()}</span>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => restoreNote(note.id)}
                            className="p-1.5 bg-white/60 hover:bg-white rounded-md text-blue-600 shadow-sm transition-all"
                            title="还原"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="p-1.5 bg-white/60 hover:bg-white rounded-md text-red-500 shadow-sm transition-all"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}