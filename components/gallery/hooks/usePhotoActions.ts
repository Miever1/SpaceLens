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

const { width: screenW } = Dimensions.get("window");

type ImgLayout = { width: number; height: number; x: number; y: number } | null;

type LastPointRef = {
  assetId: string;
  x: number;
  y: number;
} | null;

export function usePhotoActions() {
  const [points, setPoints] = useState<Record<string, SamPoint[]>>({});

  const [segmentingId, setSegmentingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  /** 分割预览（带绿边） */
  const [segPreviewUri, setSegPreviewUri] = useState<string | null>(null);
  /** 纯 mask，用来做 MaskedView */
  const [segMaskUri, setSegMaskUri] = useState<string | null>(null);
  const [segAssetId, setSegAssetId] = useState<string | null>(null);

  const [previewGlbUrl, setPreviewGlbUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const lastPointRef = useRef<LastPointRef>(null);

  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 });

  const [imgLayout, setImgLayout] = useState<ImgLayout | null>(null);

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

  const resetPoints = (assetId: string) => {
    setPoints((p) => {
      const cp = { ...p };
      delete cp[assetId];
      return cp;
    });

    if (segAssetId === assetId) {
      setSegPreviewUri(null);
      setSegMaskUri(null);
      setSegAssetId(null);
    }

    lastPointRef.current = null;
    setBubbleVisible(false);
  };

  /** 加点 + 分割 */
  const addPointAndSegment = async (
    asset: MyAsset,
    point: { x: number; y: number }
  ) => {
    const id = asset.id;
    const prev = points[id] ?? [];

    const newList: SamPoint[] = [...prev, { ...point, label: 1 }].slice(-5);
    setPoints((p) => ({ ...p, [id]: newList }));
    lastPointRef.current = { assetId: id, x: point.x, y: point.y };

    try {
      setSegmentingId(id);
      setSegPreviewUri(null);
      setSegMaskUri(null);
      setSegAssetId(null);

      const fileName = `${id}.jpg`;

      const { segUrl, maskUrl } = await sam3dSegment({
        uri: asset.uri,
        serverFilename: fileName,
        points: newList,
      });

      console.log("[usePhotoActions] seg result:", {
        id,
        segUrl,
        maskUrl,
      });

      if (!segUrl && !maskUrl) {
        throw new Error("segment response missing segUrl/maskUrl");
      }

      // 如果只有 segUrl 也先用着（老后端兼容）
      setSegPreviewUri(segUrl ?? null);
      setSegMaskUri(maskUrl ?? segUrl ?? null);
      setSegAssetId(id);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e: any) {
      console.warn("[usePhotoActions] segment error:", e);
      Alert.alert("Segmentation failed", e?.message ?? "Unknown error");
    } finally {
      setSegmentingId(null);
    }
  };

  /** 生成 3D */
  const generate3D = async (asset: MyAsset) => {
    const last = lastPointRef.current;
    if (!last || last.assetId !== asset.id) return;

    // 允许 segMaskUri 或 segPreviewUri 任意一个存在就生成 3D
    if (!segMaskUri && !segPreviewUri) return;
    if (generatingId) return;

    try {
      setGeneratingId(asset.id);
      setPreviewLoading(true);
      setBubbleVisible(false);

      const glbUrl = await sam3dGenerate3D({
        uri: asset.uri,
        serverFilename: `${asset.id}.jpg`,
        x: last.x,
        y: last.y,
      });

      setPreviewGlbUrl(glbUrl);
    } catch (e: any) {
      Alert.alert("3D Error", e?.message ?? "Unknown error");
    } finally {
      setGeneratingId(null);
      setPreviewLoading(false);
    }
  };

  return {
    points,
    segmentingId,
    generatingId,
    segPreviewUri,
    segMaskUri,
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
  };
}