import * as FileSystem from 'expo-file-system/legacy';
import { CHUNK_SIZE } from '../config';

// Reads a file in CHUNK_SIZE chunks — never loads the whole file into memory.
// Works with both content:// (Android) and file:// (iOS) URIs.
export async function readChunks(
  uri: string,
  onChunk: (b64: string) => Promise<void>,
  fallbackSize?: number,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error(`File not found: ${uri}`);
  const fileSize = info.size ?? fallbackSize ?? 0;
  if (fileSize === 0) {
    await onChunk('');
    return;
  }

  let offset = 0;
  while (offset < fileSize) {
    const length = Math.min(CHUNK_SIZE, fileSize - offset);
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    await onChunk(b64);
    offset += length;
  }
}
