import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", facility: "", role: "chw" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form);
    } catch (err: any) {
      show(err.message || "Registration failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "name", label: "Full Name", placeholder: "e.g. Amina Bello", icon: "person-outline" },
    { key: "email", label: "Email Address", placeholder: "you@example.com", icon: "mail-outline", keyboard: "email-address" as const, caps: "none" as const },
    { key: "facility", label: "Facility / Clinic", placeholder: "Optional — e.g. PHC Kano", icon: "business-outline" },
  ];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Ionicons name="medkit" size={32} color="#16a34a" />
          </View>
          <Text style={s.logoText}>Create Account</Text>
          <Text style={s.subtitle}>Join the HealthNet CHW network</Text>
        </View>

        {fields.map(({ key, label, placeholder, icon, keyboard, caps }) => (
          <View key={key} style={s.field}>
            <Text style={s.label}>{label}</Text>
            <View style={[s.inputWrap, errors[key] ? s.inputError : null]}>
              <Ionicons name={icon as any} size={18} color="#9ca3af" style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                keyboardType={keyboard}
                autoCapitalize={caps ?? "words"}
                value={form[key as keyof typeof form]}
                onChangeText={set(key)}
              />
            </View>
            {errors[key] ? <Text style={s.errorText}>{errors[key]}</Text> : null}
          </View>
        ))}

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <View style={[s.inputWrap, errors.password ? s.inputError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Min. 6 characters"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPass}
              value={form.password}
              onChangeText={set("password")}
            />
            <TouchableOpacity onPress={() => setShowPass((p) => !p)} style={s.eyeBtn}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          {errors.password
            ? <Text style={s.errorText}>{errors.password}</Text>
            : form.password.length > 0 && (
              <Text style={[s.hint, form.password.length >= 6 ? s.hintGood : s.hintWeak]}>
                {form.password.length >= 6 ? "✓ Strong enough" : `${6 - form.password.length} more character(s) needed`}
              </Text>
            )}
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkBtn} onPress={() => router.back()}>
          <Text style={s.link}>Already have an account? <Text style={s.linkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  scroll: { padding: 24, paddingTop: 52, paddingBottom: 40 },
  logoWrap: { alignItems: "center", marginBottom: 28 },
  logoCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  logoText: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12 },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: "#111827" },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 12, color: "#dc2626", marginTop: 4, marginLeft: 2 },
  hint: { fontSize: 12, marginTop: 4, marginLeft: 2 },
  hintGood: { color: "#16a34a" },
  hintWeak: { color: "#d97706" },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 20, alignItems: "center" },
  link: { fontSize: 14, color: "#6b7280" },
  linkBold: { color: "#16a34a", fontWeight: "700" },
});
