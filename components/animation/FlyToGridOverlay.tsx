// components/animation/FlyToGridOverlay.tsx
import React, { useEffect } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type FlyRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  uri: string;
};

export type SlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  visible: boolean;
  from: FlyRect | null;
  to: SlotRect | null;
  onFinish: () => void;
};

export default function FlyToGridOverlay({
  visible,
  from,
  to,
  onFinish,
}: Props) {
  const progress = useSharedValue(0);

  // ⭐ 启动动画
  useEffect(() => {
    if (!visible || !from || !to) {
      return;
    }

    console.log("[Fly] start animation", { from, to });

    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: 800 }, // 时间拉长一点，更好看出来
      (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      }
    );
  }, [visible, from, to, onFinish, progress]);

  // ⭐ 始终定义 hook，避免 “Rendered more hooks than…” 报错
  const animStyle = useAnimatedStyle(() => {
    if (!visible || !from || !to) {
      // 不可见时直接透明
      return { opacity: 0 };
    }

    const x = interpolate(progress.value, [0, 1], [from.x, to.x]);
    const y = interpolate(progress.value, [0, 1], [from.y, to.y]);
    const w = interpolate(progress.value, [0, 1], [from.width, to.width]);
    const h = interpolate(progress.value, [0, 1], [from.height, to.height]);
    const opacity = interpolate(progress.value, [0, 1], [1, 0.3]);
    const scale = interpolate(progress.value, [0, 1], [1, 0.95]);

    return {
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      opacity,
      transform: [{ scale }],
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "rgba(63,168,255,0.9)",
      overflow: "hidden",
    };
  });

  // React 这层可以安全地根据 visible / from / to 提前 return
  if (!visible || !from || !to) return null;

  return (
    <Animated.View style={[styles.overlay, StyleSheet.absoluteFill]}>
      {/* 飞行中的小图 */}
      <Animated.View style={animStyle}>
        <Image
          source={{ uri: from.uri }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
            borderWidth: 4,
            borderColor: "#00E0FF",
            shadowColor: "#00E0FF",
            shadowOpacity: 0.9,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
    elevation: 999,
    pointerEvents: "none",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
});