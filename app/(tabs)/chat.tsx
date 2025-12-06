import { Stack, useLocalSearchParams } from "expo-router";
import ChatScreen from "../../components/chat/ChatScreen";

export default function ChatRoute() {
  const { glb } = useLocalSearchParams<{ glb?: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatScreen initialGlb={glb} />
    </>
  );
}
