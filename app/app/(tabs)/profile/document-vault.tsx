import { Brand, Surface } from "@/constants/theme";
import { ScreenHeader } from "@/components/ui";
import { useUser } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import * as documentService from "@/services/document.service";
import * as TokenService from "@/services/token.service";
import { API_BASE_URL } from "@/config/api";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Document {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
}

const DOC_TYPES = [
  { id: "id_card",        label: "ID Card",               icon: "🪪" },
  { id: "report_card",    label: "Report Card",           icon: "📄" },
  { id: "recommendation", label: "Recommendation Letter", icon: "💌" },
  { id: "certificate",   label: "Certificate",            icon: "🏆" },
  { id: "other",          label: "Other Documents",       icon: "📎" },
];

function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocMeta(docType: string) {
  return DOC_TYPES.find((t) => t.id === docType) ?? { label: docType, icon: "📎" };
}

// ── Real XHR upload with progress ─────────────────────────────────────────────
async function uploadFileXHR(
  uri: string,
  name: string,
  mimeType: string,
  docType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const token = await TokenService.getToken();

  const formData = new FormData();
  formData.append("file", { uri, name, type: mimeType } as any);
  formData.append("docType", docType);

  // Strip /api suffix so the path becomes <host>/documents/upload
  const baseUrl = API_BASE_URL!.replace(/\/api$/, "");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body.message || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error — check your connection"));

    xhr.open("POST", `${baseUrl}/api/documents/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DocumentVaultScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const router = useRouter();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const data = await documentService.list();
      setDocuments(
        data.map((d) => ({
          id:          d.id,
          doc_type:    d.docType,
          file_name:   d.fileName,
          file_size:   d.fileSize,
          uploaded_at: d.uploadedAt,
        }))
      );
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── File pickers ──────────────────────────────────────────────────────────
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        showDocTypeSelector({
          uri:      asset.uri,
          name:     asset.name ?? `doc_${Date.now()}`,
          mimeType: asset.mimeType ?? "application/octet-stream",
        });
      }
    } catch {
      Alert.alert("Error", "Failed to open document");
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images" as const,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        showDocTypeSelector({
          uri:      asset.uri,
          name:     `foto_${Date.now()}.jpg`,
          mimeType: "image/jpeg",
        });
      }
    } catch {
      Alert.alert("Error", "Failed to open gallery");
    }
  };

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow camera access in settings.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        showDocTypeSelector({
          uri:      asset.uri,
          name:     `kamera_${Date.now()}.jpg`,
          mimeType: "image/jpeg",
        });
      }
    } catch {
      Alert.alert("Error", "Failed to open camera");
    }
  };

  // ── Doc type selector → upload ─────────────────────────────────────────────
  const showDocTypeSelector = (file: { uri: string; name: string; mimeType: string }) => {
    Alert.alert(
      "Document Type",
      "What type of document is this?",
      [
        ...DOC_TYPES.map((t) => ({
          text: `${t.icon} ${t.label}`,
          onPress: () => uploadDocument(file, t.id),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  };

  const uploadDocument = async (
    file: { uri: string; name: string; mimeType: string },
    docType: string
  ) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadFileXHR(file.uri, file.name, file.mimeType, docType, setUploadProgress);
      await fetchDocuments();
      Alert.alert("✅ Success", "Document uploaded successfully!");
    } catch (err: any) {
      Alert.alert("Failed", err?.message || "Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (docId: string, fileName: string) => {
    Alert.alert(
      "Delete Document",
      `Delete "${fileName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await documentService.remove(docId);
              setDocuments((prev) => prev.filter((d) => d.id !== docId));
            } catch {
              Alert.alert("Error", "Failed to delete document");
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Surface.background, paddingTop: insets.top }}>
      <ScreenHeader title="Document Vault" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Store your important documents here to make competition registration easier.
        </Text>
      </View>

      {/* Upload buttons */}
      <Text style={styles.sectionLabel}>Add Document</Text>
      <View style={styles.uploadRow}>
        {[
          { emoji: "📄", label: "File / PDF",     onPress: handlePickDocument },
          { emoji: "🖼️",  label: "From Gallery",  onPress: handlePickImage },
          { emoji: "📸",  label: "Camera",        onPress: handleCamera },
        ].map((btn) => (
          <TouchableOpacity
            key={btn.label}
            style={[styles.uploadBtn, uploading && { opacity: 0.5 }]}
            onPress={btn.onPress}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadBtnEmoji}>{btn.emoji}</Text>
            <Text style={styles.uploadBtnLabel}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Upload progress */}
      {uploading && (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>
            Mengunggah... {uploadProgress}%
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {/* Document list */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
        My Documents ({documents.length})
      </Text>

      {documents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No documents yet</Text>
          <Text style={styles.emptySubtext}>
            Upload documents like report cards, ID, or certificates to speed up registration.
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(d) => d.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const meta = getDocMeta(item.doc_type);
            return (
              <View style={styles.docCard}>
                <View style={styles.docIcon}>
                  <Text style={{ fontSize: 24 }}>{meta.icon}</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docType}>{meta.label}</Text>
                  <Text style={styles.docName} numberOfLines={1}>
                    {item.file_name}
                  </Text>
                  <Text style={styles.docMeta}>
                    {formatFileSize(item.file_size)} ·{" "}
                    {new Date(item.uploaded_at).toLocaleDateString("en-US", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id, item.file_name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoEmoji}>🔒</Text>
        <Text style={styles.infoText}>
          Accepted formats: PDF, JPG, PNG (max. 10 MB). Your documents are secure and can only be viewed by you and the competition organizers you register with.
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  container: { paddingHorizontal: 20, backgroundColor: "#F8FAFC" },

  header: { marginBottom: 24 },
  subtitle: { fontSize: 14, color: "#64748B", lineHeight: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Upload buttons
  uploadRow: { flexDirection: "row", gap: 10 },
  uploadBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
  },
  uploadBtnEmoji: { fontSize: 26 },
  uploadBtnLabel: { fontSize: 11, fontWeight: "700", color: Brand.primary, textAlign: "center" },

  // Progress
  progressCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  progressLabel: { fontSize: 13, color: "#475569", fontWeight: "600", marginBottom: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: Brand.primary,
    borderRadius: 4,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  emptySubtext: { fontSize: 13, color: "#94A3B8", textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },

  // Document card
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  docInfo: { flex: 1 },
  docType: { fontSize: 12, fontWeight: "700", color: Brand.primary, marginBottom: 2 },
  docName: { fontSize: 14, fontWeight: "600", color: "#0F172A", marginBottom: 2 },
  docMeta: { fontSize: 11, color: "#94A3B8" },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 14, color: "#EF4444", fontWeight: "700" },

  // Info box
  infoBox: {
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
  },
  infoEmoji: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, color: "#1D4ED8", lineHeight: 18 },
});
