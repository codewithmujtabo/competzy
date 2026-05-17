import { Button, Card, Pill, ScreenHeader } from "@/components/ui";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import * as registrationsService from "@/services/registrations.service";
import * as paymentsService from "@/services/payments.service";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatDate(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyRegistrationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [redirectLoading, setRedirectLoading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["registrationDetail", id],
    queryFn: () => registrationsService.getDetail(id!),
    enabled: !!id,
  });

  const registration = data;
  const competition = data?.competition;

  const handleOpenRedirect = async () => {
    if (!id) return;
    try {
      setRedirectLoading(true);
      const { redirectUrl } = await paymentsService.getPostPaymentRedirectUrl(id);
      await Linking.openURL(redirectUrl);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to get the link.");
    } finally {
      setRedirectLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (isError || !registration || !competition) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[Type.h2, { marginBottom: Spacing.lg }]}>Failed to load details</Text>
        <Button label="Try again" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Registration Details"
        onBack={() => router.replace("/(tabs)/my-competitions")}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[Type.label, { color: "rgba(255,255,255,0.85)", letterSpacing: 0.5 }]}>
            {competition.organizerName} • {competition.category}
          </Text>
          <Text style={[Type.h1, { color: "#FFFFFF", marginTop: Spacing.sm }]}>
            {competition.name}
          </Text>
          <View style={{ marginTop: Spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm }}>
            <Pill
              label={registration.status === "completed" ? "✓ Completed" : "✓ Approved / Joined"}
              tone="success"
            />
            {registration.registrationNumber ? (
              <Pill label={registration.registrationNumber} tone="brand" />
            ) : null}
          </View>
        </View>

        <Card variant="playful">
          <Text style={Type.h3}>What You Need To Know</Text>
          <Text style={[Type.body, { marginTop: Spacing.md }]}>
            {competition.participantInstructions?.trim() ||
              "Admin has not published participant instructions yet. Check back later or watch notifications."}
          </Text>
        </Card>

        <Card variant="playful">
          <Text style={Type.h3}>Important Details</Text>
          <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
            <Row label="Competition Date" value={formatDate(competition.competitionDate)} />
            <Row label="Registration Closed" value={formatDate(competition.regCloseDate)} />
            <Row label="Website" value={competition.websiteUrl?.trim() || "-"} />
          </View>
          {competition.websiteUrl?.trim() ? (
            <View style={{ marginTop: Spacing.lg, alignSelf: "flex-start" }}>
              <Button label="Open Website" variant="secondary" onPress={() => Linking.openURL(competition.websiteUrl!)} />
            </View>
          ) : null}
        </Card>

        <Card variant="playful">
          <Text style={Type.h3}>Round & Schedule</Text>
          {competition.rounds.length > 0 ? (
            <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
              {competition.rounds.map((round) => (
                <View key={round.id} style={styles.roundCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={Type.title}>
                      {round.roundOrder ? `Round ${round.roundOrder}` : round.roundName}
                    </Text>
                    <Pill label={round.roundType} tone="brand" size="sm" />
                  </View>
                  <Text style={[Type.bodySm, { marginTop: Spacing.sm }]}>{round.roundName}</Text>
                  <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                    <Row label="Starts" value={formatDate(round.startDate)} />
                    <Row label="Exam" value={formatDate(round.examDate)} />
                    <Row label="Location/Platform" value={round.location?.trim() || "-"} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[Type.body, { marginTop: Spacing.md, color: TextColor.secondary }]}>
              Round-by-round schedule has not been published yet.
            </Text>
          )}
        </Card>

        {registration.profileSnapshot && Object.keys(registration.profileSnapshot).length > 0 ? (
          <Card variant="playful">
            <Text style={Type.h3}>Profile at Registration</Text>
            <Text style={[Type.bodySm, { marginTop: Spacing.sm }]}>
              Your profile snapshot captured at registration.
            </Text>
            <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
              {Object.entries(registration.profileSnapshot).map(([key, value]) =>
                value ? (
                  <Row
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    value={String(value)}
                  />
                ) : null
              )}
            </View>
          </Card>
        ) : null}

        {competition.post_payment_redirect_url ? (
          <Card variant="tinted" tint={Brand.primarySoft}>
            <Text style={Type.h3}>Competition Platform</Text>
            <Text style={[Type.body, { marginTop: Spacing.sm }]}>
              Access the organizer competition platform with your registration token.
            </Text>
            <View style={{ marginTop: Spacing.lg }}>
              <Button
                label={redirectLoading ? "Opening..." : "Open Competition Platform"}
                loading={redirectLoading}
                onPress={handleOpenRedirect}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: Spacing.md }}>
      <Text style={[Type.bodySm, { color: TextColor.secondary, flex: 1 }]}>{label}</Text>
      <Text style={[Type.title, { textAlign: "right", flex: 1.4 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  center: {
    flex: 1,
    backgroundColor: Surface.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  hero: {
    backgroundColor: Brand.primary,
    borderRadius: Radius["3xl"],
    padding: Spacing["2xl"],
    ...Shadow.playful,
  },
  roundCard: {
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
  },
});
