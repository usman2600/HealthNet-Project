import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { syncQueue, getQueueCount } from "@/lib/storage";
import api from "@/lib/api";

type Stats = { patients: number; visits: number; payments: number };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ patients: 0, visits: 0, payments: 0 });
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadStats();
    getQueueCount().then(setQueueCount);
  }, []);

  const loadStats = async () => {
    try {
      const [p, v] = await Promise.all([
        api.get("/patients?limit=1"),
        api.get("/visits/patient/all").catch(() => ({ data: [] })),
      ]);
      setStats((s) => ({ ...s, patients: p.data.total ?? 0 }));
    } catch {
      // offline — stats unavailable
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncQueue();
      setQueueCount(0);
      Alert.alert("Sync Complete", `${result.synced} record(s) synced successfully.`);
      loadStats();
    } catch {
      Alert.alert("Sync Failed", "Could not sync. Check your connection.");
    } finally {
      setSyncing(false);
    }
  };

  const actions = [
    { label: "Add Patient", icon: "person-add-outline", route: "/patients/register", color: "#16a34a" },
    { label: "Patient List", icon: "people-outline", route: "/(tabs)/patients", color: "#0891b2" },
    { label: "Scan QR", icon: "qr-code-outline", route: "/(tabs)/qr", color: "#7c3aed" },
    { label: "AI Explain", icon: "sparkles-outline", route: "/ai", color: "#d97706" },
    { label: "Payments", icon: "card-outline", route: "/(tabs)/payments", color: "#dc2626" },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={s.role}>{user?.role?.toUpperCase()} · HealthNet</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert("Logout", "Are you sure?", [
          { text: "Cancel" },
          { text: "Logout", style: "destructive", onPress: logout },
        ])}>
          <Ionicons name="log-out-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Offline sync banner */}
      {queueCount > 0 && (
        <TouchableOpacity style={s.syncBanner} onPress={handleSync} disabled={syncing}>
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={s.syncText}>
            {syncing ? "Syncing..." : `${queueCount} offline record(s) pending sync. Tap to sync.`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{stats.patients}</Text>
          <Text style={s.statLabel}>Patients</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNum}>{stats.visits}</Text>
          <Text style={s.statLabel}>Visits</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNum}>{stats.payments}</Text>
          <Text style={s.statLabel}>Payments</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={s.sectionTitle}>Quick Actions</Text>
      <View style={s.actionsGrid}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[s.actionCard, { borderLeftColor: a.color }]}
            onPress={() => router.push(a.route as any)}
          >
            <Ionicons name={a.icon as any} size={28} color={a.color} />
            <Text style={s.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { paddingBottom: 32 },
  header: { backgroundColor: "#16a34a", padding: 24, paddingTop: 56, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff" },
  role: { fontSize: 12, color: "#bbf7d0", marginTop: 2 },
  syncBanner: { backgroundColor: "#f59e0b", flexDirection: "row", alignItems: "center", gap: 8, padding: 12, margin: 16, borderRadius: 10 },
  syncText: { color: "#fff", fontSize: 13, flex: 1 },
  statsRow: { flexDirection: "row", gap: 12, padding: 16 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6 },
  statNum: { fontSize: 28, fontWeight: "800", color: "#16a34a" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", paddingHorizontal: 16, marginBottom: 12 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
  actionCard: { width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 18, alignItems: "center", gap: 10, borderLeftWidth: 4, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6 },
  actionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", textAlign: "center" },
});
