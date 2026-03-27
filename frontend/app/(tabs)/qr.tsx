import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, FlatList, TextInput, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import api from "@/lib/api";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/use-toast";

type Patient = { _id: string; name: string; age?: number; gender?: string };

export default function QRScreen() {
  const router = useRouter();
  const { toast, show, hide } = useToast();

  // Generate
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Scan
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [decoded, setDecoded] = useState<any>(null);
  const [decoding, setDecoding] = useState(false);
  const scanned = useRef(false);

  useEffect(() => {
    api.get("/patients?limit=100").then(({ data }) => {
      setPatients(data.entry?.map((e: any) => e) ?? []);
    }).catch(() => {});
  }, []);

  const filtered = patients.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const generateQR = async () => {
    if (!selected) { show("Please select a patient first.", "warning"); return; }
    setLoading(true); setQrImage(null);
    try {
      const { data } = await api.get(`/qr/generate/${selected._id}`);
      setQrImage(data.qr);
      show("QR code generated successfully.", "success");
    } catch (err: any) {
      show(err.message || "Could not generate QR code.", "error");
    } finally { setLoading(false); }
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned.current || decoding) return;
    scanned.current = true;
    setScanning(false);
    setDecoding(true);
    setDecoded(null);
    try {
      const res = await api.post("/qr/decode", { encrypted: data });
      setDecoded(res.data);
    } catch (err: any) {
      show(err.message || "Could not decode QR code.", "error");
    } finally { setDecoding(false); }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { show("Camera permission is required to scan QR codes.", "warning"); return; }
    }
    scanned.current = false;
    setDecoded(null);
    setScanning(true);
  };

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
                onPress={() => { setSelected(item); setPickerOpen(false); setQrImage(null); }}
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

      {/* Camera Scanner Modal */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleScan}
          />
          <View style={s.scanOverlay}>
            <View style={s.scanFrame} />
            <Text style={s.scanHint}>Point camera at a HealthNet QR code</Text>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setScanning(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Generate Section */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Ionicons name="qr-code-outline" size={20} color="#7c3aed" />
            <Text style={s.sectionTitle}>Generate Patient QR</Text>
          </View>
          <Text style={s.hint}>Creates an encrypted QR code to share patient records securely.</Text>

          <TouchableOpacity style={s.picker} onPress={() => setPickerOpen(true)}>
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

          <TouchableOpacity style={[s.btn, s.btnPurple, loading && s.btnDisabled]} onPress={generateQR} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="qr-code-outline" size={18} color="#fff" /><Text style={s.btnText}> Generate QR</Text></>}
          </TouchableOpacity>

          {qrImage && (
            <View style={s.qrContainer}>
              <Image source={{ uri: qrImage }} style={s.qrImage} resizeMode="contain" />
              <View style={s.qrBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#7c3aed" />
                <Text style={s.qrBadgeText}>Encrypted · Show at receiving facility</Text>
              </View>
            </View>
          )}
        </View>

        {/* Scan Section */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Ionicons name="scan-outline" size={20} color="#0891b2" />
            <Text style={s.sectionTitle}>Scan Patient QR</Text>
          </View>
          <Text style={s.hint}>Use the camera to scan a HealthNet QR code and view patient data.</Text>

          <TouchableOpacity style={[s.btn, s.btnBlue, decoding && s.btnDisabled]} onPress={openScanner} disabled={decoding}>
            {decoding
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="camera-outline" size={18} color="#fff" /><Text style={s.btnText}> Scan QR Code</Text></>}
          </TouchableOpacity>

          {decoded && (
            <View style={s.decodedCard}>
              <View style={s.decodedHeader}>
                <View style={s.decodedAvatar}>
                  <Text style={s.decodedAvatarText}>{decoded.patient?.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.decodedName}>{decoded.patient?.name}</Text>
                  <Text style={s.decodedMeta}>{decoded.patient?.age} yrs · {decoded.patient?.gender}</Text>
                </View>
              </View>

              {decoded.patient?.allergies?.length > 0 && (
                <View style={s.allergyBadge}>
                  <Ionicons name="warning-outline" size={14} color="#dc2626" />
                  <Text style={s.allergyText}>Allergies: {decoded.patient.allergies.join(", ")}</Text>
                </View>
              )}

              <View style={s.decodedStat}>
                <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                <Text style={s.decodedStatText}>{decoded.visits?.length ?? 0} visit(s) included</Text>
              </View>

              <TouchableOpacity
                style={s.viewBtn}
                onPress={() => router.push(`/patients/${decoded.patient?._id}`)}
              >
                <Text style={s.viewBtnText}>View Full Record</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
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
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  hint: { fontSize: 12, color: "#9ca3af", marginBottom: 14 },
  btn: { borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  btnPurple: { backgroundColor: "#7c3aed" },
  btnBlue: { backgroundColor: "#0891b2" },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Picker
  picker: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, backgroundColor: "#f9fafb", marginBottom: 12 },
  pickerPlaceholder: { flex: 1, color: "#9ca3af", fontSize: 14 },
  pickerSelected: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  // Modal
  modal: { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  searchInput: { margin: 16, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, fontSize: 14, color: "#111827", backgroundColor: "#f9fafb" },
  patientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#f3f4f6" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#7c3aed" },
  patientName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  patientMeta: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40, fontSize: 14 },
  // QR
  qrContainer: { alignItems: "center", marginTop: 18, gap: 10 },
  qrImage: { width: 220, height: 220, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  qrBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ede9fe", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  qrBadgeText: { fontSize: 12, color: "#7c3aed", fontWeight: "600" },
  // Scanner overlay
  scanOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 20 },
  scanFrame: { width: 240, height: 240, borderWidth: 3, borderColor: "#fff", borderRadius: 16 },
  scanHint: { color: "#fff", fontSize: 14, fontWeight: "600", textShadowColor: "#000", textShadowRadius: 4 },
  cancelBtn: { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  cancelBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Decoded card
  decodedCard: { marginTop: 16, backgroundColor: "#f0fdf4", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#bbf7d0", gap: 10 },
  decodedHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  decodedAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  decodedAvatarText: { fontSize: 18, fontWeight: "800", color: "#16a34a" },
  decodedName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  decodedMeta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  allergyBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef2f2", borderRadius: 8, padding: 8 },
  allergyText: { fontSize: 13, color: "#dc2626", fontWeight: "600" },
  decodedStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  decodedStatText: { fontSize: 13, color: "#6b7280" },
  viewBtn: { backgroundColor: "#16a34a", borderRadius: 10, padding: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 4 },
  viewBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
