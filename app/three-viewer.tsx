// app/three-viewer.tsx
import ModelViewer3D from "@/components/three/ModelViewer3D";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

export default function ThreeViewerRoute() {
  const router = useRouter();
  const { glb, usdz } = useLocalSearchParams<{ glb: string; usdz?: string }>();

  const handleShareToChat = (glbUrl: string) => {
    router.push({
      pathname: "/chat",         // ⭐ 你的聊天页路由，比如 app/chat/index.tsx
      params: { glb: glbUrl },   // 带上当前 3D 模型的 url
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ModelViewer3D
        glb={glb}
        usdz={usdz}
        onClose={router.back}
        onOpenAR={() => {
          // TODO: 打开 AR viewer
        }}
        onShareToChat={handleShareToChat} // ⭐ 传给刚才加的回调
      />
    </>
  );
}