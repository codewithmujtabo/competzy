// Mobile forgot-password screen. Mirrors web/app/forgot-password/page.tsx —
// student enters their email, we POST /auth/forgot-password (which always
// returns 200, never reveals whether the email matches an account), then show
// a generic "check your email" success state. The email contains the actual
// reset link; the in-app handler is at app/app/(auth)/reset-password.tsx.

import { AppInput } from "@/components/common/AppInput";
import { Button, Card } from "@/components/ui";
import {
  Brand,
  FontFamily,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import * as authService from "@/services/auth.service";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(trimmed);
      setSent(true);
    } catch {
      // Backend silently 200s when the email doesn't match — the only path
      // here is a network / 5xx error, which is also safe to coalesce into
      // the same success message (no information leakage either way).
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={22} color={TextColor.primary} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="lock-closed-outline" size={36} color={Brand.primary} />
          </View>
          <Text style={Type.displayMd}>Forgot password?</Text>
          <Text
            style={[
              Type.body,
              { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm },
            ]}
          >
            Enter your email and we&apos;ll send you a link to reset it.
          </Text>
        </View>

        <Card padding="lg" style={{ marginTop: Spacing["2xl"] }}>
          {sent ? (
            <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
              <View style={styles.successBadge}>
                <Ionicons name="mail-outline" size={28} color={Brand.primary} />
              </View>
              <Text style={[Type.h3, { textAlign: "center", marginTop: Spacing.lg }]}>
                Check your email
              </Text>
              <Text
                style={[
                  Type.body,
                  {
                    color: TextColor.secondary,
                    textAlign: "center",
                    marginTop: Spacing.sm,
                    marginBottom: Spacing.lg,
                  },
                ]}
              >
                If that email matches an account, we sent a reset link. The link expires in 15
                minutes — tap it on this device to open the app.
              </Text>
              <Button
                label="Back to sign in"
                onPress={() => router.replace("/(auth)/login")}
                fullWidth
                size="lg"
              />
            </View>
          ) : (
            <View style={{ gap: Spacing.lg }}>
              <AppInput
                label="Email"
                placeholder="e.g. john@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={error ?? undefined}
                editable={!loading}
              />
              <Button
                label="Send reset link"
                onPress={submit}
                loading={loading}
                fullWidth
                size="lg"
              />
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text
                  style={[
                    Type.label,
                    { color: Brand.primary, textAlign: "center", fontFamily: FontFamily.bodyBold },
                  ]}
                >
                  ← Back to sign in
                </Text>
              </Pressable>
            </View>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["4xl"] },
  backBtn: {
    alignSelf: "flex-start",
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  header: { alignItems: "center" },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Brand.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
});
