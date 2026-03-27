import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { C } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 17, color: C.text },
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HealthNet",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: "Patients",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          title: "QR",
          tabBarIcon: ({ color }) => (
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: C.primary,
              justifyContent: "center", alignItems: "center",
              marginBottom: 4,
              shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
            }}>
              <Ionicons name="qr-code" size={22} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
