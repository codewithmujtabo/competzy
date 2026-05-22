import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  LANGS,
  htmlToPlainText,
  pickLang,
  type LangCode,
} from "@/lib/exam-languages";

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
  // Language — locked once the student picks. Defaults to "en" on the wire
  // until the modal commits a choice (the picker auto-opens on first load
  // when sessions.language is null).
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<LangCode>("en");

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
    if (session.language) {
      setActiveLang(session.language as LangCode);
    } else {
      setLangPickerOpen(true);
    }
  }, [session]);

  const chooseLanguage = useCallback(
    async (code: LangCode) => {
      if (!sessionId) return;
      try {
        await examsService.setSessionLanguage(sessionId, code);
        setActiveLang(code);
        setLangPickerOpen(false);
      } catch (err: any) {
        Alert.alert("Could not set language", err?.message || "Please try again.");
      }
    },
    [sessionId],
  );

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
      {/* One-shot language picker — only when sessions.language is null. */}
      <Modal
        visible={langPickerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => session?.language && setLangPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[Type.h3, { marginBottom: Spacing.xs }]}>Pick your exam language</Text>
            <Text style={[Type.bodySm, { color: TextColor.secondary, marginBottom: Spacing.lg }]}>
              Your choice is locked for the duration of the attempt. Questions without
              a translation in your language fall back to English.
            </Text>
            <View style={{ gap: Spacing.sm }}>
              {LANGS.map((l) => (
                <Pressable
                  key={l.code}
                  onPress={() => void chooseLanguage(l.code)}
                  style={styles.langOption}
                >
                  <Ionicons name="globe-outline" size={18} color={Brand.primary} />
                  <Text style={[Type.body, { color: TextColor.primary }]}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

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
        <View style={styles.langChip}>
          <Ionicons name="globe-outline" size={14} color={TextColor.tertiary} />
          <Text style={[Type.caption, { color: TextColor.secondary }]}>
            {LANGS.find((l) => l.code === activeLang)?.label ?? "English"}
          </Text>
        </View>
        {session.periods.map((p) => (
          <QuestionCard
            key={p.id}
            period={p}
            lang={activeLang}
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
  lang,
  selected,
  shortValue,
  onSelect,
  onShortChange,
  onShortBlur,
}: {
  period: ExamPeriod;
  lang: LangCode;
  selected: string | null;
  shortValue: string;
  onSelect: (answerId: string) => void;
  onShortChange: (v: string) => void;
  onShortBlur: () => void;
}) {
  const isMc = period.options && period.options.length > 0;
  // The operator authors questions as HTML (TipTap output, with KaTeX math
  // spans on the web). Mobile strips the HTML to plain text — math comes
  // through as the raw LaTeX source ($x^2$). A future phase can render the
  // HTML properly with `react-native-render-html` + a math renderer.
  const stem = htmlToPlainText(pickLang(period.question, lang));
  return (
    <Card variant="playful">
      <Text style={[Type.label, { color: Brand.primary }]}>Question {period.number}</Text>
      <Text style={[Type.body, { marginTop: Spacing.xs }]}>{stem}</Text>

      {isMc ? (
        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          {period.options.map((opt) => {
            const on = selected === opt.id;
            const text = htmlToPlainText(pickLang(opt, lang));
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
                  {text}
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    backgroundColor: Surface.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
  },
  langChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
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
