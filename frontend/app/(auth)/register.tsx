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
import { C } from "@/constants/theme";

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
    else if (form.password.length < 6) e.password = "Minimum 6 characters";
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
    { key: "name",     label: "Full Name",       placeholder: "e.g. Amina Bello",    icon: "person-outline",   keyboard: undefined,         caps: "words" as const },
    { key: "email",    label: "Email",            placeholder: "you@example.com",     icon: "mail-outline",     keyboard: "email-address" as const, caps: "none" as const },
    { key: "facility", label: "Facility (optional)", placeholder: "e.g. PHC Kano",   icon: "business-outline", keyboard: undefined,         caps: "words" as const },
  ];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Ionicons name="medkit" size={28} color={C.primary} />
          </View>
          <Text style={s.logoText}>Create Account</Text>
          <Text style={s.subtitle}>Join the HealthNet CHW network</Text>
        </View>

        {fields.map(({ key, label, placeholder, icon, keyboard, caps }) => (
          <View key={key} style={s.field}>
            <Text style={s.label}>{label}</Text>
            <View style={[s.inputWrap, errors[key] ? s.inputError : null]}>
              <Ionicons name={icon as any} size={17} color={C.textMuted} />
              <TextInput
                style={s.input}
                placeholder={placeholder}
                placeholderTextColor={C.textMuted}
                keyboardType={keyboard}
                autoCapitalize={caps}
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
            <Ionicons name="lock-closed-outline" size={17} color={C.textMuted} />
            <TextInput
              style={s.input}
              placeholder="Min. 6 characters"
              placeholderTextColor={C.textMuted}
              secureTextEntry={!showPass}
              value={form.password}
              onChangeText={set("password")}
            />
            <TouchableOpacity onPress={() => setShowPass((p) => !p)}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={17} color={C.textMuted} />
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
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkBtn} onPress={() => router.back()}>
          <Text style={s.link}>Already have an account? <Text style={s.linkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 52, paddingBottom: 40 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.primaryLight,
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  logoText: { fontSize: 24, fontWeight: "800", color: C.text },
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
  hint: { fontSize: 12, marginTop: 4 },
  hintGood: { color: C.primary },
  hintWeak: { color: C.warning },
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
