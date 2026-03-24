import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import api from "@/lib/api";

export default function QRScreen() {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [decoded, setDecoded] = useState<any>(null);
  const [encryptedPayload, setEncryptedPayload] = useState("");

  const generateQR = async () => {
    if (!patientId.trim()) return Alert.alert("Error", "Enter a patient ID");
    setLoading(true);
    setQrImage(null);
    try {
      const { data } = await api.get(`/qr/generate/${patientId.trim()}`);
      setQrImage(data.qr);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const decodePayload = async () => {
    if (!encryptedPayload.trim()) return Alert.alert("Error", "Paste an encrypted QR payload");
    setLoading(true);
    try {
      const { data } = await api.post("/qr/decode", { encrypted: encryptedPayload.trim() });
      setDecoded(data);
    } catch (err: any) {
      Alert.alert("Decode Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Generate Section */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Generate Patient QR</Text>
        <TextInput
          style={s.input}
          placeholder="Patient ID"
          placeholderTextColor="#9ca3af"
          value={patientId}
          onChangeText={setPatientId}
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.btn} onPress={generateQR} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="qr-code-outline" size={18} color="#fff" /><Text style={s.btnText}> Generate QR</Text></>
          )}
        </TouchableOpacity>

        {qrImage && (
          <View style={s.qrContainer}>
            <Image source={{ uri: qrImage }} style={s.qrImage} resizeMode="contain" />
            <Text style={s.qrHint}>Show this QR at the receiving facility</Text>
          </View>
        )}
      </View>

      {/* Decode Section */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Decode QR Payload</Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: "top" }]}
          placeholder="Paste encrypted QR payload here..."
          placeholderTextColor="#9ca3af"
          value={encryptedPayload}
          onChangeText={setEncryptedPayload}
          multiline
          autoCapitalize="none"
        />
        <TouchableOpacity style={[s.btn, { backgroundColor: "#7c3aed" }]} onPress={decodePayload} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="scan-outline" size={18} color="#fff" /><Text style={s.btnText}> Decode Payload</Text></>
          )}
        </TouchableOpacity>

        {decoded && (
          <View style={s.decodedCard}>
            <Text style={s.decodedTitle}>Patient: {decoded.patient?.name}</Text>
            <Text style={s.decodedMeta}>Age: {decoded.patient?.age} · Gender: {decoded.patient?.gender}</Text>
            {decoded.patient?.allergies?.length > 0 && (
              <Text style={s.allergy}>⚠️ Allergies: {decoded.patient.allergies.join(", ")}</Text>
            )}
            <Text style={s.decodedMeta}>Visits included: {decoded.visits?.length ?? 0}</Text>
            <TouchableOpacity
              style={s.viewBtn}
              onPress={() => router.push(`/patients/${decoded.patient?._id}`)}
            >
              <Text style={s.viewBtnText}>View Full Record →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginBottom: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 14 },
  input: { borderWidth: 1, borderColor: "#d1fae5", borderRadius: 10, padding: 13, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb", marginBottom: 12 },
  btn: { backgroundColor: "#16a34a", borderRadius: 10, padding: 13, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  qrContainer: { alignItems: "center", marginTop: 16 },
  qrImage: { width: 220, height: 220, borderRadius: 8 },
  qrHint: { fontSize: 12, color: "#6b7280", marginTop: 8, textAlign: "center" },
  decodedCard: { marginTop: 14, backgroundColor: "#f0fdf4", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#bbf7d0" },
  decodedTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  decodedMeta: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  allergy: { fontSize: 13, color: "#dc2626", marginTop: 4 },
  viewBtn: { marginTop: 12, backgroundColor: "#16a34a", borderRadius: 8, padding: 10, alignItems: "center" },
  viewBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
