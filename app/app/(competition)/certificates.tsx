import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as certificatesService from "@/services/certificates.service";
import type { Certificate } from "@/services/certificates.service";

export default function CertificatesScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["certificates", compId],
    queryFn: () => certificatesService.getMine(compId!),
    enabled: !!compId,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="My Certificate" subtitle={compName} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load certificates</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="ribbon-outline" size={30} color={Brand.primary} />}
            title="No certificate yet"
            message="Your certificate is issued automatically once you finish a competition exam."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.map((c) => (
            <CertificateCard key={c.id} c={c} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function CertificateCard({ c }: { c: Certificate }) {
  const isAchievement = c.type === "achievement";
  return (
    <Card variant="playful">
      <Text style={[Type.label, { color: Brand.primary }]}>
        {isAchievement ? "CERTIFICATE OF ACHIEVEMENT" : "CERTIFICATE OF PARTICIPATION"}
      </Text>
      {c.awardLabel ? (
        <Text style={[Type.h2, { marginTop: Spacing.xs }]}>{c.awardLabel}</Text>
      ) : null}
      <Text style={[Type.h3, { marginTop: Spacing.xs }]}>{c.competitionName}</Text>
      <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
        No. {c.certificateNumber} · Issued {fmtDate(c.issuedAt)}
      </Text>
      <View style={styles.badges}>
        <Pill
          label={c.revokedAt ? "Revoked" : "Valid"}
          tone={c.revokedAt ? "danger" : "success"}
          size="sm"
        />
        {c.grade ? <Pill label={c.grade} tone="neutral" size="sm" /> : null}
        {c.score != null ? (
          <Pill
            label={`Score ${c.score}${c.scoreMax != null ? ` / ${c.scoreMax}` : ""}`}
            tone="brand"
            size="sm"
          />
        ) : null}
      </View>
      <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
        <Button
          label="View / Download"
          variant="secondary"
          size="sm"
          leadingIcon={<Ionicons name="download-outline" size={16} color={Brand.primary} />}
          onPress={() =>
            WebBrowser.openBrowserAsync(
              certificatesService.certificatePdfUrl(c.verificationCode)
            )
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
});
