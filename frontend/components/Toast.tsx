import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
}

const CONFIG: Record<ToastType, { bg: string; icon: string; color: string }> = {
  success: { bg: "#dcfce7", icon: "checkmark-circle", color: "#16a34a" },
  error:   { bg: "#fef2f2", icon: "alert-circle",     color: "#dc2626" },
  warning: { bg: "#fffbeb", icon: "warning",           color: "#d97706" },
  info:    { bg: "#eff6ff", icon: "information-circle",color: "#2563eb" },
};

export default function Toast({ message, type = "info", onHide, duration = 3500 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const { bg, icon, color } = CONFIG[type];

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(duration - 500),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onHide);
  }, []);

  return (
    <Animated.View style={[s.container, { backgroundColor: bg, opacity }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[s.text, { color }]}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: "absolute", top: 56, left: 16, right: 16, zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "600" },
});
