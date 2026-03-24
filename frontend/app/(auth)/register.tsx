import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", facility: "", role: "chw" });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password)
      return Alert.alert("Error", "Name, email and password are required");
    setLoading(true);
    try {
      await register(form);
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>🏥 HealthNet</Text>
        <Text style={s.subtitle}>Create your CHW account</Text>

        {[
          { key: "name", placeholder: "Full Name" },
          { key: "email", placeholder: "Email", keyboardType: "email-address" as const, autoCapitalize: "none" as const },
          { key: "password", placeholder: "Password (min 6 chars)", secure: true },
          { key: "facility", placeholder: "Facility / Clinic Name (optional)" },
        ].map(({ key, placeholder, keyboardType, autoCapitalize, secure }) => (
          <TextInput
            key={key}
            style={s.input}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize ?? "words"}
            secureTextEntry={secure}
            value={form[key as keyof typeof form]}
            onChangeText={set(key)}
          />
        ))}

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.link}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  scroll: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 32, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 28 },
  input: { borderWidth: 1, borderColor: "#d1fae5", borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, color: "#111827", backgroundColor: "#fff" },
  btn: { backgroundColor: "#16a34a", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { textAlign: "center", color: "#16a34a", marginTop: 18, fontSize: 14 },
});
