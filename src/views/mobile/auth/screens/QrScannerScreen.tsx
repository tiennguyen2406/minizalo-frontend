import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    StyleSheet,
    Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/shared/store/authStore";
import { authService } from "@/shared/services/authService";

const QR_PREFIX = "minizalo://qr-login/";

export default function QrScannerScreen() {
    const router = useRouter();
    const accessToken = useAuthStore((s) => s.accessToken);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        if (!data.startsWith(QR_PREFIX)) {
            Alert.alert("Mã QR không hợp lệ", "Vui lòng quét mã QR đăng nhập MiniZalo Web.");
            return;
        }
        const sid = data.substring(QR_PREFIX.length);
        if (!sid) return;
        setScanned(true);
        setSessionId(sid);
        setShowConfirmModal(true);
    };

    const handleConfirm = async () => {
        if (!sessionId || !accessToken) return;
        setConfirming(true);
        try {
            await authService.confirmQrLogin(sessionId, accessToken);
            setShowConfirmModal(false);
            Alert.alert("Thành công", "Đã xác nhận đăng nhập MiniZalo Web.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            const msg = err.response?.data?.message || "Xác nhận thất bại. Mã QR có thể đã hết hạn.";
            Alert.alert("Lỗi", msg);
            setScanned(false);
            setShowConfirmModal(false);
        } finally {
            setConfirming(false);
        }
    };

    const handleCancel = () => {
        setShowConfirmModal(false);
        setScanned(false);
        setSessionId(null);
    };

    if (!permission) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#0068FF" />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.center}>
                <Ionicons name="camera-outline" size={64} color="#999" />
                <Text style={styles.permText}>Cần quyền truy cập camera để quét mã QR</Text>
                <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                    <Text style={styles.permBtnText}>Cấp quyền camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
                    <Text style={{ color: "#0068FF", fontSize: 15 }}>Quay lại</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />

            {/* Overlay */}
            <SafeAreaView style={styles.overlay}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Quét mã QR</Text>
                    <View style={{ width: 32 }} />
                </View>

                <View style={styles.scanArea}>
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.tl]} />
                        <View style={[styles.corner, styles.tr]} />
                        <View style={[styles.corner, styles.bl]} />
                        <View style={[styles.corner, styles.br]} />
                    </View>
                </View>

                <Text style={styles.hint}>
                    Đưa camera về phía mã QR trên MiniZalo Web
                </Text>
            </SafeAreaView>

            {/* Confirm Modal */}
            <Modal visible={showConfirmModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Ionicons name="desktop-outline" size={48} color="#0068FF" style={{ marginBottom: 12 }} />
                        <Text style={styles.modalTitle}>Đăng nhập MiniZalo Web?</Text>
                        <Text style={styles.modalDesc}>
                            Xác nhận để đăng nhập tài khoản của bạn trên trình duyệt web.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={handleCancel}
                                disabled={confirming}
                            >
                                <Text style={styles.cancelBtnText}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.confirmBtn]}
                                onPress={handleConfirm}
                                disabled={confirming}
                            >
                                {confirming ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.confirmBtnText}>Xác nhận</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        padding: 24,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    backBtn: { padding: 4 },
    title: { color: "#fff", fontSize: 18, fontWeight: "600" },
    scanArea: {
        alignItems: "center",
        justifyContent: "center",
    },
    scanFrame: {
        width: 240,
        height: 240,
        position: "relative",
    },
    corner: {
        position: "absolute",
        width: CORNER_SIZE,
        height: CORNER_SIZE,
    },
    tl: {
        top: 0,
        left: 0,
        borderTopWidth: CORNER_WIDTH,
        borderLeftWidth: CORNER_WIDTH,
        borderColor: "#0068FF",
    },
    tr: {
        top: 0,
        right: 0,
        borderTopWidth: CORNER_WIDTH,
        borderRightWidth: CORNER_WIDTH,
        borderColor: "#0068FF",
    },
    bl: {
        bottom: 0,
        left: 0,
        borderBottomWidth: CORNER_WIDTH,
        borderLeftWidth: CORNER_WIDTH,
        borderColor: "#0068FF",
    },
    br: {
        bottom: 0,
        right: 0,
        borderBottomWidth: CORNER_WIDTH,
        borderRightWidth: CORNER_WIDTH,
        borderColor: "#0068FF",
    },
    hint: {
        color: "#fff",
        fontSize: 14,
        textAlign: "center",
        paddingHorizontal: 32,
        paddingBottom: 60,
    },
    permText: {
        marginTop: 16,
        fontSize: 16,
        color: "#666",
        textAlign: "center",
    },
    permBtn: {
        marginTop: 20,
        backgroundColor: "#0068FF",
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
    },
    modalCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 28,
        alignItems: "center",
        width: "80%",
        maxWidth: 320,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", color: "#333", marginBottom: 8 },
    modalDesc: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 },
    modalActions: { flexDirection: "row", gap: 12 },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    cancelBtn: { backgroundColor: "#f0f0f0" },
    cancelBtnText: { color: "#333", fontSize: 15, fontWeight: "600" },
    confirmBtn: { backgroundColor: "#0068FF" },
    confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
