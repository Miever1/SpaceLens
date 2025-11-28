// components/gallery/PhotoDetail.tsx
import React from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { usePhotoActions } from "./hooks/usePhotoActions";
import {
  BubbleMenu,
  PointsOverlay,
  Preview3DModal,
  SegPreviewOverlay,
} from "./ui/DetailOverlays";

import type { MyAsset } from "@/hooks/usePhotoAssets";

const { width: screenW, height: screenH } = Dimensions.get("window");

type Props = {
  assets: MyAsset[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
};

export default function PhotoDetail({
  assets,
  index,
  onChangeIndex,
  onClose,
}: Props) {
  const scrollX = React.useRef(new Animated.Value(index * screenW)).current;

  const {
    points,
    segmentingId,
    generatingId,
    segPreviewUri,
    segAssetId,
    previewGlbUrl,
    previewLoading,
    imgLayout,
    bubbleVisible,
    bubblePos,
    setImgLayout,
    mapTouch,
    showBubble,
    addPointAndSegment,
    generate3D,
    resetPoints,
    setPreviewGlbUrl,
    setPreviewLoading,
    setBubbleVisible,
  } = usePhotoActions();

  const currentAsset = assets[index];
  const canGenerate =
    !!segPreviewUri && segAssetId === currentAsset.id && !segmentingId;

  /** 长按触发：加点 + 分割 + 弹出菜单 */
  const onLongPress = async (e: any, asset: MyAsset) => {
    const mapped = mapTouch(e, asset);
    if (!mapped) return;

    await addPointAndSegment(asset, mapped);

    // 气泡位置来自手指坐标
    showBubble(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };

  const isBusy = !!segmentingId || !!generatingId;
  const busyText = segmentingId ? "Segmenting..." : "Generating 3D...";

  return (
    <View style={styles.container}>
      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={onClose}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      {/* Page */}
      <View style={styles.counterWrapper}>
        <Text style={styles.counterText}>
          {index + 1} / {assets.length}
        </Text>
      </View>

      {/* Image List */}
      <Animated.FlatList
        data={assets}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
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
              <Image
                source={{ uri: item.uri }}
                style={styles.image}
                resizeMode="contain"
                onLayout={(ev) =>
                  setImgLayout({
                    width: ev.nativeEvent.layout.width,
                    height: ev.nativeEvent.layout.height,
                  })
                }
              />

              {/* Mask Preview */}
              {isSeg && segPreviewUri && (
                <SegPreviewOverlay uri={segPreviewUri} />
              )}

              {/* Points */}
              {imgLayout && pts.length > 0 && (
                <PointsOverlay
                  points={pts}
                  asset={item}
                  imgLayout={imgLayout}
                />
              )}
            </Pressable>
          );
        }}
      />

      {/* Popup Menu */}
      {bubbleVisible && (
        <BubbleMenu
          pos={bubblePos}
          canGenerate={canGenerate}
          onReset={() => resetPoints(currentAsset.id)}
          onMake3D={() => {
            console.log("Make 3D clicked for", currentAsset.id);
            generate3D(currentAsset);
          }}
          onDismiss={() => setBubbleVisible(false)}
        />
      )}

      {/* 全局 loading 蒙层：分割或 3D 生成时显示 */}
      {isBusy && (
        <View style={styles.loadingMask}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>{busyText}</Text>
        </View>
      )}

      {/* 3D Modal */}
      {previewGlbUrl && (
        <Preview3DModal
          glbUrl={previewGlbUrl}
          loading={previewLoading}
          onClose={() => {
            setPreviewGlbUrl(null);
            setPreviewLoading(false);
            // 关闭 modal 重置当前图片的点和 mask
            resetPoints(currentAsset.id);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  itemWrapper: {
    width: screenW,
    height: screenH,
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: screenW, height: screenH },
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

  // loading overlay
  loadingMask: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 30,
  },
  loadingText: {
    marginTop: 8,
    color: "#fff",
    fontSize: 14,
  },
});