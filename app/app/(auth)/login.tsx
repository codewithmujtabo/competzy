import { AppInput } from "@/components/common/AppInput";
import { Button, Card } from "@/components/ui";
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
import { router } from "expo-router";
import React, { useState } from "react";
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

type AuthTab = "email" | "phone";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { fetchUser } = useUser();

  const [authTab, setAuthTab] = useState<AuthTab>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function switchTab(tab: AuthTab) {
    setAuthTab(tab);
    setErrors({});
    setPhoneOtpSent(false);
    setPhoneOtp("");
  }

  function validateEmailPassword() {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validatePhone() {
    const e: Record<string, string> = {};
    const digits = phone.replace(/\D/g, "");
    if (!phone.trim()) e.phone = "Phone number is required";
    else if (digits.length < 9 || digits.length > 13) e.phone = "Enter a valid phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function onSuccess(user: any) {
    fetchUser(user?.id);
    const userRole = user?.role;
    if (userRole === "admin") router.replace("/(tabs)/web-portal-redirect");
    else if (userRole === "teacher") router.replace("/(tabs)/teacher-dashboard");
    else if (userRole === "parent") router.replace("/(tabs)/children");
    else if (userRole === "school_admin") router.replace("/(tabs)/profile");
    else router.replace("/(tabs)/competitions");
  }

  async function handleEmailLogin() {
    if (!validateEmailPassword()) return;
    setLoading(true);
    try {
      const { user } = await authService.login(email.trim(), password.trim());
      if (user) onSuccess(user);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      Alert.alert(
        "Sign In Failed",
        msg.includes("invalid") ? "Email or password is incorrect" : err.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPhoneOtp() {
    if (!validatePhone()) return;
    setLoading(true);
    try {
      await authService.sendPhoneOtp(phone.trim());
      setPhoneOtpSent(true);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (!phoneOtp.trim() || phoneOtp.length < 6) {
      setErrors({ phoneOtp: "Enter the 6-digit OTP code" });
      return;
    }
    setLoading(true);
    try {
      const result = await authService.verifyPhoneOtp(phone.trim(), phoneOtp);
      if ("noAccount" in result) {
        Alert.alert("Account Not Found", "This phone is not registered. Please sign up first.", [
          { text: "Sign Up", onPress: () => router.push("/(auth)/register") },
          { text: "Cancel", style: "cancel" },
        ]);
        return;
      }
      if ("historicalMatch" in result) {
        router.push({
          pathname: "/(auth)/claim-account",
          params: { phone: result.phone, fullName: result.fullName, email: result.email },
        });
        return;
      }
      if (result.user) onSuccess(result.user);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
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
        {/* Brand header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="trophy" size={36} color={Brand.primary} />
          </View>
          <Text style={Type.displayMd}>Welcome</Text>
          <Text
            style={[
              Type.body,
              { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm },
            ]}
          >
            Sign in to access your competitions, results, and certificates.
          </Text>
        </View>

        <Card padding="lg" style={{ marginTop: Spacing["2xl"] }}>
          {/* Tab switcher */}
          <View style={styles.tabRow}>
            {(["email", "phone"] as AuthTab[]).map((tab) => (
              <Pressable
                key={tab}
                style={({ pressed }) => [
                  styles.tab,
                  authTab === tab && styles.tabActive,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => switchTab(tab)}
                accessibilityRole="button"
                accessibilityState={{ selected: authTab === tab }}
              >
                <Text
                  style={[
                    Type.label,
                    {
                      color: authTab === tab ? Brand.primary : TextColor.secondary,
                      fontSize: 13,
                    },
                  ]}
                >
                  {tab === "email" ? "Email" : "Phone Number"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Email + password */}
          {authTab === "email" ? (
            <View style={{ gap: Spacing.lg, marginTop: Spacing.xl }}>
              <AppInput
                label="Email"
                placeholder="e.g. john@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                editable={!loading}
              />
              <AppInput
                label="Password"
                placeholder="Enter your password"
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
              <Button label="Sign In" onPress={handleEmailLogin} loading={loading} fullWidth size="lg" />
            </View>
          ) : (
            <View style={{ gap: Spacing.lg, marginTop: Spacing.xl }}>
              {!phoneOtpSent ? (
                <>
                  <AppInput
                    label="Phone Number"
                    placeholder="e.g. 08123456789"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    error={errors.phone}
                    editable={!loading}
                  />
                  <Text style={[Type.caption, { marginTop: -Spacing.sm }]}>
                    Indonesian format: 08xxx or +628xxx
                  </Text>
                  <Button label="Send OTP" onPress={handleSendPhoneOtp} loading={loading} fullWidth size="lg" />
                </>
              ) : (
                <>
                  <View
                    style={{
                      backgroundColor: Brand.primarySoft,
                      borderRadius: Radius.lg,
                      padding: Spacing.md,
                    }}
                  >
                    <Text style={[Type.bodySm, { color: Brand.primary, fontFamily: FontFamily.bodySemi }]}>
                      OTP code sent to {phone}
                    </Text>
                  </View>
                  <AppInput
                    label="OTP Code"
                    placeholder="6-digit code"
                    value={phoneOtp}
                    onChangeText={setPhoneOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    error={errors.phoneOtp}
                    editable={!loading}
                  />
                  <Button
                    label="Verify"
                    onPress={handleVerifyPhoneOtp}
                    loading={loading}
                    fullWidth
                    size="lg"
                  />
                  <Pressable
                    onPress={() => {
                      setPhoneOtpSent(false);
                      setPhoneOtp("");
                      setErrors({});
                    }}
                    hitSlop={8}
                  >
                    <Text style={[Type.label, { color: Brand.primary, textAlign: "center" }]}>
                      ← Change number
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </Card>

        <View style={styles.footer}>
          <Text style={[Type.body, { color: TextColor.secondary }]}>Don't have an account? </Text>
          <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={8}>
            <Text style={[Type.body, { color: Brand.primary, fontFamily: FontFamily.bodyBold }]}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["4xl"] },
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
  tabRow: {
    flexDirection: "row",
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.lg,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Surface.card,
    ...Shadow.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing["2xl"],
  },
});
