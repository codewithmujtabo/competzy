import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, ScreenHeader } from "@/components/ui";
import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import * as marketingService from "@/services/marketing.service";

export default function FeedbackScreen() {
  const { compId, compName } = useLocalSearchParams<{ compId: string; compName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = content.trim();
    if (!text || !compId) return;
    setSending(true);
    setError(null);
    try {
      await marketingService.sendSuggestion(compId, text);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Failed to send your feedback.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Send Feedback" subtitle={compName} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sent ? (
          <Card variant="playful" style={{ alignItems: "center" }}>
            <View style={styles.tick}>
              <Ionicons name="checkmark-circle" size={48} color={Brand.success} />
            </View>
            <Text style={[Type.h2, { marginTop: Spacing.md }]}>Thank you!</Text>
            <Text style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm }]}>
              Your feedback has reached the organizer team.
            </Text>
            <Button
              label="Back to competition"
              variant="secondary"
              style={{ marginTop: Spacing.xl }}
              onPress={() => router.back()}
            />
          </Card>
        ) : (
          <Card variant="playful">
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={Brand.primary} />
              <Text style={[Type.bodySm, { flex: 1 }]}>
                Tell the organizers what&apos;s working and what could be better.
              </Text>
            </View>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Your suggestion or feedback…"
              placeholderTextColor={TextColor.tertiary}
              style={styles.input}
              multiline
            />
            {error ? (
              <Text style={[Type.bodySm, { color: Brand.error, marginTop: Spacing.sm }]}>
                {error}
              </Text>
            ) : null}
            <Button
              label={sending ? "Sending…" : "Send feedback"}
              loading={sending}
              disabled={!content.trim()}
              fullWidth
              style={{ marginTop: Spacing.lg }}
              onPress={submit}
            />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing["3xl"],
  },
  tick: { marginTop: Spacing.sm },
  input: {
    marginTop: Spacing.md,
    minHeight: 140,
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Surface.card,
    textAlignVertical: "top",
    ...Type.body,
  },
});
