// app/(tabs)/index.tsx
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import FlyToGridOverlay from "../../components/animation/FlyToGridOverlay";
import PhotoDetail from "../../components/gallery/PhotoDetail";
import PhotoGrid from "../../components/gallery/PhotoGrid";
import ModelViewer3D from "../../components/three/ModelViewer3D";
import ModelViewerAR from "../../components/three/ModelViewerAR";

import { sam3dListModels, type Sam3DItem } from "@/api/sam3d";
import usePhotoAssets from "@/hooks/usePhotoAssets";

/** 大图的 fromRect 类型，给 PhotoDetail 用 */
export type FromRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  uri: string;
};

/** 每张图 3D 生成状态 */
type GeneratingStatusMap = Record<
  string,
  { status: "pending" | "error" | "done"; model?: Sam3DItem }
>;

export default function AlbumTab() {
  const { assets, loading, loadMore, addPhoto } = usePhotoAssets();

  /** S3 里的 3D 模型列表 */
  const [threeModels, setThreeModels] = useState<Sam3DItem[]>([]);
  const [loading3d, setLoading3d] = useState(false);

  /** 每张图的生成状态 */
  const [generatingStatus, setGeneratingStatus] =
    useState<GeneratingStatusMap>({});

  /** 当前大图 index（null 表示在 Grid） */
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /** Grid 里每个占位格的布局（飞行动画终点） */
  const [gridLayouts, setGridLayouts] = useState<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});

  /** 如果点击 3D 时还没量到占位格，先把 from 存在这里 */
  const [pendingFly, setPendingFly] = useState<{
    assetId: string;
    from: FromRect;
  } | null>(null);

  /** 飞行动画状态 */
  const [flyVisible, setFlyVisible] = useState(false);
  const [flyFrom, setFlyFrom] = useState<FromRect | null>(null);
  const [flyTo, setFlyTo] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  /** 3D / AR Viewer 状态 */
  const [active3DModel, setActive3DModel] = useState<Sam3DItem | null>(null);
  const [show3D, setShow3D] = useState(false);
  const [showAR, setShowAR] = useState(false);

  /* ---------------- 拉取 S3 3D 列表 ---------------- */
  useEffect(() => {
    (async () => {
      setLoading3d(true);
      try {
        const list = await sam3dListModels();
        setThreeModels(list);
      } catch (e) {
        console.warn("sam3dListModels error:", e);
      } finally {
        setLoading3d(false);
      }
    })();
  }, []);

  /* ---------------- 记录 Grid 里占位格布局（只给飞行动画用） ---------------- */
  const handleItemLayout = (item: any, layout: any) => {
    if (item.kind !== "placeholder") return;

    setGridLayouts((prev) => ({
      ...prev,
      [item.assetId]: layout,
    }));

    // 如果正好有等待中的飞行动画，这里补开一次
    if (pendingFly && pendingFly.assetId === item.assetId) {
      const { from } = pendingFly;
      setFlyFrom(from);
      setFlyTo(layout);
      setFlyVisible(true);
      setPendingFly(null);
    }
  };

  /* ---------------- 从大图触发：开始生成 3D + 飞行动画 ---------------- */
  const handleStartGenerate3D = (assetId: string, from?: FromRect) => {
    console.log("onStartGenerate3D", assetId, from);

    // 1) 先标记 pending，占位会出现在 grid 里
    setGeneratingStatus((prev) => ({
      ...prev,
      [assetId]: { status: "pending" },
    }));

    // 2) 有 from 的情况下，尝试启动飞行动画
    if (from) {
      const to = gridLayouts[assetId];

      if (to) {
        // 已经有占位布局，直接飞
        console.log("start fly (immediate)", { assetId, from, to });
        setFlyFrom(from);
        setFlyTo(to);
        setFlyVisible(true);
      } else {
        // 还没量到占位格，先记一笔，等 handleItemLayout 再飞
        console.log("还没拿到占位布局，先挂起待飞", assetId);
        setPendingFly({ assetId, from });
      }
    }
  };

  /* ---------------- 生成结束回调 ---------------- */
  const handleFinishGenerate3D = (
    assetId: string,
    success: boolean,
    model?: Sam3DItem
  ) => {
    setGeneratingStatus((prev) => {
      if (!success) {
        return { ...prev, [assetId]: { status: "error" } };
      }
      return {
        ...prev,
        [assetId]: { status: "done", model },
      };
    });

    // 顺便刷新一次远程列表，保持一致
    sam3dListModels()
      .then(setThreeModels)
      .catch((err) => console.warn("refresh list3d error:", err));
  };

  /* ---------------- 飞行动画结束 ---------------- */
  const handleFlyFinish = () => {
    setFlyVisible(false);
    // 动画完回到 Grid
    setSelectedIndex(null);
  };

  /* ---------------- 关闭大图 ---------------- */
  const closeDetail = () => {
    setSelectedIndex(null);
  };

  return (
    <View style={styles.container}>
      {/* ---------- Grid（照片 + 3D + 占位） ---------- */}
      {selectedIndex === null && !show3D && !showAR && (
        <PhotoGrid
          assets={assets}
          loading={loading || loading3d}
          threeModels={threeModels}
          generatingStatus={generatingStatus}
          onPress={(i) => setSelectedIndex(i)}
          onPress3D={(model) => {
            setActive3DModel(model);
            setShow3D(true);
          }}
          onAddPhoto={addPhoto}
          onLoadMore={loadMore}
          onItemLayout={handleItemLayout}
        />
      )}

      {/* ---------- 大图预览 & 打点 ---------- */}
      {selectedIndex !== null && !show3D && !showAR && (
        <PhotoDetail
          assets={assets}
          index={selectedIndex}
          onChangeIndex={setSelectedIndex}
          onClose={closeDetail}
          onStartGenerate3D={handleStartGenerate3D}
          onFinishGenerate3D={handleFinishGenerate3D}
        />
      )}

      {/* ---------- 3D Viewer ---------- */}
      {show3D && active3DModel && (
        <ModelViewer3D
          glb={active3DModel.url}
          onClose={() => {
            setShow3D(false);
            setActive3DModel(null);
          }}
          onOpenAR={() => {
            setShow3D(false);
            setShowAR(true);
          }}
        />
      )}

      {/* ---------- AR Viewer ---------- */}
      {showAR && (
        <ModelViewerAR
          glb={
            active3DModel?.url ??
            "https://miever.s3.ap-east-1.amazonaws.com/static/projects/Sofa_01_4k-1.glb"
          }
          usdz="https://miever.s3.ap-east-1.amazonaws.com/static/projects/3d/model_model_20EDD480-D70D-4AE5-8E9B-2B455BFAA636_L0_001_20251129-022109_b7ffd79b.usdz"
          onClose={() => setShowAR(false)}
        />
      )}

      {/* ---------- 飞行动画层 ---------- */}
      <FlyToGridOverlay
        visible={flyVisible}
        from={flyFrom}
        to={flyTo}
        onFinish={handleFlyFinish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
});