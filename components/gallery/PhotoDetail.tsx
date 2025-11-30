// components/gallery/PhotoDetail.tsx
import type { SamPoint } from "@/api/sam3d";
import type { FromRect } from "@/app/(tabs)";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import { EvilIcons } from "@expo/vector-icons";
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
import ShareButton from "../common/ShareButton";
import ScreenShell from "../layout/ScreenShell";
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

/* ---------------- 选区内特效 ---------------- */

const SegPreviewOverlay = ({ maskUri }: { maskUri: string }) => {
  const pulse = useRef(new Animated.Value(0)).current;
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

  const fillOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.22],
  });

  const glowRadius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 18],
  });

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
      {/* 区域内淡青色填充 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#00E0FF",
            opacity: fillOpacity,
          },
        ]}
      />

      {/* 边缘 glow */}
      <Animated.View
        style={[
          styles.segGlow,
          {
            shadowRadius: glowRadius,
          },
        ]}
      />

      {/* 斜向高光刷过 */}
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

  /* ---------------- 底部栏内容 ---------------- */

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
    // TODO: 这里后面接系统分享逻辑
    console.log("share current photo:", currentAsset.uri);
  };

  /* ---------------- 渲染 ---------------- */

  return (
    <ScreenShell
      title="Photo"
      onBack={onClose}
      rightSlot={
        <ShareButton
          onPress={handleShare}
          size={36}
          // header 背景是白色，用 light 主题
          theme="light"
        />
      }
      bottomSlot={bottomSlot}
    >
      {/* 中间内容区域：FlatList + 各种 overlay，只覆盖内容区，不挡住 header/bottom */}
      <View style={styles.content}>
        <FlatList
  data={assets}
  horizontal
  pagingEnabled
  initialScrollIndex={index}
  showsHorizontalScrollIndicator={false}
  keyExtractor={(item) => item.id}
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

        {isSeg && segPreviewUri && (
          <Image
            source={{ uri: segPreviewUri }}
            style={styles.segOverlayImage}
            resizeMode="contain"
          />
        )}

        {isSeg && segMaskUri && <SegPreviewOverlay maskUri={segMaskUri} />}

        {imgLayout && pts.length > 0 && (
          <PointsOverlay points={pts} asset={item} imgLayout={imgLayout} />
        )}
      </Pressable>
    );
  }}
/>

        {/* 分割 loading 遮罩（只盖内容区域） */}
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
    </ScreenShell>
  );
}

/* ---------------- 样式 ---------------- */

const styles = StyleSheet.create({
  /* header 右侧按钮（给 ScreenShell 的 rightSlot 用） */
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerIconText: {
    fontSize: 18,
    color: "#111",
  },

  /* 中间内容区域（ScreenShell 已经给了背景和 padding） */
  content: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  itemWrapper: {
    width: screenW,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: screenW,
    height: "100%",
  },

  /* 底部操作区内容（放在 ScreenShell.bottomSlot 里） */
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
  bottomShareText: {
    fontSize: 12,
    color: "#111",
  },
  bottomHint: {
    fontSize: 11,
    color: "rgba(0,0,0,0.5)",
  },

  segOverlayImage: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
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
    elevation: 6,
  },

  segShimmer: {
    position: "absolute",
    top: -screenH,
    bottom: -screenH,
    width: screenW * 0.4,
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