import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export function pickImage() {
  return new Promise((resolve) => {
    Alert.alert('Add photo', 'Choose a source', [
      { text: 'Camera', onPress: async () => {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) { Alert.alert('Permission needed', 'Camera access is required to take a photo.'); return resolve(null); }
        const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
        resolve(r.canceled ? null : r.assets[0]);
      } },
      { text: 'Gallery', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
        resolve(r.canceled ? null : r.assets[0]);
      } },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

export function toFormFile(asset) {
  const ok = ['image/jpeg', 'image/png', 'image/webp'];
  const type = ok.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return { uri: asset.uri, name: `photo.${ext}`, type };
}
