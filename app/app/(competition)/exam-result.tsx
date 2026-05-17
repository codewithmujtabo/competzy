import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, ScreenHeader, StatTile } from "@/components/ui";
import { Brand, Radius, Shadow, Spacing, Surface, Type } from "@/constants/theme";
import * as examsService from "@/services/exams.service";
import type { ExamSection } from "@/services/exams.service";

const sum = (s: ExamSection) => (s.choice ?? 0) + (s.short ?? 0);

export default function ExamResultScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: session, isLoading, isError, refetch } = useQuery({
    queryKey: ["examSession", sessionId],
    queryFn: () => examsService.getSession(sessionId!),
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }
  if (isError || !session) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load the result</Text>
        <Button label="Try again" onPress={() => refetch()} />
      </View>
    );
  }

  const result = session.result ?? null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Result" subtitle={session.examName} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!result ? (
          <Card variant="playful">
            <Text style={Type.h3}>Not finished yet</Text>
            <Text style={[Type.body, { marginTop: Spacing.sm }]}>
              This exam attempt hasn&apos;t been submitted.
            </Text>
          </Card>
        ) : (
          <>
            {/* Score hero */}
            <View style={styles.hero}>
              <Text style={[Type.label, { color: "rgba(255,255,255,0.85)" }]}>YOUR SCORE</Text>
              <Text style={styles.score}>{result.totalPoint}</Text>
              <Text style={[Type.bodySm, { color: "rgba(255,255,255,0.85)" }]}>points</Text>
            </View>

            <View style={styles.tiles}>
              <StatTile
                label="Correct"
                value={sum(result.corrects)}
                tint={Brand.successSoft}
                accent={Brand.success}
                icon={<Ionicons name="checkmark-circle" size={18} color={Brand.success} />}
                style={{ flex: 1 }}
              />
              <StatTile
                label="Wrong"
                value={sum(result.wrongs)}
                tint={Brand.errorSoft}
                accent={Brand.error}
                icon={<Ionicons name="close-circle" size={18} color={Brand.error} />}
                style={{ flex: 1 }}
              />
              <StatTile
                label="Blank"
                value={sum(result.blanks)}
                icon={<Ionicons name="ellipse-outline" size={18} color={Brand.navy} />}
                style={{ flex: 1 }}
              />
            </View>

            {result.awaitingGrading ? (
              <Card variant="tinted" tint={Brand.warningSoft}>
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  <Ionicons name="hourglass-outline" size={18} color={Brand.navy} />
                  <Text style={[Type.bodySm, { flex: 1, color: Brand.navy }]}>
                    Some short-answer questions are still being graded — your final score may rise.
                  </Text>
                </View>
              </Card>
            ) : null}

            <Button
              label="Back to exams"
              variant="secondary"
              fullWidth
              onPress={() => router.back()}
            />
          </>
        )}
      </ScrollView>
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing["3xl"],
    gap: Spacing.lg,
  },
  hero: {
    backgroundColor: Brand.primary,
    borderRadius: Radius["3xl"],
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
    ...Shadow.playful,
  },
  score: {
    ...Type.displayLg,
    fontSize: 52,
    lineHeight: 58,
    color: "#FFFFFF",
    marginVertical: Spacing.xs,
  },
  tiles: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
