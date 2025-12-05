// components/gallery/hooks/usePhotoActions.ts
import { sam3dGenerate3D, sam3dSegment, SamPoint } from "@/api/sam3d";
import type { MyAsset } from "@/hooks/usePhotoAssets";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  GestureResponderEvent,
  Image as RNImage,
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

  const boxW = imgLayout.width;
  const boxH = imgLayout.height;

  if (!boxW || !boxH) return null;

  // 宽高比
  const imgRatio = (asset.width || 1) / (asset.height || 1);
  const boxRatio = boxW / boxH;

  let drawW: number;
  let drawH: number;
  let offsetX: number;
  let offsetY: number;

  if (imgRatio > boxRatio) {
    drawW = boxW;
    drawH = boxW / imgRatio;
    offsetX = 0;
    offsetY = (boxH - drawH) / 2;
  } else {
    drawH = boxH;
    drawW = boxH * imgRatio;
    offsetY = 0;
    offsetX = (boxW - drawW) / 2;
  }

  const xInImgBox = locationX - offsetX;
  const yInImgBox = locationY - offsetY;

  if (
    xInImgBox < 0 ||
    yInImgBox < 0 ||
    xInImgBox > drawW ||
    yInImgBox > drawH
  ) {
    console.log("[mapTouch] touch outside image box", {
      locationX,
      locationY,
      offsetX,
      offsetY,
      drawW,
      drawH,
    });
    return null;
  }

  const xNorm = xInImgBox / drawW; // 0~1
  const yNorm = yInImgBox / drawH; // 0~1

  const mapped = {
    x: Number(xNorm.toFixed(4)),
    y: Number(yNorm.toFixed(4)),
  };

  console.log("[mapTouch] mapped (normalized)", {
    box: { xInImgBox, yInImgBox },
    result: mapped,
    raw: { locationX, locationY },
  });

  return mapped;
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

      const iw = asset.width || 1;
      const ih = asset.height || 1;
      const backendPoints = newList.map((p) => ({
        x: Math.round(p.x * iw),
        y: Math.round(p.y * ih),
        label: typeof p.label === "number" ? p.label : 1,
      }));

      const { segUrl, maskUrl } = await sam3dSegment({
        uri: asset.uri,
        serverFilename: fileName,
        points: backendPoints,
      });

      console.log("[usePhotoActions] seg result:", {
        id,
        segUrl,
        maskUrl,
      });

      if (!segUrl && !maskUrl) {
        throw new Error("segment response missing segUrl/maskUrl");
      }

      const ts = Date.now();
      const segUrlWithTs = segUrl ? `${segUrl}?t=${ts}` : null;
      const maskUrlWithTs = maskUrl ? `${maskUrl}?t=${ts}` : null;

      const urlsToPrefetch = [segUrlWithTs, maskUrlWithTs].filter(Boolean) as string[];
      await Promise.all(urlsToPrefetch.map((u) => RNImage.prefetch(u)));

      setSegPreviewUri(segUrlWithTs ?? null);
      setSegMaskUri(maskUrlWithTs ?? segUrlWithTs ?? null);
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

    if (!segMaskUri && !segPreviewUri) return;
    if (generatingId) return;

    try {
      setGeneratingId(asset.id);
      setPreviewLoading(true);
      setBubbleVisible(false);

      const { glbUrl } = await sam3dGenerate3D({
        uri: asset.uri,
        serverFilename: `${asset.id}.jpg`,
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

export default usePhotoActions;