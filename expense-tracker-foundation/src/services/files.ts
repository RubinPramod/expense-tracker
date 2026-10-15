import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type PickedDocument = { uri: string; name: string };

export async function pickDocument(type: string | string[]): Promise<PickedDocument | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type,
    // Android Expo Go denies reads from the picker's cache copy; the original content:// URI is readable.
    copyToCacheDirectory: Platform.OS !== 'android',
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  return asset ? { uri: asset.uri, name: asset.name } : null;
}

export async function shareTextFile(filename: string, contents: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType });
}

export async function readTextFile(uri: string): Promise<string> {
  return new File(uri).text();
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
