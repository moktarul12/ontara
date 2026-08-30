import type { GraphSnapshot } from './graphSnapshot'

const SNAPSHOTS_KEY = 'ontopedian:snapshots'

type SnapshotRecord = GraphSnapshot & { id: string; name: string }

function readSnapshots(): SnapshotRecord[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SnapshotRecord[]
  } catch {
    return []
  }
}

function writeSnapshots(list: SnapshotRecord[]) {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list.slice(0, 20)))
  } catch {
    /* quota */
  }
}

export function saveGraphSnapshot(
  snap: GraphSnapshot,
  name?: string,
): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const record: SnapshotRecord = {
    ...snap,
    id,
    name: name || snap.seedLabel || 'Saved map',
  }
  const prev = readSnapshots().filter((s) => s.id !== id)
  writeSnapshots([record, ...prev])
  return id
}

export function loadGraphSnapshot(id: string): GraphSnapshot | null {
  const hit = readSnapshots().find((s) => s.id === id)
  if (!hit) return null
  const { id: _id, name: _name, ...snap } = hit
  void _id
  void _name
  return snap
}

export function listSnapshots(): { id: string; name: string; savedAt: string; nodeCount: number }[] {
  return readSnapshots().map((s) => ({
    id: s.id,
    name: s.name,
    savedAt: s.savedAt,
    nodeCount: s.nodes.length,
  }))
}

/** Local workspace state for Phase 2–5 UX (collections, history, alerts, settings). */

export type SavedCollection = {
  id: string
  name: string
  uris: string[]
  labels: string[]
  createdAt: string
}

export type HistoryEntry = {
  id: string
  uri: string
  label: string
  source: string
  at: string
}

export type AlertItem = {
  id: string
  title: string
  body: string
  read: boolean
  at: string
}

export type AppSettings = {
  defaultDepth: number
  maxNodesHint: number
  showAiHints: boolean
  compactBars: boolean
  contentLanguage: string
}

const COLLECTIONS_KEY = 'ontopedian:collections'
const HISTORY_KEY = 'ontopedian:history'
const ALERTS_KEY = 'ontopedian:alerts'
const SETTINGS_KEY = 'ontopedian:settings'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export function loadCollections(): SavedCollection[] {
  return readJson(COLLECTIONS_KEY, [])
}

export function saveCollections(items: SavedCollection[]) {
  writeJson(COLLECTIONS_KEY, items)
}

export function loadHistory(): HistoryEntry[] {
  return readJson(HISTORY_KEY, [])
}

export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'at'>) {
  const next: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
  }
  const prev = loadHistory().filter((h) => h.uri !== entry.uri)
  const list = [next, ...prev].slice(0, 40)
  writeJson(HISTORY_KEY, list)
  return list
}

export function loadAlerts(): AlertItem[] {
  const existing = readJson<AlertItem[]>(ALERTS_KEY, [])
  if (existing.length) return existing
  const seed: AlertItem[] = [
    {
      id: 'welcome',
      title: 'Welcome to Ontopedian',
      body: 'Progressive expansion is on — start at depth 1–2, then grow selectively.',
      read: false,
      at: new Date().toISOString(),
    },
    {
      id: 'sources',
      title: 'Source licenses',
      body: 'Wikidata is CC0; always retain source metadata for commercial use.',
      read: false,
      at: new Date().toISOString(),
    },
  ]
  writeJson(ALERTS_KEY, seed)
  return seed
}

export function saveAlerts(items: AlertItem[]) {
  writeJson(ALERTS_KEY, items)
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultDepth: 2,
  maxNodesHint: 500,
  showAiHints: true,
  compactBars: false,
  contentLanguage: 'en',
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_KEY, {}) }
}

export function saveSettings(s: AppSettings) {
  writeJson(SETTINGS_KEY, s)
}
