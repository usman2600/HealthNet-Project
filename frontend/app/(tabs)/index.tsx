import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { syncQueue, getQueueCount } from "@/lib/storage";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

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
      show(`${result.synced} record(s) synced successfully.`, "success");
      loadStats();
    } catch {
      show("Sync failed. Check your connection and try again.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);

  const actions = [
    { label: "Add Patient",  icon: "person-add-outline", route: "/patients/register", color: "#16a34a", bg: "#dcfce7" },
    { label: "Patient List", icon: "people-outline",     route: "/(tabs)/patients",   color: "#0891b2", bg: "#e0f2fe" },
    { label: "Scan QR",      icon: "qr-code-outline",    route: "/(tabs)/qr",         color: "#7c3aed", bg: "#ede9fe" },
    { label: "AI Explain",   icon: "sparkles-outline",   route: "/ai",                color: "#d97706", bg: "#fef3c7" },
    { label: "Payments",     icon: "card-outline",       route: "/(tabs)/payments",   color: "#dc2626", bg: "#fee2e2" },
  ];

  const statItems = [
    { label: "Patients", value: stats.patients, icon: "people", color: "#16a34a" },
    { label: "Visits",   value: stats.visits,   icon: "calendar", color: "#0891b2" },
    { label: "Payments", value: stats.payments, icon: "card",   color: "#7c3aed" },
  ];

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatarSmall}>
              <Text style={s.avatarSmallText}>{user?.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
              <Text style={s.role}>{user?.role?.toUpperCase()} · HealthNet</Text>
            </View>
          </View>
          <TouchableOpacity onPress={confirmLogout} style={s.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Offline sync banner */}
        {queueCount > 0 && (
          <TouchableOpacity style={s.syncBanner} onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
            <Ionicons name={syncing ? "sync" : "cloud-upload-outline"} size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.syncTitle}>{syncing ? "Syncing…" : "Offline Records Pending"}</Text>
              {!syncing && <Text style={s.syncSub}>{queueCount} record(s) · Tap to sync now</Text>}
            </View>
            {!syncing && <Ionicons name="chevron-forward" size={16} color="#fff" />}
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {statItems.map((item) => (
            <View key={item.label} style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: item.color + "20" }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={[s.statNum, statsError && s.statNumError]}>
                {statsError ? "—" : item.value}
              </Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {statsError && (
          <TouchableOpacity style={s.retryRow} onPress={loadStats}>
            <Ionicons name="refresh-outline" size={14} color="#6b7280" />
            <Text style={s.retryText}>Could not load stats · Tap to retry</Text>
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
              activeOpacity={0.75}
            >
              <View style={[s.actionIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={24} color={a.color} />
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
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { paddingBottom: 40 },
  header: { backgroundColor: "#16a34a", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarSmall: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  avatarSmallText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  greeting: { fontSize: 18, fontWeight: "700", color: "#fff" },
  role: { fontSize: 11, color: "#bbf7d0", marginTop: 1 },
  logoutBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10 },
  syncBanner: { backgroundColor: "#f59e0b", flexDirection: "row", alignItems: "center", gap: 10, padding: 14, margin: 16, borderRadius: 12 },
  syncTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  syncSub: { color: "#fef3c7", fontSize: 12, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statNum: { fontSize: 24, fontWeight: "800", color: "#111827" },
  statNumError: { color: "#9ca3af" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  retryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 },
  retryText: { fontSize: 12, color: "#6b7280" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
  actionCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center", gap: 10, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", textAlign: "center" },
});
