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
import { C } from "@/constants/theme";

type Patient = { _id: string; name: string; age?: number; gender?: string };

export default function QRScreen() {
  const router = useRouter();
  const { toast, show, hide } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (!granted) { show("Camera permission required.", "warning"); return; }
    }
    scanned.current = false;
    setDecoded(null);
    setScanning(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={hide} />}

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
            <Text style={s.scanHint}>Point at a HealthNet QR code</Text>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setScanning(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Generate */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.sectionIcon, { backgroundColor: C.purpleLight }]}>
              <Ionicons name="qr-code-outline" size={18} color={C.purple} />
            </View>
            <View>
              <Text style={s.sectionTitle}>Generate QR</Text>
              <Text style={s.sectionSub}>Share encrypted patient records</Text>
            </View>
          </View>

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
            <Ionicons name="chevron-down" size={16} color={C.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, { backgroundColor: C.purple }, loading && s.btnDisabled]} onPress={generateQR} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="qr-code-outline" size={17} color="#fff" /><Text style={s.btnText}>Generate QR Code</Text></>}
          </TouchableOpacity>

          {qrImage && (
            <View style={s.qrContainer}>
              <Image source={{ uri: qrImage }} style={s.qrImage} resizeMode="contain" />
              <View style={s.qrBadge}>
                <Ionicons name="shield-checkmark-outline" size={13} color={C.purple} />
                <Text style={s.qrBadgeText}>Encrypted · Show at receiving facility</Text>
              </View>
            </View>
          )}
        </View>

        {/* Scan */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={[s.sectionIcon, { backgroundColor: C.blueLight }]}>
              <Ionicons name="scan-outline" size={18} color={C.blue} />
            </View>
            <View>
              <Text style={s.sectionTitle}>Scan QR</Text>
              <Text style={s.sectionSub}>Read patient data from a QR code</Text>
            </View>
          </View>

          <TouchableOpacity style={[s.btn, { backgroundColor: C.blue }, decoding && s.btnDisabled]} onPress={openScanner} disabled={decoding}>
            {decoding
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="camera-outline" size={17} color="#fff" /><Text style={s.btnText}>Open Camera</Text></>}
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
                  <Ionicons name="warning-outline" size={13} color={C.error} />
                  <Text style={s.allergyText}>Allergies: {decoded.patient.allergies.join(", ")}</Text>
                </View>
              )}

              <Text style={s.visitCount}>{decoded.visits?.length ?? 0} visit(s) included</Text>

              <TouchableOpacity style={s.viewBtn} onPress={() => router.push(`/patients/${decoded.patient?._id}`)}>
                <Text style={s.viewBtnText}>View Full Record</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
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
  btn: { borderRadius: C.radius, padding: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  picker: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: C.borderMid, borderRadius: C.radius,
    padding: 12, backgroundColor: C.bg, marginBottom: 12,
  },
  pickerPlaceholder: { flex: 1, color: C.textMuted, fontSize: 14 },
  pickerSelected: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  modal: { flex: 1, backgroundColor: C.surface, paddingTop: 50 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text },
  closeBtn: { padding: 6, backgroundColor: C.border, borderRadius: 8 },
  modalSearch: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 16, borderWidth: 1, borderColor: C.borderMid,
    borderRadius: C.radius, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.bg,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: C.text },
  patientRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: C.border,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleLight, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 15, fontWeight: "700", color: C.purple },
  patientName: { fontSize: 14, fontWeight: "600", color: C.text },
  patientMeta: { fontSize: 12, color: C.textSub, marginTop: 1 },
  empty: { textAlign: "center", color: C.textMuted, marginTop: 40, fontSize: 14 },
  qrContainer: { alignItems: "center", marginTop: 18, gap: 10 },
  qrImage: { width: 200, height: 200, borderRadius: C.radius, borderWidth: 1, borderColor: C.borderMid },
  qrBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.purpleLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  qrBadgeText: { fontSize: 12, color: C.purple, fontWeight: "600" },
  scanOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", gap: 20 },
  scanFrame: { width: 220, height: 220, borderWidth: 2.5, borderColor: "#fff", borderRadius: C.radius },
  scanHint: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cancelBtn: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: C.radius, paddingHorizontal: 28, paddingVertical: 12 },
  cancelBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  decodedCard: { marginTop: 14, backgroundColor: C.bg, borderRadius: C.radius, padding: 14, borderWidth: 1, borderColor: C.primaryMid, gap: 10 },
  decodedHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  decodedAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primaryLight, justifyContent: "center", alignItems: "center" },
  decodedAvatarText: { fontSize: 17, fontWeight: "800", color: C.primary },
  decodedName: { fontSize: 15, fontWeight: "700", color: C.text },
  decodedMeta: { fontSize: 12, color: C.textSub, marginTop: 1 },
  allergyBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.errorLight, borderRadius: 8, padding: 8 },
  allergyText: { fontSize: 12, color: C.error, fontWeight: "600" },
  visitCount: { fontSize: 13, color: C.textSub },
  viewBtn: { backgroundColor: C.primary, borderRadius: C.radiusSm, padding: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  viewBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
