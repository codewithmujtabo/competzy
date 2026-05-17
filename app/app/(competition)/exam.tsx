import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as examsService from "@/services/exams.service";
import type { ExamPeriod } from "@/services/exams.service";

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function ExamPlayerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: session, isLoading, isError, refetch } = useQuery({
    queryKey: ["examSession", sessionId],
    queryFn: () => examsService.getSession(sessionId!),
    enabled: !!sessionId,
  });

  // Answer state, seeded from the loaded periods.
  const [mc, setMc] = useState<Record<string, string>>({});
  const [sa, setSa] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    if (!session) return;
    const m: Record<string, string> = {};
    const s: Record<string, string> = {};
    for (const p of session.periods) {
      if (p.answerId) m[p.id] = p.answerId;
      if (p.shortAnswer) s[p.id] = p.shortAnswer;
    }
    setMc(m);
    setSa(s);
    setRemaining(session.remainingSeconds);
  }, [session]);

  // A finished session has no player — bounce to the result.
  useEffect(() => {
    if (session?.finishedAt) {
      router.replace({ pathname: "/(competition)/exam-result", params: { sessionId } });
    }
  }, [session?.finishedAt, router, sessionId]);

  const toResult = useCallback(() => {
    router.replace({ pathname: "/(competition)/exam-result", params: { sessionId } });
  }, [router, sessionId]);

  const doSubmit = useCallback(async () => {
    if (submitted.current || !sessionId) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      await examsService.submitSession(sessionId);
      toResult();
    } catch (err: any) {
      submitted.current = false;
      setSubmitting(false);
      Alert.alert("Submit failed", err?.message || "Please try again.");
    }
  }, [sessionId, toResult]);

  // Countdown — ticks every second, auto-submits at zero.
  useEffect(() => {
    if (remaining == null) return;
    if (remaining <= 0) {
      void doSubmit();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining, doSubmit]);

  const saveMc = (periodId: string, answerId: string) => {
    setMc((prev) => ({ ...prev, [periodId]: answerId }));
    if (sessionId) examsService.saveAnswer(sessionId, periodId, { answerId }).catch(() => {});
  };
  const saveSa = (periodId: string) => {
    if (sessionId) {
      examsService
        .saveAnswer(sessionId, periodId, { shortAnswer: sa[periodId] ?? "" })
        .catch(() => {});
    }
  };

  const confirmSubmit = () => {
    Alert.alert("Submit exam?", "You won't be able to change your answers after submitting.", [
      { text: "Keep going", style: "cancel" },
      { text: "Submit", style: "destructive", onPress: () => void doSubmit() },
    ]);
  };

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
        <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load the exam</Text>
        <Button label="Try again" onPress={() => refetch()} />
      </View>
    );
  }
  if (session.finishedAt) return null; // redirecting to the result

  const low = remaining != null && remaining <= 60;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={session.examName}
        onBack={() => router.back()}
        trailing={
          remaining != null ? (
            <Pill
              label={fmtClock(remaining)}
              tone={low ? "danger" : "brand"}
              leadingIcon={
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={low ? Brand.error : Brand.primary}
                />
              }
            />
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {session.periods.map((p) => (
          <QuestionCard
            key={p.id}
            period={p}
            selected={mc[p.id] ?? null}
            shortValue={sa[p.id] ?? ""}
            onSelect={(answerId) => saveMc(p.id, answerId)}
            onShortChange={(v) => setSa((prev) => ({ ...prev, [p.id]: v }))}
            onShortBlur={() => saveSa(p.id)}
          />
        ))}

        <Button
          label={submitting ? "Submitting…" : "Submit exam"}
          loading={submitting}
          fullWidth
          onPress={confirmSubmit}
          style={{ marginTop: Spacing.sm }}
        />
      </ScrollView>
    </View>
  );
}

function QuestionCard({
  period,
  selected,
  shortValue,
  onSelect,
  onShortChange,
  onShortBlur,
}: {
  period: ExamPeriod;
  selected: string | null;
  shortValue: string;
  onSelect: (answerId: string) => void;
  onShortChange: (v: string) => void;
  onShortBlur: () => void;
}) {
  const isMc = period.options && period.options.length > 0;
  return (
    <Card variant="playful">
      <Text style={[Type.label, { color: Brand.primary }]}>Question {period.number}</Text>
      <Text style={[Type.body, { marginTop: Spacing.xs }]}>{period.questionContent}</Text>

      {isMc ? (
        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          {period.options.map((opt) => {
            const on = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onSelect(opt.id)}
                style={[styles.option, on && styles.optionOn]}
              >
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[Type.body, { flex: 1 }, on && { color: Brand.primaryDark }]}>
                  {opt.content}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={shortValue}
          onChangeText={onShortChange}
          onBlur={onShortBlur}
          placeholder="Type your answer…"
          placeholderTextColor={TextColor.tertiary}
          style={styles.shortInput}
          multiline
        />
      )}
    </Card>
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
    paddingBottom: Spacing["4xl"],
    gap: Spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  optionOn: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Surface.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: Brand.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primary,
  },
  shortInput: {
    marginTop: Spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Surface.card,
    ...Type.body,
  },
});
