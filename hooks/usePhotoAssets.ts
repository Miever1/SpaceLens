// hooks/usePhotoAssets.ts
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

export type MyAsset = {
  id: string;
  uri: string;
  width: number;
  height: number;
  usdz?: string;
};

export default function usePhotoAssets(limit: number = 20) {
  const [assets, setAssets] = useState<MyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const normalizeAsset = useCallback(
    async (a: MediaLibrary.Asset): Promise<MyAsset> => {
      let uri = a.uri;

      if (Platform.OS === "ios" && uri.startsWith("ph://")) {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(a);
          if (info.localUri) {
            uri = info.localUri;
          }
        } catch (e) {
          console.warn("[usePhotoAssets] getAssetInfoAsync error:", e);
        }
      }

      return {
        id: a.id,
        uri,
        width: a.width ?? 0,
        height: a.height ?? 0,
      };
    },
    []
  );

  const mapAssets = useCallback(
    async (items: MediaLibrary.Asset[]) => {
      const mapped = await Promise.all(items.map(normalizeAsset));
      if (mapped[0]) {
        console.log("[usePhotoAssets] first mapped uri =", mapped[0].uri);
      }
      return mapped;
    },
    [normalizeAsset]
  );

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

  const addPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets[0];

    let uri = picked.uri;

    if (Platform.OS === "ios") {
      try {
        if (picked.assetId) {
          const info = await MediaLibrary.getAssetInfoAsync(picked.assetId);
          if (info.localUri) {
            uri = info.localUri;
          }
        }
      } catch (e) {
        console.warn("[usePhotoAssets] addPhoto getAssetInfoAsync error:", e);
      }
    }

    const newAsset: MyAsset = {
      id: picked.assetId ?? uri,
      uri,
      width: picked.width ?? 0,
      height: picked.height ?? 0,
    };

    console.log("[usePhotoAssets] addPhoto uri =", newAsset.uri);

    setAssets((prev) => [newAsset, ...prev]);
  }, []);

  const deleteAsset = useCallback(async (id: string) => {
    try {
      await MediaLibrary.deleteAssetsAsync([id]);
    } catch (e) {
      console.warn("delete asset error:", e);
    } finally {
      setAssets((prev) => prev.filter((a) => a.id !== id));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    assets,
    loading,
    loadMore,
    addPhoto,
    deleteAsset,
    reload: load,
    hasMore,
  };
}