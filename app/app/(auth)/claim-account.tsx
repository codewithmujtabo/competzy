import { AppInput } from "@/components/common/AppInput";
import { Button, Card, Pill } from "@/components/ui";
import * as authService from "@/services/auth.service";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import { router, useLocalSearchParams } from "expo-router";
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

  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Minimum 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleClaim() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { user } = await authService.signup({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: params.phone,
        city: "",
        role: "student",
        roleData: {},
        consentAccepted: true,
      });
      if (user) {
        fetchUser(user.id);
        router.replace("/(tabs)/competitions");
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() ?? "";
      if (msg.includes("email already")) {
        Alert.alert("Email Already Registered", "This email is in use. Try another email or sign in.");
      } else {
        Alert.alert("Error", err?.message ?? "Failed to create account");
      }
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
        <View style={{ alignItems: "center", marginBottom: Spacing["2xl"] }}>
          <View style={styles.badge}>
            <Text style={{ fontSize: 36 }}>🏅</Text>
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
          <Pill label={`✓ HP terverifikasi: ${params.phone}`} tone="success" />
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
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              error={errors.password}
              editable={!loading}
            />
            <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={8}>
              <Text style={[Type.label, { color: Brand.primary }]}>
                {showPwd ? "Hide" : "Show"} password
              </Text>
            </Pressable>
            <Button
              label="Create Account & View History"
              onPress={handleClaim}
              loading={loading}
              fullWidth
              size="lg"
            />
          </View>
        </Card>

        <View style={styles.footer}>
          <Text style={[Type.body, { color: TextColor.secondary }]}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
            <Text style={[Type.body, { color: Brand.primary, fontWeight: "700" }]}>Sign In</Text>
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
