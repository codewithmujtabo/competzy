import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as DocumentPicker from "expo-document-picker";
import { apiRequest } from "@/services/api";

interface BulkJob {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  progress: number;
  errors: Array<{ row: number; error: string }>;
  createdAt: string;
  completedAt?: string;
}

export default function BulkRegistrationScreen() {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentJob, setCurrentJob] = useState<BulkJob | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchJobs();
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await apiRequest<BulkJob[]>("/bulk-registration/jobs");
      setJobs(data);
    } catch (error: any) {
      console.error("Failed to fetch jobs:", error);
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    try {
      const data = await apiRequest<BulkJob>(`/bulk-registration/jobs/${jobId}`);
      setCurrentJob(data);

      if (data.status === "completed" || data.status === "failed") {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        fetchJobs();
      }
    } catch (error: any) {
      console.error("Failed to fetch job status:", error);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/csv",
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert("Error", "Please select a CSV file first");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: selectedFile.uri,
        type: "text/csv",
        name: selectedFile.name,
      } as any);

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/bulk-registration/upload`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${await import("@/services/token.service").then((m) => m.getToken())}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      const data = await response.json();

      Alert.alert(
        "Success",
        `CSV uploaded successfully! Processing ${data.totalRows} rows...`
      );

      setSelectedFile(null);
      setCurrentJob(data);

      // Start polling for job status
      const interval = setInterval(() => {
        fetchJobStatus(data.jobId);
      }, 2000); // Poll every 2 seconds

      setPollingInterval(interval);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to upload CSV");
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewJob = (job: BulkJob) => {
    setCurrentJob(job);
    if (job.status === "processing") {
      const interval = setInterval(() => {
        fetchJobStatus(job.id);
      }, 2000);
      setPollingInterval(interval);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#10B981";
      case "failed":
        return "#EF4444";
      case "processing":
        return "#F59E0B";
      default:
        return "#94A3B8";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={Brand.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bulk Registration</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Upload Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload CSV File</Text>
          <Text style={styles.cardSubtitle}>
            Select a CSV file with student data for bulk registration
          </Text>

          {selectedFile ? (
            <View style={styles.filePreview}>
              <IconSymbol name="doc.fill" size={32} color={Brand.primary} />
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <TouchableOpacity
                onPress={() => setSelectedFile(null)}
                style={styles.removeButton}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickButton} onPress={handlePickFile}>
              <IconSymbol name="plus.circle" size={32} color={Brand.primary} />
              <Text style={styles.pickButtonText}>Choose CSV File</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!selectedFile || isUploading) && styles.uploadButtonDisabled,
            ]}
            onPress={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Upload & Process</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Current Job Progress */}
        {currentJob && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Processing Status</Text>

            <View style={styles.jobHeader}>
              <Text style={styles.jobFileName}>{currentJob.fileName}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(currentJob.status) },
                ]}
              >
                <Text style={styles.statusText}>{currentJob.status}</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View
                style={[styles.progressBar, { width: `${currentJob.progress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{currentJob.progress}% Complete</Text>

            {/* Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{currentJob.totalRows}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: "#10B981" }]}>
                  {currentJob.successfulRows}
                </Text>
                <Text style={styles.statLabel}>Success</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: "#EF4444" }]}>
                  {currentJob.failedRows}
                </Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>
            </View>

            {/* Errors */}
            {currentJob.errors && currentJob.errors.length > 0 && (
              <View style={styles.errorsSection}>
                <Text style={styles.errorsTitle}>Errors ({currentJob.errors.length})</Text>
                {currentJob.errors.slice(0, 5).map((err, idx) => (
                  <Text key={idx} style={styles.errorText}>
                    Row {err.row}: {err.error}
                  </Text>
                ))}
                {currentJob.errors.length > 5 && (
                  <Text style={styles.moreErrors}>
                    +{currentJob.errors.length - 5} more errors
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Recent Jobs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Uploads</Text>

          {jobs.length === 0 ? (
            <Text style={styles.emptyText}>No uploads yet</Text>
          ) : (
            jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => handleViewJob(job)}
              >
                <View style={styles.jobInfo}>
                  <Text style={styles.jobName}>{job.fileName}</Text>
                  <Text style={styles.jobDate}>
                    {new Date(job.createdAt).toLocaleString()}
                  </Text>
                  <Text style={styles.jobStats}>
                    {job.successfulRows}/{job.totalRows} successful
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(job.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{job.status}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scrollContent: { padding: Spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Surface.card,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.sm,
  },
  headerTitle: { ...Type.h2 },
  placeholder: { width: 44 },
  card: {
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  cardTitle: { ...Type.h3, marginBottom: 4 },
  cardSubtitle: { ...Type.bodySm, marginBottom: Spacing.lg },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  fileName: { flex: 1, marginLeft: Spacing.md, ...Type.body, fontWeight: "600" },
  removeButton: { padding: 4 },
  pickButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Brand.primary,
    borderStyle: "dashed",
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    backgroundColor: Brand.primarySoft,
  },
  pickButtonText: { marginLeft: Spacing.sm, ...Type.title, color: Brand.primary },
  uploadButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.pill,
    padding: Spacing.md + 2,
    alignItems: "center",
    ...Shadow.md,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  jobFileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  progressContainer: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: Brand.primary,
  },
  progressText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  statBox: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  errorsSection: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 12,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  moreErrors: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    marginTop: 4,
  },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    marginTop: 8,
  },
  jobInfo: {
    flex: 1,
  },
  jobName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  jobDate: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 2,
  },
  jobStats: {
    fontSize: 12,
    color: "#64748B",
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
  },
});
