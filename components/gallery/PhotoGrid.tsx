import type { Sam3DItem } from "@/api/sam3d";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MiniModelViewer from "../three/MiniModelViewer";

// 用 window 宽度做一个初始值，真正的宽度用 onLayout 再更新
const INITIAL_WIDTH = Dimensions.get("window").width;

// 不同宽度下自动调列数
const getNumColumns = (width: number) => {
  if (width >= 1024) return 5; // iPad 横屏
  if (width >= 768) return 3;  // iPad 竖屏
  return 3;                    // iPhone
};

// ⭐ 顶部标题区域高度（FlatList 用它来 paddingTop）
const HEADER_HEIGHT = 80;

/* -------------------------------------------------------------------------- */
/* GridItem 类型                                                              */
/* -------------------------------------------------------------------------- */
export type GridItem =
  | { kind: "photo"; id: string; uri: string; assetIndex: number }
  | { kind: "3d"; id: string; glbUrl: string; name: string }
  | {
      kind: "placeholder";
      assetId: string;
      status: "pending" | "error";
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
  onItemLayout?: (
    item: GridItem,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
};

/* -------------------------------------------------------------------------- */
/* 占位格子：原图背景 + 发光呼吸边框                                         */
/* -------------------------------------------------------------------------- */
const PlaceholderCell = ({
  status,
  thumbUri,
  onLayout,
  size,
}: {
  status: "pending" | "error";
  thumbUri?: string;
  onLayout?: (ev: any) => void;
  size: number;
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
  }, [status]);

  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,224,255,0.25)", "rgba(0,224,255,1)"],
  });

  if (status === "error") {
    return (
      <View
        style={[
          styles.item,
          { width: size, height: size },
          styles.placeholderBox,
          styles.placeholderError,
        ]}
        onLayout={onLayout}
      >
        {thumbUri && (
          <>
            <Image
              source={{ uri: thumbUri }}
              style={styles.placeholderBgImage}
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

  return (
    <Animated.View
      style={[
        styles.item,
        { width: size, height: size },
        styles.placeholderBox,
        {
          borderWidth: 3.5,
          borderColor,
          shadowColor: "#00E0FF",
          shadowRadius: 18,
          shadowOpacity: 0.7,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
      onLayout={onLayout}
    >
      {thumbUri && (
        <>
          <Image
            source={{ uri: thumbUri }}
            style={styles.placeholderBgImage}
            blurRadius={6}
          />
          <View style={styles.placeholderBgDim} />
        </>
      )}

      <ActivityIndicator color="#00E0FF" />
      <Text style={styles.placeholderText}>Generating 3D…</Text>
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* 主组件                                                                      */
/* -------------------------------------------------------------------------- */
export default function PhotoGrid(props: Props) {
  const {
    assets,
    loading,
    threeModels = [],
    generatingStatus,
    onPress,
    onPress3D,
    onLoadMore,
    onItemLayout,
  } = props;

  const insets = useSafeAreaInsets(); // 暂时没用，但保留不动

  // 👉 实际可用宽度，来自容器 onLayout
  const [listWidth, setListWidth] = useState(INITIAL_WIDTH);

  const numColumns = useMemo(
    () => getNumColumns(listWidth),
    [listWidth]
  );

  const itemSize = useMemo(
    () => listWidth / numColumns - 5,
    [listWidth, numColumns]
  );

  /* ---------------------------------------------------------------------- */
  /* gridItems：整理成照片+3D+占位                                             */
  /* ---------------------------------------------------------------------- */
  const gridItems: GridItem[] = useMemo(() => {
    const items: GridItem[] = [];
    const assetMap = new Map<string, string>();
    assets.forEach((a) => assetMap.set(a.id, a.uri));

    // placeholder + done(3D)
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

    const replacedKeys = new Set(
      Object.values(generatingStatus)
        .filter((v) => v.status === "done" && v.model)
        .map((v) => (v.model as Sam3DItem).key)
    );

    // 老 3D（过滤 usdz）
    threeModels.forEach((m) => {
      if (m.url.endsWith(".usdz")) return;
      if (!replacedKeys.has(m.key)) {
        items.push({
          kind: "3d",
          id: `3d-${m.key}`,
          glbUrl: m.url,
          name: m.key.split("/").pop() ?? m.key,
        });
      }
    });

    // 照片
    assets.forEach((a, idx) => {
      items.push({ kind: "photo", id: a.id, uri: a.uri, assetIndex: idx });
    });

    return items;
  }, [assets, threeModels, generatingStatus]);

  /* ---------------------------------------------------------------------- */
  /* Layout measurement for animation                                        */
  /* ---------------------------------------------------------------------- */
  const measureLayout = (item: GridItem, target: any) => {
    const node = findNodeHandle(target);
    if (!node) return;

    UIManager.measure(node, (x, y, w, h, pageX, pageY) => {
      onItemLayout?.(item, { x: pageX, y: pageY, width: w, height: h });
    });
  };

  /* ---------------------------------------------------------------------- */
  /* renderItem                                                              */
  /* ---------------------------------------------------------------------- */
  const renderItem = ({ item }: { item: GridItem }) => {
    if (item.kind === "photo") {
      return (
        <TouchableOpacity
          style={[styles.item, { width: itemSize, height: itemSize }]}
          onPress={() => props.onPress(item.assetIndex)}
          onLayout={(e) => measureLayout(item, e.target)}
        >
          <Image source={{ uri: item.uri }} style={styles.image} />
        </TouchableOpacity>
      );
    }

    if (item.kind === "3d") {
      const idx = threeModels.findIndex((m) => m.url === item.glbUrl);
      const model = idx >= 0 ? threeModels[idx] : undefined;

      return (
        <TouchableOpacity
          style={[styles.item, { width: itemSize, height: itemSize }]}
          onPress={() => model && props.onPress3D?.(model, idx)}
          onLayout={(e) => measureLayout(item, e.target)}
        >
          <MiniModelViewer glb={item.glbUrl} />
          <View style={styles.model3dBadge}>
            <Ionicons name="cube-outline" size={14} color="#4D4D4D" />
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <PlaceholderCell
        status={item.status}
        thumbUri={item.thumbUri}
        size={itemSize}
        onLayout={(e: any) => measureLayout(item, e.target)}
      />
    );
  };

  /* ---------------------------------------------------------------------- */
  /* Main render                                                              */
  /* ---------------------------------------------------------------------- */
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            setListWidth(w);
          }
        }}
      >
        {/* ⭐ 固定在顶部的标题 + 渐变背景（覆盖在网格上） */}
        <View style={styles.headerWrapper}>
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.40)", // 顶部：淡淡灰黑
              "rgba(0,0,0,0.32)",
              "rgba(0,0,0,0.24)",
              "rgba(0,0,0,0.16)",
              "rgba(0,0,0,0.08)",
              "rgba(0,0,0,0.0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGradient}
          />

          {/* 标题 + 统计 + 右侧「+」按钮 */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Library</Text>
              <Text style={styles.headerCount}>
                {gridItems.length} items
              </Text>
            </View>

            {/* <TouchableOpacity
              style={styles.addBtn}
              onPress={props.onAddPhoto}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#111" />
            </TouchableOpacity> */}
          </View>
        </View>

        {/* 下方网格滚动，内容在 header 背后经过 */}
        <FlatList
          data={gridItems}
          key={numColumns}              // ⭐ 列数变动时强制重建列表
          numColumns={numColumns}
          keyExtractor={(item) =>
            item.kind === "photo"
              ? `photo-${item.id}`
              : item.kind === "3d"
              ? `3d-${item.id}`
              : `placeholder-${item.assetId}`
          }
          renderItem={renderItem}
          onEndReached={props.onLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{
            paddingTop: HEADER_HEIGHT + 8,
            paddingBottom: 12,
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  /* Header：绝对定位，盖在最上层，背景透明 */
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT + 40,
    paddingHorizontal: 16,
    paddingBottom: 10,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
    overflow: "hidden",
    zIndex: 10,
    pointerEvents: "none", // ⭐ 不挡下面网格的点击
  },

  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // 标题 + 按钮排一行
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    pointerEvents: "auto", // ❗ 允许点击「+」按钮
  },

  headerTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
  },
  headerCount: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
  },

  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },

  /* Grid item：不再在这里写死 width / height，用 size 动态传 */
  item: {
    margin: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },

  /* Placeholder */
  placeholderBox: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050505",
  },
  placeholderBgImage: { ...StyleSheet.absoluteFillObject },
  placeholderBgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
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
    borderRadius: 50,
  },

  /* Center loading */
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 8, color: "#fff" },
});