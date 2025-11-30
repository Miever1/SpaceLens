import type { Sam3DItem } from "@/api/sam3d";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  findNodeHandle,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const { width } = Dimensions.get("window");
const SIZE = width / 3 - 4;

/* -------------------------------------------------------------------------- */
/* GridItem 类型                                                              */
/* -------------------------------------------------------------------------- */
export type GridItem =
  | {
      kind: "photo";
      id: string;
      uri: string;
      assetIndex: number;
    }
  | {
      kind: "3d";
      id: string;
      glbUrl: string;
      name: string;
    }
  | {
      kind: "placeholder";
      assetId: string;
      status: "pending" | "error";
      /** 占位格要用到的背景图（原始照片） */
      thumbUri?: string;
    };

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */
type Props = {
  assets: MyAsset[];
  loading: boolean;

  threeModels?: Sam3DItem[];

  generatingStatus: Record<
    string,
    { status: "pending" | "error" | "done"; model?: Sam3DItem }
  >;

  onPress: (index: number) => void;
  onPress3D?: (item: Sam3DItem, index: number) => void;

  onAddPhoto: () => void;
  onLoadMore: () => void;

  /** ⭐ 把每个 item 的屏幕绝对布局报告给 AlbumTab（飞行动画） */
  onItemLayout?: (
    item: GridItem,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
};

/* -------------------------------------------------------------------------- */
/* 小号 WebView 3D 预览                                                       */
/* -------------------------------------------------------------------------- */
const Mini3DPreview = ({ glbUrl }: { glbUrl: string }) => {
  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
        <style>
          html, body {
            margin:0;
            padding:0;
            background:#eee;
            overflow:hidden;
          }
          model-viewer {
            width:100%;
            height:100%;
            background:#eee;
          }
        </style>
      </head>
      <body>
        <model-viewer
          src="${glbUrl}"
          auto-rotate
          rotation-per-second="25deg"
          shadow-intensity="0.6"
          exposure="1.0"
          disable-tap
          disable-zoom
          disable-pan
        ></model-viewer>
      </body>
    </html>
  `;

  return (
    <WebView
      source={{ html }}
      originWhitelist={["*"]}
      scrollEnabled={false}
      // 关键：让所有触摸事件穿透给外面的 TouchableOpacity
      pointerEvents="none"
      style={styles.image}
      onError={(e) => {
    console.warn("Mini3DPreview webview error", e.nativeEvent);
  }}
    />
  );
};

/* -------------------------------------------------------------------------- */
/* 占位格子：原图背景 + 发光呼吸边框                                         */
/* -------------------------------------------------------------------------- */
type PlaceholderCellProps = {
  status: "pending" | "error";
  thumbUri?: string;
  onLayout: (e: any) => void;
};

const PlaceholderCell: React.FC<PlaceholderCellProps> = ({
  status,
  thumbUri,
  onLayout,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== "pending") return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [status, progress]);

  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,224,255,0.25)", "rgba(0,224,255,1)"],
  });

  const shadowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.75],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  const innerGlowOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 0.9, 0.2],
  });

  // error 状态：简单红框提示
  if (status === "error") {
    return (
      <View
        style={[styles.item, styles.placeholderBox, styles.placeholderError]}
        onLayout={onLayout}
      >
        {thumbUri && (
          <>
            <Image
              source={{ uri: thumbUri }}
              style={styles.placeholderBgImage}
              resizeMode="cover"
              blurRadius={4}
            />
            <View style={styles.placeholderBgDim} />
          </>
        )}
        <Text style={[styles.placeholderText, { color: "#ff6666" }]}>
          Failed
        </Text>
      </View>
    );
  }

  // pending 状态：原图背景 + 昏暗层 + 发光边框 + 呼吸
  return (
    <Animated.View
      style={[
        styles.item,
        styles.placeholderBox,
        {
          borderWidth: 3.5,
          borderColor,
          shadowColor: "#00E0FF",
          shadowRadius: 18,
          shadowOpacity,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ scale }],
        },
      ]}
      onLayout={onLayout}
    >
      {/* 背景：原图 + 一层暗色遮罩 */}
      {thumbUri && (
        <>
          <Image
            source={{ uri: thumbUri }}
            style={styles.placeholderBgImage}
            resizeMode="cover"
            blurRadius={6}
          />
          <View style={styles.placeholderBgDim} />
        </>
      )}

      {/* 内圈高光边，增加层次感 */}
      <Animated.View
        pointerEvents="none"
        style={[styles.placeholderInnerGlow, { opacity: innerGlowOpacity }]}
      />

      <ActivityIndicator color="#00E0FF" />
      <Text style={styles.placeholderText}>Generating 3D…</Text>
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* 主组件                                                                      */
/* -------------------------------------------------------------------------- */
export default function PhotoGrid({
  assets,
  loading,
  threeModels = [],
  generatingStatus,
  onPress,
  onPress3D,
  onAddPhoto,
  onLoadMore,
  onItemLayout,
}: Props) {
  /* ---------------------------------------------------------------------- */
  /* Step 1: 整合 gridItems（占位 → 新 3D → 旧 3D → 照片）                  */
  /* ---------------------------------------------------------------------- */
  const gridItems: GridItem[] = useMemo(() => {
    const items: GridItem[] = [];

    // 建一个 map，方便通过 assetId 拿到原图 uri
    const assetMap = new Map<string, string>();
    assets.forEach((a) => assetMap.set(a.id, a.uri));

    // 1) pending / error / done （done 会直接变 3D 卡片）
    Object.entries(generatingStatus).forEach(([assetId, entry]) => {
      if (entry.status === "pending" || entry.status === "error") {
        items.push({
          kind: "placeholder",
          assetId,
          status: entry.status,
          thumbUri: assetMap.get(assetId),
        });
      } else if (entry.status === "done" && entry.model) {
        items.push({
          kind: "3d",
          id: `3d-new-${entry.model.key}`,
          glbUrl: entry.model.url,
          name: entry.model.key.split("/").pop() ?? entry.model.key,
        });
      }
    });

    // 2) 没被 done 覆盖的老 3D 模型
    const replacedKeys = new Set(
      Object.values(generatingStatus)
        .filter((v) => v.status === "done" && v.model)
        .map((v) => v.model!.key)
    );

    threeModels.forEach((m) => {
      if (!replacedKeys.has(m.key)) {
        items.push({
          kind: "3d",
          id: `3d-${m.key}`,
          glbUrl: m.url,
          name: m.key.split("/").pop() ?? m.key,
        });
      }
    });

    // 3) 照片
    assets.forEach((a, idx) => {
      items.push({
        kind: "photo",
        id: a.id,
        uri: a.uri,
        assetIndex: idx,
      });
    });

    return items;
  }, [assets, threeModels, generatingStatus]);

  /* ---------------------------------------------------------------------- */
  /* Step 2: 用 UIManager.measure 计算绝对坐标                               */
  /* ---------------------------------------------------------------------- */
  const measureLayout = (item: GridItem, target: any) => {
    const node = findNodeHandle(target);
    if (!node) return;

    UIManager.measure(node, (x, y, width, height, pageX, pageY) => {
      onItemLayout?.(item, {
        x: pageX,
        y: pageY,
        width,
        height,
      });
    });
  };

  /* ---------------------------------------------------------------------- */
  /* 渲染每个格子                                                              */
  /* ---------------------------------------------------------------------- */
  const renderItem = ({ item }: { item: GridItem }) => {
    // Photo
    if (item.kind === "photo") {
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => onPress(item.assetIndex)}
          onLayout={(e) => measureLayout(item, e.target)}
        >
          <Image source={{ uri: item.uri }} style={styles.image} />
        </TouchableOpacity>
      );
    }

    // 3D model
    if (item.kind === "3d") {
      const modelIndex = threeModels.findIndex((m) => m.url === item.glbUrl);
      const model = modelIndex >= 0 ? threeModels[modelIndex] : undefined;

      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => model && onPress3D?.(model, modelIndex)}
          onLayout={(e) => measureLayout(item, e.target)}
        >
          <Mini3DPreview glbUrl={item.glbUrl} />
          <View style={styles.model3dBadge}>
            <Ionicons name="cube-outline" size={14} color="#4D4D4D" />
          </View>
        </TouchableOpacity>
      );
    }

    // placeholder
    if (item.kind === "placeholder") {
      return (
        <PlaceholderCell
          status={item.status}
          thumbUri={item.thumbUri}
          onLayout={(e) => measureLayout(item, e.target)}
        />
      );
    }

    return null;
  };

  /* ---------------------------------------------------------------------- */
  /* Skeleton                                                                */
  /* ---------------------------------------------------------------------- */
  if (loading && gridItems.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.centerText}>Loading photos…</Text>
      </View>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Main render                                                             */
  /* ---------------------------------------------------------------------- */
  return (
    <SafeAreaView style={{ flex: 1}}>
      <View>
        <FlatList
          data={gridItems}
          numColumns={3}
          keyExtractor={(item) => {
            if (item.kind === "photo") return `photo-${item.id}`;
            if (item.kind === "3d") return `3d-${item.id}`;
            return `placeholder-${item.assetId}`;
          }}
          renderItem={renderItem}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
        />
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  item: {
    width: SIZE,
    height: SIZE,
    margin: 2,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },

  image: { width: "100%", height: "100%" },

  /* placeholder */
  placeholderBox: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050505",
  },
  // 背景用原图
  placeholderBgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  // 压暗原图
  placeholderBgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  placeholderInnerGlow: {
    position: "absolute",
    left: 4,
    top: 4,
    right: 4,
    bottom: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(0,224,255,0.7)",
  },
  placeholderError: {
    borderWidth: 2,
    borderColor: "#ff4d4d",
  },
  placeholderText: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 6,
  },

  /* 3D badge */
  model3dBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
  },
  model3dBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },

  model3dNameBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  model3dName: { color: "#fff", fontSize: 11 },

  /* center loading */
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 8, color: "#fff" },

  /* FAB */
  fab: {
    position: "absolute",
    bottom: 40,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 30,
    backgroundColor: "#1e90ff",
    justifyContent: "center",
    alignItems: "center",
  },
  fabText: {
    fontSize: 30,
    color: "#fff",
    marginTop: -2,
  },
});