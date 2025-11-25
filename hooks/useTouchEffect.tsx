// hooks/useTouchEffect.tsx
import React, { useCallback, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

export default function useTouchEffect() {
  const [effectPos, setEffectPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const scaleOuter = useRef(new Animated.Value(0)).current;
  const scaleInner = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  /**
   * 触发炫酷触摸特效
   */
  const triggerTouchEffect = useCallback((x: number, y: number) => {
    setEffectPos({ x, y });

    scaleOuter.setValue(0);
    scaleInner.setValue(0);
    opacity.setValue(0.9);

    Animated.parallel([
      Animated.timing(scaleOuter, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scaleInner, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  /**
   * 渲染特效（交由外层组件调用）
   */
  const renderTouchEffects = useCallback(() => {
    if (!effectPos) return null;

    return (
      <>
        {/* 外圈波纹 */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.effectOuter,
            {
              opacity,
              transform: [
                { translateX: effectPos.x - 120 },
                { translateY: effectPos.y - 120 },
                {
                  scale: scaleOuter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1.8],
                  }),
                },
              ],
            },
          ]}
        />

        {/* 内圈闪光 */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.effectInner,
            {
              opacity,
              transform: [
                { translateX: effectPos.x - 40 },
                { translateY: effectPos.y - 40 },
                {
                  scale: scaleInner.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 1.4],
                  }),
                },
              ],
            },
          ]}
        />
      </>
    );
  }, [effectPos, opacity, scaleOuter, scaleInner]);

  return {
    effectPos,
    triggerTouchEffect,
    renderTouchEffects,
  };
}

const styles = StyleSheet.create({
  effectOuter: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: "#00e0ff",
    backgroundColor: "rgba(0, 224, 255, 0.08)",
    shadowColor: "#00e0ff",
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 200,
  },
  effectInner: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 224, 255, 0.6)",
    shadowColor: "#00ffff",
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 201,
  },
});