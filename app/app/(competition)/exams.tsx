import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as examsService from "@/services/exams.service";
import type { AvailableExam } from "@/services/exams.service";

const WINDOW_NOTE: Record<string, string> = {
  upcoming: "This exam hasn't opened yet.",
  closed: "This exam has closed.",
  unscheduled: "This exam isn't scheduled yet.",
};

export default function ExamListScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["availableExams", compId],
    queryFn: () => examsService.getAvailableExams(compId!),
    enabled: !!compId,
  });

  const openSession = (sessionId: string) =>
    router.push({ pathname: "/(competition)/exam", params: { sessionId } });
  const openResult = (sessionId: string) =>
    router.push({ pathname: "/(competition)/exam-result", params: { sessionId } });

  const start = async (examId: string) => {
    setStarting(examId);
    try {
      const { sessionId } = await examsService.startSession(examId);
      openSession(sessionId);
    } catch (err: any) {
      Alert.alert("Could not start", err?.message || "Please try again.");
    } finally {
      setStarting(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Exams" subtitle={compName} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load exams</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="document-text-outline" size={30} color={Brand.primary} />}
            title="No exams yet"
            message="Your exams will appear here closer to the exam date."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {data.map((ex) => (
            <ExamCard
              key={ex.examId}
              exam={ex}
              starting={starting === ex.examId}
              onStart={() => start(ex.examId)}
              onResume={() => ex.session && openSession(ex.session.id)}
              onResult={() => ex.session && openResult(ex.session.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ExamCard({
  exam,
  starting,
  onStart,
  onResume,
  onResult,
}: {
  exam: AvailableExam;
  starting: boolean;
  onStart: () => void;
  onResume: () => void;
  onResult: () => void;
}) {
  const finished = exam.session?.state === "finished";
  const inProgress = exam.session?.state === "in_progress";

  return (
    <Card variant="playful">
      <View style={styles.cardHead}>
        <Text style={[Type.h3, { flex: 1 }]}>{exam.name}</Text>
        {finished ? (
          <Pill label="Done" tone="success" size="sm" />
        ) : inProgress ? (
          <Pill label="In progress" tone="warning" size="sm" />
        ) : (
          <Pill label={exam.windowStatus === "open" ? "Open" : "Locked"} tone="brand" size="sm" />
        )}
      </View>
      <Text style={[Type.label, { color: TextColor.tertiary, marginTop: Spacing.xs }]}>
        {exam.code}
      </Text>

      <View style={{ marginTop: Spacing.lg }}>
        {finished ? (
          <Button label="View result" variant="secondary" onPress={onResult} />
        ) : inProgress ? (
          <Button label="Resume exam" onPress={onResume} />
        ) : exam.windowStatus === "open" ? (
          <Button label="Start exam" loading={starting} onPress={onStart} />
        ) : (
          <Text style={[Type.bodySm, { color: TextColor.secondary }]}>
            {WINDOW_NOTE[exam.windowStatus] ?? "Not available yet."}
          </Text>
        )}
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
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
