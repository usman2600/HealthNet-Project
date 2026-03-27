import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { enqueue } from "@/lib/storage";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPatient() {
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [form, setForm] = useState({ name: "", age: "", gender: "male", phone: "", address: "", allergies: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.age.trim()) e.age = "Age is required";
    else if (isNaN(parseInt(form.age)) || parseInt(form.age) <= 0 || parseInt(form.age) > 120) e.age = "Enter a valid age (1–120)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
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
      show("Patient registered successfully!", "success");
      setTimeout(() => router.back(), 1500);
    } catch {
      await enqueue({ type: "patient", data: payload, localId: payload.localId });
      show("No connection — patient saved offline and will sync later.", "warning");
      setTimeout(() => router.back(), 2000);
    } finally {
      setLoading(false);
    }
  };

  const genderOptions = [
    { value: "male",   label: "Male",   icon: "male-outline" },
    { value: "female", label: "Female", icon: "female-outline" },
    { value: "other",  label: "Other",  icon: "person-outline" },
  ];

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <View style={s.field}>
          <Text style={s.label}>Full Name <Text style={s.required}>*</Text></Text>
          <TextInput
            style={[s.input, errors.name ? s.inputError : null]}
            placeholder="e.g. Amina Bello"
            placeholderTextColor="#9ca3af"
            value={form.name}
            onChangeText={set("name")}
          />
          {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Age <Text style={s.required}>*</Text></Text>
          <TextInput
            style={[s.input, errors.age ? s.inputError : null]}
            placeholder="e.g. 34"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={form.age}
            onChangeText={set("age")}
          />
          {errors.age ? <Text style={s.errorText}>{errors.age}</Text> : null}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Gender <Text style={s.required}>*</Text></Text>
          <View style={s.genderRow}>
            {genderOptions.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[s.genderBtn, form.gender === g.value && s.genderBtnActive]}
                onPress={() => set("gender")(g.value)}
              >
                <Ionicons name={g.icon as any} size={16} color={form.gender === g.value ? "#fff" : "#6b7280"} />
                <Text style={[s.genderText, form.gender === g.value && s.genderTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Phone Number</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 08012345678"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={set("phone")}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Address</Text>
          <TextInput
            style={s.input}
            placeholder="Village / Town"
            placeholderTextColor="#9ca3af"
            value={form.address}
            onChangeText={set("address")}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Known Allergies</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Penicillin, Peanuts (comma-separated)"
            placeholderTextColor="#9ca3af"
            value={form.allergies}
            onChangeText={set("allergies")}
          />
          <Text style={s.fieldHint}>Separate multiple allergies with commas</Text>
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="person-add-outline" size={18} color="#fff" /><Text style={s.btnText}> Register Patient</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  required: { color: "#dc2626" },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 13, fontSize: 15, color: "#111827", backgroundColor: "#fff" },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  errorText: { fontSize: 12, color: "#dc2626", marginTop: 4 },
  fieldHint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 12 },
  genderBtnActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  genderText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  genderTextActive: { color: "#fff" },
  btn: { backgroundColor: "#16a34a", borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 10 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
