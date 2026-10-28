import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

export function saveDir(): string {
  return (FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? 'file:///') + 'SecureShare/';
}

export async function ensureSaveDir(): Promise<void> {
  const dir = saveDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function hasSpace(bytes: number): Promise<boolean> {
  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    return info > bytes + 200 * 1024 * 1024; // 200 MB safety buffer
  } catch {
    return true;
  }
}

// Per-path write mutex to prevent concurrent writes to the same file path
const writeLocks = new Map<string, Promise<void>>();

/**
 * BUG-13 FIX: appendChunk previously had a race condition where two rapid chunks
 * could both see `exists = false` and both perform non-append writes, with the second
 * truncating the first. Now uses a per-file mutex (promise chain) to serialize writes.
 *
 * Appends a chunk to the file (creates the file on first call).
 */
export async function appendChunk(
  filePath: string,
  data: Uint8Array,
): Promise<void> {
  // Chain writes to the same file so they are always sequential
  const prev = writeLocks.get(filePath) ?? Promise.resolve();
  const next = prev.then(async () => {
    const b64 = Buffer.from(data).toString('base64');
    const info = await FileSystem.getInfoAsync(filePath);
    await FileSystem.writeAsStringAsync(filePath, b64, {
      encoding: FileSystem.EncodingType.Base64,
      append: info.exists, // first call creates, subsequent calls append
    });
  });
  writeLocks.set(filePath, next);
  await next;
}

/**
 * Clears the write lock for a given path after the transfer is complete.
 * Should be called when a file transfer finishes or is cancelled.
 */
export function clearWriteLock(filePath: string): void {
  writeLocks.delete(filePath);
}

// Returns a unique file path — appends (1), (2), etc. if already exists
export async function uniquePath(
  dir: string,
  fileName: string,
): Promise<string> {
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()! : '';
  const base = ext
    ? fileName.slice(0, fileName.length - ext.length)
    : fileName;

  let candidate = `${dir}${fileName}`;
  let i = 1;
  while ((await FileSystem.getInfoAsync(candidate)).exists) {
    candidate = `${dir}${base} (${i})${ext}`;
    i++;
  }
  return candidate;
}
