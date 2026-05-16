import { EmptyState, ScreenHeader } from "@/components/ui";
import { API_BASE_URL } from "@/config/api";
import {
  Brand,
  FontFamily,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import * as documentService from "@/services/document.service";
import * as TokenService from "@/services/token.service";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface Document {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
}

const DOC_TYPES: { id: string; label: string; emoji: string; icon: IoniconName }[] = [
  { id: "id_card",        label: "ID Card",               emoji: "🪪", icon: "card-outline" },
  { id: "report_card",    label: "Report Card",           emoji: "📄", icon: "document-text-outline" },
  { id: "recommendation", label: "Recommendation Letter", emoji: "💌", icon: "mail-outline" },
  { id: "certificate",    label: "Certificate",           emoji: "🏆", icon: "ribbon-outline" },
  { id: "other",          label: "Other Documents",       emoji: "📎", icon: "attach-outline" },
];

function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocMeta(docType: string): { label: string; icon: IoniconName } {
  const match = DOC_TYPES.find((t) => t.id === docType);
  return match ? { label: match.label, icon: match.icon } : { label: docType, icon: "document-outline" };
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
          text: `${t.emoji} ${t.label}`,
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
      Alert.alert("Success", "Document uploaded successfully!");
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

  const uploadActions: { icon: IoniconName; label: string; onPress: () => void }[] = [
    { icon: "document-outline", label: "File / PDF",    onPress: handlePickDocument },
    { icon: "image-outline",    label: "From Gallery",  onPress: handlePickImage },
    { icon: "camera-outline",   label: "Camera",        onPress: handleCamera },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Surface.background, paddingTop: insets.top }}>
      <ScreenHeader title="Document Vault" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
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
          {uploadActions.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={[styles.uploadBtn, uploading && { opacity: 0.5 }]}
              onPress={btn.onPress}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <Ionicons name={btn.icon} size={24} color={Brand.primary} />
              <Text style={styles.uploadBtnLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upload progress */}
        {uploading && (
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>Uploading… {uploadProgress}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
          </View>
        )}

        {/* Document list */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing["2xl"] }]}>
          My Documents ({documents.length})
        </Text>

        {documents.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="folder-open-outline" size={44} color={Brand.primary} />}
            title="No documents yet"
            message="Upload documents like report cards, ID, or certificates to speed up registration."
          />
        ) : (
          <FlatList
            data={documents}
            keyExtractor={(d) => d.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm + 2 }} />}
            renderItem={({ item }) => {
              const meta = getDocMeta(item.doc_type);
              return (
                <View style={styles.docCard}>
                  <View style={styles.docIcon}>
                    <Ionicons name={meta.icon} size={22} color={Brand.primary} />
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
                    <Ionicons name="close" size={16} color={Brand.error} />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Ionicons name="lock-closed" size={16} color={Brand.primary} />
          <Text style={styles.infoText}>
            Accepted formats: PDF, JPG, PNG (max. 10 MB). Your documents are secure and can only be viewed by you and the competition organizers you register with.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Surface.background },
  container: { paddingHorizontal: Spacing.xl },

  header: { marginBottom: Spacing["2xl"] },
  subtitle: { ...Type.bodySm, lineHeight: 20 },

  sectionLabel: {
    ...Type.label,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },

  // Upload buttons
  uploadRow: { flexDirection: "row", gap: Spacing.sm + 2 },
  uploadBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderStyle: "dashed",
    alignItems: "center",
    gap: Spacing.xs + 2,
    backgroundColor: Brand.primarySoft,
  },
  uploadBtnLabel: {
    ...Type.caption,
    color: Brand.primary,
    fontFamily: FontFamily.bodyBold,
    textAlign: "center",
  },

  // Progress
  progressCard: {
    marginTop: Spacing.md + 2,
    backgroundColor: Surface.card,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    ...Shadow.sm,
  },
  progressLabel: {
    ...Type.bodySm,
    color: TextColor.secondary,
    fontFamily: FontFamily.bodySemi,
    marginBottom: Spacing.sm,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: Brand.primary,
    borderRadius: Radius.sm,
  },

  // Document card
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Surface.card,
    borderRadius: Radius.xl,
    padding: Spacing.md + 2,
    ...Shadow.sm,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    backgroundColor: Brand.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  docInfo: { flex: 1 },
  docType: {
    ...Type.caption,
    color: Brand.primary,
    fontFamily: FontFamily.bodyBold,
    marginBottom: 2,
  },
  docName: {
    ...Type.bodySm,
    color: TextColor.primary,
    fontFamily: FontFamily.bodySemi,
    marginBottom: 2,
  },
  docMeta: { ...Type.caption },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Brand.errorSoft,
    justifyContent: "center",
    alignItems: "center",
  },

  // Info box
  infoBox: {
    marginTop: Spacing.xl,
    flexDirection: "row",
    gap: Spacing.sm + 2,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, ...Type.caption, color: Brand.primary, lineHeight: 18 },
});
