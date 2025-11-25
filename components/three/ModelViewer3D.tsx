// components/three/ModelViewer3D.tsx
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
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
  usdz: string;
  onClose: () => void;
  onOpenAR: () => void;
};

type PanelMode = "color" | "texture" | "light";

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
    changeColor,
  } = use3DModelControls();

  const [mode, setMode] = useState<PanelMode>("color");

  // 当前配置状态（用于状态标签 + 选中样式）
  const [currentColor, setCurrentColor] = useState<string>("gray");
  const [currentTexture, setCurrentTexture] = useState<string>("none");
  const [currentLight, setCurrentLight] = useState<string>("normal");

  // 模型尺寸（米）
  const [dimensions, setDimensions] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);

  useEffect(() => {
    startLoadAnim();
  }, [startLoadAnim]);

  // 标签文案
  const COLOR_LABEL: Record<string, string> = {
    white: "象牙白",
    blue: "雾蓝",
    red: "莓红",
    green: "薄荷绿",
    gray: "石墨灰",
    default: "默认色",
  };

  const TEXTURE_LABEL: Record<string, string> = {
    none: "无纹理",
    fabricLight: "纹理1",
    fabricDark: "纹理2",
    leather: "纹理3",
    pattern: "纹理4",
  };

  const LIGHT_LABEL: Record<string, string> = {
    normal: "默认",
    day: "明亮日光",
    warm: "暖光客厅",
    night: "夜景",
    showroom: "展厅灯光",
  };

  const colorLabel = COLOR_LABEL[currentColor] || COLOR_LABEL.default;
  const textureLabel = TEXTURE_LABEL[currentTexture] || "纹理";
  const lightLabel = LIGHT_LABEL[currentLight] || "灯光";

  // 尺寸格式化（米 → cm）
  const formatSize = (v: number) => {
    if (!v || Number.isNaN(v)) return "-";
    const cm = Math.round(v * 100); // m → cm
    return `${cm}cm`;
  };

  const html = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
      <style>
        body, html { margin:0; padding:0; overflow:hidden; background:#000; }
        model-viewer { width:100%; height:100%; }
      </style>
    </head>
    <body>
      <model-viewer id="viewer"
        src="${glb}"
        ios-src="${usdz}"
        camera-controls
        auto-rotate
        exposure="1.05"
        shadow-intensity="1"
      ></model-viewer>

      <script>
        const COLOR_MAP = {
          white: "#ffffff",
          blue:  "#4da3ff",
          red:   "#ff5a5a",
          green: "#4dff8c",
          gray:  "#cccccc",
          default: "#dddddd",
        };

        const TEXTURE_MAP = {
          none: null,
          fabricLight: "https://miever.s3.ap-east-1.amazonaws.com/static/projects/texture-1.jpg",
          fabricDark:  "https://miever.s3.ap-east-1.amazonaws.com/static/projects/texture-2.jpg",
          leather:     "https://miever.s3.ap-east-1.amazonaws.com/static/projects/texture-3.jpg",
          pattern:     "https://miever.s3.ap-east-1.amazonaws.com/static/projects/texture-4.jpg",
        };

        const LIGHT_PRESETS = {
          normal: {
            background: "#000000",
            exposure: 1.05,
            shadowIntensity: 1.0,
          },
          day: {
            background: "#f5f5f5",
            exposure: 1.4,
            shadowIntensity: 0.9,
          },
          warm: {
            background: "#2b1a10",
            exposure: 1.1,
            shadowIntensity: 1.1,
          },
          night: {
            background: "#050712",
            exposure: 0.9,
            shadowIntensity: 1.2,
          },
          showroom: {
            background: "#111111",
            exposure: 1.2,
            shadowIntensity: 1.4,
          },
        };

        const textureCache = {};
        let modelReady = false;

        const viewer = document.getElementById("viewer");

        // ========= 计算模型尺寸，并发给 RN =========
        async function computeModelSize() {
          if (!viewer || !viewer.model) return;

          let size = { x: 0, y: 0, z: 0 };

          try {
            // 新版 model-viewer
            if (viewer.model.getDimensions) {
              const dim = viewer.model.getDimensions();
              size = { x: dim.x, y: dim.y, z: dim.z };
            } else if (viewer.model.boundingBox) {
              const box = viewer.model.boundingBox;
              size = {
                x: box.max.x - box.min.x,
                y: box.max.y - box.min.y,
                z: box.max.z - box.min.z,
              };
            }

            const payload = JSON.stringify({
              type: "MODEL_DIMENSIONS",
              data: size,
            });

            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(payload);
            }

            console.log("model dimensions:", size);
          } catch (e) {
            console.error("computeModelSize error", e);
          }
        }

        viewer.addEventListener("load", () => {
          modelReady = true;
          console.log("model-viewer model loaded");
          computeModelSize();
        });

        function hexToRGBA(hex) {
          if (!hex || hex[0] !== "#") return [1,1,1,1];
          const bigint = parseInt(hex.slice(1), 16);
          const r = ((bigint >> 16) & 255) / 255;
          const g = ((bigint >> 8) & 255) / 255;
          const b = (bigint & 255) / 255;
          return [r,g,b,1];
        }

        // ========= 改颜色 =========
        window.changeSofaColor = function(name) {
          if (!modelReady || !viewer.model) return;

          const hex = COLOR_MAP[name] || COLOR_MAP.default;
          const rgba = hexToRGBA(hex);

          try {
            const mat = viewer.model.materials[0];
            mat.pbrMetallicRoughness.setBaseColorFactor(rgba);
            console.log("color changed", name);
          } catch (e) {
            console.error("changeSofaColor error", e);
          }
        };

        // ========= 改纹理 =========
        window.changeSofaTexture = async function(name) {
          if (!modelReady || !viewer.model) return;

          const url = TEXTURE_MAP[name];
          try {
            const mat = viewer.model.materials[0];
            const pbr = mat.pbrMetallicRoughness;

            if (!url) {
              console.log("clear texture");
              if (pbr.setBaseColorTexture) {
                pbr.setBaseColorTexture(null);
              }
              if (pbr.baseColorTexture && pbr.baseColorTexture.setTexture) {
                pbr.baseColorTexture.setTexture(null);
              }
              const hex = COLOR_MAP.default;
              const rgba = hexToRGBA(hex);
              pbr.setBaseColorFactor && pbr.setBaseColorFactor(rgba);
              return;
            }

            if (!textureCache[name]) {
              console.log("loading texture", url);
              if (!viewer.createTexture) {
                console.warn("viewer.createTexture not found");
                return;
              }
              textureCache[name] = await viewer.createTexture(url);
            }
            const tex = textureCache[name];

            if (pbr.setBaseColorTexture) {
              pbr.setBaseColorTexture(tex);
            } else if (pbr.baseColorTexture && pbr.baseColorTexture.setTexture) {
              pbr.baseColorTexture.setTexture(tex);
            }

            pbr.setBaseColorFactor && pbr.setBaseColorFactor([1,1,1,1]);

            console.log("texture changed", name);
          } catch (e) {
            console.error("changeSofaTexture error", e);
          }
        };

        // ========= 改灯光 / 场景 =========
        window.changeLightPreset = function(name) {
          const preset = LIGHT_PRESETS[name] || LIGHT_PRESETS.normal;
          if (!viewer) return;

          viewer.style.backgroundColor = preset.background;
          viewer.exposure = preset.exposure;
          viewer.shadowIntensity = preset.shadowIntensity;

          console.log("light preset:", name, preset);
        };

        // ========= 重置相机 =========
        window.resetCamera = function() {
          if (!viewer) return;
          viewer.cameraOrbit = "0deg 75deg 2.5m";
          viewer.fieldOfView = "45deg";
        };
      </script>
    </body>
  </html>
  `;

  // RN：纹理
  const changeTexture = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.changeSofaTexture("${name}"); true;`
    );
    setCurrentTexture(name);
  };

  // RN：灯光
  const changeLight = (name: string) => {
    Haptics.selectionAsync();
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.changeLightPreset("${name}"); true;`
    );
    setCurrentLight(name);
  };

  const MOCK_SIZE = {
    length: Math.floor(180 + Math.random() * 80), // 180–260 cm
    width: Math.floor(70 + Math.random() * 40),   // 70–110 cm
    height: Math.floor(70 + Math.random() * 20),  // 70–90 cm
  };

  return (
    <View style={styles.container}>
      {/* 顶部关闭 */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeText}>返回</Text>
      </TouchableOpacity>

      {/* WebView */}
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
            if (msg.type === "MODEL_DIMENSIONS" && msg.data) {
              setDimensions(msg.data);
            }
          } catch {
            // 其他消息忽略
          }
        }}
      />

      {/* Loading 遮罩 */}
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

      {/* 底部控件面板 */}
      <View style={styles.bottomSheet}>
        {/* 当前状态标签 */}
        <Text style={styles.statusText}>
          当前：{colorLabel} · {textureLabel} · {lightLabel}
        </Text>

        {/* 尺寸显示（如果拿到了） */}
        {dimensions && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: "#999", fontSize: 11 }}>
                预计尺寸：{MOCK_SIZE.length} × {MOCK_SIZE.width} × {MOCK_SIZE.height} cm
            </Text>
          </View>
        )}

        {/* 顶部：Segment + 重置视角 */}
        <View style={styles.sheetTopRow}>
          <View style={styles.segment}>
            {(["color", "texture", "light"] as PanelMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.segmentItem,
                  mode === m && styles.segmentItemActive,
                ]}
                onPress={() => {
                  setMode(m);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === m && styles.segmentTextActive,
                  ]}
                >
                  {m === "color" ? "颜色" : m === "texture" ? "纹理" : "灯光"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() =>
              webviewRef.current?.injectJavaScript(
                `window.resetCamera(); true;`
              )
            }
          >
            <Text style={styles.resetText}>重置视角</Text>
          </TouchableOpacity>
        </View>

        {/* 中间内容：根据 mode 切换 */}
        {mode === "color" && (
          <View style={styles.contentRow}>
            {[
              { name: "white", color: "#ffffff" },
              { name: "blue", color: "#4da3ff" },
              { name: "red", color: "#ff5a5a" },
              { name: "green", color: "#4dff8c" },
              { name: "gray", color: "#cccccc" },
            ].map((c) => (
              <TouchableOpacity
                key={c.name}
                onPress={() => {
                  changeColor(c.name);
                  setCurrentColor(c.name);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.colorDot,
                  { backgroundColor: c.color },
                  currentColor === c.name && styles.colorDotActive,
                ]}
              />
            ))}
          </View>
        )}

        {mode === "texture" && (
          <View style={styles.contentRow}>
            <TouchableOpacity
              onPress={() => changeTexture("none")}
              style={[
                styles.textureTag,
                { borderStyle: "dashed" },
                currentTexture === "none" && styles.textureTagActive,
              ]}
            >
              <Text style={styles.textureText}>无纹理</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeTexture("fabricLight")}
              style={[
                styles.textureTag,
                currentTexture === "fabricLight" && styles.textureTagActive,
              ]}
            >
              <Text style={styles.textureText}>纹理1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeTexture("fabricDark")}
              style={[
                styles.textureTag,
                currentTexture === "fabricDark" && styles.textureTagActive,
              ]}
            >
              <Text style={styles.textureText}>纹理2</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeTexture("leather")}
              style={[
                styles.textureTag,
                currentTexture === "leather" && styles.textureTagActive,
              ]}
            >
              <Text style={styles.textureText}>纹理3</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeTexture("pattern")}
              style={[
                styles.textureTag,
                currentTexture === "pattern" && styles.textureTagActive,
              ]}
            >
              <Text style={styles.textureText}>纹理4</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "light" && (
          <View style={styles.contentRow}>
            <TouchableOpacity
              onPress={() => changeLight("normal")}
              style={[
                styles.lightTag,
                currentLight === "normal" && styles.lightTagActive,
              ]}
            >
              <Text style={styles.textureText}>默认</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeLight("day")}
              style={[
                styles.lightTag,
                currentLight === "day" && styles.lightTagActive,
              ]}
            >
              <Text style={styles.textureText}>明亮日光</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeLight("warm")}
              style={[
                styles.lightTag,
                currentLight === "warm" && styles.lightTagActive,
              ]}
            >
              <Text style={styles.textureText}>暖光客厅</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeLight("night")}
              style={[
                styles.lightTag,
                currentLight === "night" && styles.lightTagActive,
              ]}
            >
              <Text style={styles.textureText}>夜景</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => changeLight("showroom")}
              style={[
                styles.lightTag,
                currentLight === "showroom" && styles.lightTagActive,
              ]}
            >
              <Text style={styles.textureText}>展厅</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 底部：进入 AR */}
        <TouchableOpacity
          style={styles.arButton}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOpenAR();
          }}
        >
          <Text style={styles.arButtonText}>进入 AR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const DOT = 26;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

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

  bottomSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(10,10,10,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statusText: {
    color: "#777",
    fontSize: 11,
    marginBottom: 4,
  },
  sizeText: {
    color: "#999",
    fontSize: 11,
    marginBottom: 6,
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    padding: 2,
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  segmentItemActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  segmentText: {
    color: "#aaa",
    fontSize: 12,
  },
  segmentTextActive: {
    color: "#fff",
    fontWeight: "600",
  },

  resetText: {
    color: "#ccc",
    fontSize: 12,
  },

  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  colorDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    transform: [{ scale: 1 }],
  },
  colorDotActive: {
    borderColor: "#00e0ff",
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },

  textureTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  textureTagActive: {
    borderColor: "#00e0ff",
    backgroundColor: "rgba(0,224,255,0.18)",
  },

  lightTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  lightTagActive: {
    borderColor: "#ffd700",
    backgroundColor: "rgba(255,215,0,0.16)",
  },

  textureText: {
    color: "#eee",
    fontSize: 11,
  },

  arButton: {
    marginTop: 2,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#00e0ff",
    alignItems: "center",
  },
  arButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
});