import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";

type Payment = { _id: string; service: string; amount: number; status: string; transactionRef: string; createdAt: string };

export default function PaymentsScreen() {
  const [form, setForm] = useState({ patientId: "", amount: "", service: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const initiatePayment = async () => {
    if (!form.patientId || !form.amount || !form.service)
      return Alert.alert("Error", "Patient ID, amount and service are required");
    setLoading(true);
    try {
      const { data } = await api.post("/payments/initiate", {
        patientId: form.patientId,
        amount: parseFloat(form.amount),
        service: form.service,
        email: form.email,
      });
      setReceipt(data);
      Alert.alert("Payment Initiated", `Ref: ${data.transactionRef}\nAmount: ₦${form.amount}\nService: ${form.service}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!form.patientId) return Alert.alert("Error", "Enter a patient ID first");
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/payments/patient/${form.patientId}`);
      setHistory(data);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const statusColor = (s: string) => s === "success" ? "#16a34a" : s === "failed" ? "#dc2626" : "#d97706";

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.section}>
        <Text style={s.sectionTitle}>Process Payment</Text>

        {[
          { key: "patientId", placeholder: "Patient ID", autoCapitalize: "none" as const },
          { key: "service", placeholder: "Service (e.g. Consultation, Lab Test)" },
          { key: "amount", placeholder: "Amount (₦)", keyboardType: "numeric" as const },
          { key: "email", placeholder: "Patient Email (optional)", keyboardType: "email-address" as const, autoCapitalize: "none" as const },
        ].map(({ key, placeholder, keyboardType, autoCapitalize }) => (
          <TextInput
            key={key}
            style={s.input}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize ?? "sentences"}
            value={form[key as keyof typeof form]}
            onChangeText={set(key)}
          />
        ))}

        <TouchableOpacity style={s.btn} onPress={initiatePayment} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="card-outline" size={18} color="#fff" /><Text style={s.btnText}> Initiate Payment</Text></>
          )}
        </TouchableOpacity>

        {receipt && (
          <View style={s.receipt}>
            <Text style={s.receiptTitle}>🧾 Payment Receipt</Text>
            <Text style={s.receiptLine}>Ref: {receipt.transactionRef}</Text>
            <Text style={s.receiptLine}>Service: {receipt.payment?.service}</Text>
            <Text style={s.receiptLine}>Amount: ₦{receipt.payment?.amount}</Text>
            <Text style={[s.receiptLine, { color: statusColor(receipt.payment?.status) }]}>
              Status: {receipt.payment?.status?.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Payment History */}
      <View style={s.section}>
        <View style={s.historyHeader}>
          <Text style={s.sectionTitle}>Payment History</Text>
          <TouchableOpacity onPress={loadHistory} disabled={historyLoading}>
            {historyLoading
              ? <ActivityIndicator size="small" color="#16a34a" />
              : <Ionicons name="refresh-outline" size={22} color="#16a34a" />}
          </TouchableOpacity>
        </View>

        {history.length === 0
          ? <Text style={s.empty}>Enter a patient ID and tap refresh to load history.</Text>
          : history.map((p) => (
            <View key={p._id} style={s.historyCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.historyService}>{p.service}</Text>
                <Text style={s.historyRef}>{p.transactionRef}</Text>
                <Text style={s.historyDate}>{new Date(p.createdAt).toLocaleDateString()}</Text>
              </View>
              <View>
                <Text style={s.historyAmount}>₦{p.amount}</Text>
                <Text style={[s.historyStatus, { color: statusColor(p.status) }]}>{p.status.toUpperCase()}</Text>
              </View>
            </View>
          ))}
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
  receipt: { marginTop: 14, backgroundColor: "#f0fdf4", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#bbf7d0" },
  receiptTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 8 },
  receiptLine: { fontSize: 13, color: "#374151", marginBottom: 4 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  empty: { fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 12 },
  historyCard: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  historyService: { fontSize: 14, fontWeight: "600", color: "#111827" },
  historyRef: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  historyDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  historyAmount: { fontSize: 15, fontWeight: "700", color: "#111827", textAlign: "right" },
  historyStatus: { fontSize: 11, fontWeight: "600", textAlign: "right", marginTop: 2 },
});
