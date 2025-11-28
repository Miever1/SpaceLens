// components/gallery/ui/DetailOverlays.tsx
import { useRouter } from "expo-router";
import { Accelerometer } from "expo-sensors";
import React, { useEffect, useMemo, useRef } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { WebView } from "react-native-webview";

import type { SamPoint } from "@/api/sam3d";
import type { MyAsset } from "@/hooks/usePhotoAssets";

const { width: screenW, height: screenH } = Dimensions.get("window");

// 如果 glb 是本地后端出来的，还需要过 ngrok，就用这两个常量
const LOCAL_BASE = "http://192.168.0.89:6666";
const NGROK_BASE = "https://overidly-anthropogenic-margot.ngrok-free.dev";

// 把本地地址替换成 ngrok，并且自动加上 ?ngrok-skip-browser-warning=1
function fixGlbUrl(url: string): string {
  if (!url) return url;

  let u = url;

  // 1) 本地地址 -> ngrok 地址
  if (u.startsWith(LOCAL_BASE)) {
    u = NGROK_BASE + u.slice(LOCAL_BASE.length);
  }

  // 2) ngrok 的 warning 处理
  if (u.startsWith(NGROK_BASE)) {
    const hasQuery = u.includes("?");
    const sep = hasQuery ? "&" : "?";
    u = u + `${sep}ngrok-skip-browser-warning=1`;
  }

  return u;
}

/* ------------------------------------------------------------------ */
/* 1. 气泡菜单：Reset / 3D                                             */
/* ------------------------------------------------------------------ */

export type BubbleMenuProps = {
  pos: { x: number; y: number };
  canGenerate: boolean;
  onReset: () => void;
  onMake3D: () => void;
  onDismiss: () => void;
};

export const BubbleMenu: React.FC<BubbleMenuProps> = ({
  pos,
  canGenerate,
  onReset,
  onMake3D,
  onDismiss,
}) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 点背景收起菜单 */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onDismiss}
      />

      {/* 气泡本体 */}
      <View style={[styles.bubbleMenu, { left: pos.x, top: pos.y }]}>
        <TouchableOpacity style={styles.bubbleItem} onPress={onReset}>
          <Text style={styles.bubbleText}>Reset</Text>
        </TouchableOpacity>

        <View style={styles.bubbleDivider} />

        <TouchableOpacity
          style={[styles.bubbleItem, !canGenerate && styles.bubbleItemDisabled]}
          disabled={!canGenerate}
          onPress={onMake3D}
        >
          <Text
            style={[
              styles.bubbleText,
              styles.bubbleTextPrimary,
              !canGenerate && styles.bubbleTextDisabled,
            ]}
          >
            3D
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/* 2. Segmentation 预览图层                                            */
/* ------------------------------------------------------------------ */

export type SegPreviewOverlayProps = {
  uri: string;
};

export const SegPreviewOverlay: React.FC<SegPreviewOverlayProps> = ({
  uri,
}) => {
  return (
    <Image
      source={{ uri }}
      style={styles.segOverlayImage}
      resizeMode="contain"
    />
  );
};

/* ------------------------------------------------------------------ */
/* 3. 点标记覆盖层                                                     */
/* ------------------------------------------------------------------ */

export type PointsOverlayProps = {
  points: SamPoint[];
  asset: MyAsset;
  imgLayout: { width: number; height: number };
};

