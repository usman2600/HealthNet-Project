import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { syncQueue, getQueueCount } from "@/lib/storage";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { C } from "@/constants/theme";

type Stats = { patients: number; visits: number; payments: number };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [stats, setStats] = useState<Stats>({ patients: 0, visits: 0, payments: 0 });
  const [statsError, setStatsError] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadStats();
    getQueueCount().then(setQueueCount);
  }, []);

  const loadStats = async () => {
    setStatsError(false);
    try {
      const { data } = await api.get("/patients?limit=1");
      setStats((s) => ({ ...s, patients: data.total ?? 0 }));
    } catch {
      setStatsError(true);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncQueue();
      setQueueCount(0);
      show(`${result.synced} record(s) synced.`, "success");
      loadStats();
    } catch {
      show("Sync failed. Check your connection.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);

  const actions = [
    { label: "Add Patient",  icon: "person-add-outline",  route: "/patients/register", color: C.primary,  bg: C.primaryLight },
    { label: "Patients",     icon: "people-outline",      route: "/(tabs)/patients",   color: C.blue,     bg: C.blueLight },
    { label: "Scan QR",      icon: "scan-outline",        route: "/(tabs)/qr",         color: C.purple,   bg: C.purpleLight },
    { label: "AI Explain",   icon: "sparkles-outline",    route: "/ai",                color: "#d97706",  bg: "#fef3c7" },
    { label: "Payments",     icon: "card-outline",        route: "/(tabs)/payments",   color: C.pink,     bg: "#fce7f3" },
  ];

  const statItems = [
    { label: "Patients", value: stats.patients, icon: "people",    color: C.primary },
    { label: "Visits",   value: stats.visits,   icon: "calendar",  color: C.blue },
    { label: "Payments", value: stats.payments, icon: "card",      color: C.purple },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
            <Text style={s.role}>{user?.role === "chw" ? "Community Health Worker" : user?.role}</Text>
          </View>
          <TouchableOpacity onPress={confirmLogout} style={s.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={C.textSub} />
          </TouchableOpacity>
        </View>

        {/* Sync Banner */}
        {queueCount > 0 && (
          <TouchableOpacity style={s.syncBanner} onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
            <View style={s.syncDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.syncTitle}>{syncing ? "Syncing…" : `${queueCount} offline record(s) pending`}</Text>
              {!syncing && <Text style={s.syncSub}>Tap to sync now</Text>}
            </View>
            {!syncing && <Ionicons name="cloud-upload-outline" size={18} color={C.warning} />}
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {statItems.map((item) => (
            <View key={item.label} style={s.statCard}>
              <Text style={[s.statNum, statsError && { color: C.textMuted }]}>
                {statsError ? "—" : item.value}
              </Text>
              <Text style={s.statLabel}>{item.label}</Text>
              <View style={[s.statBar, { backgroundColor: item.color }]} />
            </View>
          ))}
        </View>
        {statsError && (
          <TouchableOpacity style={s.retryRow} onPress={loadStats}>
            <Ionicons name="refresh-outline" size={13} color={C.textMuted} />
            <Text style={s.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={s.actionCard}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.7}
            >
              <View style={[s.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: C.text },
  role: { fontSize: 12, color: C.textSub, marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: C.border, borderRadius: C.radiusSm },
  syncBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: C.warningLight, borderRadius: C.radius,
    borderWidth: 1, borderColor: "#fde68a",
    padding: 14,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.warning },
  syncTitle: { fontSize: 13, fontWeight: "600", color: "#92400e" },
  syncSub: { fontSize: 12, color: "#a16207", marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: C.radius,
    padding: 16, overflow: "hidden",
    ...C.shadow,
  },
  statNum: { fontSize: 26, fontWeight: "800", color: C.text },
  statLabel: { fontSize: 11, color: C.textSub, marginTop: 2 },
  statBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 },
  retryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 8 },
  retryText: { fontSize: 12, color: C.textMuted },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: C.textSub, paddingHorizontal: 20, marginTop: 24, marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20 },
  actionCard: {
    width: "47%", backgroundColor: C.surface, borderRadius: C.radius,
    padding: 18, alignItems: "center", gap: 10,
    ...C.shadow,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 13, fontWeight: "600", color: C.text, textAlign: "center" },
});
