import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";
import { enqueue } from "@/lib/storage";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

type Visit = { _id: string; symptoms: string[]; diagnosis: string; prescriptions: any[]; createdAt: string; notes: string };
type Patient = { _id: string; name: string; age: number; gender: string; allergies: string[]; medicalHistory: any[]; phone: string; address: string };

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({ symptoms: "", diagnosis: "", drug: "", dosage: "", notes: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/patients/${id}`), api.get(`/visits/patient/${id}`)])
      .then(([p, v]) => { setPatient(p.data); setVisits(v.data); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const setV = (key: string) => (val: string) => {
    setVisitForm((f) => ({ ...f, [key]: val }));
    setFormErrors((e) => ({ ...e, [key]: "" }));
  };

  const saveVisit = async () => {
    if (!visitForm.diagnosis.trim()) {
      setFormErrors({ diagnosis: "Diagnosis is required" });
      return;
    }
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
      show("Visit saved successfully.", "success");
    } catch {
      await enqueue({ type: "visit", data: payload, localId: payload.localId });
      setShowVisitModal(false);
      show("No connection — visit saved offline and will sync later.", "warning");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator color="#16a34a" size="large" />
      <Text style={s.loadingText}>Loading patient…</Text>
    </View>
  );

  if (error || !patient) return (
    <View style={s.centered}>
      <Ionicons name="alert-circle-outline" size={48} color="#d1d5db" />
      <Text style={s.errorTitle}>Patient not found</Text>
      <Text style={s.errorSub}>This record may have been removed or is unavailable offline.</Text>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
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
              <Ionicons name="warning-outline" size={14} color="#dc2626" />
              <Text style={s.allergyText}>Allergies: {patient.allergies.join(", ")}</Text>
            </View>
          )}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/(tabs)/qr?patientId=${id}`)}>
              <Ionicons name="qr-code-outline" size={15} color="#7c3aed" />
              <Text style={[s.actionBtnText, { color: "#7c3aed" }]}>Share QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { borderColor: "#d97706" }]} onPress={() => router.push({ pathname: "/ai", params: { patientId: id } })}>
              <Ionicons name="sparkles-outline" size={15} color="#d97706" />
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

        {visits.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="calendar-outline" size={40} color="#d1d5db" />
            <Text style={s.emptyText}>No visits recorded yet.</Text>
          </View>
        ) : (
          visits.map((v) => (
            <View key={v._id} style={s.visitCard}>
              <Text style={s.visitDate}>
                {new Date(v.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
              <Text style={s.visitDiagnosis}>{v.diagnosis}</Text>
              {v.symptoms?.length > 0 && (
                <Text style={s.visitMeta}>🩺 Symptoms: {v.symptoms.join(", ")}</Text>
              )}
              {v.prescriptions?.length > 0 && (
                <Text style={s.visitMeta}>💊 {v.prescriptions.map((p: any) => `${p.drug} ${p.dosage}`).join(", ")}</Text>
              )}
              {v.notes ? <Text style={s.visitNotes}>{v.notes}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Visit Modal */}
      <Modal visible={showVisitModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={s.modal} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Visit</Text>
            <TouchableOpacity onPress={() => setShowVisitModal(false)} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          {[
            { key: "symptoms",  label: "Symptoms",                    placeholder: "e.g. Fever, Headache (comma-separated)" },
            { key: "diagnosis", label: "Diagnosis *",                 placeholder: "e.g. Malaria" },
            { key: "drug",      label: "Drug Prescribed",             placeholder: "e.g. Artemether (optional)" },
            { key: "dosage",    label: "Dosage",                      placeholder: "e.g. 500mg twice daily" },
            { key: "notes",     label: "Additional Notes",            placeholder: "Any extra observations…" },
          ].map(({ key, label, placeholder }) => (
            <View key={key} style={s.field}>
              <Text style={s.fieldLabel}>{label}</Text>
              <TextInput
                style={[s.input, formErrors[key] ? s.inputError : null]}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                value={visitForm[key as keyof typeof visitForm]}
                onChangeText={setV(key)}
              />
              {formErrors[key] ? <Text style={s.errorText}>{formErrors[key]}</Text> : null}
            </View>
          ))}

          <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={saveVisit} disabled={saving}>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 32, backgroundColor: "#f0fdf4" },
  loadingText: { fontSize: 14, color: "#6b7280" },
  errorTitle: { fontSize: 17, fontWeight: "700", color: "#374151", marginTop: 8 },
  errorSub: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  backBtn: { marginTop: 8, borderWidth: 1, borderColor: "#16a34a", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: "#16a34a", fontWeight: "600" },
  profileCard: { backgroundColor: "#fff", borderRadius: 18, padding: 22, alignItems: "center", marginBottom: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#16a34a" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  allergyBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef2f2", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginTop: 10 },
  allergyText: { fontSize: 13, color: "#dc2626", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#7c3aed", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addVisitBtn: { backgroundColor: "#16a34a", flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addVisitText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  visitCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#16a34a", elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4 },
  visitDate: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  visitDiagnosis: { fontSize: 15, fontWeight: "700", color: "#111827" },
  visitMeta: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  visitNotes: { fontSize: 12, color: "#9ca3af", marginTop: 4, fontStyle: "italic" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  closeBtn: { padding: 4, backgroundColor: "#f3f4f6", borderRadius: 8 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 13, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb" },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  errorText: { fontSize: 12, color: "#dc2626", marginTop: 3 },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
