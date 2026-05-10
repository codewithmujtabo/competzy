import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import { getMyChildren, acceptInvitation } from "@/services/parents.service";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function ChildrenScreen() {
  const params = useLocalSearchParams<{ studentId?: string; compId?: string }>();
  const { user } = useUser();
  const userRole = (user as any)?.role;
  const parentId = (user as any)?.id;
  const [showPinModal, setShowPinModal] = useState(false);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const queryClient = useQueryClient();
  const highlightedStudentId =
    typeof params.studentId === "string" ? params.studentId : undefined;
  const highlightedCompId =
    typeof params.compId === "string" ? params.compId : undefined;

  // Fetch linked children (hooks must come before any returns)
  const { data: children, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["myChildren", parentId],
    queryFn: () => getMyChildren(),
    enabled: userRole === "parent" && !!parentId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    React.useCallback(() => {
      if (userRole === "parent" && parentId) {
        void refetch();
      }
    }, [userRole, parentId, refetch])
  );

  // Accept invitation mutation (hooks must come before any returns)
  const acceptInvitationMutation = useMutation({
    mutationFn: ({ email, pin }: { email: string; pin: string }) => acceptInvitation(email, pin),
    onSuccess: () => {
      Alert.alert(
        "Success",
        "Link created! Waiting for student approval.",
        [{ text: "OK", onPress: () => setShowPinModal(false) }]
      );
      setEmail("");
      setPin("");
      queryClient.invalidateQueries({ queryKey: ["myChildren", parentId] });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Invalid or expired PIN");
    },
  });

  // Redirect non-parents away from this screen
  useEffect(() => {
    if (userRole && userRole !== "parent") {
      if (userRole === "teacher") {
        router.replace("/(tabs)/teacher-dashboard");
      } else if (userRole === "school_admin") {
        router.replace("/(tabs)/profile");
      } else {
        router.replace("/(tabs)/competitions");
      }
    }
  }, [userRole]);

  const handleAcceptInvitation = () => {
    if (!email.trim() || !pin.trim()) {
      Alert.alert("Error", "Please enter both email and PIN");
      return;
    }

    if (pin.length !== 6) {
      Alert.alert("Error", "PIN must be 6 digits");
      return;
    }

    acceptInvitationMutation.mutate({ email, pin });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      paid: "#10B981",
      registered: "#F59E0B",
      pending: "#94A3B8",
      approved: "#10B981",
      pending_review: "#3B82F6",
      rejected: "#EF4444",
    };

    return (
      <View style={[styles.badge, { backgroundColor: colors[status as keyof typeof colors] || "#94A3B8" }]}>
        <Text style={styles.badgeText}>{status}</Text>
      </View>
    );
  };

  const sortedChildren = React.useMemo(() => {
    if (!children) return [];

    return [...children].sort((a, b) => {
      const aHighlighted = highlightedStudentId && a.studentId === highlightedStudentId ? 1 : 0;
      const bHighlighted = highlightedStudentId && b.studentId === highlightedStudentId ? 1 : 0;

      if (aHighlighted !== bHighlighted) {
        return bHighlighted - aHighlighted;
      }

      return new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime();
    });
  }, [children, highlightedStudentId]);

  // Don't render if not a parent
  if (userRole && userRole !== "parent") {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Children</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowPinModal(true)}
          >
            <IconSymbol name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Children List */}
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={Brand.primary} />
        ) : isError ? (
          <View style={styles.emptyState}>
            <IconSymbol name="exclamationmark.triangle.fill" size={64} color="#F59E0B" />
            <Text style={styles.emptyTitle}>Failed to Load Children</Text>
            <Text style={styles.emptySubtitle}>
              {(error as Error)?.message || "Please try again."}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : sortedChildren.length > 0 ? (
          sortedChildren.map((child) => {
            const isHighlightedChild =
              !!highlightedStudentId && child.studentId === highlightedStudentId;

            const sortedRegistrations = [...child.registrations].sort((a, b) => {
              const aHighlighted =
                !!highlightedCompId && a.competitionId === highlightedCompId ? 1 : 0;
              const bHighlighted =
                !!highlightedCompId && b.competitionId === highlightedCompId ? 1 : 0;

              if (aHighlighted !== bHighlighted) {
                return bHighlighted - aHighlighted;
              }

              return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime();
            });

            return (
            <View
              key={child.linkId}
              style={[styles.childCard, isHighlightedChild && styles.childCardHighlighted]}
            >
              {/* Child Header */}
              <View style={styles.childHeader}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarText}>
                    {child.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.fullName}</Text>
                  <Text style={styles.childDetails}>
                    {child.linkStatus === "pending" ? "Waiting for student approval" : `Grade ${child.grade} • ${child.school || "No school"}`}
                  </Text>
                  {child.email && (
                    <Text style={styles.childEmail}>{child.email}</Text>
                  )}
                </View>
                {getStatusBadge(child.linkStatus)}
              </View>

              {isHighlightedChild && (
                <View style={styles.highlightBanner}>
                  <Text style={styles.highlightBannerText}>
                    Opened from notification
                  </Text>
                </View>
              )}

              {/* Registrations */}
              <View style={styles.registrationsSection}>
                <Text style={styles.sectionTitle}>
                  Registrations ({child.registrations.length})
                </Text>

                {sortedRegistrations.length === 0 ? (
                  <Text style={styles.emptyText}>No registrations yet</Text>
                ) : (
                  sortedRegistrations.map((reg) => {
                    const isHighlightedReg =
                      !!highlightedCompId && reg.competitionId === highlightedCompId;

                    return (
                    <View
                      key={reg.registrationId}
                      style={[styles.regCard, isHighlightedReg && styles.regCardHighlighted]}
                    >
                      <View style={styles.regInfo}>
                        <Text style={styles.regName}>{reg.competitionName}</Text>
                        <Text style={styles.regCategory}>
                          {reg.category} • {reg.level}
                        </Text>
                        <Text style={styles.regDate}>
                          Registered: {new Date(reg.registeredAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {getStatusBadge(reg.status)}
                    </View>
                  );
                  })
                )}
              </View>
            </View>
          );
          })
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol name="person.2.fill" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Linked Children</Text>
            <Text style={styles.emptySubtitle}>
              Ask your child to send you an invitation, then tap the + button to enter the PIN code.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* PIN Entry Modal */}
      <Modal
        visible={showPinModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPinModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter PIN Code</Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your email and the 6-digit PIN code sent by your child
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Your email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="6-digit PIN"
              placeholderTextColor="#94A3B8"
              value={pin}
              onChangeText={(text) => setPin(text.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={[
                styles.submitButton,
                acceptInvitationMutation.isPending && styles.submitButtonDisabled,
              ]}
              onPress={handleAcceptInvitation}
              disabled={acceptInvitationMutation.isPending}
            >
              {acceptInvitationMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerTitle: { ...Type.displayMd },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  loader: { marginTop: Spacing["3xl"] },
  childCard: {
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  childCardHighlighted: {
    borderWidth: 2,
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  childAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  childAvatarText: { fontSize: 24, fontWeight: "800", color: Brand.primary },
  childInfo: { flex: 1 },
  childName: { ...Type.title, fontSize: 17 },
  childDetails: { ...Type.bodySm, marginTop: 2 },
  childEmail: { ...Type.caption, marginTop: 2 },
  registrationsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
    paddingTop: Spacing.lg,
  },
  highlightBanner: {
    alignSelf: "flex-start",
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginBottom: Spacing.md,
  },
  highlightBannerText: { ...Type.label, color: Brand.primary, fontSize: 12 },
  sectionTitle: { ...Type.label, marginBottom: Spacing.md },
  regCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  regCardHighlighted: {
    backgroundColor: Brand.primarySoft,
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  regInfo: { flex: 1, marginRight: Spacing.sm },
  regName: { ...Type.title, fontSize: 14 },
  regCategory: { ...Type.caption, marginTop: 2 },
  regDate: { ...Type.caption, marginTop: 2 },
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  emptyText: { ...Type.bodySm, textAlign: "center", marginVertical: Spacing.sm },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyTitle: { ...Type.h2, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptySubtitle: {
    ...Type.body,
    color: TextColor.secondary,
    textAlign: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Brand.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Surface.card,
    borderTopLeftRadius: Radius["3xl"],
    borderTopRightRadius: Radius["3xl"],
    padding: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  modalTitle: { ...Type.h2 },
  modalSubtitle: { ...Type.body, color: TextColor.secondary, marginBottom: Spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    fontSize: 16,
    color: TextColor.primary,
    marginBottom: Spacing.md,
    backgroundColor: Surface.card,
  },
  submitButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.pill,
    padding: Spacing.md + 2,
    alignItems: "center",
    marginTop: Spacing.sm,
    ...Shadow.md,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
