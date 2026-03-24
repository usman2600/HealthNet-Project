import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";

type Patient = { _id: string; name: string; age: number; gender: string; allergies: string[]; lastModified: string };

export default function PatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatients = useCallback(async (q = "") => {
    try {
      const { data } = await api.get(`/patients?search=${q}&limit=50`);
      setPatients(data.entry?.map((e: any) => e) ?? []);
    } catch {
      // offline — show cached or empty
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

  const renderItem = ({ item }: { item: Patient }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/patients/${item._id}`)}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{item.name[0].toUpperCase()}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.name}>{item.name}</Text>
        <Text style={s.meta}>{item.age} yrs · {item.gender}</Text>
        {item.allergies?.length > 0 && (
          <Text style={s.allergy}>⚠️ {item.allergies.join(", ")}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" style={s.searchIcon} />
        <TextInput
          style={s.search}
          placeholder="Search patients..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#16a34a" size="large" />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPatients(search); }} tintColor="#16a34a" />}
          ListEmptyComponent={<Text style={s.empty}>No patients found.</Text>}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => router.push("/patients/register")}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", margin: 16, borderRadius: 12, borderWidth: 1, borderColor: "#d1fae5", paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: "#111827" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#16a34a" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  allergy: { fontSize: 12, color: "#dc2626", marginTop: 2 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 60, fontSize: 15 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#16a34a", width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 6 },
});
