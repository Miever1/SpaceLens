// components/three/ModelViewerAR.tsx
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Platform } from "react-native";

export default function ModelViewerAR({
  usdz,
  glb,
  onClose,
}: {
  usdz?: string;
  glb: string;
  onClose: () => void;
}) {

  useEffect(() => {
    const openAR = async () => {
      if (Platform.OS === "ios" && usdz) {
        await WebBrowser.openBrowserAsync(usdz);
      } else {
        await WebBrowser.openBrowserAsync(
          `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
            glb
          )}&mode=ar_only#Intent;scheme=https;package=com.google.android.googlequicksearchbox;end;`
        );
      }

      // 系统 AR 退出后回来 → 自动关闭本层
      onClose();
    };

    openAR();
  }, []);

  return null; // 不显示 UI
}