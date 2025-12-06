import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

/**
 * 确保返回的是一个可被 <Image> / 网络请求 / ImageManipulator 正常使用的 URI
 * - Android: 直接返回原始 uri
 * - iOS: 如果是 ph://，用 MediaLibrary.getAssetInfoAsync 转成 file://
 */
export async function ensureFileUri(
  asset: Pick<MediaLibrary.Asset, "id" | "uri">
): Promise<string> {
  if (Platform.OS !== "ios") {
    return asset.uri;
  }

  if (asset.uri.startsWith("file://")) {
    return asset.uri;
  }

  if (!asset.uri.startsWith("ph://")) {
    return asset.uri;
  }

  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset.id);
    console.log("[ensureFileUri] getAssetInfo", asset.id, info);

    if (info.localUri && info.localUri.startsWith("file://")) {
      return info.localUri;
    }
    if (info.uri && info.uri.startsWith("file://")) {
      return info.uri;
    }

    console.warn(
      "[ensureFileUri] cannot resolve file:// for",
      asset.id,
      "keep original:",
      asset.uri
    );
    return asset.uri;
  } catch (e) {
    console.warn("[ensureFileUri] getAssetInfo error:", e);
    return asset.uri;
  }
}