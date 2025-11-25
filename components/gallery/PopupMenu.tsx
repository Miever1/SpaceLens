// components/gallery/PopupMenu.tsx
import React from "react";
import {
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import type { MyAsset } from "../../hooks/usePhotoAssets";

type Props = {
  asset: MyAsset;
  onClose: () => void;
  onOpen3D: () => void;
  onOpenAR: () => void;
  onDelete: () => void; // ✅ 新增
};

export default function PopupMenu({
  asset,
  onClose,
  onOpen3D,
  onOpenAR,
  onDelete,
}: Props) {
  const sharePhoto = async () => {
    onClose();
    try {
      await Share.share({
        message: "分享图片",
        url: asset.uri,
      });
    } catch (e) {
      console.warn("share error", e);
    }
  };

  const handleDelete = () => {
    onDelete();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.title}>操作</Text>
        <Text style={styles.subTitle} numberOfLines={1}>
          当前图片 ID：{asset.id}
        </Text>

        {/* 分享 */}
        <TouchableOpacity style={styles.btn} onPress={sharePhoto}>
          <Text style={styles.btnText}>分享</Text>
        </TouchableOpacity>

        {/* 3D */}
        <TouchableOpacity style={styles.btn} onPress={onOpen3D}>
          <Text style={styles.btnText}>3D 预览</Text>
        </TouchableOpacity>

        {/* AR */}
        <TouchableOpacity style={styles.btn} onPress={onOpenAR}>
          <Text style={styles.btnText}>AR 放置</Text>
        </TouchableOpacity>

        {/* 删除（危险操作） */}
        <TouchableOpacity
          style={[styles.btn, styles.deleteBtn]}
          onPress={handleDelete}
        >
          <Text style={styles.deleteText}>删除照片（不可恢复）</Text>
        </TouchableOpacity>

        {/* 关闭 */}
        <TouchableOpacity
          style={[styles.btn, styles.closeBtn]}
          onPress={onClose}
        >
          <Text style={styles.closeText}>关闭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 200,
  },
  box: {
    width: "82%",
    backgroundColor: "rgba(20,20,20,0.95)",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  title: { color: "#fff", fontSize: 18, marginBottom: 4, fontWeight: "600" },
  subTitle: { color: "#999", fontSize: 12, marginBottom: 12 },

  btn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#222",
    marginTop: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 14 },

  // 删除按钮样式
  deleteBtn: {
    backgroundColor: "rgba(255,60,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.7)",
    marginTop: 12,
  },
  deleteText: {
    color: "#ff6666",
    fontSize: 13,
    fontWeight: "600",
  },

  closeBtn: {
    marginTop: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  closeText: { color: "#aaa", fontSize: 13 },
});