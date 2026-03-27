import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, FlatList, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

type Step = "form" | "card" | "otp" | "done";

export default function PaymentsScreen() {
  const { toast, show, hide } = useToast();

  // Patient picker
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);

  // Payment form
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Card details
  const [pan, setPan] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [pin, setPin] = useState("");

  // OTP
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  // Flow
  const [step, setStep] = useState<Step>("form");
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  // History
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    api.get("/patients?limit=100").then(({ data }) => {
      setPatients(data.entry?.map((e: any) => e) ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) loadHistory();
  }, [selected]);

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
    if (!amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) e.amount = "Enter a valid amount";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Step 1: create pending record
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
      setPendingRef(data.transactionRef);
      setStep("card");
    } catch (err: any) {
      show(err.message || "Could not initiate payment.", "error");
    } finally { setLoading(false); }
  };

  // Step 2: charge card
  const handlePay = async () => {
    if (!pan || !expiry || !cvv) { show("Fill in all card details.", "warning"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/payments/pay", {
        transactionRef: pendingRef,
        pan: pan.replace(/\s/g, ""),
        expiry: expiry.replace("/", ""),
        cvv,
        pin,
      });

      if (data.requiresOtp) {
        setOtpMessage(data.message || "Enter the OTP sent to your phone.");
        setStep("otp");
      } else {
        setReceipt(data);
        setStep("done");
        show(data.status === "success" ? "Payment successful!" : "Payment failed.", data.status === "success" ? "success" : "error");
        loadHistory();
      }
    } catch (err: any) {
      show(err.message || "Card charge failed.", "error");
    } finally { setLoading(false); }
  };

  // Step 3: submit OTP
  const handleOtp = async () => {
    if (!otp.trim()) { show("Enter the OTP.", "warning"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/payments/otp", { transactionRef: pendingRef, otp });
      setReceipt(data);
      setStep("done");
      show(data.status === "success" ? "Payment successful!" : "Payment failed.", data.status === "success" ? "success" : "error");
      loadHistory();
    } catch (err: any) {
      show(err.message || "OTP verification failed.", "error");
    } finally { setLoading(false); }
  };

  const resetFlow = () => {
    setStep("form"); setPendingRef(null); setReceipt(null);
    setPan(""); setExpiry(""); setCvv(""); setPin(""); setOtp("");
    setService(""); setAmount(""); setEmail("");
    setErrors({});
  };

  // Format card number with spaces
  const formatPan = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  // Format expiry MM/YY
  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
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

        {/* ── STEP: FORM ── */}
        {step === "form" && (
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
              {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="arrow-forward-circle-outline" size={18} color="#fff" /><Text style={s.btnText}> Continue to Payment</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: CARD ── */}
        {step === "card" && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Ionicons name="card-outline" size={20} color="#7c3aed" />
              <Text style={s.sectionTitle}>Enter Card Details</Text>
            </View>

            <View style={s.summaryBadge}>
              <Text style={s.summaryText}>{selected?.name} · {service} · ₦{parseFloat(amount).toLocaleString()}</Text>
            </View>

            <Text style={s.label}>Card Number</Text>
            <TextInput
              style={s.input}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={pan}
              onChangeText={(v) => setPan(formatPan(v))}
              maxLength={19}
            />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Expiry (MM/YY)</Text>
                <TextInput style={s.input} placeholder="MM/YY" placeholderTextColor="#9ca3af" keyboardType="numeric" value={expiry} onChangeText={(v) => setExpiry(formatExpiry(v))} maxLength={5} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.label}>CVV</Text>
                <TextInput style={s.input} placeholder="123" placeholderTextColor="#9ca3af" keyboardType="numeric" secureTextEntry value={cvv} onChangeText={setCvv} maxLength={4} />
              </View>
            </View>

            <Text style={s.label}>Card PIN</Text>
            <TextInput style={s.input} placeholder="••••" placeholderTextColor="#9ca3af" keyboardType="numeric" secureTextEntry value={pin} onChangeText={setPin} maxLength={4} />

            <View style={s.secureNote}>
              <Ionicons name="lock-closed-outline" size={13} color="#6b7280" />
              <Text style={s.secureText}>Secured by Interswitch · PCI DSS Compliant</Text>
            </View>

            <TouchableOpacity style={[s.btn, s.btnPurple, loading && s.btnDisabled]} onPress={handlePay} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="card-outline" size={18} color="#fff" /><Text style={s.btnText}> Pay ₦{parseFloat(amount).toLocaleString()}</Text></>}
            </TouchableOpacity>

            <TouchableOpacity style={s.backBtn} onPress={() => setStep("form")}>
              <Text style={s.backBtnText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: OTP ── */}
        {step === "otp" && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#0891b2" />
              <Text style={s.sectionTitle}>Enter OTP</Text>
            </View>
            <Text style={s.hint}>{otpMessage}</Text>

            <Text style={s.label}>One-Time Password</Text>
            <TextInput
              style={[s.input, s.otpInput]}
              placeholder="Enter OTP"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={otp}
              onChangeText={setOtp}
              maxLength={8}
            />

            <TouchableOpacity style={[s.btn, s.btnBlue, loading && s.btnDisabled]} onPress={handleOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={s.btnText}> Verify OTP</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && receipt && (
          <View style={s.section}>
            <View style={s.receiptHead}>
              <View style={[s.receiptIcon, { backgroundColor: cfg(receipt.status).bg }]}>
                <Ionicons name={cfg(receipt.status).icon as any} size={32} color={cfg(receipt.status).color} />
              </View>
              <Text style={s.receiptTitle}>
                {receipt.status === "success" ? "Payment Successful" : "Payment Failed"}
              </Text>
            </View>

            {[
              { k: "Reference", v: receipt.transactionRef },
              { k: "Service",   v: receipt.service },
              { k: "Amount",    v: `₦${receipt.amount?.toLocaleString()}` },
              ...(receipt.interswitchRef ? [{ k: "Interswitch Ref", v: receipt.interswitchRef }] : []),
            ].map(({ k, v }) => (
              <View key={k} style={s.receiptRow}>
                <Text style={s.receiptKey}>{k}</Text>
                <Text style={s.receiptVal}>{v}</Text>
              </View>
            ))}

            <View style={[s.statusBadge, { backgroundColor: cfg(receipt.status).bg, alignSelf: "center", marginTop: 8 }]}>
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
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb", marginBottom: 4 },
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  errorText: { fontSize: 12, color: "#dc2626", marginBottom: 4 },
  row: { flexDirection: "row" },
  btn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 },
  btnPurple: { backgroundColor: "#7c3aed" },
  btnBlue: { backgroundColor: "#0891b2" },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  backBtn: { marginTop: 12, alignItems: "center" },
  backBtnText: { color: "#6b7280", fontSize: 14 },
  // Picker
  picker: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, backgroundColor: "#f9fafb", marginBottom: 4 },
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
  // Card
  summaryBadge: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#bbf7d0" },
  summaryText: { fontSize: 13, color: "#16a34a", fontWeight: "600", textAlign: "center" },
  secureNote: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, justifyContent: "center" },
  secureText: { fontSize: 11, color: "#9ca3af" },
  // OTP
  hint: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  otpInput: { fontSize: 22, textAlign: "center", letterSpacing: 8, fontWeight: "700" },
  // Receipt
  receiptHead: { alignItems: "center", marginBottom: 16, gap: 8 },
  receiptIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  receiptTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  receiptKey: { fontSize: 13, color: "#6b7280" },
  receiptVal: { fontSize: 13, fontWeight: "600", color: "#111827", flexShrink: 1, textAlign: "right", marginLeft: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  // History
  emptyWrap: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  historyIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  historyService: { fontSize: 14, fontWeight: "600", color: "#111827" },
  historyRef: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  historyDate: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  historyAmount: { fontSize: 15, fontWeight: "700", color: "#111827" },
});
