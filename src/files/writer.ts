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

// Appends a chunk to the file (creates the file on first call)
export async function appendChunk(
  filePath: string,
  data: Uint8Array,
): Promise<void> {
  const b64 = Buffer.from(data).toString('base64');
  const info = await FileSystem.getInfoAsync(filePath);
  await FileSystem.writeAsStringAsync(filePath, b64, {
    encoding: FileSystem.EncodingType.Base64,
    append: info.exists, // first call creates, subsequent calls append
  });
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
