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
import { C } from "@/constants/theme";

type Visit   = { _id: string; symptoms: string[]; diagnosis: string; prescriptions: any[]; createdAt: string; notes: string };
type Patient = { _id: string; name: string; age: number; gender: string; allergies: string[]; medicalHistory: any[]; phone: string; address: string };

const GENDER_COLOR: Record<string, string> = { male: C.blue, female: C.pink, other: C.purple };

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast, show, hide } = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits]   = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [visitForm, setVisitForm]   = useState({ symptoms: "", diagnosis: "", drug: "", dosage: "", notes: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);

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
    if (!visitForm.diagnosis.trim()) { setFormErrors({ diagnosis: "Diagnosis is required" }); return; }
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
      setShowModal(false);
      setVisitForm({ symptoms: "", diagnosis: "", drug: "", dosage: "", notes: "" });
      show("Visit saved successfully.", "success");
    } catch {
      await enqueue({ type: "visit", data: payload, localId: payload.localId });
      setShowModal(false);
      show("Saved offline — will sync when connected.", "warning");
    } finally { setSaving(false); }
  };

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );

  if (error || !patient) return (
    <View style={s.centered}>
      <Ionicons name="alert-circle-outline" size={44} color={C.borderMid} />
      <Text style={s.errorTitle}>Patient not found</Text>
      <Text style={s.errorSub}>This record may be unavailable offline.</Text>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  const gc = GENDER_COLOR[patient.gender] ?? C.textSub;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: gc + "18" }]}>
            <Text style={[s.avatarText, { color: gc }]}>{patient.name[0].toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{patient.name}</Text>
          <Text style={s.meta}>{patient.age} yrs · {patient.gender}</Text>
          {patient.phone ? <Text style={s.meta}>{patient.phone}</Text> : null}
          {patient.address ? <Text style={s.meta}>{patient.address}</Text> : null}

          {patient.allergies?.length > 0 && (
            <View style={s.allergyBadge}>
              <Ionicons name="warning-outline" size={13} color={C.error} />
              <Text style={s.allergyText}>Allergies: {patient.allergies.join(", ")}</Text>
            </View>
          )}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/(tabs)/qr?patientId=${id}`)}>
              <Ionicons name="qr-code-outline" size={14} color={C.purple} />
              <Text style={[s.actionBtnText, { color: C.purple }]}>Share QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, { borderColor: "#d97706" }]} onPress={() => router.push({ pathname: "/ai", params: { patientId: id } })}>
              <Ionicons name="sparkles-outline" size={14} color="#d97706" />
              <Text style={[s.actionBtnText, { color: "#d97706" }]}>AI Explain</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Visit History Header */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Visits <Text style={s.visitCount}>({visits.length})</Text></Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addBtnText}>Add Visit</Text>
          </TouchableOpacity>
        </View>

        {visits.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="calendar-outline" size={40} color={C.borderMid} />
            <Text style={s.emptyText}>No visits recorded yet.</Text>
          </View>
        ) : (
          visits.map((v) => (
            <View key={v._id} style={s.visitCard}>
              <Text style={s.visitDate}>
                {new Date(v.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
              <Text style={s.visitDiagnosis}>{v.diagnosis}</Text>
              {v.symptoms?.length > 0 && <Text style={s.visitMeta}>Symptoms: {v.symptoms.join(", ")}</Text>}
              {v.prescriptions?.length > 0 && (
                <Text style={s.visitMeta}>Rx: {v.prescriptions.map((p: any) => `${p.drug} ${p.dosage}`).join(", ")}</Text>
              )}
              {v.notes ? <Text style={s.visitNotes}>{v.notes}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Visit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={s.modal} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Visit</Text>
            <TouchableOpacity onPress={() => setShowModal(false)} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          {[
            { key: "symptoms",  label: "Symptoms",          placeholder: "e.g. Fever, Headache (comma-separated)" },
            { key: "diagnosis", label: "Diagnosis *",        placeholder: "e.g. Malaria" },
            { key: "drug",      label: "Drug Prescribed",    placeholder: "e.g. Artemether (optional)" },
            { key: "dosage",    label: "Dosage",             placeholder: "e.g. 500mg twice daily" },
            { key: "notes",     label: "Notes",              placeholder: "Any extra observations…" },
          ].map(({ key, label, placeholder }) => (
            <View key={key} style={s.field}>
              <Text style={s.fieldLabel}>{label}</Text>
              <TextInput
                style={[s.input, formErrors[key] ? s.inputError : null]}
                placeholder={placeholder}
                placeholderTextColor={C.textMuted}
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
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 32, backgroundColor: C.bg },
  errorTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginTop: 8 },
  errorSub: { fontSize: 13, color: C.textMuted, textAlign: "center" },
  backBtn: { marginTop: 8, borderWidth: 1, borderColor: C.primary, borderRadius: C.radiusSm, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: C.primary, fontWeight: "600" },
  profileCard: {
    backgroundColor: C.surface, borderRadius: C.radiusLg,
    padding: 22, alignItems: "center", marginBottom: 20, ...C.shadow,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText: { fontSize: 26, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "700", color: C.text },
  meta: { fontSize: 13, color: C.textSub, marginTop: 3 },
  allergyBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.errorLight, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7, marginTop: 10,
  },
  allergyText: { fontSize: 12, color: C.error, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: C.purple, borderRadius: C.radiusSm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  visitCount: { color: C.textMuted, fontWeight: "400" },
  addBtn: {
    backgroundColor: C.primary, flexDirection: "row", alignItems: "center",
    gap: 4, borderRadius: C.radiusSm, paddingHorizontal: 12, paddingVertical: 8,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, color: C.textMuted },
  visitCard: {
    backgroundColor: C.surface, borderRadius: C.radius,
    padding: 14, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: C.primary,
    ...C.shadow,
  },
  visitDate: { fontSize: 11, color: C.textMuted, marginBottom: 4 },
  visitDiagnosis: { fontSize: 15, fontWeight: "700", color: C.text },
  visitMeta: { fontSize: 13, color: C.textSub, marginTop: 3 },
  visitNotes: { fontSize: 12, color: C.textMuted, marginTop: 4, fontStyle: "italic" },
  modal: { flex: 1, backgroundColor: C.surface },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  closeBtn: { padding: 6, backgroundColor: C.border, borderRadius: 8 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: C.textSub, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radiusSm, padding: 13, fontSize: 14, color: C.text, backgroundColor: C.bg },
  inputError: { borderColor: C.error, backgroundColor: C.errorLight },
  errorText: { fontSize: 12, color: C.error, marginTop: 3 },
  btn: { backgroundColor: C.primary, borderRadius: C.radius, padding: 15, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
