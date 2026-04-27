import { describe, expect, it } from 'vitest';

import {
  archiveNoteRecord,
  arrangeNotesInGrid,
  bringNoteToFront,
  createCanvasSnapshot,
  createNote,
  filterArchivedNotes,
  filterNotesByCreatedDateRange,
  formatDateKey,
  mergeImportedNotes,
  normalizeNoteZIndices,
  normalizeStoredNotes,
  parseCanvasSnapshot,
  parseDateKey,
  readNotesFromStorage,
  restoreNoteRecord,
  type Note,
} from './notes';

const baseNote: Note = {
  id: 'note-1',
  x: 20,
  y: 40,
  width: 260,
  height: 220,
  title: 'title',
  content: 'content',
  color: 'yellow',
  isPinned: false,
  isArchived: false,
  createdAt: '2026-04-26T01:23:45.000Z',
  zIndex: 1,
};

describe('notes helpers', () => {
  it('formats and parses local date keys', () => {
    expect(formatDateKey(new Date(2026, 3, 26))).toBe('2026-04-26');

    const parsed = parseDateKey('2026-04-26');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(26);
    expect(parseDateKey('bad-value')).toBeNull();
  });

  it('filters invalid stored notes', () => {
    const invalid = { ...baseNote, color: 'invalid' };
    const valid = { ...baseNote, id: 'note-2', color: 'blue' as const, zIndex: 99 };

    expect(normalizeStoredNotes([invalid, valid])).toEqual([{ ...valid, zIndex: 1 }]);
    expect(readNotesFromStorage(JSON.stringify([invalid, valid]))).toEqual([{ ...valid, zIndex: 1 }]);
    expect(readNotesFromStorage(null)).toEqual([]);
  });

  it('archives and restores notes using archivedAt', () => {
    const archived = archiveNoteRecord(baseNote, '2026-04-27T08:00:00.000Z');
    expect(archived.isArchived).toBe(true);
    expect(archived.archivedAt).toBe('2026-04-27T08:00:00.000Z');

    const restored = restoreNoteRecord(archived);
    expect(restored.isArchived).toBe(false);
    expect(restored.archivedAt).toBeUndefined();
  });

  it('filters archive results by archived date first', () => {
    const archivedToday = archiveNoteRecord(baseNote, '2026-04-26T08:00:00.000Z');
    const archivedYesterday = archiveNoteRecord(
      { ...baseNote, id: 'note-2' },
      '2026-04-25T08:00:00.000Z'
    );

    expect(filterArchivedNotes([archivedToday, archivedYesterday], '2026-04-26')).toEqual([
      archivedToday,
    ]);
  });

  it('creates notes inside viewport bounds and can reorder z-index', () => {
    const note = createNote(420, 700, 7);
    expect(note.x).toBeGreaterThanOrEqual(24);
    expect(note.y).toBeGreaterThanOrEqual(96);
    expect(note.width).toBe(350);
    expect(note.height).toBe(340);
    expect(note.x + note.width).toBeLessThanOrEqual(420 - 24 + 0.00001);
    expect(note.y + note.height).toBeLessThanOrEqual(700 - 24 + 0.00001);
    expect(note.zIndex).toBe(7);

    const notes = [
      { ...baseNote, id: 'note-1', zIndex: 1 },
      { ...baseNote, id: 'note-2', zIndex: 2 },
    ];
    const reordered = bringNoteToFront(notes, 'note-1');
    expect(reordered.find((item) => item.id === 'note-1')?.zIndex).toBe(3);
  });

  it('normalizes legacy large z-index values into a compact stack order', () => {
    const normalized = normalizeNoteZIndices([
      { ...baseNote, id: 'note-1', zIndex: 1714200000000 },
      { ...baseNote, id: 'note-2', zIndex: 1714300000000 },
      { ...baseNote, id: 'note-3', zIndex: 1714400000000 },
    ]);

    expect(normalized.map((note) => note.zIndex)).toEqual([1, 2, 3]);
  });

  it('arranges active notes into a predictable grid without touching archived notes', () => {
    const archived = archiveNoteRecord({ ...baseNote, id: 'archived' }, '2026-04-27T08:00:00.000Z');
    const note2 = { ...baseNote, id: 'note-2', zIndex: 2 };
    const note3 = { ...baseNote, id: 'note-3', zIndex: 3 };
    const arranged = arrangeNotesInGrid([baseNote, note2, note3, archived], {
      columns: 2,
      startX: 100,
      startY: 200,
      gapX: 10,
      gapY: 20,
    });

    expect(arranged.bounds).toEqual({
      minX: 100,
      minY: 200,
      maxX: 630,
      maxY: 660,
    });
    expect(arranged.notes.find((note) => note.id === 'note-1')).toMatchObject({ x: 100, y: 200 });
    expect(arranged.notes.find((note) => note.id === 'note-2')).toMatchObject({ x: 370, y: 200 });
    expect(arranged.notes.find((note) => note.id === 'note-3')).toMatchObject({ x: 100, y: 440 });
    expect(arranged.notes.find((note) => note.id === 'archived')).toMatchObject({ isArchived: true });
  });

  it('creates and parses a full canvas snapshot', () => {
    const snapshot = createCanvasSnapshot([baseNote], { x: 12, y: -40 });
    const parsed = parseCanvasSnapshot(JSON.stringify(snapshot));

    expect(parsed.version).toBe(1);
    expect(parsed.notes).toEqual([baseNote]);
    expect(parsed.viewport).toEqual({ x: 12, y: -40 });
  });

  it('filters notes by created date range using local date keys', () => {
    const rangeNotes = [
      { ...baseNote, id: 'note-1', createdAt: '2026-04-20T08:00:00.000Z' },
      { ...baseNote, id: 'note-2', createdAt: '2026-04-25T08:00:00.000Z' },
      { ...baseNote, id: 'note-3', createdAt: '2026-04-29T08:00:00.000Z' },
    ];

    expect(filterNotesByCreatedDateRange(rangeNotes, '2026-04-21', '2026-04-28')).toEqual([
      rangeNotes[1],
    ]);
  });

  it('merges imported notes without reusing ids', () => {
    const merged = mergeImportedNotes(
      [{ ...baseNote, id: 'current', zIndex: 1 }],
      [{ ...baseNote, id: 'imported', zIndex: 99 }]
    );

    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((note) => note.id)).size).toBe(2);
    expect(merged.map((note) => note.zIndex)).toEqual([1, 2]);
  });
});
