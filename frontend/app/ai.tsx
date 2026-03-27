import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

const TYPES = [
  { key: "prescription", label: "Prescription", icon: "medical-outline" },
  { key: "lab_result",   label: "Lab Result",   icon: "flask-outline" },
  { key: "diagnosis",    label: "Diagnosis",    icon: "pulse-outline" },
];

export default function AIScreen() {
  const { toast, show, hide } = useToast();
  const [text, setText] = useState("");
  const [type, setType] = useState("prescription");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  const explain = async () => {
    if (!text.trim()) { show("Please enter some medical text to explain.", "warning"); return; }
    setLoading(true);
    setExplanation("");
    try {
      const { data } = await api.post("/ai/explain", { text: text.trim(), type });
      setExplanation(data.explanation);
    } catch (err: any) {
      show(err.message || "AI explanation failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="sparkles" size={28} color="#d97706" />
          </View>
          <Text style={s.headerTitle}>AI Medical Explainer</Text>
          <Text style={s.headerSub}>Translate complex medical terms into simple, clear language</Text>
        </View>

        <Text style={s.label}>Type of Information</Text>
        <View style={s.typeRow}>
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeBtn, type === t.key && s.typeBtnActive]}
              onPress={() => setType(t.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={t.icon as any} size={16} color={type === t.key ? "#fff" : "#6b7280"} />
              <Text style={[s.typeText, type === t.key && s.typeTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Medical Text</Text>
        <TextInput
          style={s.textArea}
          placeholder={`Paste ${type.replace("_", " ")} here…\n\ne.g. Amoxicillin 500mg TDS x 5/7`}
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={explain} disabled={loading}>
          {loading
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.btnText}>  Explaining…</Text></>
            : <><Ionicons name="sparkles-outline" size={18} color="#fff" /><Text style={s.btnText}> Explain in Simple Terms</Text></>}
        </TouchableOpacity>

        {explanation ? (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <View style={s.resultIconWrap}>
                <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              </View>
              <Text style={s.resultTitle}>Simplified Explanation</Text>
            </View>
            <Text style={s.resultText}>{explanation}</Text>
            <TouchableOpacity style={s.clearBtn} onPress={() => { setExplanation(""); setText(""); }}>
              <Ionicons name="refresh-outline" size={14} color="#6b7280" />
              <Text style={s.clearBtnText}>Clear & Start Over</Text>
            </TouchableOpacity>
          </View>
        ) : !loading && (
          <View style={s.emptyState}>
            <Ionicons name="document-text-outline" size={40} color="#d1d5db" />
            <Text style={s.emptyText}>Your explanation will appear here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", paddingVertical: 20, marginBottom: 8 },
  headerIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 13, color: "#6b7280", marginTop: 4, textAlign: "center", paddingHorizontal: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 10 },
  typeBtnActive: { backgroundColor: "#d97706", borderColor: "#d97706" },
  typeText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  textArea: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 14, padding: 14, fontSize: 14, color: "#111827", backgroundColor: "#fff", height: 150, marginBottom: 4 },
  btn: { backgroundColor: "#d97706", borderRadius: 14, padding: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resultCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginTop: 20, borderLeftWidth: 4, borderLeftColor: "#16a34a", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  resultIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  resultTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  resultText: { fontSize: 14, color: "#374151", lineHeight: 23 },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 14, alignSelf: "flex-start" },
  clearBtnText: { fontSize: 12, color: "#6b7280" },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, color: "#9ca3af" },
});
