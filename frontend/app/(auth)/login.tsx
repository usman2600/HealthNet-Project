import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      show(err.message || "Login failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}

      <View style={s.card}>
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Ionicons name="medkit" size={32} color="#16a34a" />
          </View>
          <Text style={s.logoText}>HealthNet</Text>
          <Text style={s.subtitle}>Community Health Worker Portal</Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Email Address</Text>
          <View style={[s.inputWrap, errors.email ? s.inputError : null]}>
            <Ionicons name="mail-outline" size={18} color="#9ca3af" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
            />
          </View>
          {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <View style={[s.inputWrap, errors.password ? s.inputError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color="#9ca3af" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
            />
            <TouchableOpacity onPress={() => setShowPass((p) => !p)} style={s.eyeBtn}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkBtn} onPress={() => router.push("/(auth)/register")}>
          <Text style={s.link}>Don't have an account? <Text style={s.linkBold}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 28, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
  logoWrap: { alignItems: "center", marginBottom: 28 },
  logoCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  logoText: { fontSize: 26, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, backgroundColor: "#f9fafb", paddingHorizontal: 12 },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: "#111827" },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 12, color: "#dc2626", marginTop: 4, marginLeft: 2 },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 20, alignItems: "center" },
  link: { fontSize: 14, color: "#6b7280" },
  linkBold: { color: "#16a34a", fontWeight: "700" },
});
