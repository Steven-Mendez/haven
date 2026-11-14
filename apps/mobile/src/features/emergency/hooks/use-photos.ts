import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import type { Photo } from '../logic/packet';

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.4,
  // A data URI travels inside the JSON packet so Earth (T02) can show it.
  base64: true,
};

function toPhoto(asset: ImagePicker.ImagePickerAsset, note?: string): Photo {
  const uri = asset.base64
    ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
    : asset.uri;
  return { uri, takenAt: new Date().toISOString(), note };
}

/**
 * Attach a photo (skin, wound, AED screen). Camera on the phone, file picker on web; if the camera
 * permission is denied it falls back to the library.
 */
export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [failed, setFailed] = useState(false);

  const attach = useCallback(async (note?: string) => {
    setFailed(false);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (Platform.OS === 'web') {
        result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        result = permission.granted
          ? await ImagePicker.launchCameraAsync(OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(OPTIONS);
      }
      if (result.canceled || result.assets.length === 0) return;
      const added = result.assets.map((a) => toPhoto(a, note));
      setPhotos((list) => [...list, ...added]);
    } catch (error) {
      console.warn('[emergency] photo failed', error);
      setFailed(true);
    }
  }, []);

  return { photos, attach, failed };
}
