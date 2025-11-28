// components/gallery/hooks/usePhotoActions.ts
import { sam3dGenerate3D, sam3dSegment, SamPoint } from "@/api/sam3d";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    GestureResponderEvent,
} from "react-native";

const { width: screenW, height: screenH } = Dimensions.get("window");

type ImgLayout = { width: number; height: number };

type LastPointRef = {
  assetId: string;
  x: number;
  y: number;
} | null;

export function usePhotoActions() {
  /** 每张图的点击点 */
  const [points, setPoints] = useState<Record<string, SamPoint[]>>({});

  /** 全局 loading 状态 */
  const [segmentingId, setSegmentingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  /** 分割预览 */
  const [segPreviewUri, setSegPreviewUri] = useState<string | null>(null);
  const [segAssetId, setSegAssetId] = useState<string | null>(null);

  /** 3D 预览 */
  const [previewGlbUrl, setPreviewGlbUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  /** 最近一次点的位置（生成 3D 用） */
  const lastPointRef = useRef<LastPointRef>(null);

  /** 气泡菜单 */
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 });

  /** Image layout，用来把 RN 坐标映射回原图像素 */
  const [imgLayout, setImgLayout] = useState<ImgLayout | null>(null);

  /** 把手指坐标映射到原图坐标 */
  const mapTouch = (
    e: GestureResponderEvent,
    asset: MyAsset
  ): { x: number; y: number } | null => {
    if (!imgLayout) return null;

    const { locationX, locationY } = e.nativeEvent;

    return {
      x: Math.round((locationX * asset.width) / imgLayout.width),
      y: Math.round((locationY * asset.height) / imgLayout.height),
    };
  };

  /** 计算气泡菜单位置 */
  const showBubble = (x: number, y: number) => {
    const w = 160;
    const h = 40;

    let px = x - w / 2;
    let py = y - h - 10;

    px = Math.max(10, Math.min(px, screenW - w - 10));
    py = Math.max(70, py);

    setBubblePos({ x: px, y: py });
    setBubbleVisible(true);
  };

  /** 清空某张图片的点 & mask */
  const resetPoints = (assetId: string) => {
    setPoints((p) => {
      const cp = { ...p };
      delete cp[assetId];
      return cp;
    });

    if (segAssetId === assetId) {
      setSegPreviewUri(null);
      setSegAssetId(null);
    }

    lastPointRef.current = null;
    setBubbleVisible(false);
  };

  /** 分割：加点 + 调后端 + 更新预览 */
  const addPointAndSegment = async (asset: MyAsset, point: { x: number; y: number }) => {
    const id = asset.id;
    const prev = points[id] ?? [];

    // 最多保留最近 5 个点
    const newList: SamPoint[] = [...prev, { ...point, label: 1 }].slice(-5);
    setPoints((p) => ({ ...p, [id]: newList }));
    lastPointRef.current = { assetId: id, x: point.x, y: point.y };

    try {
      setSegmentingId(id);
      setSegPreviewUri(null);
      setSegAssetId(null);

      const fileName = `${id}.jpg`;

      const dataUrl = await sam3dSegment({
        uri: asset.uri,
        serverFilename: fileName,
        points: newList,
      });

      setSegPreviewUri(dataUrl);
      setSegAssetId(id);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e: any) {
      Alert.alert("Segmentation failed", e?.message ?? "Unknown error");
    } finally {
      setSegmentingId(null);
    }
  };

  /** 生成 3D：调用后端，返回 glbUrl，打开 3D modal */
  const generate3D = async (asset: MyAsset) => {
    // 必须先有这个图片的分割结果
    if (!segPreviewUri || segAssetId !== asset.id) return;

    // 必须有最近一次点击点
    const last = lastPointRef.current;
    if (!last || last.assetId !== asset.id) return;

    // 避免重复点击
    if (generatingId) return;

    try {
      setGeneratingId(asset.id);      // 全局「Generating 3D...」
      setPreviewLoading(true);        // modal 里的小 loading
      setBubbleVisible(false);

      const glbUrl = await sam3dGenerate3D({
        uri: asset.uri,
        serverFilename: `${asset.id}.jpg`,
        x: last.x,
        y: last.y,
      });

      // 成功：直接给 modal 用
      setPreviewGlbUrl(glbUrl);
    } catch (e: any) {
      Alert.alert("3D Error", e?.message ?? "Unknown error");
    } finally {
      // ✅ 不管成功失败，都关 loading
      setGeneratingId(null);
      setPreviewLoading(false);
    }
  };

  return {
    // state
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

    // setters / actions
    setImgLayout,
    mapTouch,
    showBubble,
    addPointAndSegment,
    generate3D,
    resetPoints,
    setPreviewGlbUrl,
    setPreviewLoading,
    setBubbleVisible,
  };
}