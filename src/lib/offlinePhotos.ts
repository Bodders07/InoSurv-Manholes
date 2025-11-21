'use client'

// Simple IndexedDB storage for offline file blobs
// Stores { data: ArrayBuffer, type: string, name: string } under a generated key

const DB_NAME = 'offline-photos'
const STORE = 'photos'
const VERSION = 1

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export type StoredPhoto = {
  data: ArrayBuffer
  type: string
  name: string
}

export async function storeOfflineFile(file: File): Promise<string | null> {
  const db = await openDb()
  if (!db) return null
  const arrayBuffer = await file.arrayBuffer()
  const key = uuid()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ data: arrayBuffer, type: file.type, name: file.name }, key)
    tx.oncomplete = () => resolve(key)
    tx.onerror = () => resolve(null)
  })
}

export async function retrieveOfflineFile(key: string): Promise<StoredPhoto | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as StoredPhoto) || null)
    req.onerror = () => resolve(null)
  })
}

export async function deleteOfflineFiles(keys: (string | undefined | null)[]) {
  const db = await openDb()
  if (!db) return
  const valid = keys.filter(Boolean) as string[]
  if (!valid.length) return
  return new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    valid.forEach((k) => store.delete(k))
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}
