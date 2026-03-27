import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";
import { C } from "@/constants/theme";

const TYPES = [
  { key: "prescription", label: "Prescription", icon: "medical-outline" },
  { key: "lab_result",   label: "Lab Result",   icon: "flask-outline" },
  { key: "diagnosis",    label: "Diagnosis",    icon: "pulse-outline" },
];

export default function AIScreen() {
  const { toast, show, hide } = useToast();
  const [text, setText]           = useState("");
  const [type, setType]           = useState("prescription");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading]     = useState(false);

  const explain = async () => {
    if (!text.trim()) { show("Please enter some medical text.", "warning"); return; }
    setLoading(true);
    setExplanation("");
    try {
      const { data } = await api.post("/ai/explain", { text: text.trim(), type });
      setExplanation(data.explanation);
    } catch (err: any) {
      show(err.message || "AI explanation failed. Please try again.", "error");
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="sparkles" size={26} color="#d97706" />
          </View>
          <Text style={s.headerTitle}>AI Medical Explainer</Text>
          <Text style={s.headerSub}>Translate complex medical terms into simple language</Text>
        </View>

        {/* Type Selector */}
        <Text style={s.label}>Type</Text>
        <View style={s.typeRow}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeBtn, type === t.key && s.typeBtnActive]}
              onPress={() => setType(t.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={t.icon as any} size={15} color={type === t.key ? "#fff" : C.textSub} />
              <Text style={[s.typeText, type === t.key && s.typeTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input */}
        <Text style={s.label}>Medical Text</Text>
        <TextInput
          style={s.textArea}
          placeholder={`Paste ${type.replace("_", " ")} here…\n\ne.g. Amoxicillin 500mg TDS x 5/7`}
          placeholderTextColor={C.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={explain} disabled={loading}>
          {loading
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.btnText}>Explaining…</Text></>
            : <><Ionicons name="sparkles-outline" size={17} color="#fff" /><Text style={s.btnText}>Explain in Simple Terms</Text></>}
        </TouchableOpacity>

        {/* Result */}
        {explanation ? (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <View style={s.resultIconWrap}>
                <Ionicons name="checkmark-circle" size={18} color={C.primary} />
              </View>
              <Text style={s.resultTitle}>Simplified Explanation</Text>
            </View>
            <Text style={s.resultText}>{explanation}</Text>
            <TouchableOpacity style={s.clearBtn} onPress={() => { setExplanation(""); setText(""); }}>
              <Ionicons name="refresh-outline" size={13} color={C.textMuted} />
              <Text style={s.clearBtnText}>Clear & Start Over</Text>
            </TouchableOpacity>
          </View>
        ) : !loading && (
          <View style={s.emptyState}>
            <Ionicons name="document-text-outline" size={38} color={C.borderMid} />
            <Text style={s.emptyText}>Your explanation will appear here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", paddingVertical: 24, marginBottom: 4 },
  headerIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#fef3c7",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.text },
  headerSub: { fontSize: 13, color: C.textSub, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius,
    padding: 10, backgroundColor: C.surface,
  },
  typeBtnActive: { backgroundColor: "#d97706", borderColor: "#d97706" },
  typeText: { fontSize: 12, color: C.textSub, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  textArea: {
    borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius,
    padding: 14, fontSize: 14, color: C.text,
    backgroundColor: C.surface, height: 140,
  },
  btn: {
    backgroundColor: "#d97706", borderRadius: C.radius, padding: 15,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resultCard: {
    backgroundColor: C.surface, borderRadius: C.radius, padding: 18, marginTop: 20,
    borderLeftWidth: 3, borderLeftColor: C.primary, ...C.shadow,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  resultIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  resultTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  resultText: { fontSize: 14, color: C.text, lineHeight: 23 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 14, alignSelf: "flex-start" },
  clearBtnText: { fontSize: 12, color: C.textMuted },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, color: C.textMuted },
});
