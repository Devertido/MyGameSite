const databaseName = 'arena-atlas-audio'
const storeName = 'music'
const trackKey = 'background'

async function withTrackStore<T>(
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(databaseName, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(storeName)
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode)
      const operation = request(transaction.objectStore(storeName))
      transaction.oncomplete = () => resolve(operation.result)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

export function loadMusic(): Promise<File | undefined> {
  return withTrackStore('readonly', (store) => store.get(trackKey))
}

export function saveMusic(track: File | null) {
  return track
    ? withTrackStore('readwrite', (store) => store.put(track, trackKey))
    : withTrackStore('readwrite', (store) => store.delete(trackKey))
}
