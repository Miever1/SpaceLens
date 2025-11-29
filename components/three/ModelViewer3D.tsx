// components/three/ModelViewer3D.tsx
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import use3DModelControls from "../../hooks/use3DModelControls";

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
  const {
    webviewRef,
    loading,
    setLoading,
    startLoadAnim,
    rotate,
    pulse,
  } = use3DModelControls();

  useEffect(() => {
    startLoadAnim();
  }, [startLoadAnim]);

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
        ios-src="${usdz}"
        camera-controls
        auto-rotate
        autoplay
        environment-image="neutral"
        shadow-intensity="1"
        exposure="1.1"
        camera-orbit="0deg 70deg auto"
        crossorigin="anonymous"
      ></model-viewer>

      <script>
        const viewer = document.getElementById("viewer");

        function postMessageToRN(obj) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(obj));
          }
        }

        // model loaded
        viewer.addEventListener("load", () => {
          // make sure basic lighting is applied
          viewer.style.backgroundColor = "#000000";
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

        // Reset camera API for React Native
        window.resetCamera = function() {
          if (!viewer) return;
          viewer.cameraOrbit = "0deg 70deg auto";
          viewer.fieldOfView = "45deg";
        };
      </script>
    </body>
  </html>
  `;

  return (
    <View style={styles.container}>
      {/* Top back button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={async () => {
          await Haptics.selectionAsync();
          onClose();
        }}
      >
        <Text style={styles.closeText}>Back</Text>
      </TouchableOpacity>

      {/* WebView with model-viewer */}
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1 }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onMessage={(event) => {
          // 目前只是接一下，避免报错；后面如果要根据 MODEL_LOADED 做事可以扩展
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            console.log("[ModelViewer3D] message:", msg);
          } catch {
            // ignore invalid JSON
          }
        }}
      />

      {/* Loading overlay */}
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

      {/* Bottom actions: Reset + AR */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomButton, styles.bottomButtonGhost]}
          onPress={() =>
            webviewRef.current?.injectJavaScript(`window.resetCamera(); true;`)
          }
        >
          <Text style={styles.bottomButtonGhostText}>Reset view</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomButton, styles.bottomButtonPrimary]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOpenAR();
          }}
        >
          <Text style={styles.bottomButtonPrimaryText}>View in AR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // keep transparent so parent can add blur/background if needed
  container: { flex: 1, backgroundColor: "transparent" },

  closeBtn: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 20,
    padding: 10,
  },
  closeText: { color: "#fff", fontSize: 16 },

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

  bottomBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(10,10,10,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  bottomButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomButtonGhost: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bottomButtonGhostText: {
    color: "#eee",
    fontSize: 13,
  },
  bottomButtonPrimary: {
    backgroundColor: "#00e0ff",
  },
  bottomButtonPrimaryText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});