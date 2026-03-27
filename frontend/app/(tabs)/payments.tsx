import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, FlatList, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import api from "@/lib/api";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

type Patient = { _id: string; name: string; age?: number; gender?: string };
type Payment = { _id: string; service: string; amount: number; status: string; transactionRef: string; createdAt: string };

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  success: { color: "#16a34a", bg: "#dcfce7", icon: "checkmark-circle" },
  failed:  { color: "#dc2626", bg: "#fee2e2", icon: "close-circle" },
  pending: { color: "#d97706", bg: "#fef3c7", icon: "time" },
};

export default function PaymentsScreen() {
  const { toast, show, hide } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);

  const [form, setForm] = useState({ service: "", amount: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [webviewUrl, setWebviewUrl] = useState<string | null>(null);
  const [webviewVisible, setWebviewVisible] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const verifying = useRef(false);

  useEffect(() => {
    api.get("/patients?limit=100").then(({ data }) => {
      setPatients(data.entry?.map((e: any) => e) ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadHistory();
  }, [selected]);

  const loadHistory = async () => {
    if (!selected) return;
    setHistoryLoading(true);
    setHistory([]);
    try {
      const { data } = await api.get(`/payments/patient/${selected._id}`);
      setHistory(data);
    } catch {}
    finally { setHistoryLoading(false); }
  };

  const filtered = patients.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const set = (key: string) => (val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selected) e.patient = "Please select a patient";
    if (!form.service.trim()) e.service = "Service name is required";
    if (!form.amount.trim()) e.amount = "Amount is required";
    else if (isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) e.amount = "Enter a valid amount";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const initiatePayment = async () => {
    if (!validate()) return;
    setLoading(true); setReceipt(null);
    try {
      const { data } = await api.post("/payments/initiate", {
        patientId: selected!._id,
        amount: parseFloat(form.amount),
        service: form.service,
        email: form.email,
      });

      setPendingRef(data.transactionRef);
      setWebviewUrl(data.paymentUrl);
      setWebviewVisible(true);
    } catch (err: any) {
      show(err.message || "Payment failed. Please try again.", "error");
    } finally { setLoading(false); }
  };

  const verifyPayment = async (ref: string) => {
    if (verifying.current) return;
    verifying.current = true;
    setWebviewVisible(false);
    try {
      const { data } = await api.get(`/payments/status/${ref}`);
      setReceipt(data);
      setPendingRef(null);
      setWebviewUrl(null);
      show(data.status === "success" ? "Payment confirmed!" : "Payment not confirmed. Try again.", data.status === "success" ? "success" : "warning");
      await loadHistory();
    } catch (err: any) {
      show(err.message || "Could not verify payment.", "error");
    } finally { verifying.current = false; }
  };

  const cfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}

      {/* In-App Payment WebView */}
      <Modal visible={webviewVisible} animationType="slide" onRequestClose={() => setWebviewVisible(false)}>
        <View style={{ flex: 1, paddingTop: 50, backgroundColor: "#fff" }}>
          <View style={s.webviewHeader}>
            <Text style={s.webviewTitle}>Interswitch Payment</Text>
            <TouchableOpacity onPress={() => setWebviewVisible(false)}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          {webviewUrl && (
            <WebView
              source={{ uri: webviewUrl }}
              style={{ flex: 1 }}
              startInLoadingState
              renderLoading={() => (
                <View style={s.webviewLoading}>
                  <ActivityIndicator size="large" color="#16a34a" />
                  <Text style={s.webviewLoadingText}>Loading payment page…</Text>
                </View>
              )}
              onNavigationStateChange={(navState) => {
                // Interswitch redirects to our /verify/:ref URL after payment
                if (navState.url?.includes("/api/payments/verify/") && pendingRef) {
                  verifyPayment(pendingRef);
                }
              }}
            />
          )}
        </View>
      </Modal>

      {/* Patient Picker Modal */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Patient</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(p) => p._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.patientRow}
                onPress={() => { setSelected(item); setPickerOpen(false); setReceipt(null); setPendingRef(null); setWebviewUrl(null); }}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.patientName}>{item.name}</Text>
                  <Text style={s.patientMeta}>{item.age ? `${item.age} yrs` : ""}{item.gender ? ` · ${item.gender}` : ""}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.empty}>No patients found.</Text>}
          />
        </View>
      </Modal>

      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Process Payment */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Ionicons name="card-outline" size={20} color="#16a34a" />
            <Text style={s.sectionTitle}>Process Payment</Text>
          </View>

          <Text style={s.label}>Patient</Text>
          <TouchableOpacity style={[s.picker, errors.patient ? s.pickerError : null]} onPress={() => setPickerOpen(true)}>
            {selected ? (
              <View style={s.pickerSelected}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{selected.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.patientName}>{selected.name}</Text>
                  <Text style={s.patientMeta}>{selected.age ? `${selected.age} yrs` : ""}{selected.gender ? ` · ${selected.gender}` : ""}</Text>
                </View>
              </View>
            ) : (
              <Text style={s.pickerPlaceholder}>Select a patient…</Text>
            )}
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </TouchableOpacity>
          {errors.patient ? <Text style={s.errorText}>{errors.patient}</Text> : null}

          {[
            { key: "service", label: "Service",    placeholder: "e.g. Consultation, Lab Test" },
            { key: "amount",  label: "Amount (₦)", placeholder: "e.g. 2500", keyboard: "numeric" as const },
            { key: "email",   label: "Patient Email (optional)", placeholder: "patient@email.com", keyboard: "email-address" as const, caps: "none" as const },
          ].map(({ key, label, placeholder, keyboard, caps }) => (
            <View key={key} style={s.field}>
              <Text style={s.label}>{label}</Text>
              <TextInput
                style={[s.input, errors[key] ? s.inputError : null]}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                keyboardType={keyboard}
                autoCapitalize={caps ?? "sentences"}
                value={form[key as keyof typeof form]}
                onChangeText={set(key)}
              />
              {errors[key] ? <Text style={s.errorText}>{errors[key]}</Text> : null}
            </View>
          ))}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={initiatePayment} disabled={loading || !!pendingRef}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="card-outline" size={18} color="#fff" /><Text style={s.btnText}> Pay with Interswitch</Text></>}
          </TouchableOpacity>

          {pendingRef && (
            <View style={s.verifyBanner}>
              <View style={{ flex: 1 }}>
                <Text style={s.verifyTitle}>Payment in progress</Text>
                <Text style={s.verifyRef}>Ref: {pendingRef}</Text>
              </View>
              <TouchableOpacity style={s.openBtn} onPress={() => setWebviewVisible(true)}>
                <Text style={s.openBtnText}>Resume Payment</Text>
              </TouchableOpacity>
            </View>
          )}

          {receipt && (
            <View style={s.receipt}>
              <View style={s.receiptHead}>
                <Ionicons name="receipt-outline" size={18} color="#16a34a" />
                <Text style={s.receiptTitle}>Payment Receipt</Text>
              </View>
              <View style={s.receiptRow}><Text style={s.receiptKey}>Reference</Text><Text style={s.receiptVal}>{receipt.transactionRef}</Text></View>
              <View style={s.receiptRow}><Text style={s.receiptKey}>Service</Text><Text style={s.receiptVal}>{receipt.service}</Text></View>
              <View style={s.receiptRow}><Text style={s.receiptKey}>Amount</Text><Text style={s.receiptVal}>₦{receipt.amount}</Text></View>
              {receipt.interswitchRef && (
                <View style={s.receiptRow}><Text style={s.receiptKey}>Interswitch Ref</Text><Text style={s.receiptVal}>{receipt.interswitchRef}</Text></View>
              )}
              <View style={s.receiptRow}>
                <Text style={s.receiptKey}>Status</Text>
                <View style={[s.statusBadge, { backgroundColor: cfg(receipt.status).bg }]}>
                  <Text style={[s.statusText, { color: cfg(receipt.status).color }]}>
                    {receipt.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Payment History */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Ionicons name="time-outline" size={20} color="#16a34a" />
            <Text style={s.sectionTitle}>Payment History</Text>
            {historyLoading && <ActivityIndicator size="small" color="#16a34a" />}
          </View>

          {!selected ? (
            <View style={s.emptyWrap}>
              <Ionicons name="person-outline" size={36} color="#d1d5db" />
              <Text style={s.emptyText}>Select a patient above to view their payment history.</Text>
            </View>
          ) : history.length === 0 && !historyLoading ? (
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={36} color="#d1d5db" />
              <Text style={s.emptyText}>No payment history found for this patient.</Text>
            </View>
          ) : (
            history.map((p) => {
              const c = cfg(p.status);
              return (
                <View key={p._id} style={s.historyCard}>
                  <View style={[s.historyIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={c.icon as any} size={18} color={c.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyService}>{p.service}</Text>
                    <Text style={s.historyRef}>{p.transactionRef}</Text>
                    <Text style={s.historyDate}>{new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.historyAmount}>₦{p.amount}</Text>
                    <View style={[s.statusBadge, { backgroundColor: c.bg, marginTop: 4 }]}>
                      <Text style={[s.statusText, { color: c.color }]}>{p.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb" },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  errorText: { fontSize: 12, color: "#dc2626", marginTop: 3 },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 4 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Picker
  picker: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, backgroundColor: "#f9fafb", marginBottom: 14 },
  pickerError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  pickerPlaceholder: { flex: 1, color: "#9ca3af", fontSize: 14 },
  pickerSelected: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  // Modal
  modal: { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  searchInput: { margin: 16, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb" },
  patientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#16a34a" },
  patientName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  patientMeta: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40, fontSize: 14 },
  // Verify banner
  verifyBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", borderRadius: 12, padding: 14, marginTop: 12, gap: 10, borderWidth: 1, borderColor: "#fde68a" },
  verifyTitle: { fontSize: 13, fontWeight: "700", color: "#92400e" },
  verifyRef: { fontSize: 11, color: "#b45309", marginTop: 2 },
  openBtn: { backgroundColor: "#0891b2", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  openBtnText: { color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" },
  webviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  webviewTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  webviewLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  webviewLoadingText: { fontSize: 14, color: "#6b7280" },
  // Receipt
  receipt: { marginTop: 16, backgroundColor: "#f0fdf4", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#bbf7d0" },
  receiptHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  receiptTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  receiptKey: { fontSize: 13, color: "#6b7280" },
  receiptVal: { fontSize: 13, fontWeight: "600", color: "#111827", flexShrink: 1, textAlign: "right", marginLeft: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  emptyWrap: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  historyIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  historyService: { fontSize: 14, fontWeight: "600", color: "#111827" },
  historyRef: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  historyDate: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  historyAmount: { fontSize: 15, fontWeight: "700", color: "#111827" },
});
