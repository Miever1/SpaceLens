import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ⭐ 小 3D 预览
import MiniModelViewer from "../three/MiniModelViewer";

type Sender = "me" | "friend";

type ChatMessage = {
  id: string;
  type: "text" | "3d";
  text?: string;
  glb?: string;
  from: Sender;
};

const PARTICIPANTS: Record<
  Sender,
  { name: string; avatar: string }
> = {
  me: {
    name: "You",
    avatar: "https://i.pravatar.cc/120?img=11",
  },
  friend: {
    name: "Alex",
    avatar: "https://i.pravatar.cc/120?img=32",
  },
};

export default function ChatScreen({
  initialGlb,
}: {
  initialGlb?: string;  
}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ glb?: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "text",
      from: "friend",
      text: "Hey, did you finish that 3D sticker of your iPad?",
    },
    {
      id: "2",
      type: "text",
      from: "me",
      text: "Almost! I'm testing it in the 3D viewer right now.",
    },
    {
      id: "3",
      type: "text",
      from: "friend",
      text: "Nice. Send it here when it's ready – I want to see it in chat.",
    },
  ]);

  const [input, setInput] = useState("");

  const listRef = useRef<FlatList<ChatMessage>>(null);

  /** ⭐ 进场放大用的状态 & 动画值 */
  const [showIntroPreview, setShowIntroPreview] = useState(false);
  const introScale = useRef(new Animated.Value(0.5)).current;     // ⬅ 更小一点起步
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslateY = useRef(new Animated.Value(80)).current;  // ⬅ 从更下面飞上来
  const introBgOpacity = useRef(new Animated.Value(0)).current;

  /** 带着 glb 进来时，自动加一条 3D 消息 */
  useEffect(() => {
    if (initialGlb) {
      add3DMessage(initialGlb);
    }
  }, [initialGlb]);

  /** 每次 messages 更新后滚到底部 */
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToEnd?.({ animated: true });
  }, [messages]);

  /** ⭐ 有 glb 时做一个“放大预览”的进场动画 */
  useEffect(() => {
    if (!initialGlb) return;

    setShowIntroPreview(true);

    // 初始状态
    introScale.setValue(0.5);
    introOpacity.setValue(0);
    introTranslateY.setValue(80);
    introBgOpacity.setValue(0);

    // 进场：更强烈一点的冲击 + 弹回
    Animated.parallel([
      // 背景模糊淡入
      Animated.timing(introBgOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      // 整个浮层透明度
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      // 冲到比 1 大一点，制造“砰”一下的感觉
      Animated.spring(introScale, {
        toValue: 1.05,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      // 从下往上飞一点
      Animated.spring(introTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 再轻轻回到 scale = 1
      Animated.spring(introScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    });

    // 若不手动点背景，3 秒后自动淡出
    const timer = setTimeout(() => {
      hideIntro();
    }, 3000);

    return () => clearTimeout(timer);
  }, [initialGlb]);

  const hideIntro = () => {
    // 退场：同时缩小 + 下滑 + 淡出
    Animated.parallel([
      Animated.timing(introBgOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(introScale, {
        toValue: 0.8,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(introTranslateY, {
        toValue: 40,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowIntroPreview(false);
    });
  };

  const add3DMessage = (glb: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      type: "3d",
      glb,
      from: "me",
    };
    setMessages((prev) => [...prev, msg]);

    // 简单模拟 Alex 的回复
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "text",
          from: "friend",
          text: "Whoa, that looks awesome in 3D 😍",
        },
      ]);
    }, 3500);
  };

  const sendText = () => {
    if (!input.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      type: "text",
      text: input.trim(),
      from: "me",
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");
  };

  const renderAvatar = (from: Sender) => {
    const { avatar } = PARTICIPANTS[from];
    return <Image source={{ uri: avatar }} style={styles.avatar} />;
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.from === "me";

    return (
      <View
        style={[
          styles.msgRow,
          isMe ? styles.rowRight : styles.rowLeft,
        ]}
      >
        {!isMe && renderAvatar(item.from)}

        <View
          style={[
            styles.msgContent,
            isMe ? styles.msgContentRight : styles.msgContentLeft,
          ]}
        >
          {item.type === "3d" ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: "/three-viewer",
                  params: { glb: item.glb },
                })
              }
            >
              {/* ⭐ 3D 气泡：外层只负责圆角和背景，尺寸交给 MiniModelViewer */}
              <View style={[styles.bubble, styles.modelBubble]}>
                <MiniModelViewer glb={item.glb} />
              </View>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.bubble,
                isMe ? "" : styles.botBubble,
              ]}
            >
              <Text style={styles.text}>{item.text}</Text>
            </View>
          )}
        </View>

        {isMe && renderAvatar(item.from)}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f4f4f8" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={56} // 顶部 header 高度
      >
        <View style={styles.container}>
          {/* 顶部：返回 + 对方头像 + 名字 + 状态 */}
          <View className="header" style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Image
                source={{ uri: PARTICIPANTS.friend.avatar }}
                style={styles.headerAvatar}
              />
              <View>
                <Text style={styles.headerName}>
                  {PARTICIPANTS.friend.name}
                </Text>
                <Text style={styles.headerStatus}>
                  Online · 3D stickers
                </Text>
              </View>
            </View>

            <View style={styles.headerRight} />
          </View>

          {/* 聊天列表 */}
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          />

          {/* 输入栏 */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message…"
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={sendText}
              activeOpacity={0.8}
            >
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>

          {/* ⭐ 进场放大的 3D 预览浮层（带模糊背景 + 强一点的动画） */}
          {showIntroPreview && initialGlb && (
            <Animated.View
              style={[
                styles.introOverlay,
                { opacity: introOpacity },
              ]}
            >
              {/* 背景模糊层 + 点击关闭 */}
              <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFillObject}
                onPress={hideIntro}
              >
                <Animated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    { opacity: introBgOpacity },
                  ]}
                >
                  <BlurView
                    intensity={40}
                    tint="dark"
                    style={StyleSheet.absoluteFillObject}
                  />
                </Animated.View>
              </TouchableOpacity>

              {/* 中间的大 3D 模型 */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.introCard,
                  {
                    transform: [
                      { scale: introScale },
                      { translateY: introTranslateY },
                    ],
                  },
                ]}
              >
                <MiniModelViewer glb={initialGlb} full />
              </Animated.View>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 34;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f8" },

  /* bubble 通用样式 */
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: "90%", // 让气泡能更宽一点
  },
  botBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    marginLeft: 8,
    borderColor: "#ddd",
  },

  // ⭐ 专门给 3D 用的气泡：去掉内边距，让 MiniModelViewer 填满
  modelBubble: {
    padding: 0,
    overflow: "hidden",
    width: 260,
    maxWidth: "90%",
  },

  modelCaption: {
    marginTop: 6,
    fontSize: 12,
    color: "#0055aa",
  },

  /* header */
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 22,
    color: "#111",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  headerStatus: {
    fontSize: 11,
    color: "rgba(0,0,0,0.5)",
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },

  /* messages */
  msgRow: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-end",
  },
  rowLeft: {
    justifyContent: "flex-start",
  },
  rowRight: {
    justifyContent: "flex-end",
  },

  msgContent: {
    maxWidth: "100%",
  },
  msgContentLeft: {
    marginLeft: 0,
    marginRight: 0,
    alignItems: "flex-start",
  },
  msgContentRight: {
    marginRight: 4,
    marginLeft: 0,
    alignItems: "flex-end",
  },

  name: {
    fontSize: 11,
    color: "rgba(0,0,0,0.45)",
    marginBottom: 3,
  },
  nameLeft: { textAlign: "left" },
  nameRight: { textAlign: "right" },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE / 2 * 2,
    borderRadius: AVATAR_SIZE / 2,
  },

  text: {
    fontSize: 15,
    color: "#333",
    lineHeight: 20,
  },

  /* input */
  inputBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f1f3",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#333",
    maxHeight: 90,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#007bff",
    borderRadius: 18,
    paddingHorizontal: 16,
    justifyContent: "center",
    minHeight: 36,
  },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  /* ⭐ 进场放大浮层样式 */
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },

  introBackdrop: {},

  // 中间大 3D 区域：全屏+内边距让模型有呼吸感
  introCard: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 24,
    paddingVertical: 80,
    justifyContent: "center",
    alignItems: "center",
  },

  introHint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
  },
});