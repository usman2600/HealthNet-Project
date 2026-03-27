import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { C } from "@/constants/theme";

type Patient = { _id: string; name: string; age: number; gender: string; allergies: string[]; lastModified: string };

const GENDER_COLOR: Record<string, string> = { male: C.blue, female: C.pink, other: C.purple };

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
    const gc = GENDER_COLOR[item.gender] ?? C.textSub;
    return (
      <TouchableOpacity style={s.card} onPress={() => router.push(`/patients/${item._id}`)} activeOpacity={0.7}>
        <View style={[s.avatar, { backgroundColor: gc + "18" }]}>
          <Text style={[s.avatarText, { color: gc }]}>{item.name[0].toUpperCase()}</Text>
        </View>
        <View style={s.info}>
          <Text style={s.name}>{item.name}</Text>
          <Text style={s.meta}>{item.age} yrs · {item.gender}</Text>
          {item.allergies?.length > 0 && (
            <View style={s.allergyRow}>
              <Ionicons name="warning-outline" size={11} color={C.error} />
              <Text style={s.allergy}>{item.allergies.join(", ")}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.borderMid} />
      </TouchableOpacity>
    );
  };

  const ListEmpty = () => (
    <View style={s.emptyWrap}>
      {error ? (
        <>
          <Ionicons name="cloud-offline-outline" size={44} color={C.borderMid} />
          <Text style={s.emptyTitle}>Could not load patients</Text>
          <Text style={s.emptySub}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchPatients(search); }}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Ionicons name="people-outline" size={44} color={C.borderMid} />
          <Text style={s.emptyTitle}>{search ? "No results" : "No patients yet"}</Text>
          <Text style={s.emptySub}>{search ? `No match for "${search}"` : "Tap + to register the first patient."}</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={17} color={C.textMuted} />
        <TextInput
          style={s.search}
          placeholder="Search patients…"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={17} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.primary} size="large" />
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
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={<ListEmpty />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => router.push("/patients/register")} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, margin: 16, borderRadius: C.radius,
    borderWidth: 1, borderColor: C.borderMid,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  search: { flex: 1, fontSize: 15, color: C.text },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: C.surface, borderRadius: C.radius,
    padding: 14, flexDirection: "row", alignItems: "center",
    marginBottom: 8, ...C.shadow,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 17, fontWeight: "800" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: C.text },
  meta: { fontSize: 13, color: C.textSub, marginTop: 1 },
  allergyRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  allergy: { fontSize: 11, color: C.error },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginTop: 8 },
  emptySub: { fontSize: 13, color: C.textMuted, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: { marginTop: 8, borderWidth: 1, borderColor: C.primary, borderRadius: C.radiusSm, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { color: C.primary, fontWeight: "600", fontSize: 14 },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    backgroundColor: C.primary, width: 54, height: 54, borderRadius: 27,
    justifyContent: "center", alignItems: "center",
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
});
