// utils/permissions.ts
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

/**
 * 请求相册读取权限（读取照片）
 */
export async function requestPhotoLibraryPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === "granted";
}

/**
 * 请求访问系统媒体库（保存图片用）
 */
export async function requestMediaSavePermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync(true);
  return status === "granted";
}

/**
 * 请求用于选图的权限（ImagePicker）
 */
export async function requestImagePickerPermission() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}

/**
 * 请求相机权限（如果未来要拍照）
 */
export async function requestCameraPermission() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  return permission.granted;
}

/**
 * Android 特有：文件读写权限（<= Android 12）
 */
export async function requestAndroidFilePermission() {
  if (Platform.OS !== "android") return true;

  // Android 13+ 只需要照片权限
  if (Platform.Version >= 33) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  }

  // Android 12 及以下
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === "granted";
}