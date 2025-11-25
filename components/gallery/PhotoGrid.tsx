import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import type { MyAsset } from "../../hooks/usePhotoAssets";

const { width } = Dimensions.get("window");
const SIZE = width / 3 - 4;

type Props = {
  assets: MyAsset[];
  loading: boolean;
  onPress: (index: number) => void;
  onAddPhoto: () => void;
  onLoadMore: () => void;
};

export default function PhotoGrid({
  assets,
  loading,
  onPress,
  onAddPhoto,
  onLoadMore,
}: Props) {
  const renderItem = ({ item, index }: { item: MyAsset; index: number }) => (
    <TouchableOpacity style={styles.item} onPress={() => onPress(index)}>
      <Image source={{ uri: item.uri }} style={styles.image} />
    </TouchableOpacity>
  );

  if (loading && assets.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.centerText}>加载相册中...</Text>
      </View>
    );
  }

  if (!loading && assets.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>相册里暂时没有照片</Text>
        <Text style={[styles.centerText, { marginTop: 6 }]}>
          点右下角「＋」添加一张试试
        </Text>

        <TouchableOpacity
          style={[styles.fab, { position: "relative", top: 40 }]}
          onPress={onAddPhoto}
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={assets}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
      />

      {/* 添加按钮 */}
      <TouchableOpacity style={styles.fab} onPress={onAddPhoto}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 2,
  },
  item: {
    width: SIZE,
    height: SIZE,
    margin: 2,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  center: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  centerText: {
    color: "#fff",
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e90ff",
  },
  fabText: {
    color: "#fff",
    fontSize: 30,
    marginTop: -2,
  },
});