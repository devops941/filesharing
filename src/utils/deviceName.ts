import * as FileSystem from 'expo-file-system/legacy';

const NAME_FILE = (FileSystem.documentDirectory ?? '') + 'secureshare_device_name.txt';

export async function getDeviceName(): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(NAME_FILE);
    if (info.exists) {
      const name = await FileSystem.readAsStringAsync(NAME_FILE);
      if (name.trim()) return name.trim();
    }
  } catch {}
  const generated = 'SecureShare-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  await saveDeviceName(generated).catch(() => {});
  return generated;
}

export async function saveDeviceName(name: string): Promise<void> {
  await FileSystem.writeAsStringAsync(NAME_FILE, name.trim());
}
