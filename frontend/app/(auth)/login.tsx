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
import { C } from "@/constants/theme";

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

      <View style={s.inner}>
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Ionicons name="medkit" size={28} color={C.primary} />
          </View>
          <Text style={s.logoText}>HealthNet</Text>
          <Text style={s.subtitle}>Community Health Worker Portal</Text>
        </View>

        {/* Email */}
        <View style={s.field}>
          <Text style={s.label}>Email</Text>
          <View style={[s.inputWrap, errors.email ? s.inputError : null]}>
            <Ionicons name="mail-outline" size={17} color={C.textMuted} />
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
            />
          </View>
          {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
        </View>

        {/* Password */}
        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <View style={[s.inputWrap, errors.password ? s.inputError : null]}>
            <Ionicons name="lock-closed-outline" size={17} color={C.textMuted} />
            <TextInput
              style={s.input}
              placeholder="Enter your password"
              placeholderTextColor={C.textMuted}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
            />
            <TouchableOpacity onPress={() => setShowPass((p) => !p)}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={17} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkBtn} onPress={() => router.push("/(auth)/register")}>
          <Text style={s.link}>Don't have an account? <Text style={s.linkBold}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24 },
  inner: { gap: 0 },
  logoWrap: { alignItems: "center", marginBottom: 36 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.primaryLight,
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  logoText: { fontSize: 26, fontWeight: "800", color: C.text },
  subtitle: { fontSize: 13, color: C.textSub, marginTop: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius,
    backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 2,
  },
  inputError: { borderColor: C.error, backgroundColor: C.errorLight },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.text },
  errorText: { fontSize: 12, color: C.error, marginTop: 4 },
  btn: {
    backgroundColor: C.primary, borderRadius: C.radius,
    padding: 15, alignItems: "center", marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 24, alignItems: "center" },
  link: { fontSize: 14, color: C.textSub },
  linkBold: { color: C.primary, fontWeight: "700" },
});
