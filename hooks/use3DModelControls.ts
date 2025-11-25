// hooks/use3DModelControls.ts
import { useCallback, useRef, useState } from "react";
import { Animated } from "react-native";
import { WebView } from "react-native-webview";

export default function use3DModelControls() {
  const webviewRef = useRef<WebView>(null);

  const changeColor = useCallback((name: string) => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(`
      window.changeSofaColor("${name}");
      true;
    `);
  }, []);

  const [loading, setLoading] = useState(true);

  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.3)).current;

  const startLoadAnim = useCallback(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return {
    webviewRef,
    loading,
    setLoading,
    changeColor,
    rotate,
    pulse,
    startLoadAnim,
  };
}