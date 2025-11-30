// components/common/ShareButton.tsx
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    ViewStyle,
} from "react-native";

type Props = {
  onPress: () => void;
  /** 外层额外样式（比如在底部栏里加 margin） */
  style?: StyleProp<ViewStyle>;
  /** 尺寸，默认 44（直径） */
  size?: number;
  /** 适配深色背景时用，图标会变成浅色 */
  theme?: "light" | "dark";
};

export default function ShareButton({
  onPress,
  style,
  size = 44,
  theme = "light",
}: Props) {
  const iconColor = theme === "light" ? "#111" : "#fff";
  const bgColor =
    theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.55)";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <MaterialIcons name="more-horiz" size={24} color="black" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: "center",
    alignItems: "center",
  },
});