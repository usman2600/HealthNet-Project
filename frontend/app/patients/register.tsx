import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { enqueue } from "@/lib/storage";

export default function RegisterPatient() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", age: "", gender: "male", phone: "", address: "", allergies: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name || !form.age || !form.gender)
      return Alert.alert("Error", "Name, age and gender are required");

    const payload = {
      name: form.name.trim(),
      age: parseInt(form.age),
      gender: form.gender,
      phone: form.phone.trim(),
      address: form.address.trim(),
      allergies: form.allergies ? form.allergies.split(",").map((a) => a.trim()).filter(Boolean) : [],
      lastModified: new Date().toISOString(),
      localId: `local_${Date.now()}`,
    };

    setLoading(true);
    try {
      await api.post("/patients", payload);
      Alert.alert("Success", "Patient registered successfully", [{ text: "OK", onPress: () => router.back() }]);
    } catch {
      // Offline — queue for later sync
      await enqueue({ type: "patient", data: payload, localId: payload.localId });
      Alert.alert("Saved Offline", "Patient saved locally and will sync when connected.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const genderOptions = ["male", "female", "other"];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>Full Name *</Text>
      <TextInput style={s.input} placeholder="e.g. Amina Bello" placeholderTextColor="#9ca3af" value={form.name} onChangeText={set("name")} />

      <Text style={s.label}>Age *</Text>
      <TextInput style={s.input} placeholder="e.g. 34" placeholderTextColor="#9ca3af" keyboardType="numeric" value={form.age} onChangeText={set("age")} />

      <Text style={s.label}>Gender *</Text>
      <View style={s.genderRow}>
        {genderOptions.map((g) => (
          <TouchableOpacity
            key={g}
            style={[s.genderBtn, form.gender === g && s.genderBtnActive]}
            onPress={() => set("gender")(g)}
          >
            <Text style={[s.genderText, form.gender === g && s.genderTextActive]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Phone Number</Text>
      <TextInput style={s.input} placeholder="e.g. 08012345678" placeholderTextColor="#9ca3af" keyboardType="phone-pad" value={form.phone} onChangeText={set("phone")} />

      <Text style={s.label}>Address</Text>
      <TextInput style={s.input} placeholder="Village / Town" placeholderTextColor="#9ca3af" value={form.address} onChangeText={set("address")} />

      <Text style={s.label}>Known Allergies</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Penicillin, Peanuts (comma-separated)"
        placeholderTextColor="#9ca3af"
        value={form.allergies}
        onChangeText={set("allergies")}
      />

      <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <><Ionicons name="person-add-outline" size={18} color="#fff" /><Text style={s.btnText}> Register Patient</Text></>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: "#d1fae5", borderRadius: 10, padding: 13, fontSize: 15, color: "#111827", backgroundColor: "#fff" },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtn: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12, alignItems: "center" },
  genderBtnActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  genderText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  genderTextActive: { color: "#fff" },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 28 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
