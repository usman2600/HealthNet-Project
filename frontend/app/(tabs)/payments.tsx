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
import { C } from "@/constants/theme";

type Patient = { _id: string; name: string; age?: number; gender?: string };
type Payment  = { _id: string; service: string; amount: number; status: string; transactionRef: string; createdAt: string };

const STATUS: Record<string, { color: string; bg: string; icon: string }> = {
  success:   { color: C.primary, bg: C.primaryLight,   icon: "checkmark-circle" },
  failed:    { color: C.error,   bg: C.errorLight,      icon: "close-circle" },
  cancelled: { color: C.warning, bg: C.warningLight,    icon: "close-circle-outline" },
  pending:   { color: C.warning, bg: C.warningLight,    icon: "time" },
};

const MERCHANT_CODE = "MX180552";
const PAY_ITEM_ID   = "Default_Payable_MX180552";
const CHECKOUT_URL  = "https://newwebpay.interswitchng.com/inline-checkout.js";

export default function PaymentsScreen() {
  const { toast, show, hide } = useToast();

  const [patients, setPatients]     = useState<Patient[]>([]);
  const [search, setSearch]         = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected]     = useState<Patient | null>(null);

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
        patientId: selected!._id, amount: parseFloat(amount), service, email,
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
      setShowPay(false);
      const responseCode = response?.resp;
      const success   = responseCode === "00";
      const cancelled = responseCode === "Z6";
      try {
        await api.post("/payments/confirm", {
          transactionRef: txnRef, responseCode,
          interswitchRef: response?.payRef || response?.retRef,
        });
      } catch {}
      setReceipt({
        status: success ? "success" : cancelled ? "cancelled" : "failed",
        transactionRef: txnRef, service, amount: parseFloat(amount), responseCode, desc: response?.desc,
      });
      show(success ? "Payment successful!" : cancelled ? "Payment cancelled." : "Payment failed.", success ? "success" : "warning");
      loadHistory();
    } catch {}
  };

  const resetFlow = () => {
    setReceipt(null); setTxnRef(null); setShowPay(false);
    setService(""); setAmount(""); setEmail(""); setErrors({});
  };

  const cfg = (status: string) => STATUS[status] ?? STATUS.pending;

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
              mode: 'LIVE',
              onComplete: function(resp) { window.ReactNativeWebView.postMessage(JSON.stringify(resp)); }
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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}

      {/* Checkout Modal */}
      <Modal visible={showPay} animationType="slide" onRequestClose={() => setShowPay(false)}>
        <View style={{ flex: 1, paddingTop: 50, backgroundColor: C.surface }}>
          <View style={s.webviewHeader}>
            <Ionicons name="lock-closed-outline" size={15} color={C.primary} />
            <Text style={s.webviewTitle}>Secure Payment</Text>
            <TouchableOpacity onPress={() => setShowPay(false)} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          {txnRef && (
            <WebView
              source={{ uri: "https://newwebpay.interswitchng.com" }}
              injectedJavaScript={getInjectedJS(txnRef, amountKobo, custEmail, custName)}
              onMessage={handleMessage}
              javaScriptEnabled domStorageEnabled originWhitelist={["*"]} style={{ flex: 1 }}
              renderLoading={() => (
                <View style={s.webviewLoader}>
                  <ActivityIndicator size="large" color={C.primary} />
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
            <TouchableOpacity onPress={() => setPickerOpen(false)} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={s.modalSearch}>
            <Ionicons name="search-outline" size={16} color={C.textMuted} />
            <TextInput
              style={s.modalSearchInput}
              placeholder="Search…"
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
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

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Payment Form */}
        {!receipt && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionIcon, { backgroundColor: C.primaryLight }]}>
                <Ionicons name="card-outline" size={18} color={C.primary} />
              </View>
              <View>
                <Text style={s.sectionTitle}>Process Payment</Text>
                <Text style={s.sectionSub}>Powered by Interswitch</Text>
              </View>
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
              <Ionicons name="chevron-down" size={16} color={C.textMuted} />
            </TouchableOpacity>
            {errors.patient ? <Text style={s.errorText}>{errors.patient}</Text> : null}

            <Text style={s.label}>Service</Text>
            <TextInput style={[s.input, errors.service ? s.inputError : null]} placeholder="e.g. Consultation, Lab Test" placeholderTextColor={C.textMuted} value={service} onChangeText={(v) => { setService(v); setErrors((e) => ({ ...e, service: "" })); }} />
            {errors.service ? <Text style={s.errorText}>{errors.service}</Text> : null}

            <Text style={s.label}>Amount (₦)</Text>
            <TextInput style={[s.input, errors.amount ? s.inputError : null]} placeholder="e.g. 2500" placeholderTextColor={C.textMuted} keyboardType="numeric" value={amount} onChangeText={(v) => { setAmount(v); setErrors((e) => ({ ...e, amount: "" })); }} />
            {errors.amount ? <Text style={s.errorText}>{errors.amount}</Text> : null}

            <Text style={s.label}>Patient Email (optional)</Text>
            <TextInput style={s.input} placeholder="patient@email.com" placeholderTextColor={C.textMuted} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleProceed} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="card-outline" size={17} color="#fff" /><Text style={s.btnText}>Pay with Interswitch</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {/* Receipt */}
        {receipt && (
          <View style={s.section}>
            <View style={s.receiptHead}>
              <View style={[s.receiptIcon, { backgroundColor: cfg(receipt.status).bg }]}>
                <Ionicons name={cfg(receipt.status).icon as any} size={30} color={cfg(receipt.status).color} />
              </View>
              <Text style={s.receiptTitle}>
                {receipt.status === "success" ? "Payment Successful" : receipt.status === "cancelled" ? "Cancelled" : "Payment Failed"}
              </Text>
              {receipt.desc ? <Text style={s.receiptDesc}>{receipt.desc}</Text> : null}
            </View>

            {[
              { k: "Reference", v: receipt.transactionRef },
              { k: "Service",   v: receipt.service },
              { k: "Amount",    v: `₦${receipt.amount?.toLocaleString()}` },
              { k: "Code",      v: receipt.responseCode || "—" },
            ].map(({ k, v }) => (
              <View key={k} style={s.receiptRow}>
                <Text style={s.receiptKey}>{k}</Text>
                <Text style={s.receiptVal}>{v}</Text>
              </View>
            ))}

            <View style={[s.badge, { backgroundColor: cfg(receipt.status).bg, alignSelf: "center", marginTop: 12 }]}>
              <Text style={[s.badgeText, { color: cfg(receipt.status).color }]}>{receipt.status?.toUpperCase()}</Text>
            </View>

            <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={resetFlow}>
              <Ionicons name="add-circle-outline" size={17} color="#fff" />
              <Text style={s.btnText}>New Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* History */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.sectionIcon, { backgroundColor: C.blueLight }]}>
              <Ionicons name="time-outline" size={18} color={C.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>Payment History</Text>
              {selected && <Text style={s.sectionSub}>{selected.name}</Text>}
            </View>
            {historyLoading && <ActivityIndicator size="small" color={C.primary} />}
          </View>

          {!selected ? (
            <View style={s.emptyWrap}>
              <Ionicons name="person-outline" size={34} color={C.borderMid} />
              <Text style={s.emptyText}>Select a patient to view history.</Text>
            </View>
          ) : history.length === 0 && !historyLoading ? (
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={34} color={C.borderMid} />
              <Text style={s.emptyText}>No payment history yet.</Text>
            </View>
          ) : (
            history.map((p) => {
              const c = cfg(p.status);
              return (
                <View key={p._id} style={s.historyCard}>
                  <View style={[s.historyIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={c.icon as any} size={16} color={c.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyService}>{p.service}</Text>
                    <Text style={s.historyDate}>{new Date(p.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.historyAmount}>₦{p.amount?.toLocaleString()}</Text>
                    <View style={[s.badge, { backgroundColor: c.bg, marginTop: 3 }]}>
                      <Text style={[s.badgeText, { color: c.color }]}>{p.status.toUpperCase()}</Text>
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
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: C.surface, borderRadius: C.radiusLg, padding: 18, marginBottom: 14, ...C.shadow },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sectionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  sectionSub: { fontSize: 12, color: C.textSub, marginTop: 1 },
  label: { fontSize: 12, fontWeight: "600", color: C.textSub, marginBottom: 5, marginTop: 12 },
  input: { borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radiusSm, padding: 12, fontSize: 14, color: C.text, backgroundColor: C.bg },
  inputError: { borderColor: C.error, backgroundColor: C.errorLight },
  errorText: { fontSize: 12, color: C.error, marginTop: 3 },
  btn: { backgroundColor: C.primary, borderRadius: C.radius, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  picker: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radiusSm, padding: 12, backgroundColor: C.bg, marginTop: 0 },
  pickerError: { borderColor: C.error, backgroundColor: C.errorLight },
  pickerPlaceholder: { flex: 1, color: C.textMuted, fontSize: 14 },
  pickerSelected: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  modal: { flex: 1, backgroundColor: C.surface, paddingTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text },
  closeBtn: { padding: 6, backgroundColor: C.border, borderRadius: 8 },
  modalSearch: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.bg },
  modalSearchInput: { flex: 1, fontSize: 14, color: C.text },
  patientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.border },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 15, fontWeight: "700", color: C.primary },
  patientName: { fontSize: 14, fontWeight: "600", color: C.text },
  patientMeta: { fontSize: 12, color: C.textSub, marginTop: 1 },
  empty: { textAlign: "center", color: C.textMuted, marginTop: 40, fontSize: 14 },
  webviewHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: C.border },
  webviewTitle: { fontSize: 15, fontWeight: "700", color: C.text, flex: 1 },
  webviewLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: C.surface },
  webviewLoaderText: { fontSize: 14, color: C.textSub },
  receiptHead: { alignItems: "center", marginBottom: 16, gap: 6 },
  receiptIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  receiptTitle: { fontSize: 17, fontWeight: "700", color: C.text },
  receiptDesc: { fontSize: 13, color: C.textSub, textAlign: "center" },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  receiptKey: { fontSize: 13, color: C.textSub },
  receiptVal: { fontSize: 13, fontWeight: "600", color: C.text },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  emptyWrap: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { fontSize: 13, color: C.textMuted, textAlign: "center" },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  historyIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  historyService: { fontSize: 14, fontWeight: "600", color: C.text },
  historyDate: { fontSize: 12, color: C.textSub, marginTop: 1 },
  historyAmount: { fontSize: 14, fontWeight: "700", color: C.text },
});
