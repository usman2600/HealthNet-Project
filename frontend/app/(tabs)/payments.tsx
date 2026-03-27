import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, FlatList, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IswPaymentWebView, type IswWebViewRefMethods } from "@interswitchapi/ipg-react-native";
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
  const paymentRef = useRef<IswWebViewRefMethods>(null);

  // Patient picker
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [search, setSearch]       = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected]   = useState<Patient | null>(null);

  // Form
  const [service, setService] = useState("");
  const [amount, setAmount]   = useState("");
  const [email, setEmail]     = useState("");
  const [errors, setErrors]   = useState<Record<string, string>>({});

  // Flow
  const [txnRef, setTxnRef]     = useState<string>("");
  const [showPay, setShowPay]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [receipt, setReceipt]   = useState<any>(null);

  // History
  const [history, setHistory]           = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    api.get("/payments/config").then(({ data }) => setIswConfig(data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/patients?limit=100").then(({ data }) => {
      setPatients(data.entry?.map((e: any) => e) ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (selected) loadHistory(); }, [selected]);

  const loadHistory = async () => {
    if (!selected) return;
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/payments/patient/${selected._id}`);
      setHistory(data);
    } catch {} finally { setHistoryLoading(false); }
  };

  const filtered = patients.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selected) e.patient = "Please select a patient";
    if (!service.trim()) e.service = "Service is required";
    if (!amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      e.amount = "Enter a valid amount";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Step 1: create pending record on backend, then launch SDK
  const handleProceed = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/payments/initiate", {
        patientId: selected!._id,
        amount: parseFloat(amount),
        service,
        email,
      });
      setTxnRef(data.transactionRef);
      setShowPay(true);
    } catch (err: any) {
      show(err.message || "Could not initiate payment.", "error");
    } finally { setLoading(false); }
  };

  // Step 2: SDK calls onCompleted when done
  const handleCompleted = async (response: any) => {
    setShowPay(false);
    console.log("ISW response:", JSON.stringify(response));

    const success = response?.responseCode === "00" ||
                    response?.txnRef === txnRef;

    // Update status on backend
    try {
      await api.post("/payments/confirm", {
        transactionRef: txnRef,
        responseCode: response?.responseCode,
        interswitchRef: response?.transactionRef || response?.txnRef,
      });
    } catch {}

    setReceipt({
      status: success ? "success" : response?.responseCode === "Z6" ? "cancelled" : "failed",
      transactionRef: txnRef,
      service,
      amount: parseFloat(amount),
      responseCode: response?.responseCode,
    });

    show(success ? "Payment successful!" : "Payment was not completed.", success ? "success" : "warning");
    loadHistory();
  };

  const resetFlow = () => {
    setReceipt(null); setTxnRef(""); setShowPay(false);
    setService(""); setAmount(""); setEmail(""); setErrors({});
  };

  const cfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}

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
                onPress={() => { setSelected(item); setPickerOpen(false); resetFlow(); }}
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

        {/* Payment Form */}
        {!receipt && (
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
              ) : <Text style={s.pickerPlaceholder}>Select a patient…</Text>}
              <Ionicons name="chevron-down" size={18} color="#6b7280" />
            </TouchableOpacity>
            {errors.patient ? <Text style={s.errorText}>{errors.patient}</Text> : null}

            <Text style={s.label}>Service</Text>
            <TextInput style={[s.input, errors.service ? s.inputError : null]} placeholder="e.g. Consultation, Lab Test" placeholderTextColor="#9ca3af" value={service} onChangeText={(v) => { setService(v); setErrors((e) => ({ ...e, service: "" })); }} />
            {errors.service ? <Text style={s.errorText}>{errors.service}</Text> : null}

            <Text style={s.label}>Amount (₦)</Text>
            <TextInput style={[s.input, errors.amount ? s.inputError : null]} placeholder="e.g. 2500" placeholderTextColor="#9ca3af" keyboardType="numeric" value={amount} onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: "" })); }} />
            {errors.amount ? <Text style={s.errorText}>{errors.amount}</Text> : null}

            <Text style={s.label}>Patient Email (optional)</Text>
            <TextInput style={s.input} placeholder="patient@email.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleProceed} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="card-outline" size={18} color="#fff" /><Text style={s.btnText}> Pay with Interswitch</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* Interswitch SDK WebView — inline, full section */}
        {showPay && txnRef && iswConfig && (
          <View style={s.iswSection}>
            <View style={s.sectionHead}>
              <Ionicons name="lock-closed-outline" size={18} color="#7c3aed" />
              <Text style={s.sectionTitle}>Secure Payment</Text>
              <TouchableOpacity onPress={() => setShowPay(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <IswPaymentWebView
              ref={paymentRef}
              autoStart
              trnxRef={txnRef}
              merchantCode={iswConfig.merchantCode}
              payItem={{ id: iswConfig.payItemId, name: service }}
              amount={Math.round(parseFloat(amount) * 100)}
              currency={566}
              mode={iswConfig.mode}
              customer={{
                id: selected!._id,
                name: selected!.name,
                email: email || "patient@healthnet.ng",
              }}
              onCompleted={handleCompleted}
              showBackdrop
              indicatorColor="#16a34a"
              loadingText="Connecting to Interswitch…"
              style={{ height: 520 }}
            />
          </View>
        )}

        {/* Receipt */}
        {receipt && (
          <View style={s.section}>
            <View style={s.receiptHead}>
              <View style={[s.receiptIcon, { backgroundColor: cfg(receipt.status).bg }]}>
                <Ionicons name={cfg(receipt.status).icon as any} size={32} color={cfg(receipt.status).color} />
              </View>
              <Text style={s.receiptTitle}>
                {receipt.status === "success" ? "Payment Successful" : receipt.status === "cancelled" ? "Payment Cancelled" : "Payment Failed"}
              </Text>
            </View>

            {[
              { k: "Reference", v: receipt.transactionRef },
              { k: "Service",   v: receipt.service },
              { k: "Amount",    v: `₦${receipt.amount?.toLocaleString()}` },
              { k: "Response",  v: receipt.responseCode || "-" },
            ].map(({ k, v }) => (
              <View key={k} style={s.receiptRow}>
                <Text style={s.receiptKey}>{k}</Text>
                <Text style={s.receiptVal}>{v}</Text>
              </View>
            ))}

            <View style={[s.statusBadge, { backgroundColor: cfg(receipt.status).bg, alignSelf: "center", marginTop: 10 }]}>
              <Text style={[s.statusText, { color: cfg(receipt.status).color }]}>{receipt.status?.toUpperCase()}</Text>
            </View>

            <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={resetFlow}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={s.btnText}> New Payment</Text>
            </TouchableOpacity>
          </View>
        )}

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
              <Text style={s.emptyText}>Select a patient to view payment history.</Text>
            </View>
          ) : history.length === 0 && !historyLoading ? (
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={36} color="#d1d5db" />
              <Text style={s.emptyText}>No payment history for this patient.</Text>
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
                    <Text style={s.historyAmount}>₦{p.amount?.toLocaleString()}</Text>
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
  iswSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, minHeight: 580 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb", marginBottom: 4 },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  errorText: { fontSize: 12, color: "#dc2626", marginBottom: 4 },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  picker: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, backgroundColor: "#f9fafb", marginBottom: 4 },
  pickerError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  pickerPlaceholder: { flex: 1, color: "#9ca3af", fontSize: 14 },
  pickerSelected: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
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
  receiptHead: { alignItems: "center", marginBottom: 16, gap: 8 },
  receiptIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  receiptTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  receiptKey: { fontSize: 13, color: "#6b7280" },
  receiptVal: { fontSize: 13, fontWeight: "600", color: "#111827" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  emptyWrap: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  historyIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  historyService: { fontSize: 14, fontWeight: "600", color: "#111827" },
  historyRef: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  historyDate: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  historyAmount: { fontSize: 15, fontWeight: "700", color: "#111827" },
});
