import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { enqueue } from "@/lib/storage";

type Visit = { _id: string; symptoms: string[]; diagnosis: string; prescriptions: any[]; createdAt: string; notes: string };
type Patient = { _id: string; name: string; age: number; gender: string; allergies: string[]; medicalHistory: any[]; phone: string; address: string };

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({ symptoms: "", diagnosis: "", drug: "", dosage: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/visits/patient/${id}`),
    ]).then(([p, v]) => {
      setPatient(p.data);
      setVisits(v.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const setV = (key: string) => (val: string) => setVisitForm((f) => ({ ...f, [key]: val }));

  const saveVisit = async () => {
    if (!visitForm.diagnosis) return Alert.alert("Error", "Diagnosis is required");
    const payload = {
      patient: id,
      symptoms: visitForm.symptoms.split(",").map((s) => s.trim()).filter(Boolean),
      diagnosis: visitForm.diagnosis,
      prescriptions: visitForm.drug ? [{ drug: visitForm.drug, dosage: visitForm.dosage }] : [],
      notes: visitForm.notes,
      lastModified: new Date().toISOString(),
      localId: `local_visit_${Date.now()}`,
    };
    setSaving(true);
    try {
      const { data } = await api.post("/visits", payload);
      setVisits((v) => [data, ...v]);
      setShowVisitModal(false);
      setVisitForm({ symptoms: "", diagnosis: "", drug: "", dosage: "", notes: "" });
    } catch {
      await enqueue({ type: "visit", data: payload, localId: payload.localId });
      Alert.alert("Saved Offline", "Visit saved locally and will sync when connected.");
      setShowVisitModal(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#16a34a" size="large" />;
  if (!patient) return <Text style={{ textAlign: "center", marginTop: 40 }}>Patient not found.</Text>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{patient.name[0].toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{patient.name}</Text>
          <Text style={s.meta}>{patient.age} yrs · {patient.gender}</Text>
          {patient.phone ? <Text style={s.meta}>📞 {patient.phone}</Text> : null}
          {patient.address ? <Text style={s.meta}>📍 {patient.address}</Text> : null}
          {patient.allergies?.length > 0 && (
            <View style={s.allergyBadge}>
              <Text style={s.allergyText}>⚠️ Allergies: {patient.allergies.join(", ")}</Text>
            </View>
          )}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/(tabs)/qr?patientId=${id}`)}>
              <Ionicons name="qr-code-outline" size={16} color="#16a34a" />
              <Text style={s.actionBtnText}>Share QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { borderColor: "#d97706" }]} onPress={() => router.push({ pathname: "/ai", params: { patientId: id } })}>
              <Ionicons name="sparkles-outline" size={16} color="#d97706" />
              <Text style={[s.actionBtnText, { color: "#d97706" }]}>AI Explain</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Visit History */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Visit History ({visits.length})</Text>
          <TouchableOpacity style={s.addVisitBtn} onPress={() => setShowVisitModal(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addVisitText}>Add Visit</Text>
          </TouchableOpacity>
        </View>

        {visits.length === 0
          ? <Text style={s.empty}>No visits recorded yet.</Text>
          : visits.map((v) => (
            <View key={v._id} style={s.visitCard}>
              <Text style={s.visitDate}>{new Date(v.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</Text>
              <Text style={s.visitDiagnosis}>{v.diagnosis}</Text>
              {v.symptoms?.length > 0 && <Text style={s.visitMeta}>Symptoms: {v.symptoms.join(", ")}</Text>}
              {v.prescriptions?.length > 0 && (
                <Text style={s.visitMeta}>💊 {v.prescriptions.map((p: any) => `${p.drug} ${p.dosage}`).join(", ")}</Text>
              )}
              {v.notes ? <Text style={s.visitNotes}>{v.notes}</Text> : null}
            </View>
          ))}
      </ScrollView>

      {/* Add Visit Modal */}
      <Modal visible={showVisitModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={s.modal} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Visit</Text>
            <TouchableOpacity onPress={() => setShowVisitModal(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {[
            { key: "symptoms", placeholder: "Symptoms (comma-separated)" },
            { key: "diagnosis", placeholder: "Diagnosis *" },
            { key: "drug", placeholder: "Drug prescribed (optional)" },
            { key: "dosage", placeholder: "Dosage (e.g. 500mg twice daily)" },
            { key: "notes", placeholder: "Additional notes" },
          ].map(({ key, placeholder }) => (
            <TextInput
              key={key}
              style={s.input}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              value={visitForm[key as keyof typeof visitForm]}
              onChangeText={setV(key)}
            />
          ))}

          <TouchableOpacity style={s.btn} onPress={saveVisit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save Visit</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#16a34a" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  allergyBadge: { backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  allergyText: { fontSize: 13, color: "#dc2626", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#16a34a", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addVisitBtn: { backgroundColor: "#16a34a", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addVisitText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  visitCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#16a34a", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
  visitDate: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  visitDiagnosis: { fontSize: 15, fontWeight: "700", color: "#111827" },
  visitMeta: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  visitNotes: { fontSize: 12, color: "#9ca3af", marginTop: 4, fontStyle: "italic" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 20, fontSize: 14 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 13, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb", marginBottom: 12 },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
