// app/(tabs)/chat.tsx
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";


type Message =
  | {
      id: string;
      from: "me" | "bot";
      type: "text";
      text: string;
      time?: string;
    }
  | {
      id: string;
      from: "me" | "bot";
      type: "model";
      glbUrl: string;
      title?: string;
      subtitle?: string;
      time?: string;
    };

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** 气泡里的小 3D 预览 */
const ModelThumbnail: React.FC<{ glbUrl: string }> = ({ glbUrl }) => {
  const html = useMemo(
    () => `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script type="module"
            src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js">
          </script>
          <style>
            html,body {
              margin:0; padding:0;
              background: transparent;
            }
            model-viewer {
              width: 100%;
              height: 100%;
              background: transparent;
            }
          </style>
        </head>
        <body>
          <model-viewer
            src="${glbUrl}"
            auto-rotate
            camera-controls
            interaction-prompt="none"
            camera-orbit="0deg 70deg auto"
            exposure="1.1"
            shadow-intensity="0.6">
          </model-viewer>
        </body>
      </html>
    `,
    [glbUrl]
  );

  return (
    <WebView
      source={{ html }}
      style={styles.modelThumbWebview}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{ glbUrl?: string | string[] }>();

  // 统一成 string | undefined
  const sharedGlbUrl = useMemo(() => {
    const raw = params.glbUrl;
    if (!raw) return undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.glbUrl]);

  // 初始：只有一些「欢迎语」
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg1",
      from: "bot",
      type: "text",
      text: "Hey! I looked at your 3D model earlier — looks really clean 👀",
      time: nowTime(),
    },
    {
      id: "msg2",
      from: "bot",
      type: "text",
      text: "Feel free to drop your model here. I can help describe it or generate ideas!",
      time: nowTime(),
    },
  ]);

  const [input, setInput] = useState("");

  // 3D viewer 状态（全屏）
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  /** params.glbUrl 变化时，把模型塞进聊天流里 */
  useEffect(() => {
    if (!sharedGlbUrl) return;

    setMessages((prev) => {
      const existed = prev.some(
        (m) => m.type === "model" && "glbUrl" in m && m.glbUrl === sharedGlbUrl
      );
      if (existed) return prev;

      const modelMsg: Message = {
        id: `model-${Date.now()}`,
        from: "me",
        type: "model",
        glbUrl: sharedGlbUrl,
        title: "Shared 3D model",
        subtitle: "Preview · Tap to open",
        time: nowTime(),
      };

      const replyMsg: Message = {
        id: `bot-${Date.now() + 1}`,
        from: "bot",
        type: "text",
        text: "Nice! This model looks great. What do you want to do with it?",
        time: nowTime(),
      };

      return [...prev, modelMsg, replyMsg];
    });
  }, [sharedGlbUrl]);

  const sendText = () => {
    if (!input.trim()) return;

    const msg: Message = {
      id: String(Date.now()),
      from: "me",
      type: "text",
      text: input.trim(),
      time: nowTime(),
    };

    setMessages((prev) => [...prev, msg]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: "bot-" + Date.now(),
          from: "bot",
          type: "text",
          text: "Got it! Tell me if you want this turned into something else.",
          time: nowTime(),
        },
      ]);
    }, 600);
  };

  const openModel = (glbUrl: string) => {
    console.log("[Chat] openModel glbUrl =", glbUrl);
    setViewerUrl(glbUrl);
    setViewerLoading(true);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.from === "me";

    // 文本气泡
    if (item.type === "text") {
      return (
        <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
          {!isMe && <View style={styles.avatar} />}
          <View>
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleMe : styles.bubbleOther,
              ]}
            >
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        </View>
      );
    }

    // 带「小 3D 预览」的模型气泡
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
        {!isMe && <View style={styles.avatar} />}

        <View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openModel(item.glbUrl)}
            style={[
              styles.modelCard,
            ]}
          >
            {/* 小号 3D viewer */}
            <View style={styles.modelThumbWrapper}>
              <ModelThumbnail glbUrl={item.glbUrl} />
            </View>

          </TouchableOpacity>

          <View
            style={[
              styles.timeWrap,
              isMe ? styles.timeWrapMe : styles.timeWrapOther,
            ]}
          >
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
      />

      {/* 输入栏 */}
      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          disabled={!input.trim()}
          onPress={sendText}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* 全屏 3D 预览 */}
      {/* {viewerUrl && (
        <Preview3DModal
          glbUrl={viewerUrl}
          loading={viewerLoading}
          onClose={() => {
            setViewerUrl(null);
            setViewerLoading(false);
          }}
          onLoaded={() => setViewerLoading(false)}
        />
      )} */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050507", paddingTop: 48 },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },

  row: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  rowMe: {
    justifyContent: "flex-end",
  },
  rowOther: {
    justifyContent: "flex-start",
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#555",
    marginRight: 8,
  },

  bubble: {
    maxWidth: "76%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMe: {
    backgroundColor: "#2f8cff",
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: "#1f1f23",
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
  },

  timeText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginTop: 2,
    marginLeft: 4,
  },
  timeWrap: {},
  timeWrapMe: { marginLeft: 8 },
  timeWrapOther: { marginLeft: 40 },

  // 3D 模型卡片
  modelCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    maxWidth: "76%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  modelCardMe: {
    backgroundColor: "#255bff",
    borderBottomRightRadius: 6,
  },
  modelCardOther: {
    backgroundColor: "#1f1f23",
    borderBottomLeftRadius: 6,
  },

  // 小 3D 预览容器
  modelThumbWrapper: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.45)",
    marginRight: 12,
  },
  modelThumbWebview: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },

  modelTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  modelSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    marginTop: 1,
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#050507",
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "#fff",
    fontSize: 14,
  },
  sendBtn: {
    marginLeft: 8,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#2f8cff",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(47,140,255,0.4)",
  },
  sendText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});