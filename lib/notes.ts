export type NoteColor = 'yellow' | 'blue' | 'green' | 'rose' | 'purple' | 'gray';

export interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  archivedAt?: string;
  zIndex: number;
}

const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'green', 'rose', 'purple', 'gray'];
const DEFAULT_WIDTH = 350;
const DEFAULT_HEIGHT = 340;
const NOTE_MIN_X = 24;
const NOTE_MIN_Y = 96;
const NOTE_VIEWPORT_PADDING = 24;
const DEFAULT_TITLE = '\u601d\u7ef4\u8d34\u7eb8';

const isIsoDateString = (value: unknown): value is string => {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isNoteColor = (value: unknown): value is NoteColor => {
  return typeof value === 'string' && NOTE_COLORS.includes(value as NoteColor);
};

const isNoteRecord = (value: unknown): value is Note => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const note = value as Partial<Note>;

  return (
    typeof note.id === 'string' &&
    isFiniteNumber(note.x) &&
    isFiniteNumber(note.y) &&
    isFiniteNumber(note.width) &&
    isFiniteNumber(note.height) &&
    typeof note.title === 'string' &&
    typeof note.content === 'string' &&
    isNoteColor(note.color) &&
    typeof note.isPinned === 'boolean' &&
    typeof note.isArchived === 'boolean' &&
    isIsoDateString(note.createdAt) &&
    (note.archivedAt === undefined || isIsoDateString(note.archivedAt)) &&
    isFiniteNumber(note.zIndex)
  );
};

export const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const normalizeStoredNotes = (value: unknown): Note[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeNoteZIndices(value.filter(isNoteRecord));
};

export const readNotesFromStorage = (storageValue: string | null): Note[] => {
  if (!storageValue) {
    return [];
  }

  return normalizeStoredNotes(JSON.parse(storageValue));
};

export const getNextZIndex = (notes: Note[]) => {
  return notes.reduce((max, note) => Math.max(max, note.zIndex), 0) + 1;
};

export const normalizeNoteZIndices = (notes: Note[]) => {
  const sortedIds = [...notes]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((note) => note.id);

  const nextZIndexById = new Map(sortedIds.map((id, index) => [id, index + 1]));

  return notes.map((note) => ({
    ...note,
    zIndex: nextZIndexById.get(note.id) ?? note.zIndex,
  }));
};

export const bringNoteToFront = (notes: Note[], id: string) => {
  const normalizedNotes = normalizeNoteZIndices(notes);
  const nextZIndex = getNextZIndex(normalizedNotes);

  return normalizedNotes.map((note) => (
    note.id === id
      ? { ...note, zIndex: nextZIndex }
      : note
  ));
};

export const createNote = (
  viewportWidth: number,
  viewportHeight: number,
  zIndex: number
): Note => {
  const maxX = Math.max(
    NOTE_MIN_X,
    viewportWidth - DEFAULT_WIDTH - NOTE_VIEWPORT_PADDING
  );
  const maxY = Math.max(
    NOTE_MIN_Y,
    viewportHeight - DEFAULT_HEIGHT - NOTE_VIEWPORT_PADDING
  );

  return {
    id: Math.random().toString(36).substring(2, 9),
    x: NOTE_MIN_X + Math.random() * Math.max(0, maxX - NOTE_MIN_X),
    y: NOTE_MIN_Y + Math.random() * Math.max(0, maxY - NOTE_MIN_Y),
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    title: DEFAULT_TITLE,
    content: '',
    color: 'yellow',
    isPinned: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    zIndex,
  };
};

export const archiveNoteRecord = (note: Note, archivedAt = new Date().toISOString()): Note => {
  return {
    ...note,
    isArchived: true,
    archivedAt,
  };
};

export const restoreNoteRecord = (note: Note): Note => {
  return {
    ...note,
    isArchived: false,
    archivedAt: undefined,
  };
};

export const filterArchivedNotes = (notes: Note[], filterDate: string) => {
  return notes.filter((note) => {
    if (!note.isArchived) {
      return false;
    }

    const archiveDate = note.archivedAt ?? note.createdAt;
    return formatDateKey(new Date(archiveDate)) === filterDate;
  });
};

export const arrangeNotesInGrid = (
  notes: Note[],
  options?: {
    columns?: number;
    gapX?: number;
    gapY?: number;
    startX?: number;
    startY?: number;
  }
) => {
  const activeNotes = notes.filter((note) => !note.isArchived);
  const archivedNotes = notes.filter((note) => note.isArchived);

  if (activeNotes.length === 0) {
    return {
      notes,
      bounds: null,
    };
  }

  const columns = Math.max(1, options?.columns ?? Math.ceil(Math.sqrt(activeNotes.length)));
  const gapX = options?.gapX ?? 24;
  const gapY = options?.gapY ?? 24;
  const startX = options?.startX ?? 48;
  const startY = options?.startY ?? 120;

  const sortedNotes = [...activeNotes].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    return left.zIndex - right.zIndex;
  });

  const arrangedActiveNotes = sortedNotes.map((note, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...note,
      x: startX + column * (note.width + gapX),
      y: startY + row * (note.height + gapY),
    };
  });

  const noteById = new Map(arrangedActiveNotes.map((note) => [note.id, note]));
  const arrangedNotes = notes.map((note) => noteById.get(note.id) ?? note);

  const maxRight = Math.max(...arrangedActiveNotes.map((note) => note.x + note.width));
  const maxBottom = Math.max(...arrangedActiveNotes.map((note) => note.y + note.height));

  return {
    notes: [...arrangedNotes.filter((note) => !note.isArchived), ...archivedNotes],
    bounds: {
      minX: startX,
      minY: startY,
      maxX: maxRight,
      maxY: maxBottom,
    },
  };
};
