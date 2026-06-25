import { AppInput } from "@/components/common/AppInput";
import { Button, Card, Pill } from "@/components/ui";
import * as authService from "@/services/auth.service";
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
import { useUser } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ClaimAccountScreen() {
  const insets = useSafeAreaInsets();
  const { fetchUser } = useUser();
  const params = useLocalSearchParams<{ phone: string; fullName: string; email: string }>();

  const [fullName, setFullName] = useState(params.fullName ?? "");
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Email-verification step. The phone is already OTP-verified, but the email
  // here is editable + unproven, so we confirm it before creating the account.
  const [step, setStep] = useState<"form" | "verify">("form");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [verifyError, setVerifyError] = useState("");
  const RESEND_COOLDOWN_S = 30;

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Minimum 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function sendCode(isResend = false) {
    setSending(true);
    setVerifyError("");
    try {
      const res = await authService.sendSignupCode(email.trim());
      setDevCode(res.devBypass ? res.devCode ?? null : null);
      setResendIn(RESEND_COOLDOWN_S);
      if (!isResend) {
        setCode("");
        setStep("verify");
      }
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert("Email Already Registered", "This email is in use. Try another email or sign in.");
      } else if (isResend) {
        setVerifyError(err?.message || "Could not resend the code.");
      } else {
        Alert.alert("Error", err?.message || "Could not send the verification code.");
      }
    } finally {
      setSending(false);
    }
  }

  function handleSendCode() {
    if (!validate()) return;
    void sendCode(false);
  }

  function handleResend() {
    if (resendIn > 0 || sending) return;
    void sendCode(true);
  }

  async function handleClaim() {
    if (code.trim().length !== 6) {
      setVerifyError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setVerifyError("");
    try {
      const { user } = await authService.signup({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: params.phone,
        role: "student",
        roleData: {},
        consentAccepted: true,
        verificationCode: code.trim(),
      });
      if (user) {
        fetchUser(user.id);
        router.replace("/(tabs)/competitions");
      }
    } catch (err: any) {
      const codeBad =
        err?.body?.code === "INVALID_VERIFICATION_CODE" ||
        err?.body?.code === "EMAIL_NOT_VERIFIED" ||
        /verification code|invalid or has expired/i.test(err?.message || "");
      const msg = err?.message?.toLowerCase() ?? "";
      if (codeBad) {
        setVerifyError("That code is invalid or has expired. Request a new one.");
      } else if (msg.includes("email already")) {
        Alert.alert("Email Already Registered", "This email is in use. Try another email or sign in.");
        setStep("form");
      } else {
        Alert.alert("Error", err?.message ?? "Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Verify email step ───────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", marginBottom: Spacing["2xl"] }}>
            <View style={styles.badge}>
              <Ionicons name="mail-outline" size={36} color={Brand.primary} />
            </View>
            <Text style={[Type.displayMd, { textAlign: "center", marginTop: Spacing.lg }]}>
              Check your inbox
            </Text>
            <Text style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm }]}>
              We sent a 6-digit code to{"\n"}
              <Text style={{ color: TextColor.primary, fontFamily: FontFamily.bodyBold }}>{email.trim()}</Text>
            </Text>
          </View>

          {devCode ? (
            <View style={{ alignSelf: "center", marginBottom: Spacing.lg }}>
              <Pill label={`Dev code: ${devCode}`} tone="info" />
            </View>
          ) : null}

          <Card>
            <View style={{ gap: Spacing.lg }}>
              <AppInput
                label="Verification Code"
                placeholder="123456"
                value={code}
                onChangeText={(t) => {
                  setCode(t.replace(/\D/g, "").slice(0, 6));
                  setVerifyError("");
                }}
                keyboardType="number-pad"
                maxLength={6}
                error={verifyError || undefined}
                editable={!loading}
              />
              <Pressable onPress={handleResend} disabled={resendIn > 0 || sending} hitSlop={8}>
                <Text
                  style={{
                    ...Type.bodySm,
                    color: resendIn > 0 || sending ? TextColor.tertiary : Brand.primary,
                    fontFamily: FontFamily.bodyBold,
                  }}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </Text>
              </Pressable>
              <Button
                label="Create Account & View History"
                onPress={handleClaim}
                loading={loading}
                disabled={code.trim().length !== 6}
                fullWidth
                size="lg"
              />
              <Pressable onPress={() => setStep("form")} disabled={loading} hitSlop={8} style={{ alignSelf: "center" }}>
                <Text style={[Type.body, { color: TextColor.secondary }]}>Use a different email</Text>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: Spacing["2xl"] }}>
          <View style={styles.badge}>
            <Ionicons name="ribbon" size={36} color={Brand.primary} />
          </View>
          <Text style={[Type.displayMd, { textAlign: "center", marginTop: Spacing.lg }]}>
            We Found{"\n"}Your Records!
          </Text>
          <Text
            style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm }]}
          >
            Your phone matches our previous competition records. Set a password to view your history and join new competitions.
          </Text>
        </View>

        <View style={{ alignSelf: "center", marginBottom: Spacing.lg }}>
          <Pill label={`✓ Phone verified: ${params.phone}`} tone="success" />
        </View>

        <Card>
          <View style={{ gap: Spacing.lg }}>
            <AppInput
              label="Full Name"
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              error={errors.fullName}
              editable={!loading}
            />
            <AppInput
              label="Email"
              placeholder="e.g. student@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              editable={!loading}
            />
            <AppInput
              label="Password"
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              error={errors.password}
              editable={!loading}
              rightIcon={
                <Ionicons
                  name={showPwd ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color={TextColor.tertiary}
                />
              }
              onRightIconPress={() => setShowPwd((v) => !v)}
            />
            <Button
              label="Continue"
              onPress={handleSendCode}
              loading={sending}
              fullWidth
              size="lg"
            />
          </View>
        </Card>

        <View style={styles.footer}>
          <Text style={[Type.body, { color: TextColor.secondary }]}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
            <Text style={[Type.body, { color: Brand.primary, fontFamily: FontFamily.bodyBold }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["4xl"] },
  badge: {
    width: 80,
    height: 80,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
  },
});
