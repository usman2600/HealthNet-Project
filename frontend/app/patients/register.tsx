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
import { C } from "@/constants/theme";

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
    else if (isNaN(parseInt(form.age)) || parseInt(form.age) <= 0 || parseInt(form.age) > 120)
      e.age = "Enter a valid age (1–120)";
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
      show("Saved offline — will sync when connected.", "warning");
      setTimeout(() => router.back(), 2000);
    } finally { setLoading(false); }
  };

  const genderOptions = [
    { value: "male",   label: "Male",   icon: "male-outline" },
    { value: "female", label: "Female", icon: "female-outline" },
    { value: "other",  label: "Other",  icon: "person-outline" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.field}>
          <Text style={s.label}>Full Name <Text style={s.req}>*</Text></Text>
          <TextInput
            style={[s.input, errors.name ? s.inputError : null]}
            placeholder="e.g. Amina Bello"
            placeholderTextColor={C.textMuted}
            value={form.name}
            onChangeText={set("name")}
          />
          {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Age <Text style={s.req}>*</Text></Text>
          <TextInput
            style={[s.input, errors.age ? s.inputError : null]}
            placeholder="e.g. 34"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
            value={form.age}
            onChangeText={set("age")}
          />
          {errors.age ? <Text style={s.errorText}>{errors.age}</Text> : null}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Gender <Text style={s.req}>*</Text></Text>
          <View style={s.genderRow}>
            {genderOptions.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[s.genderBtn, form.gender === g.value && s.genderBtnActive]}
                onPress={() => set("gender")(g.value)}
              >
                <Ionicons name={g.icon as any} size={15} color={form.gender === g.value ? "#fff" : C.textSub} />
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
            placeholderTextColor={C.textMuted}
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
            placeholderTextColor={C.textMuted}
            value={form.address}
            onChangeText={set("address")}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Known Allergies</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Penicillin, Peanuts"
            placeholderTextColor={C.textMuted}
            value={form.allergies}
            onChangeText={set("allergies")}
          />
          <Text style={s.hint}>Separate multiple allergies with commas</Text>
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="person-add-outline" size={17} color="#fff" /><Text style={s.btnText}>Register Patient</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 6 },
  req: { color: C.error },
  input: {
    borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius,
    padding: 13, fontSize: 15, color: C.text, backgroundColor: C.surface,
  },
  inputError: { borderColor: C.error, backgroundColor: C.errorLight },
  errorText: { fontSize: 12, color: C.error, marginTop: 4 },
  hint: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius, padding: 12,
    backgroundColor: C.surface,
  },
  genderBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  genderText: { fontSize: 14, color: C.textSub, fontWeight: "600" },
  genderTextActive: { color: "#fff" },
  btn: {
    backgroundColor: C.primary, borderRadius: C.radius, padding: 16,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
