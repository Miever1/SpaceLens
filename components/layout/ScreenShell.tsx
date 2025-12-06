// components/layout/ScreenShell.tsx
import { AntDesign } from "@expo/vector-icons";
import React, { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const HEADER_HEIGHT = 56;
const BOTTOM_HEIGHT = 72;

type Props = {
  title?: string;
  onBack?: () => void;
  /** 右上角区域（例如 ... 菜单 / AR 按钮） */
  rightSlot?: ReactNode;
  /** 底部操作栏内容（Share、提示文案等） */
  bottomSlot?: ReactNode;
  /** 中间主体内容 */
  children: ReactNode;
};

export default function ScreenShell({
  title,
  onBack,
  rightSlot,
  bottomSlot,
  children,
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* 顶部栏 */}
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {onBack && (
              <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
                <AntDesign name="left" size={18} color="black" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.headerCenter}>
            {!!title && <Text style={styles.headerTitle}>{title}</Text>}
          </View>

          <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
            {rightSlot}
          </View>
        </View>

        {/* 中间内容 */}
        <View style={styles.content}>{children}</View>

        {/* 底部栏（可选） */}
        {bottomSlot && <View style={styles.bottom}>{bottomSlot}</View>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },

  /* header */
  header: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  headerSide: {
    width: 60,
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    backgroundColor: "rgba(0,0,0,0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 24,
    color: "#111",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  /* content */
  content: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  /* bottom bar */
  bottom: {
    height: BOTTOM_HEIGHT,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
});