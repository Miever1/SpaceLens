import FlyToSlotManager from "@/components/animation/FlyToSlotManager";
import React, { useEffect } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

type Props = {
  assetId: string;
  glbThumb: string; // 模型缩略图（或者你想用的小图）
  onFinish: () => void;
};

export default function FlyIn3DModel({ assetId, glbThumb, onFinish }: Props) {
  const start = { x: 0, y: 0 };
  const endRect = FlyToSlotManager.getSlot(assetId);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!endRect) {
      onFinish();
      return;
    }

    // 从屏幕中间飞向目标
    x.value = withTiming(endRect.x, { duration: 700 });
    y.value = withTiming(endRect.y, { duration: 700 });
    scale.value = withTiming(0.33, { duration: 700 }, () => {
      onFinish();
    });
  }, []);

  const rStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={rStyle}>
      <Image source={{ uri: glbThumb }} style={styles.img} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  img: {
    width: 180,
    height: 180,
    borderRadius: 14,
  },
});