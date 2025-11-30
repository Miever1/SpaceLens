// components/three/MiniModelViewer.tsx
import { DeviceMotion } from "expo-sensors";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export default function MiniModelViewer({
  glb,
  backgroundColor,
  full,
}: {
  glb?: string;
  backgroundColor?: string;
  full?: boolean;
}) {
  const webviewRef = useRef<WebView | null>(null);
  const lastInjectRef = useRef<number>(0);

  if (!glb) return null;

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>

        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: transparent;
            overflow: hidden;
          }

          /* 只保留 model-viewer，全透明 */
          model-viewer {
            width: 100%;
            height: 100%;
            background: transparent !important;
          }
        </style>
      </head>

      <body>
        <model-viewer
          id="viewer"
          src="${glb}"
          exposure="1"
          shadow-intensity="0.3"
          disable-zoom
          disable-pan
          disable-tap
        ></model-viewer>

        <script>
          const viewer = document.getElementById("viewer");

          // ⭐ 背景 & 阴影透明处理
          viewer.addEventListener("load", () => {
            // CSS 背景透明（或用传进来的底色）
            viewer.style.background = "${backgroundColor ?? "transparent"}";

            // 阴影关掉，不然会有一层灰
            viewer.shadowIntensity = 0;

            // WebGL 画布彻底透明
            const scene = viewer.getScene && viewer.getScene();
            if (scene && scene.renderer) {
              scene.renderer.alpha = true;
              scene.renderer.setClearColor(0x000000, 0); // 0 alpha → 透明
            }
          });

          const BASE_YAW = 0;
          const BASE_PITCH = 85;

          window.updateCameraFromRN = function(yaw, pitch) {
            if (!viewer) return;

            var maxYaw = 25;
            var maxPitch = 15;

            yaw = Math.max(-maxYaw, Math.min(maxYaw, yaw));
            pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

            const finalYaw = BASE_YAW - yaw;
            const finalPitch = BASE_PITCH + pitch;

            viewer.cameraOrbit = finalYaw + "deg " + finalPitch + "deg auto";
          };
        </script>
      </body>
    </html>
  `;

  /* ---------------- 陀螺仪摇头 ---------------- */
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    const MAX_YAW = 25;
    const MAX_PITCH = 15;
    const rad2deg = (r: number) => (r * 180) / Math.PI;

    const base = { yaw0: 0, pitch0: 0, inited: false };

    DeviceMotion.setUpdateInterval(80);

    sub = DeviceMotion.addListener((data) => {
      const { rotation } = data;
      if (!rotation) return;

      const beta = rotation.beta ?? 0;
      const gamma = rotation.gamma ?? 0;

      let yaw = rad2deg(gamma);
      let pitch = -rad2deg(beta);

      if (!base.inited) {
        base.yaw0 = yaw;
        base.pitch0 = pitch;
        base.inited = true;
        return;
      }

      yaw = (yaw - base.yaw0) * 0.7;
      pitch = (pitch - base.pitch0) * 0.7;

      yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw));
      pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

      const now = Date.now();
      if (now - lastInjectRef.current < 80) return;
      lastInjectRef.current = now;

      if (webviewRef.current) {
        const js = `
          window.updateCameraFromRN?.(${yaw.toFixed(2)}, ${pitch.toFixed(2)});
          true;
        `;
        webviewRef.current.injectJavaScript(js);
      }
    });

    return () => sub?.remove();
  }, []);

  return (
    <View style={full ? styles.fullContainer : styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        originWhitelist={["*"]}
        style={{ flex: 1, backgroundColor: "transparent" }}  // ⭐ WebView 自己也透明
        containerStyle={{ backgroundColor: "transparent" }} // iOS/Android 双保险
        pointerEvents="none"
        scrollEnabled={false}
        androidLayerType="software"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 聊天气泡里的 mini：有圆角、裁剪，背景透出气泡色
  container: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  // 放大预览用的 full：占满屏幕，完全透明背景（后面 BlurView 透出来）
  fullContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
});