export const PointsOverlay: React.FC<PointsOverlayProps> = ({
  points,
  asset,
  imgLayout,
}) => {
  if (!points.length) return null;

  const iw = (asset as any).width ?? 0;
  const ih = (asset as any).height ?? 0;
  if (!iw || !ih) return null;

  return (
    <>
      {points.map((p, idx) => {
        const left = (p.x / iw) * imgLayout.width;
        const top = (p.y / ih) * imgLayout.height;

        return (
          <View
            key={`${asset.id}-${idx}`}
            style={[styles.pointDot, { left: left - 11, top: top - 11 }]}
          >
            <Text style={styles.pointText}>{idx + 1}</Text>
          </View>
        );
      })}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* 4. 3D 预览 Modal + Share 按钮 + 陀螺仪控制                           */
/* ------------------------------------------------------------------ */

export type Preview3DModalProps = {
  glbUrl: string;
  loading: boolean;
  onClose: () => void;
  onLoaded?: () => void;
};

export const Preview3DModal: React.FC<Preview3DModalProps> = ({
  glbUrl,
  loading,
  onClose,
  onLoaded,
}) => {
  const router = useRouter();

  // WebView 引用 + 标记是否正在手势操作
  const webviewRef = useRef<WebView | null>(null);
  const userInteractingRef = useRef(false);

  // glb 地址可能是本地后端 → 做一次转换
  const fixedGlbUrl = useMemo(() => fixGlbUrl(glbUrl), [glbUrl]);

  // 📱 陀螺仪控制：左右晃动手机 → 模型左右摆（-30° ~ 30°）
  useEffect(() => {
    if (!fixedGlbUrl) return;

    Accelerometer.setUpdateInterval(50); // 20fps 左右

    let angle = 0;

    const sub = Accelerometer.addListener(({ x }) => {
      // 如果正在用手势拖模型，就暂停陀螺仪控制
      if (userInteractingRef.current) return;

      const raw = -x * 50; // 灵敏度：手机往右倾，模型往右转，负号调方向
      const clamped = Math.max(-30, Math.min(30, raw));

      // 简单平滑一下
      angle = angle * 0.8 + clamped * 0.2;

      if (!webviewRef.current) return;

      const js = `
        (function () {
          const v = document.getElementById("viewer");
          if (!v) return true;
          // 水平角度由手机控制，垂直 70°，距离 auto（由模型尺寸自适应）
          v.cameraOrbit = "${angle}deg 70deg auto";
          return true;
        })();
      `;
      webviewRef.current.injectJavaScript(js);
    });

    return () => {
      sub && sub.remove();
    };
  }, [fixedGlbUrl]);

  // WebView 里跑的 HTML：model-viewer + 手势事件 + load/error 事件
  const html = useMemo(() => {
    if (!fixedGlbUrl) return "";

    return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
        <style>
          html, body {
            margin:0;
            padding:0;
            background:#000;
          }
          model-viewer {
            width:100%;
            height:100%;
            background:#000;
          }
        </style>
      </head>
      <body>
        <model-viewer
          id="viewer"
          src="${fixedGlbUrl}"
          camera-controls
          interaction-policy="always-allow"

          camera-orbit="0deg 70deg auto"
          min-camera-orbit="-30deg 40deg auto"
          max-camera-orbit="30deg 100deg auto"

          min-field-of-view="20deg"
          max-field-of-view="40deg"
          exposure="1.1"
          shadow-intensity="0.6">
        </model-viewer>

        <script>
          (function () {
            function notify(msg) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(msg);
              }
            }

            const viewer = document.getElementById("viewer");
            if (!viewer) {
              notify("error:no-viewer");
              return;
            }

            // === 手势事件：按下 / 抬起，发给 RN ===
            viewer.addEventListener("pointerdown", function () {
              notify("pointer:down");
            });
            viewer.addEventListener("pointerup", function () {
              notify("pointer:up");
            });
            viewer.addEventListener("pointercancel", function () {
              notify("pointer:up");
            });
            viewer.addEventListener("pointerleave", function () {
              notify("pointer:up");
            });

            // 模型真正 load 完成
            viewer.addEventListener("load", function () {
              notify("loaded");
            });

            // model-viewer 内部报错
            viewer.addEventListener("error", function (e) {
              notify(
                "error:model-viewer:" +
                JSON.stringify(e && e.detail ? e.detail : {})
              );
            });
          })();
        </script>
      </body>
    </html>
    `;
  }, [fixedGlbUrl, glbUrl]);

  if (!fixedGlbUrl) return null;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.previewMask}>
        <View style={styles.previewCard}>
          {/* 关闭 */}
          <TouchableOpacity style={styles.previewClose} onPress={onClose}>
            <Text style={styles.previewCloseText}>×</Text>
          </TouchableOpacity>

          {/* Share → 带 fixedGlbUrl 跳转 chat */}
          <TouchableOpacity
            style={styles.previewShare}
            onPress={() => {
              onClose();
              router.push({
                pathname: "/(tabs)/chat",
                params: { glbUrl: fixedGlbUrl },
              });
            }}
          >
            <Text style={styles.previewShareText}>Share</Text>
          </TouchableOpacity>

          {/* 3D WebView */}
          <WebView
            ref={webviewRef}
            source={{ html }}
            originWhitelist={["*"]}
            style={{ flex: 1, backgroundColor: "transparent" }}
            // HTML 载入完就先关一次 loading，让界面别一直被遮住
            onLoadEnd={() => {
              onLoaded?.();
            }}
            onMessage={(event) => {
              const data = event.nativeEvent.data || "";
              console.log("model-viewer:", data);

              // 手势开始 / 结束 → 控制陀螺仪开关
              if (data === "pointer:down") {
                userInteractingRef.current = true;
                return;
              }
              if (data === "pointer:up") {
                userInteractingRef.current = false;
                return;
              }

              if (data === "loaded") {
                // 模型真正 ready，再次触发 onLoaded（通常与 onLoadEnd 差一小会）
                onLoaded?.();
              } else if (data.startsWith("error")) {
                console.warn("[Preview3DModal] error from web:", data);
                onLoaded?.();
              }
            }}
            onError={(e) => {
              console.warn("[WebView] error:", e.nativeEvent);
              onLoaded?.();
            }}
          />

          {/* Loading 遮罩 */}
          {loading && (
            <View style={styles.previewLoadingMask}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.previewLoadingText}>Loading...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  segOverlayImage: {
    position: "absolute",
    left: 0,
    top: 0,
    width: screenW,
    height: screenH,
  },

  pointDot: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#00ff99",
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  pointText: {
    color: "#00ff99",
    fontSize: 10,
    fontWeight: "700",
  },

  bubbleMenu: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 34,
    backgroundColor: "rgba(40,40,40,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  bubbleItem: {
    paddingHorizontal: 10,
    height: "100%",
    justifyContent: "center",
  },
  bubbleItemDisabled: {
    opacity: 0.35,
  },
  bubbleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  bubbleTextPrimary: {
    color: "#3FA8FF",
    fontWeight: "600",
  },
  bubbleTextDisabled: {
    color: "rgba(255,255,255,0.65)",
  },
  bubbleDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  previewMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCard: {
    width: screenW * 0.9,
    height: screenH * 0.7,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  previewClose: {
    position: "absolute",
    right: 8,
    top: 4,
    zIndex: 10,
    padding: 6,
  },
  previewCloseText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
  },
  previewShare: {
    position: "absolute",
    right: 40,
    top: 7,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  previewShareText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  previewLoadingMask: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  previewLoadingText: {
    marginTop: 8,
    color: "#fff",
    fontSize: 12,
  },
});