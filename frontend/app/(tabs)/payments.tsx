import { useState, useEffect } from "react";
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
type Payment  = { _id: string; service: string; amount: number; status: string; transactionRef: string; createdAt: string };

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  success:   { color: "#16a34a", bg: "#dcfce7", icon: "checkmark-circle" },
  failed:    { color: "#dc2626", bg: "#fee2e2", icon: "close-circle" },
  cancelled: { color: "#d97706", bg: "#fef3c7", icon: "close-circle-outline" },
  pending:   { color: "#d97706", bg: "#fef3c7", icon: "time" },
};

// Interswitch shared sandbox credentials
const MERCHANT_CODE = "MX6072";
const PAY_ITEM_ID   = "9405967";
const CHECKOUT_URL  = "https://newwebpay.qa.interswitchng.com/inline-checkout.js";

export default function PaymentsScreen() {
  const { toast, show, hide } = useToast();

  const [patients, setPatients]       = useState<Patient[]>([]);
  const [search, setSearch]           = useState("");
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [selected, setSelected]       = useState<Patient | null>(null);

  const [service, setService] = useState("");
  const [amount, setAmount]   = useState("");
  const [email, setEmail]     = useState("");
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const [txnRef, setTxnRef]   = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const [history, setHistory]               = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const handleMessage = async (event: any) => {
    try {
      const response = JSON.parse(event.nativeEvent.data);
      console.log("ISW response:", JSON.stringify(response));
      setShowPay(false);

      const responseCode = response?.resp;
      const success   = responseCode === "00";
      const cancelled = responseCode === "Z6";

      try {
        await api.post("/payments/confirm", {
          transactionRef: txnRef,
          responseCode,
          interswitchRef: response?.payRef || response?.retRef,
        });
      } catch {}

      setReceipt({
        status: success ? "success" : cancelled ? "cancelled" : "failed",
        transactionRef: txnRef,
        service,
        amount: parseFloat(amount),
        responseCode,
        desc: response?.desc,
      });

      show(
        success ? "Payment successful!" : cancelled ? "Payment cancelled." : "Payment failed.",
        success ? "success" : "warning"
      );
      loadHistory();
    } catch {}
  };

  const resetFlow = () => {
    setReceipt(null); setTxnRef(null); setShowPay(false);
    setService(""); setAmount(""); setEmail(""); setErrors({});
  };

  const cfg = (status: string) => STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  // JS injected into WebView after page loads — loads ISW script then triggers checkout
  const getInjectedJS = (ref: string, kobo: number, custEmail: string, custName: string) => `
    (function() {
      var script = document.createElement('script');
      script.src = '${CHECKOUT_URL}';
      script.onload = function() {
        var attempts = 0;
        var poll = setInterval(function() {
          attempts++;
          if (typeof window.webpayCheckout === 'function') {
            clearInterval(poll);
            window.webpayCheckout({
              merchant_code: '${MERCHANT_CODE}',
              pay_item_id: '${PAY_ITEM_ID}',
              txn_ref: '${ref}',
              amount: ${kobo},
              currency: 566,
              cust_email: '${custEmail}',
              cust_name: '${custName}',
              mode: 'TEST',
              onComplete: function(resp) {
                window.ReactNativeWebView.postMessage(JSON.stringify(resp));
              }
            });
          } else if (attempts > 20) {
            clearInterval(poll);
            window.ReactNativeWebView.postMessage(JSON.stringify({resp:'ERR',desc:'webpayCheckout not available'}));
          }
        }, 300);
      };
      script.onerror = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({resp:'ERR',desc:'Failed to load checkout script'}));
      };
      document.head.appendChild(script);
    })();
    true;
  `;

  const amountKobo = amount ? Math.round(parseFloat(amount) * 100) : 0;
  const custEmail  = email || "patient@healthnet.ng";
  const custName   = selected?.name || "Patient";

  return (
    <View style={{ flex: 1 }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}

      {/* Interswitch Checkout Modal */}
      <Modal visible={showPay} animationType="slide" onRequestClose={() => setShowPay(false)}>
        <View style={{ flex: 1, paddingTop: 50, backgroundColor: "#fff" }}>
          <View style={s.webviewHeader}>
            <Ionicons name="lock-closed-outline" size={16} color="#16a34a" />
            <Text style={s.webviewTitle}>Secure Payment</Text>
            <TouchableOpacity onPress={() => setShowPay(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          {txnRef && (
            <WebView
              source={{ uri: "https://newwebpay.qa.interswitchng.com" }}
              injectedJavaScript={getInjectedJS(txnRef, amountKobo, custEmail, custName)}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={["*"]}
              style={{ flex: 1 }}
              renderLoading={() => (
                <View style={s.webviewLoader}>
                  <ActivityIndicator size="large" color="#16a34a" />
                  <Text style={s.webviewLoaderText}>Connecting to Interswitch…</Text>
                </View>
              )}
              startInLoadingState
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
              {receipt.desc ? <Text style={s.receiptDesc}>{receipt.desc}</Text> : null}
            </View>

            {[
              { k: "Reference", v: receipt.transactionRef },
              { k: "Service",   v: receipt.service },
              { k: "Amount",    v: `₦${receipt.amount?.toLocaleString()}` },
              { k: "Code",      v: receipt.responseCode || "-" },
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
  webviewHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  webviewTitle: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  webviewLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  webviewLoaderText: { fontSize: 14, color: "#6b7280" },
  receiptHead: { alignItems: "center", marginBottom: 16, gap: 6 },
  receiptIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },
  receiptTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  receiptDesc: { fontSize: 13, color: "#6b7280", textAlign: "center" },
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
