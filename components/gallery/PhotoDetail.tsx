// components/gallery/PhotoDetail.tsx
import MaskedView from "@react-native-masked-view/masked-view";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { SamPoint } from "@/api/sam3d";
import type { FromRect } from "@/app/(tabs)";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import { usePhotoActions } from "./hooks/usePhotoActions";

const { width: screenW, height: screenH } = Dimensions.get("window");

/* ---------------- 气泡菜单 ---------------- */

type BubbleMenuProps = {
  pos: { x: number; y: number };
  canGenerate: boolean;
  onReset: () => void;
  onMake3D: () => void;
  onDismiss: () => void;
};

const BubbleMenu: React.FC<BubbleMenuProps> = ({
  pos,
  canGenerate,
  onReset,
  onMake3D,
  onDismiss,
}) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <TouchableOpacity
      style={StyleSheet.absoluteFill}
      activeOpacity={1}
      onPress={onDismiss}
    />
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

/* ---------------- 只在选中区域内部渲染特效 ---------------- */

const SegPreviewOverlay = ({ maskUri }: { maskUri: string }) => {
  // 主呼吸动画 0 → 1 → 0
  const pulse = useRef(new Animated.Value(0)).current;
  // 斜向高光的位移
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    shimmerLoop.start();
    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [pulse, shimmer]);

  // 区域填充透明度：很轻微的呼吸
  const fillOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.10, 0.22],
  });

  // 边缘 glow 强度
  const glowRadius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 18],
  });

  // 斜向高光的位置
  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenW, screenW],
  });

  return (
    <MaskedView
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      maskElement={
        <Image
          source={{ uri: maskUri }}
          style={styles.segOverlayImage}
          resizeMode="contain"
        />
      }
    >
      {/* 1. 选区内淡淡的青色内发光 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#00E0FF",
            opacity: fillOpacity,
          },
        ]}
      />

      {/* 2. 边缘柔和的高光描边 */}
      <Animated.View
        style={[
          styles.segGlow,
          {
            shadowRadius: glowRadius,
          },
        ]}
      />

      {/* 3. 非常轻的斜向高光刷过一下 */}
      <Animated.View
        style={[
          styles.segShimmer,
          {
            transform: [
              { translateX: shimmerTranslate },
              { rotateZ: "-18deg" },
            ],
          },
        ]}
      />
    </MaskedView>
  );
};

/* ---------------- 点标记 ---------------- */

