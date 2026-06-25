import { AppInput } from "@/components/common/AppInput";
import { CountrySelect } from "@/components/common/CountrySelect";
import { Button, Card, Pill, ScreenHeader } from "@/components/ui";
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
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Student-only registration, mirroring the web register flow:
//   form (name · email · phone · password · confirm · country · consent)
//     → POST /auth/signup/send-code (emails a 6-digit code)
//   verify (enter code) → POST /auth/signup (creates the account)
// Parent / teacher / other accounts are created on the web or by an admin.

const RESEND_COOLDOWN_S = 30;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fetchUser } = useUser();

  const [step, setStep] = useState<"form" | "verify">("form");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  // Country at registration is the only location field — province/city are
  // added later from the profile editor. ISO 3166-1 alpha-2 (e.g. "ID", "MY").
  const [country, setCountry] = useState("");
  const [consent, setConsent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Email-verification step state.
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [verifyError, setVerifyError] = useState("");

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    else if (name.trim().length < 3) e.name = "Name must be at least 3 characters";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Minimum 8 characters";
    if (!confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (confirmPassword !== password) e.confirmPassword = "Passwords don’t match";
    // Phone is optional, but if present it must look valid.
    if (phone.trim() && phone.replace(/\D/g, "").length < 9) e.phone = "Enter a valid phone number";
    if (!consent) e.consent = "You must agree to the privacy policy";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Step 1 → 2: email a verification code, then move to the verify step.
  const handleSendCode = async () => {
    if (!validateForm()) return;
    setSending(true);
    setVerifyError("");
    try {
      const res = await authService.sendSignupCode(email.trim());
      setDevCode(res.devBypass ? res.devCode ?? null : null);
      setCode("");
      setResendIn(RESEND_COOLDOWN_S);
      setStep("verify");
    } catch (err: any) {
      if (err?.status === 409) {
        setErrors((prev) => ({ ...prev, email: "This email is already registered. Sign in instead." }));
      } else if ((err?.message || "").toLowerCase().includes("rate limit")) {
        Alert.alert("Too fast", "Please wait a moment and try again.");
      } else {
        Alert.alert("Error", err?.message || "Could not send the verification code.");
      }
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || sending) return;
    setSending(true);
    setVerifyError("");
    try {
      const res = await authService.sendSignupCode(email.trim());
      setDevCode(res.devBypass ? res.devCode ?? null : null);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err: any) {
      setVerifyError(err?.message || "Could not resend the code.");
    } finally {
      setSending(false);
    }
  };

  // Step 2: verify the code + create the account.
  const handleCreateAccount = async () => {
    if (code.trim().length !== 6) {
      setVerifyError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setVerifyError("");
    try {
      const { user } = await authService.signup({
        email: email.trim(),
        password: password.trim(),
        fullName: name.trim(),
        phone: phone.trim(),
        country: country ? country.trim().toUpperCase() : undefined,
        role: "student",
        roleData: {},
        consentAccepted: true,
        verificationCode: code.trim(),
      });
      if (user?.id) await fetchUser(user.id);
      router.replace("/(tabs)/competitions");
    } catch (err: any) {
      const codeBad =
        err?.body?.code === "INVALID_VERIFICATION_CODE" ||
        err?.body?.code === "EMAIL_NOT_VERIFIED" ||
        /verification code|invalid or has expired/i.test(err?.message || "");
      const msg = (err?.message || "").toLowerCase();
      if (codeBad) {
        setVerifyError("That code is invalid or has expired. Request a new one.");
      } else if (msg.includes("already")) {
        setErrors((prev) => ({ ...prev, email: "This email is already registered. Sign in instead." }));
        setStep("form");
      } else if (msg.includes("rate limit")) {
        Alert.alert("Too fast", "Wait 2 minutes and try again.");
      } else {
        Alert.alert("Error", err?.message || "Failed to register");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify email ────────────────────────────────────────────────
  if (step === "verify") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <ScreenHeader title="Verify Email" onBack={() => setStep("form")} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: Spacing.xl }}>
            <View style={styles.logoTile}>
              <Text style={{ fontSize: 32 }}>📧</Text>
            </View>
            <Text style={[Type.displayMd, { marginTop: Spacing.lg, textAlign: "center" }]}>
              Check your inbox
            </Text>
            <Text style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.sm, textAlign: "center" }]}>
              We sent a 6-digit code to{"\n"}
              <Text style={{ color: TextColor.primary, fontFamily: FontFamily.bodyBold }}>{email.trim()}</Text>
            </Text>
          </View>

          {devCode ? (
            <View style={{ alignSelf: "center", marginBottom: Spacing.md }}>
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
              <Pressable onPress={handleResend} disabled={resendIn > 0 || sending} hitSlop={8} style={{ alignSelf: "flex-start" }}>
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
            </View>
          </Card>
        </ScrollView>

        <View style={[styles.footerRow, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button label="Back" variant="ghost" onPress={() => setStep("form")} disabled={loading} />
          <View style={{ flex: 1 }}>
            <Button
              label="Create Account"
              onPress={handleCreateAccount}
              loading={loading}
              disabled={code.trim().length !== 6}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step 1: Details ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScreenHeader title="Create Account" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={Type.displayMd}>Join the championship</Text>
          <Text style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
            Create your Competzy account to discover and join competitions.
          </Text>
        </View>

        <Card>
          <View style={{ gap: Spacing.lg }}>
            <AppInput
              label="Full Name"
              placeholder="e.g. John Doe"
              value={name}
              onChangeText={setName}
              error={errors.name}
              editable={!sending}
            />
            <AppInput
              label="Email"
              placeholder="e.g. john@email.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors((p) => ({ ...p, email: "" }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              editable={!sending}
            />
            <AppInput
              label="WhatsApp (optional)"
              placeholder="e.g. 08123456789"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              error={errors.phone}
              editable={!sending}
            />
            <AppInput
              label="Password (min 8 characters)"
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              error={errors.password}
              editable={!sending}
              rightIcon={
                <Ionicons
                  name={showPwd ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color={TextColor.tertiary}
                />
              }
              onRightIconPress={() => setShowPwd((v) => !v)}
            />
            <AppInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPwd}
              error={errors.confirmPassword}
              editable={!sending}
            />
            <View>
              <CountrySelect label="Country (optional)" value={country} onChange={setCountry} />
              <Text style={{ color: TextColor.tertiary, fontSize: 12, marginTop: Spacing.xs }}>
                You can add your province and city later from your profile.
              </Text>
            </View>
          </View>
        </Card>

        <Pressable
          style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.85 }]}
          onPress={() => {
            setConsent((v) => !v);
            if (errors.consent) setErrors((p) => ({ ...p, consent: "" }));
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
        >
          <View style={[styles.checkbox, consent && { backgroundColor: Brand.primary, borderColor: Brand.primary }]}>
            {consent ? <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>✓</Text> : null}
          </View>
          <Text style={[Type.body, { flex: 1, color: TextColor.secondary }]}>
            I agree to the Competzy{" "}
            <Text
              style={{ color: Brand.primary, textDecorationLine: "underline" }}
              onPress={() => Linking.openURL("https://competzy.id/terms")}
            >
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text
              style={{ color: Brand.primary, textDecorationLine: "underline" }}
              onPress={() => Linking.openURL("https://competzy.id/privacy")}
            >
              Privacy Policy
            </Text>
            , and consent to processing of my data.
          </Text>
        </Pressable>
        {errors.consent ? (
          <Text style={[Type.caption, { color: Brand.error, marginTop: Spacing.sm }]}>{errors.consent}</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footerRow, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button label="Back" variant="ghost" onPress={() => router.back()} disabled={sending} />
        <View style={{ flex: 1 }}>
          <Button label="Continue" onPress={handleSendCode} loading={sending} fullWidth size="lg" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["3xl"] },
  logoTile: {
    width: 80,
    height: 80,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Surface.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    backgroundColor: Surface.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
  },
});
