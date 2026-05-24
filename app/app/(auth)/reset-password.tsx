// Mobile reset-password screen. Mirrors web/app/reset-password/page.tsx —
// reads `token` from the route params (the email link uses
// `competzy://reset-password?token=…`, and via Universal Links the web URL
// `https://arena.competzy.com/reset-password?token=…` also lands here on
// devices that have the app installed). The token is single-use and the
// backend rejects anything older than 15 minutes; this screen surfaces both
// error states explicitly so the student knows what to do next.

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
import { router, useLocalSearchParams } from "expo-router";
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

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!password || password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    if (password !== confirm) {
      next.confirm = "Passwords don't match.";
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      // Bounce back to login after a brief read; the new password is now
      // live and the old token is consumed.
      setTimeout(() => router.replace("/(auth)/login"), 2200);
    } catch (e: any) {
      const message = typeof e?.message === "string" ? e.message : "Reset failed";
      // Backend invalidates expired / used tokens with the same 400 — surface
      // a single human-readable line and keep the user on the screen so they
      // can request a fresh link via the back-link.
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  // When the deep-link arrived without a token, the link itself was malformed
  // (or the user opened the screen directly). Either way there's nothing to do
  // here but kick them back to forgot-password to request a new one.
  if (!token) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <View style={styles.iconBadge}>
            <Ionicons name="alert-circle-outline" size={36} color={Brand.error} />
          </View>
          <Text style={[Type.h2, { textAlign: "center", marginTop: Spacing.lg }]}>
            Missing reset token
          </Text>
          <Text
            style={[
              Type.body,
              {
                color: TextColor.secondary,
                textAlign: "center",
                marginTop: Spacing.sm,
                marginBottom: Spacing.xl,
                paddingHorizontal: Spacing.xl,
              },
            ]}
          >
            Open the link directly from your reset email, or request a new link.
          </Text>
          <Button
            label="Request a new link"
            onPress={() => router.replace("/(auth)/forgot-password")}
            size="lg"
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing["2xl"] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="key-outline" size={36} color={Brand.primary} />
          </View>
          <Text style={Type.displayMd}>Set a new password</Text>
          <Text
            style={[
              Type.body,
              { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm },
            ]}
          >
            Choose at least 8 characters. The reset link is single-use.
          </Text>
        </View>

        <Card padding="lg" style={{ marginTop: Spacing["2xl"] }}>
          {done ? (
            <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark" size={32} color={Brand.success} />
              </View>
              <Text style={[Type.h3, { textAlign: "center", marginTop: Spacing.lg }]}>
                Password updated
              </Text>
              <Text
                style={[
                  Type.body,
                  {
                    color: TextColor.secondary,
                    textAlign: "center",
                    marginTop: Spacing.sm,
                  },
                ]}
              >
                Redirecting you to sign in…
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.lg }}>
              <AppInput
                label="New password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                error={errors.password}
                editable={!loading}
                rightIcon={
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={TextColor.tertiary}
                  />
                }
                onRightIconPress={() => setShowPassword((v) => !v)}
              />
              <AppInput
                label="Confirm new password"
                placeholder="Re-enter the password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                error={errors.confirm}
                editable={!loading}
              />
              {errors.form && (
                <View style={styles.errorBox}>
                  <Text style={[Type.bodySm, { color: Brand.error }]}>{errors.form}</Text>
                </View>
              )}
              <Button
                label="Update password"
                onPress={submit}
                loading={loading}
                fullWidth
                size="lg"
              />
              <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
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
    backgroundColor: Brand.successSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.errorSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBox: {
    backgroundColor: Brand.errorSoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
});
