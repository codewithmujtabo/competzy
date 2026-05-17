import { ScreenHeader } from "@/components/ui";
import {
  Brand,
  FontFamily,
  Radius,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import {
  approveLink,
  getDebugInvitations,
  getPendingInvitations,
  inviteParent,
} from "@/services/parents.service";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LinkParentScreen() {
  const { user } = useUser();
  const studentId = (user as any)?.id;
  const [parentEmail, setParentEmail] = useState("");
  const [latestDebugPin, setLatestDebugPin] = useState<string | null>(null);
  const [latestDebugEmail, setLatestDebugEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isDebugMode = __DEV__;

  // Fetch pending invitations
  const {
    data: pendingInvitations,
    isLoading,
    isError,
    error,
    refetch: refetchPendingInvitations,
  } = useQuery({
    queryKey: ["pendingInvitations", studentId],
    queryFn: getPendingInvitations,
    enabled: !!studentId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const normalizedEmail = useMemo(() => parentEmail.trim().toLowerCase(), [parentEmail]);
  const { data: recentDebugInvites = [] } = useQuery({
    queryKey: ["parentDebugInvitations", studentId, normalizedEmail],
    queryFn: () => getDebugInvitations(normalizedEmail || undefined),
    enabled: isDebugMode && !!studentId,
  });

  useFocusEffect(
    React.useCallback(() => {
      if (studentId) {
        void refetchPendingInvitations();
        if (isDebugMode) {
          void queryClient.invalidateQueries({
            queryKey: ["parentDebugInvitations", studentId],
          });
        }
      }
    }, [studentId, refetchPendingInvitations, queryClient, isDebugMode])
  );

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: inviteParent,
    onSuccess: (data) => {
      setLatestDebugPin(data.debugPin || null);
      setLatestDebugEmail(data.debugEmail || null);
      Alert.alert(
        "Success",
        data.debugPin
          ? `Invitation created in debug mode. Use PIN ${data.debugPin} for testing.`
          : "Invitation sent! Your parent will receive a PIN code via email."
      );
      setParentEmail("");
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations", studentId] });
      queryClient.invalidateQueries({ queryKey: ["parentDebugInvitations", studentId] });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to send invitation");
    },
  });

  // Approve link mutation
  const approveLinkMutation = useMutation({
    mutationFn: ({ linkId, status }: { linkId: string; status: 'active' | 'rejected' }) =>
      approveLink(linkId, status),
    onSuccess: (_, variables) => {
      const message = variables.status === 'active'
        ? "Parent link approved!"
        : "Parent link rejected";
      Alert.alert("Success", message);
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations", studentId] });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update link");
    },
  });

  const handleSendInvitation = async () => {
    if (!parentEmail.trim()) {
      Alert.alert("Error", "Please enter your parent's email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail.trim())) {
      Alert.alert("Error", "Please enter a valid email address (e.g., parent@example.com)");
      return;
    }

    sendInvitationMutation.mutate(parentEmail.trim());
  };

  const handleApprove = (linkId: string) => {
    Alert.alert(
      "Approve Parent Link",
      "Are you sure you want to approve this parent account link?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => approveLinkMutation.mutate({ linkId, status: 'active' }),
        },
      ]
    );
  };

  const handleReject = (linkId: string) => {
    Alert.alert(
      "Reject Parent Link",
      "Are you sure you want to reject this parent account link?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => approveLinkMutation.mutate({ linkId, status: 'rejected' }),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader title="Link Parent Account" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Invitation Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invite Parent</Text>
          <Text style={styles.cardSubtitle}>
            Enter your parent&apos;s email address. A 6-digit PIN code will be sent to their email inbox. The PIN is valid for 24 hours.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="parent@example.com"
            placeholderTextColor={TextColor.tertiary}
            value={parentEmail}
            onChangeText={setParentEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!sendInvitationMutation.isPending}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              sendInvitationMutation.isPending && styles.sendButtonDisabled,
            ]}
            onPress={handleSendInvitation}
            disabled={sendInvitationMutation.isPending}
          >
            {sendInvitationMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send Invitation</Text>
            )}
          </TouchableOpacity>

          {/* Instructions */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={Brand.primary} />
            <Text style={styles.infoText}>
              After sending, your parent should:{"\n"}
              1. Check their email for the PIN{"\n"}
              2. Open the app and go to &quot;Children&quot; tab{"\n"}
              3. Tap &quot;Accept Invitation&quot; and enter the PIN{"\n"}
              4. You&apos;ll then approve the connection
            </Text>
          </View>

          {isDebugMode && (
            <View style={styles.debugBox}>
              <Text style={styles.debugTitle}>Developer Testing Mode</Text>
              <Text style={styles.debugText}>
                If SMTP is not configured, the backend will still create the invitation and expose the PIN here for testing.
              </Text>

              {latestDebugPin ? (
                <View style={styles.debugPinCard}>
                  <Text style={styles.debugPinLabel}>Latest PIN</Text>
                  <Text style={styles.debugPinValue}>{latestDebugPin}</Text>
                  <Text style={styles.debugPinEmail}>{latestDebugEmail}</Text>
                </View>
              ) : null}

              {recentDebugInvites.length > 0 ? (
                <View style={styles.debugList}>
                  <Text style={styles.debugListTitle}>Recent Invitations</Text>
                  {recentDebugInvites.slice(0, 3).map((invite) => (
                    <View key={invite.invitationId} style={styles.debugListItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.debugListEmail}>{invite.parentEmail}</Text>
                        <Text style={styles.debugListMeta}>
                          {invite.status} • expires {new Date(invite.expiresAt).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.debugListPin}>{invite.pin}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Pending Approvals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending Approvals</Text>
          <Text style={styles.cardSubtitle}>
            Parents who have entered the PIN and are waiting for your approval
          </Text>

          {isLoading ? (
            <ActivityIndicator style={styles.loader} color={Brand.primary} />
          ) : isError ? (
            <Text style={styles.errorText}>
              {(error as Error)?.message || "Failed to load pending approvals"}
            </Text>
          ) : pendingInvitations && pendingInvitations.length > 0 ? (
            pendingInvitations.map((invite) => (
              <View key={invite.linkId} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteName}>{invite.parentName}</Text>
                  <Text style={styles.inviteEmail}>{invite.parentEmail}</Text>
                  <Text style={styles.inviteDate}>
                    Requested: {new Date(invite.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={[
                      styles.iconButton,
                      approveLinkMutation.isPending && styles.buttonDisabled,
                    ]}
                    onPress={() => handleApprove(invite.linkId)}
                    disabled={approveLinkMutation.isPending}
                  >
                    {approveLinkMutation.isPending ? (
                      <ActivityIndicator size="small" color={Brand.success} />
                    ) : (
                      <Ionicons name="checkmark-circle" size={28} color={Brand.success} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.iconButton,
                      approveLinkMutation.isPending && styles.buttonDisabled,
                    ]}
                    onPress={() => handleReject(invite.linkId)}
                    disabled={approveLinkMutation.isPending}
                  >
                    {approveLinkMutation.isPending ? (
                      <ActivityIndicator size="small" color={Brand.error} />
                    ) : (
                      <Ionicons name="close-circle" size={28} color={Brand.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No pending approvals</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Surface.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  card: {
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    borderWidth: 1,
    borderColor: Surface.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    ...Type.h3,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    ...Type.bodySm,
    marginBottom: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    fontSize: 15,
    fontFamily: FontFamily.bodyRegular,
    color: TextColor.primary,
    backgroundColor: Surface.background,
    marginBottom: Spacing.md,
  },
  sendButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    ...Type.button,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.md,
    backgroundColor: Brand.primarySoft,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Brand.primary,
  },
  infoText: {
    flex: 1,
    ...Type.bodySm,
    lineHeight: 20,
  },
  debugBox: {
    marginTop: Spacing.md + 2,
    padding: Spacing.md + 2,
    borderRadius: Radius.lg,
    backgroundColor: Brand.sunshineSoft,
    borderWidth: 1,
    borderColor: Brand.sunshine,
  },
  debugTitle: {
    ...Type.title,
    marginBottom: Spacing.xs + 2,
  },
  debugText: {
    ...Type.bodySm,
    color: TextColor.primary,
    lineHeight: 18,
  },
  debugPinCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Surface.card,
  },
  debugPinLabel: {
    ...Type.caption,
    marginBottom: Spacing.xs,
  },
  debugPinValue: {
    fontSize: 28,
    fontFamily: FontFamily.displayExtra,
    color: Brand.primary,
    letterSpacing: 4,
  },
  debugPinEmail: {
    ...Type.caption,
    marginTop: Spacing.xs,
  },
  debugList: {
    marginTop: Spacing.md,
  },
  debugListTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bodyBold,
    color: TextColor.primary,
    marginBottom: Spacing.sm,
  },
  debugListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Surface.card,
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm + 2,
  },
  debugListEmail: {
    fontSize: 13,
    fontFamily: FontFamily.bodySemi,
    color: TextColor.primary,
  },
  debugListMeta: {
    ...Type.caption,
    marginTop: 2,
  },
  debugListPin: {
    fontSize: 18,
    fontFamily: FontFamily.displayBold,
    color: Brand.primary,
    letterSpacing: 2,
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    backgroundColor: Surface.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Surface.border,
    marginTop: Spacing.md,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    ...Type.title,
    marginBottom: 2,
  },
  inviteEmail: {
    ...Type.bodySm,
    marginBottom: Spacing.xs,
  },
  inviteDate: {
    ...Type.caption,
  },
  inviteActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyText: {
    ...Type.bodySm,
    color: TextColor.tertiary,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  errorText: {
    ...Type.bodySm,
    color: Brand.error,
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
