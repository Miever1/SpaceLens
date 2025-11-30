// components/three/ModelViewer3D.tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import EvilIcons from "@expo/vector-icons/EvilIcons";
import { DeviceMotion } from "expo-sensors";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { WebView } from "react-native-webview";
import ShareButton from "../common/ShareButton";

import use3DModelControls from "../../hooks/use3DModelControls";
import ScreenShell from "../layout/ScreenShell";

type Props = {
  glb: string;
  usdz?: string;
  onClose: () => void;
  onOpenAR: () => void;
};

export default function ModelViewer3D({
  glb,
  usdz,
  onClose,
  onOpenAR,
}: Props) {
  const { webviewRef, loading, setLoading, startLoadAnim, rotate, pulse } =
    use3DModelControls();

  const lastInjectRef = useRef<number>(0);

  useEffect(() => {
    startLoadAnim();
  }, [startLoadAnim]);

  // 陀螺仪控制
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const MAX_YAW = 30;
    const MAX_PITCH = 20;

    const rad2deg = (rad: number) => (rad * 180) / Math.PI;

    const base = {
      yaw0: 0,
      pitch0: 0,
      inited: false,
    };

    const subscribe = async () => {
      DeviceMotion.setUpdateInterval(50);

      subscription = DeviceMotion.addListener((data) => {
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

        yaw = (yaw - base.yaw0) * 0.75;
        pitch = (pitch - base.pitch0) * 0.75;

        yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw));
        pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

        const now = Date.now();
        if (now - lastInjectRef.current < 50) return;
        lastInjectRef.current = now;

        if (webviewRef.current) {
          const js = `
            if (window.updateCameraFromRN) {
              window.updateCameraFromRN(${yaw.toFixed(2)}, ${pitch.toFixed(
            2
          )});
            }
            true;
          `;
          // @ts-ignore
          webviewRef.current.injectJavaScript(js);
        }
      });
    };

    subscribe();

    return () => {
      subscription && subscription.remove();
    };
  }, [webviewRef]);

  const html = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
      <style>
        body, html {
          margin:0;
          padding:0;
          overflow:hidden;
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
      <model-viewer id="viewer"
        src="${glb}"
        ios-src="${usdz || ""}"
        camera-controls
        autoplay
        environment-image="neutral"
        shadow-intensity="1"
        exposure="1.1"
        camera-orbit="0deg 90deg auto"
        crossorigin="anonymous"
      ></model-viewer>

      <script>
        const viewer = document.getElementById("viewer");

        function postMessageToRN(obj) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(obj));
          }
        }

        viewer.addEventListener("load", () => {
          viewer.style.backgroundColor = "#eee";
          viewer.exposure = 1.1;
          viewer.shadowIntensity = 1.0;
          postMessageToRN({ type: "MODEL_LOADED" });
        });

        viewer.addEventListener("error", (e) => {
          postMessageToRN({
            type: "MODEL_ERROR",
            data: e && e.detail ? e.detail : {},
          });
        });

        const BASE_YAW = 0;
        const BASE_PITCH = 80;

        window.updateCameraFromRN = function(yaw, pitch) {
          if (!viewer) return;

          var maxYaw = 30;
          var maxPitch = 15;

          if (yaw > maxYaw) yaw = maxYaw;
          if (yaw < -maxYaw) yaw = -maxYaw;
          if (pitch > maxPitch) pitch = maxPitch;
          if (pitch < -maxPitch) pitch = -maxPitch;

          var finalYaw = BASE_YAW - yaw;
          var finalPitch = BASE_PITCH + pitch;

          viewer.cameraOrbit = finalYaw + "deg " + finalPitch + "deg auto";
        };

        window.resetCamera = function() {
          if (!viewer) return;
          viewer.cameraOrbit = BASE_YAW + "deg " + BASE_PITCH + "deg auto";
          viewer.fieldOfView = "45deg";
        };
      </script>
    </body>
  </html>
  `;

  // 顶部右侧 AR 按钮 slot
  const headerRight = (
    <TouchableOpacity onPress={onOpenAR} activeOpacity={0.8} style={styles.arFloating}>
      <View style={styles.arPill}>
        <MaterialCommunityIcons name="cube-scan" size={16} color="#0088ff" />
        <Text style={styles.arPillText}>AR</Text>
      </View>
    </TouchableOpacity>
  );

  const bottomSlot = (
    <View style={styles.bottomBarInner}>
      <TouchableOpacity
        style={styles.bottomShareBtn}
        onPress={() => {
          console.log("TODO: share photo");
        }}
      >
        <EvilIcons name="share-apple" size={24} color="black" />
      </TouchableOpacity>
    </View>
  );

  const handleShare = () => {
    console.log("TODO: share 3D model");
  }

  return (
  <ScreenShell
    title="3D View"
    onBack={onClose}
    rightSlot={
      <ShareButton
        onPress={handleShare}
        size={36}
        theme="light"
      />
    }
    bottomSlot={bottomSlot}
  >
    <WebView
      ref={webviewRef}
      originWhitelist={["*"]}
      source={{ html }}
      style={{ flex: 1 }}
      onLoadStart={() => setLoading(true)}
      onLoadEnd={() => setLoading(false)}
      onMessage={(event) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data);
          console.log("[ModelViewer3D] message:", msg);
        } catch {}
      }}
    />

    {/* 必须放在 WebView 下面 */}
    {headerRight}

    {loading && (
      <View style={styles.loadingOverlay}>
        <Animated.View
          style={[
            styles.loadingSpinner,
            {
              transform: [
                {
                  rotate: rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.Text style={[styles.loadingText, { opacity: pulse }]}>
          LOADING 3D…
        </Animated.Text>
      </View>
    )}
  </ScreenShell>
);
}

const styles = StyleSheet.create({
  arPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,136,255,0.06)",
  },
  arPillText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#0088ff",
  },
  arFloating: {
    position: "absolute",
    top: 12,     // 离顶部距离
    left: 12,    // 离左侧距离
    zIndex: 20,  // 保证压在 WebView 上
  },
  bottomInner: {
    flex: 1,
    justifyContent: "center",
  },
  bottomHint: {
    fontSize: 11,
    color: "rgba(0,0,0,0.5)",
  },

  bottomBarInner: {
    flex: 1,
    justifyContent: "center",
  },
  bottomShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  loadingSpinner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: "rgba(0,224,255,0.4)",
    borderTopColor: "#00e0ff",
    marginBottom: 18,
  },
  loadingText: {
    color: "#00e0ff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
  },
});