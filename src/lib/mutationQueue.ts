'use client'

type MutationType = 'project-insert' | 'project-update' | 'chamber-insert' | 'chamber-update'
import { retrieveOfflineFile, deleteOfflineFiles } from '@/lib/offlinePhotos'

export type QueuedMutation = {
  id: string
  type: MutationType
  payload: Record<string, unknown>
  createdAt: number
}

const DB_NAME = 'offline-mutations'
const STORE = 'mutations'
const VERSION = 1

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
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

export async function enqueueMutation(type: MutationType, payload: Record<string, unknown>) {
  const db = await openDb()
  if (!db) return
  const entry: QueuedMutation = { id: uuid(), type, payload, createdAt: Date.now() }
  return new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export async function getQueue(): Promise<QueuedMutation[]> {
  const db = await openDb()
  if (!db) return []
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as QueuedMutation[]) || [])
    req.onerror = () => resolve([])
  })
}

async function removeMutation(id: string) {
  const db = await openDb()
  if (!db) return
  return new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export async function flushQueue(supabase: any, onStatus?: (msg: string) => void) {
  if (!supabase) return { success: 0, failed: 0 }
  const queue = await getQueue()
  let success = 0
  let failed = 0
  for (const item of queue) {
    try {
      const { type, payload, id } = item
      switch (type) {
        case 'project-insert': {
          const { error } = await supabase.from('projects').insert([payload])
          if (error) throw error
          break
        }
        case 'project-update': {
          const { id: projectId, update } = payload as { id: string; update: Record<string, unknown> }
          const { error } = await supabase.from('projects').update(update).eq('id', projectId)
          if (error) throw error
          break
        }
        case 'chamber-insert': {
          const { project_lookup, offline_photos, ...rest } = payload as any
          let insertPayload: Record<string, unknown> = { ...rest }
          const projectId = rest.project_id as string | undefined
          if (projectId && projectId.startsWith('tmp-') && project_lookup) {
            // Try to resolve the real project_id using project meta
            const query = supabase
              .from('projects')
              .select('id')
              .limit(1)
              .eq('project_number', project_lookup.project_number ?? null)
              .eq('name', project_lookup.name ?? null)
              .eq('client', project_lookup.client ?? null)
            const res = await query.maybeSingle()
            if (!res.error && res.data?.id) {
              insertPayload.project_id = res.data.id
            }
          }
          const insertRes = await supabase.from('chambers').insert([insertPayload]).select('id').single()
          if (insertRes.error) throw insertRes.error
          const chamberId = insertRes.data?.id

          // If there were offline photos cached, upload them now
          if (chamberId && offline_photos) {
            const bucket = supabase.storage.from('manhole-photos')
            const uploadPhoto = async (key: string | null | undefined, kind: 'internal' | 'external') => {
              if (!key) return null
              const stored = await retrieveOfflineFile(key)
              if (!stored) return null
              const extFromName = (stored.name?.split('.').pop() || '').toLowerCase()
              const ext = extFromName || 'jpg'
              const blob = new Blob([stored.data], { type: stored.type || 'image/jpeg' })
              const path = `${chamberId}/${kind}-${Date.now()}.${ext}`
              const up = await bucket.upload(path, blob, { upsert: true, contentType: stored.type || 'image/jpeg', cacheControl: '3600' })
              if (up.error) return null
              const pub = bucket.getPublicUrl(path)
              const url = pub.data.publicUrl
              const upRow = await supabase
                .from('chambers')
                .update(kind === 'internal' ? { internal_photo_url: url } : { external_photo_url: url })
                .eq('id', chamberId)
              if (upRow.error) return null
              return url
            }
            await uploadPhoto(offline_photos.internal, 'internal')
            await uploadPhoto(offline_photos.external, 'external')
            deleteOfflineFiles([offline_photos.internal, offline_photos.external])
          }
          break
        }
        case 'chamber-update': {
          const { id: chamberId, update } = payload as { id: string; update: Record<string, unknown> }
          const { error } = await supabase.from('chambers').update(update).eq('id', chamberId)
          if (error) throw error
          break
        }
      }
      await removeMutation(id)
      success++
      onStatus?.(`Synced ${type}`)
    } catch {
      failed++
    }
  }
  return { success, failed }
}

export async function clearQueue() {
  const db = await openDb()
  if (!db) return
  return new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}
