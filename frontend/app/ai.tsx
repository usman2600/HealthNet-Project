import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";

const TYPES = [
  { key: "prescription", label: "Prescription" },
  { key: "lab_result", label: "Lab Result" },
  { key: "diagnosis", label: "Diagnosis" },
];

export default function AIScreen() {
  const [text, setText] = useState("");
  const [type, setType] = useState("prescription");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  const explain = async () => {
    if (!text.trim()) return Alert.alert("Error", "Please enter medical text to explain");
    setLoading(true);
    setExplanation("");
    try {
      const { data } = await api.post("/ai/explain", { text: text.trim(), type });
      setExplanation(data.explanation);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <Ionicons name="sparkles" size={28} color="#d97706" />
        <Text style={s.headerTitle}>AI Medical Explainer</Text>
        <Text style={s.headerSub}>Translate medical terms into simple language</Text>
      </View>

      {/* Type selector */}
      <Text style={s.label}>Type of Information</Text>
      <View style={s.typeRow}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.typeBtn, type === t.key && s.typeBtnActive]}
            onPress={() => setType(t.key)}
          >
            <Text style={[s.typeText, type === t.key && s.typeTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Medical Text</Text>
      <TextInput
        style={s.textArea}
        placeholder={`Paste ${type.replace("_", " ")} here...\n\ne.g. Amoxicillin 500mg TDS x 5/7`}
        placeholderTextColor="#9ca3af"
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity style={s.btn} onPress={explain} disabled={loading}>
        {loading
          ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.btnText}>  Explaining...</Text></>
          : <><Ionicons name="sparkles-outline" size={18} color="#fff" /><Text style={s.btnText}> Explain in Simple Terms</Text></>
        }
      </TouchableOpacity>

      {explanation ? (
        <View style={s.resultCard}>
          <View style={s.resultHeader}>
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text style={s.resultTitle}>Simplified Explanation</Text>
          </View>
          <Text style={s.resultText}>{explanation}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", paddingVertical: 20 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 8 },
  headerSub: { fontSize: 13, color: "#6b7280", marginTop: 4, textAlign: "center" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 10, alignItems: "center" },
  typeBtnActive: { backgroundColor: "#d97706", borderColor: "#d97706" },
  typeText: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  textArea: { borderWidth: 1, borderColor: "#d1fae5", borderRadius: 12, padding: 14, fontSize: 14, color: "#111827", backgroundColor: "#fff", height: 140, marginBottom: 4 },
  btn: { backgroundColor: "#d97706", borderRadius: 12, padding: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resultCard: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginTop: 20, borderLeftWidth: 4, borderLeftColor: "#16a34a", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  resultTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  resultText: { fontSize: 14, color: "#374151", lineHeight: 22 },
});