const PointsOverlay = ({
  points,
  asset,
  imgLayout,
}: {
  points: SamPoint[];
  asset: MyAsset;
  imgLayout: { width: number; height: number };
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

/* ---------------- 主组件 ---------------- */

type Props = {
  assets: MyAsset[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;

  onStartGenerate3D?: (assetId: string, from?: FromRect) => void;
  onFinishGenerate3D?: (assetId: string, ok: boolean, model?: any) => void;
};

export default function PhotoDetail({
  assets,
  index,
  onChangeIndex,
  onClose,
  onStartGenerate3D,
  onFinishGenerate3D,
}: Props) {
  const {
    points,
    segmentingId,
    segPreviewUri,
    segMaskUri,
    segAssetId,
    imgLayout,
    bubbleVisible,
    bubblePos,
    setImgLayout,
    mapTouch,
    showBubble,
    addPointAndSegment,
    generate3D,
    resetPoints,
    setBubbleVisible,
  } = usePhotoActions();

  const currentAsset = assets[index];
  const isSegmenting = !!segmentingId;
   const canGenerate =
    !!(segMaskUri || segPreviewUri) &&
    segAssetId === currentAsset.id &&
    !segmentingId;

  /* ---------------- 长按水波纹 ---------------- */

  const [ripplePos, setRipplePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  const triggerRipple = (x: number, y: number) => {
    setRipplePos({ x, y });
    rippleScale.setValue(0);
    rippleOpacity.setValue(0.8);

    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRipplePos(null);
    });
  };

  const onLongPress = async (e: any, asset: MyAsset) => {
    const mapped = mapTouch(e, asset);
    if (!mapped) return;

    const { pageX, pageY } = e.nativeEvent;
    triggerRipple(pageX, pageY);

    await addPointAndSegment(asset, mapped);
    showBubble(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };

  const handleMake3D = () => {
    console.log("Make 3D clicked for", currentAsset.id);

    let fromRect: FromRect | undefined;
    if (imgLayout) {
      fromRect = {
        x: imgLayout.x ?? 0,
        y: imgLayout.y ?? 0,
        width: imgLayout.width,
        height: imgLayout.height,
        uri: currentAsset.uri,
      };
    }

    onStartGenerate3D?.(currentAsset.id, fromRect);

    generate3D(currentAsset)
      .then((model) => {
        onFinishGenerate3D?.(currentAsset.id, true, model);
      })
      .catch((err) => {
        console.warn("generate3D error:", err);
        onFinishGenerate3D?.(currentAsset.id, false);
      });

    setBubbleVisible(false);
    resetPoints(currentAsset.id);
    onClose();
  };

  return (
    <View style={styles.container}>
      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={onClose}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      {/* Page counter */}
      <View style={styles.counterWrapper}>
        <Text style={styles.counterText}>
          {index + 1} / {assets.length}
        </Text>
      </View>

      {/* 主图分页 */}
      <FlatList
        data={assets}
        horizontal
        pagingEnabled
        initialScrollIndex={index}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.id}
        getItemLayout={(_, i) => ({
          length: screenW,
          offset: screenW * i,
          index: i,
        })}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.floor(e.nativeEvent.contentOffset.x / screenW);
          onChangeIndex(newIndex);
          setBubbleVisible(false);
        }}
        renderItem={({ item }) => {
  const pts = points[item.id] ?? [];
  const isSeg = segAssetId === item.id;

  return (
    <Pressable
      style={styles.itemWrapper}
      onLongPress={(e) => onLongPress(e, item)}
      onPress={() => setBubbleVisible(false)}
    >
      {/* 1. 背景原图 */}
      <Image
        source={{ uri: item.uri }}
        style={styles.image}
        resizeMode="contain"
        onLayout={(ev) =>
          setImgLayout({
            x: ev.nativeEvent.layout.x,
            y: ev.nativeEvent.layout.y,
            width: ev.nativeEvent.layout.width,
            height: ev.nativeEvent.layout.height,
          })
        }
      />

      {/* 2. 后端可视化图：暗背景 + 绿边，放中间当参照 */}
      {isSeg && segPreviewUri && (
        <Image
          source={{ uri: segPreviewUri }}
          style={styles.segOverlayImage}
          resizeMode="contain"
        />
      )}

      {/* 3. 顶层特效：只在 mask 内部显示 */}
      {isSeg && segMaskUri && <SegPreviewOverlay maskUri={segMaskUri} />}

      {/* 4. 点标记 */}
      {imgLayout && pts.length > 0 && (
        <PointsOverlay points={pts} asset={item} imgLayout={imgLayout} />
      )}
    </Pressable>
  );
}}
      />

      {/* 分割 loading 遮罩 */}
      {isSegmenting && (
        <View style={styles.loadingMask}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Segmenting…</Text>
        </View>
      )}

      {/* 长按水波纹 */}
      {ripplePos && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ripple,
            {
              left: ripplePos.x - 90,
              top: ripplePos.y - 90,
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />
      )}

      {/* 气泡菜单 */}
      {bubbleVisible && (
        <BubbleMenu
          pos={bubblePos}
          canGenerate={canGenerate}
          onReset={() => resetPoints(currentAsset.id)}
          onMake3D={handleMake3D}
          onDismiss={() => setBubbleVisible(false)}
        />
      )}
    </View>
  );
}

/* ---------------- 样式 ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  itemWrapper: {
    width: screenW,
    height: screenH,
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: screenW,
    height: screenH,
  },

  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backText: { color: "#fff", fontSize: 16 },

  counterWrapper: {
    position: "absolute",
    top: 50,
    right: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  counterText: { color: "#fff", fontSize: 14 },

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
    zIndex: 40,
  },
  bubbleItem: {
    paddingHorizontal: 10,
    justifyContent: "center",
    height: "100%",
  },
  bubbleItemDisabled: { opacity: 0.35 },

  bubbleText: { color: "#fff", fontSize: 12 },
  bubbleTextPrimary: { color: "#3FA8FF", fontWeight: "600" },
  bubbleTextDisabled: { color: "rgba(255,255,255,0.65)" },

  bubbleDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  loadingMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  loadingText: {
    marginTop: 8,
    color: "#fff",
    fontSize: 14,
  },

      // 边缘 glow（只在选中区域内，因为被 MaskedView 裁剪）
  segGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,

    borderWidth: 1,
    borderColor: "rgba(0,224,255,0.95)",

    shadowColor: "#00E0FF",
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    // shadowRadius 由动画控制
    elevation: 6,
  },

  // 斜向高光条（被 mask 裁剪，只在选区里看到）
  segShimmer: {
    position: "absolute",
    top: -screenH,        // 做成足够高的条
    bottom: -screenH,
    width: screenW * 0.4, // 窄一点好看

    backgroundColor: "rgba(255,255,255,0.15)",
  },

  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "rgba(0,224,255,0.16)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,224,255,0.9)",
  },

  ripple: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: "#00E0FF",
    backgroundColor: "rgba(0,224,255,0.18)",
    zIndex: 50,
  },
});