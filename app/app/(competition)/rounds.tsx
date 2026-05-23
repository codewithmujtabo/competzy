import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Pill, ScreenHeader } from "@/components/ui";
import { Brand, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import type { Competition } from "@/services/competitions.service";
import * as competitionsService from "@/services/competitions.service";
import { HttpError } from "@/services/api";
import {
  ProfileCompletionModal,
  type ProfileFieldKey,
} from "@/components/profile/ProfileCompletionModal";

type Round = NonNullable<Competition["rounds"]>[number];

const CATEGORY_LABEL: Record<string, string> = {
  fast_track: "Fast Track",
  local: "Local Round",
  global: "Global Round",
};

function rupiah(n: number): string {
  if (!n || n <= 0) return "Free";
  return "Rp " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function statusTone(s: string): "success" | "warning" | "danger" | "brand" {
  if (["paid", "approved", "completed"].includes(s)) return "success";
  if (s === "rejected") return "danger";
  if (["pending_review", "pending_approval"].includes(s)) return "warning";
  return "brand";
}

// The per-round register screen for a multi-round competition — pick a round,
// register and pay for it. Reached from the competition detail screen.
export default function CompetitionRoundsScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registrations, registerCompetition } = useUser();
  const [busy, setBusy] = useState<string | null>(null);
  // When POST /registrations returns 409 PROFILE_INCOMPLETE we capture which
  // round + missing fields the student was trying to register so the modal
  // can collect the data and we can retry the same registration.
  const [profileGate, setProfileGate] = useState<{
    round: Round;
    missingFields: ProfileFieldKey[];
  } | null>(null);

  const { data: comp, isLoading, isError, refetch } = useQuery({
    queryKey: ["competition", compId],
    queryFn: () => competitionsService.get(compId!),
    enabled: !!compId,
  });

  // Rounds an operator has deactivated are hidden from students.
  const rounds = (comp?.rounds ?? []).filter((r) => r.isActive !== false);

  // Extract the missingFields list from a 409 PROFILE_INCOMPLETE response.
  // Returns null when the error is something else (we surface as an Alert).
  const profileGateFrom = (e: unknown): ProfileFieldKey[] | null => {
    if (!(e instanceof HttpError) || e.status !== 409) return null;
    if (e.body?.code !== "PROFILE_INCOMPLETE") return null;
    const raw = e.body?.missingFields;
    if (!Array.isArray(raw)) return null;
    return raw.filter((x): x is ProfileFieldKey => typeof x === "string");
  };

  const register = async (round: Round) => {
    if (!comp) return;
    setBusy(round.id);
    try {
      const reg = await registerCompetition(comp.id, {
        roundId: round.id,
        fee: round.fee,
        competitionName: comp.name,
        category: comp.category,
      });
      if (round.fee > 0 && reg.status === "pending_payment") {
        router.push({ pathname: "/(payment)/pay", params: { registrationId: reg.id } });
      } else {
        Alert.alert("Registered", `You're registered for ${round.roundName}.`);
      }
    } catch (e: any) {
      // The server gates Komodo registrations on a 9-field profile checklist;
      // when any are blank we open the inline form modal instead of a generic
      // "couldn't register" alert. After save the modal calls onCompleted, we
      // retry the registration POST, and the student lands on payment.
      const missing = profileGateFrom(e);
      if (missing) {
        setProfileGate({ round, missingFields: missing });
      } else {
        Alert.alert("Couldn't register", e?.message || "Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  // After the modal saves the missing fields, re-run register(). The retry
  // skips the modal-on-success path (the gate has cleared) and goes straight
  // to payment.
  const retryAfterProfileSaved = async () => {
    const round = profileGate?.round;
    setProfileGate(null);
    if (round) await register(round);
  };

  const profileGateLabel = profileGate
    ? `${comp?.name ?? "This competition"} — ${profileGate.round.roundName}`
    : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Rounds" subtitle={compName} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      ) : isError || !comp ? (
        <View style={styles.center}>
          <Text style={[Type.h3, { marginBottom: Spacing.lg }]}>Failed to load rounds</Text>
          <Button label="Try again" onPress={() => refetch()} />
        </View>
      ) : rounds.length === 0 ? (
        <View style={styles.center}>
          <EmptyState title="No rounds" message="This competition has a single registration." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[Type.bodySm, { color: TextColor.secondary, marginBottom: Spacing.xs }]}>
            Register and pay for each round you want to enter.
          </Text>
          {rounds.map((round, i) => {
            const reg = registrations.find(
              (r) => r.compId === comp.id && r.roundId === round.id,
            );
            const cat = round.roundCategory ? CATEGORY_LABEL[round.roundCategory] : null;
            const missed =
              !reg &&
              !!round.registrationDeadline &&
              new Date(round.registrationDeadline).getTime() < Date.now();
            return (
              <Card key={round.id} variant="playful">
                {/* Title row — full name (no truncate) + category chip. */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm }}>
                  <Text style={[Type.h3, { flex: 1 }]}>
                    {round.roundName || `Round ${i + 1}`}
                  </Text>
                  {cat ? <Pill label={cat} tone="brand" size="sm" /> : null}
                </View>

                {/* Description — when the operator typed one in the rounds
                    builder, render it as a paragraph below the title. */}
                {round.description ? (
                  <Text
                    style={[
                      Type.bodySm,
                      { color: TextColor.secondary, marginTop: Spacing.sm },
                    ]}
                  >
                    {round.description}
                  </Text>
                ) : null}

                {/* Metadata line — mode, exam date, fee. */}
                <Text
                  style={[Type.bodySm, { color: TextColor.secondary, marginTop: Spacing.xs }]}
                >
                  {round.roundType}
                  {round.examDate ? ` · ${fmtDate(round.examDate)}` : ""}
                  {` · ${rupiah(round.fee)}`}
                </Text>

                {/* Action row — status pill + CTA stacked at the bottom. */}
                <View style={{ marginTop: Spacing.md, alignItems: "flex-end", gap: Spacing.xs }}>
                  {reg ? (
                    reg.status === "pending_payment" ? (
                      <Button
                        label="Pay round fee"
                        size="sm"
                        onPress={() =>
                          router.push({
                            pathname: "/(payment)/pay",
                            params: { registrationId: reg.id },
                          })
                        }
                      />
                    ) : (
                      <Pill label={statusLabel(reg.status)} tone={statusTone(reg.status)} size="sm" />
                    )
                  ) : missed ? (
                    <Pill label="Missed" tone="neutral" size="sm" />
                  ) : (
                    <Button
                      label="Register for this round"
                      size="sm"
                      loading={busy === round.id}
                      onPress={() => register(round)}
                    />
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      <ProfileCompletionModal
        visible={!!profileGate}
        missingFields={profileGate?.missingFields ?? []}
        contextLabel={profileGateLabel}
        onClose={() => setProfileGate(null)}
        onCompleted={() => void retryAfterProfileSaved()}
      />
    </View>
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
});
