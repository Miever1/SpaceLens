// app/(tabs)/index.tsx
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import PhotoDetail from "../../components/gallery/PhotoDetail";
import PhotoGrid from "../../components/gallery/PhotoGrid";
import PopupMenu from "../../components/gallery/PopupMenu";
import ModelViewer3D from "../../components/three/ModelViewer3D";
import ModelViewerAR from "../../components/three/ModelViewerAR";

import usePhotoAssets, { MyAsset } from "../../hooks/usePhotoAssets";
import useTouchEffect from "../../hooks/useTouchEffect";

export default function AlbumTab() {
  const { assets, loading, loadMore, addPhoto, deleteAsset } = usePhotoAssets();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupAsset, setPopupAsset] = useState<MyAsset | null>(null);

  const [show3D, setShow3D] = useState(false);
  const [showAR, setShowAR] = useState(false);

  const { renderTouchEffects, triggerTouchEffect } = useTouchEffect();

  const handleLongPress = (x: number, y: number, asset: MyAsset) => {
    triggerTouchEffect(x, y);
    setPopupAsset(asset);
    setPopupVisible(true);
  };

  const closeDetail = () => {
    setSelectedIndex(null);
    setShow3D(false);
    setShowAR(false);
    setPopupVisible(false);
    setPopupAsset(null);
  };

  return (
    <View style={styles.container}>
      {/* 网格模式 */}
      {selectedIndex === null && !show3D && !showAR && (
        <PhotoGrid
          assets={assets}
          loading={loading}
          onAddPhoto={addPhoto}
          onPress={(i) => setSelectedIndex(i)}
          onLoadMore={loadMore}
        />
      )}

      {/* 大图预览 */}
      {selectedIndex !== null && !show3D && !showAR && (
        <PhotoDetail
          assets={assets}
          index={selectedIndex}
          onChangeIndex={setSelectedIndex}
          onClose={closeDetail}
          onLongPress={handleLongPress}
        />
      )}

      {/* Touch 爆裂特效（全局覆盖） */}
      {renderTouchEffects()}

      {/* Popup 操作菜单 */}
      {popupVisible && popupAsset && (
        <PopupMenu
          asset={popupAsset}
          onClose={() => setPopupVisible(false)}
          onOpen3D={() => {
            setPopupVisible(false);
            setShow3D(true);
          }}
          onOpenAR={() => {
            setPopupVisible(false);
            setShowAR(true);
          }}
          onDelete={async () => {
            await deleteAsset(popupAsset.id);
            setPopupVisible(false);
            setPopupAsset(null);
            setSelectedIndex(null);
            setShow3D(false);
            setShowAR(false);
          }}
        />
      )}

      {/* 3D Viewer */}
      {show3D && (
        <ModelViewer3D
          glb="https://miever.s3.ap-east-1.amazonaws.com/static/projects/Sofa_01_4k-1.glb"
          usdz="https://miever.s3.ap-east-1.amazonaws.com/static/projects/Sofa_01_4k-1.usdz"
          onClose={() => setShow3D(false)}
          onOpenAR={() => {
            // 从 3D 页面一键跳到 AR
            setShow3D(false);
            setShowAR(true);
          }}
        />
      )}

      {/* AR Viewer */}
      {showAR && (
        <ModelViewerAR
          glb="https://miever.s3.ap-east-1.amazonaws.com/static/projects/Sofa_01_4k-1.glb"
          usdz="https://miever.s3.ap-east-1.amazonaws.com/static/projects/Sofa_01_4k-1.usdz"
          onClose={() => setShowAR(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});