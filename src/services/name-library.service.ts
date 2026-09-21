import { NAME_LIBRARY, NAME_LIBRARY_DISCLOSURE, NAME_LIBRARY_VERSION, type NameGender, type NameLibraryItem } from '../data/name-library';

export interface NameLibraryQuery {
  surname?: string;
  gender?: NameGender | 'all';
  nameLength?: 1 | 2;
  avoid?: string;
  page?: number;
  pageSize?: number;
}

export interface NameLibraryResult {
  version: string;
  disclosure: string;
  list: Array<NameLibraryItem & { fullName: string }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const normalizeAvoidCharacters = (avoid?: string): string[] => Array.from(new Set(
  (avoid || '').replace(/[，、\s]/gu, ',').split(',').map((item) => item.trim()).filter(Boolean).join(''),
));

export function filterNameLibrary(query: NameLibraryQuery = {}): NameLibraryResult {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize || 20));
  const surname = query.surname?.trim() || '';
  const avoidCharacters = normalizeAvoidCharacters(query.avoid);

  const filtered = NAME_LIBRARY
    .filter((item) => query.gender === undefined || query.gender === 'all' || item.gender === query.gender)
    .filter((item) => query.nameLength === undefined || Array.from(item.givenName).length === query.nameLength)
    .filter((item) => avoidCharacters.every((character) => !item.givenName.includes(character)));

  const total = filtered.length;
  const start = (page - 1) * pageSize;

  return {
    version: NAME_LIBRARY_VERSION,
    disclosure: NAME_LIBRARY_DISCLOSURE,
    list: filtered.slice(start, start + pageSize).map(item => ({ ...item, fullName: `${surname}${item.givenName}` })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
