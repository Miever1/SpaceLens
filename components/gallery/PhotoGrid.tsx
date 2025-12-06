import type { Sam3DItem } from "@/api/sam3d";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MiniModelViewer from "../three/MiniModelViewer";

const INITIAL_WIDTH = Dimensions.get("window").width;

const getNumColumns = (width: number) => {
  if (width >= 1024) return 5;
  if (width >= 768) return 3;
  return 3;
};

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
/* 🔥 1. 占位格子组件 + React.memo                                           */
/* -------------------------------------------------------------------------- */
const PlaceholderCell = React.memo(
  ({
    status,
    thumbUri,
    onLayout,
    size,
  }: {
    status: "pending" | "error";
    thumbUri?: string;
    onLayout?: (ev: LayoutChangeEvent) => void;
    size: number;
  }) => {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (status !== "pending") return;
      const anim = Animated.loop(
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
      );
      anim.start();
      return () => {
        anim.stop();
      };
    }, [status, progress]);

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
  },
  (prev, next) =>
    prev.status === next.status &&
    prev.thumbUri === next.thumbUri &&
    prev.size === next.size &&
    prev.onLayout === next.onLayout
);

/* -------------------------------------------------------------------------- */
/* 🔥 2. PhotoCell + React.memo                                              */
/* -------------------------------------------------------------------------- */
type PhotoCellProps = {
  id: string;
  uri: string;
  assetIndex: number;
  size: number;
  onPress: (index: number) => void;
  onLayout?: (ev: LayoutChangeEvent) => void;
};

const PhotoCell = React.memo(
  ({ id, uri, assetIndex, size, onPress, onLayout }: PhotoCellProps) => {
    return (
      <TouchableOpacity
        style={[styles.item, { width: size, height: size }]}
        onPress={() => onPress(assetIndex)}
        onLayout={onLayout}
        activeOpacity={0.9}
      >
        <Image source={{ uri }} style={styles.image} />
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.uri === next.uri &&
    prev.size === next.size &&
    prev.assetIndex === next.assetIndex &&
    prev.onPress === next.onPress &&
    prev.onLayout === next.onLayout
);

/* -------------------------------------------------------------------------- */
/* 🔥 3. ModelCell + React.memo                                              */
/* -------------------------------------------------------------------------- */
type ModelCellProps = {
  id: string;
  glbUrl: string;
  size: number;
  model?: Sam3DItem;
  index: number;
  onPress3D?: (item: Sam3DItem, index: number) => void;
  onLayout?: (ev: LayoutChangeEvent) => void;
};

const ModelCell = React.memo(
  ({ id, glbUrl, size, model, index, onPress3D, onLayout }: ModelCellProps) => {
    return (
      <TouchableOpacity
        style={[styles.item, { width: size, height: size }]}
        onPress={() => model && onPress3D?.(model, index)}
        onLayout={onLayout}
        activeOpacity={0.9}
      >
        <MiniModelViewer glb={glbUrl} size={size} />
        <View style={styles.model3dBadge}>
          <Ionicons name="cube-outline" size={14} color="#4D4D4D" />
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.glbUrl === next.glbUrl &&
    prev.size === next.size &&
    prev.model?.key === next.model?.key &&
    prev.index === next.index &&
    prev.onPress3D === next.onPress3D &&
    prev.onLayout === next.onLayout
);

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
    onAddPhoto,
  } = props;

  const insets = useSafeAreaInsets();

  const [listWidth, setListWidth] = useState(INITIAL_WIDTH);

  const numColumns = useMemo(() => getNumColumns(listWidth), [listWidth]);

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

    assets.forEach((a, idx) => {
      items.push({ kind: "photo", id: a.id, uri: a.uri, assetIndex: idx });
    });

    return items;
  }, [assets, threeModels, generatingStatus]);

  /* ---------------------------------------------------------------------- */
  /* 🔥 Layout measurement 用 useCallback 保持引用稳定                        */
  /* ---------------------------------------------------------------------- */
  const measureLayout = useCallback(
    (item: GridItem, target: number | null | undefined) => {
      if (!target) return;
      UIManager.measure(
        target,
        (x, y, w, h, pageX, pageY) => {
          onItemLayout?.(item, { x: pageX, y: pageY, width: w, height: h });
        }
      );
    },
    [onItemLayout]
  );

  const handleItemLayout = useCallback(
    (item: GridItem) => (e: LayoutChangeEvent) => {
      // RN 里 target 是在 nativeEvent 里
      const target = (e.nativeEvent as any).target ?? findNodeHandle(e.target as any);
      measureLayout(item, target);
    },
    [measureLayout]
  );

  /* ---------------------------------------------------------------------- */
  /* 🔥 renderItem 里只负责拆 props，渲染交给 memo 子组件                     */
  /* ---------------------------------------------------------------------- */
  const renderItem = ({ item }: { item: GridItem }) => {
    if (item.kind === "photo") {
      return (
        <PhotoCell
          id={item.id}
          uri={item.uri}
          assetIndex={item.assetIndex}
          size={itemSize}
          onPress={onPress}
          onLayout={handleItemLayout(item)}
        />
      );
    }

    if (item.kind === "3d") {
      const idx = threeModels.findIndex((m) => m.url === item.glbUrl);
      const model = idx >= 0 ? threeModels[idx] : undefined;

      return (
        <ModelCell
          id={item.id}
          glbUrl={item.glbUrl}
          size={itemSize}
          model={model}
          index={idx}
          onPress3D={onPress3D}
          onLayout={handleItemLayout(item)}
        />
      );
    }

    return (
      <PlaceholderCell
        status={item.status}
        thumbUri={item.thumbUri}
        size={itemSize}
        onLayout={handleItemLayout(item)}
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
        <View style={styles.headerWrapper}>
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.40)",
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

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Library</Text>
              <Text style={styles.headerCount}>{gridItems.length} items</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={gridItems}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) =>
            item.kind === "photo"
              ? `photo-${item.id}`
              : item.kind === "3d"
              ? `3d-${item.id}`
              : `placeholder-${item.assetId}`
          }
          renderItem={renderItem}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{
            paddingTop: HEADER_HEIGHT + 8,
            paddingBottom: 12,
          }}
        />
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={onAddPhoto}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#111" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
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
    pointerEvents: "none",
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    pointerEvents: "auto",
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
    position: "absolute",
    bottom: 64,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },

    elevation: 6,
  },
  item: {
    margin: 2,
    borderRadius: 10,
  },
  image: { width: "100%", height: "100%" },

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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 8, color: "#fff" },
});