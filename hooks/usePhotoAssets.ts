// hooks/usePhotoAssets.ts
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useState } from "react";

export type MyAsset = {
  id: string;
  uri: string;
};

export default function usePhotoAssets(limit: number = 20) {
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  /**
   * 转换 asset → MyAsset
   */
  const mapAssets = useCallback(async (items: MediaLibrary.Asset[]) => {
    return Promise.all(
      items.map(async (a) => {
        const info = await MediaLibrary.getAssetInfoAsync(a);
        return {
          id: a.id,
          uri: info.localUri ?? a.uri,
        };
      })
    );
  }, []);

  /**
   * 初次加载 / 刷新
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setAssets([]);
        setHasMore(false);
        return;
      }

      const res = await MediaLibrary.getAssetsAsync({
        first: limit,
        mediaType: ["photo"],
        sortBy: [["creationTime", false]],
      });

      const mapped = await mapAssets(res.assets);

      setAssets(mapped);
      setCursor(res.endCursor ?? null);
      setHasMore(res.hasNextPage);
    } finally {
      setLoading(false);
    }
  }, [limit, mapAssets]);

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) return;

    setLoading(true);
    try {
      const res = await MediaLibrary.getAssetsAsync({
        first: limit,
        after: cursor,
        mediaType: ["photo"],
        sortBy: [["creationTime", false]],
      });

      const mapped = await mapAssets(res.assets);

      setAssets((prev) => [...prev, ...mapped]);
      setCursor(res.endCursor ?? null);
      setHasMore(res.hasNextPage);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, limit, mapAssets]);

  /**
   * 添加照片
   */
  const addPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets[0];

    const newAsset = await MediaLibrary.createAssetAsync(picked.uri);
    const info = await MediaLibrary.getAssetInfoAsync(newAsset);

    const item: MyAsset = {
      id: newAsset.id,
      uri: info.localUri ?? newAsset.uri,
    };

    // 直接加到顶部
    setAssets((prev) => [item, ...prev]);
  }, []);

  /**
   * 删除照片
   */
  const deleteAsset = useCallback(async (id: string) => {
    try {
      // 删系统相册里的资源
      await MediaLibrary.deleteAssetsAsync([id]);
    } catch (e) {
      console.warn("delete asset error:", e);
    } finally {
      // 无论系统是否成功，先把 UI 删掉
      setAssets((prev) => prev.filter((a) => a.id !== id));
    }
  }, []);

  // 初始化载入
  useEffect(() => {
    load();
  }, [load]);

  return {
    assets,
    loading,
    loadMore,
    addPhoto,
    deleteAsset, // ✅ 暴露删除方法
    reload: load,
    hasMore,
  };
}