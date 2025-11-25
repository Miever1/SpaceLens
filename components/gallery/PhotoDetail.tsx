import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import type { MyAsset } from "../../hooks/usePhotoAssets";

const { width, height } = Dimensions.get("window");

export type PhotoDetailProps = {
  assets: MyAsset[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
  onLongPress: (x: number, y: number, asset: MyAsset) => void;
};

export default function PhotoDetail({
  assets,
  index,
  onChangeIndex,
  onClose,
  onLongPress,
}: PhotoDetailProps) {
  const scrollX = useRef(new Animated.Value(index * width)).current;

  return (
    <View style={styles.container}>
      {/* 返回按钮 */}
      <TouchableOpacity style={styles.backBtn} onPress={onClose}>
        <Text style={styles.backText}>〈 返回</Text>
      </TouchableOpacity>

      {/* 索引提示 */}
      <View style={styles.counterWrapper}>
        <Text style={styles.counterText}>
          {index + 1} / {assets.length}
        </Text>
      </View>

      <Animated.FlatList
        data={assets}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={index}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          onChangeIndex(newIndex);
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Pressable
            style={styles.itemWrapper}
            onLongPress={(e) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const { pageX, pageY } = e.nativeEvent;
              onLongPress(pageX, pageY, item);
            }}
          >
            <Image
              source={{ uri: item.uri }}
              style={styles.image}
              resizeMode="contain"
            />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  itemWrapper: {
    width,
    height,
    justifyContent: "center",
    alignItems: "center",
  },

  image: { width, height },

  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  backText: {
    color: "#fff",
    fontSize: 16,
  },

  counterWrapper: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  counterText: {
    color: "#fff",
    fontSize: 14,
  },
});