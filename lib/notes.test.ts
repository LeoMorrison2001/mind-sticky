import { describe, expect, it } from 'vitest';

import {
  archiveNoteRecord,
  bringNoteToFront,
  createNote,
  filterArchivedNotes,
  formatDateKey,
  normalizeStoredNotes,
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
    const valid = { ...baseNote, id: 'note-2', color: 'blue' as const };

    expect(normalizeStoredNotes([invalid, valid])).toEqual([valid]);
    expect(readNotesFromStorage(JSON.stringify([invalid, valid]))).toEqual([valid]);
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
    const note = createNote(320, 568, 7);
    expect(note.x).toBeGreaterThanOrEqual(24);
    expect(note.y).toBeGreaterThanOrEqual(96);
    expect(note.x + note.width).toBeLessThanOrEqual(320 - 24 + 0.00001);
    expect(note.y + note.height).toBeLessThanOrEqual(568 - 24 + 0.00001);
    expect(note.zIndex).toBe(7);

    const notes = [
      { ...baseNote, id: 'note-1', zIndex: 1 },
      { ...baseNote, id: 'note-2', zIndex: 2 },
    ];
    const reordered = bringNoteToFront(notes, 'note-1');
    expect(reordered.find((item) => item.id === 'note-1')?.zIndex).toBe(3);
  });
});
