import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";

type Patient = { _id: string; name: string; age: number; gender: string; allergies: string[]; lastModified: string };

const GENDER_COLOR: Record<string, string> = { male: "#0891b2", female: "#db2777", other: "#7c3aed" };

export default function PatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchPatients = useCallback(async (q = "") => {
    setError(false);
    try {
      const { data } = await api.get(`/patients?search=${q}&limit=50`);
      setPatients(data.entry?.map((e: any) => e) ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchPatients(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const renderItem = ({ item }: { item: Patient }) => {
    const gColor = GENDER_COLOR[item.gender] ?? "#6b7280";
    return (
      <TouchableOpacity style={s.card} onPress={() => router.push(`/patients/${item._id}`)} activeOpacity={0.75}>
        <View style={[s.avatar, { backgroundColor: gColor + "20" }]}>
          <Text style={[s.avatarText, { color: gColor }]}>{item.name[0].toUpperCase()}</Text>
        </View>
        <View style={s.info}>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.meta}>{item.age} yrs · <Text style={{ color: gColor, fontWeight: "600" }}>{item.gender}</Text></Text>
          {item.allergies?.length > 0 && (
            <View style={s.allergyRow}>
              <Ionicons name="warning-outline" size={11} color="#dc2626" />
              <Text style={s.allergy}>{item.allergies.join(", ")}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </TouchableOpacity>
    );
  };

  const ListEmpty = () => (
    <View style={s.emptyWrap}>
      {error ? (
        <>
          <Ionicons name="cloud-offline-outline" size={48} color="#d1d5db" />
          <Text style={s.emptyTitle}>Could not load patients</Text>
          <Text style={s.emptySub}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchPatients(search); }}>
            <Ionicons name="refresh-outline" size={16} color="#16a34a" />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Ionicons name="people-outline" size={48} color="#d1d5db" />
          <Text style={s.emptyTitle}>{search ? "No results found" : "No patients yet"}</Text>
          <Text style={s.emptySub}>{search ? `No patients match "${search}"` : "Tap + to register the first patient."}</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" style={s.searchIcon} />
        <TextInput
          style={s.search}
          placeholder="Search by name…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#16a34a" size="large" />
          <Text style={s.loadingText}>Loading patients…</Text>
        </View>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, patients.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPatients(search); }}
              tintColor="#16a34a"
            />
          }
          ListEmptyComponent={<ListEmpty />}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => router.push("/patients/register")} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", margin: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "#e5e7eb", paddingHorizontal: 14, paddingVertical: 2 },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#111827" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "800" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  allergyRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  allergy: { fontSize: 11, color: "#dc2626" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6b7280" },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginTop: 8 },
  emptySub: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, borderWidth: 1, borderColor: "#16a34a", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: "#16a34a", fontWeight: "600", fontSize: 14 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#16a34a", width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#16a34a", shadowOpacity: 0.4, shadowRadius: 8 },
});
