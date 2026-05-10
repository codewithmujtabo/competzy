import { Card, Pill } from "@/components/ui";
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
import { router, useFocusEffect } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  school_admin: "School Admin",
};
const ROLE_EMOJI: Record<string, string> = {
  student: "🎒",
  parent: "👨‍👩‍👧",
  teacher: "📖",
  school_admin: "🏫",
};

export default function ProfileScreen() {
  const { user, registrations, refreshRegistrations } = useUser();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      refreshRegistrations();
    }, [refreshRegistrations])
  );

  const fullName = (user as any)?.fullName ?? (user as any)?.name ?? "—";
  const initial = fullName.charAt(0).toUpperCase();
  const photoUrl = (user as any)?.photoUrl || (user as any)?.avatarUrl;
  const kid = (user as any)?.kid;
  const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") || "";
  const role = (user as any)?.role ?? "student";

  const totalComps = role === "student" ? registrations.length : 0;
  const completed = role === "student" ? registrations.filter((r) => r.status === "completed").length : 0;
  const active = role === "student" ? registrations.filter((r) => r.status === "paid").length : 0;

  const menuItems = [
    { emoji: "👤", label: "Edit Profile", onPress: () => router.push("/(tabs)/profile/edit") },
    ...(role === "student"
      ? [
          { emoji: "📄", label: "Document Vault", onPress: () => router.push("/(tabs)/profile/document-vault") },
          { emoji: "🏆", label: "Competition History", onPress: () => router.push("/(tabs)/profile/history") },
          { emoji: "👨‍👩‍👧", label: "Link Parent Account", onPress: () => router.push("/(tabs)/profile/link-parent") },
        ]
      : []),
    ...(role === "school_admin"
      ? [
          { emoji: "📊", label: "School Dashboard", onPress: () => router.push("/school-dashboard") },
          { emoji: "📤", label: "Bulk Registration", onPress: () => router.push("/bulk-registration") },
        ]
      : []),
    { emoji: "🔔", label: "Notifications", onPress: () => router.push("/(tabs)/notifications") },
    { emoji: "⚙️", label: "Account Settings", onPress: () => {} },
    { emoji: "❓", label: "Help & FAQ", onPress: () => {} },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing["4xl"] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero card */}
      <View style={styles.hero}>
        <View style={styles.heroBlob} />
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            {photoUrl ? (
              <Image source={{ uri: `${API_BASE}${photoUrl}` }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>
        </View>
        <Text style={[Type.h1, { color: "#FFFFFF", marginTop: Spacing.lg, textAlign: "center" }]}>
          {fullName}
        </Text>
        <View style={styles.roleBadge}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>{ROLE_EMOJI[role] ?? "👤"}</Text>
          <Text style={{ ...Type.label, color: "#FFFFFF", fontSize: 13 }}>{ROLE_LABEL[role] ?? role}</Text>
        </View>
        {kid ? (
          <Text style={[Type.caption, { color: "rgba(255,255,255,0.85)", marginTop: Spacing.sm, fontVariant: ["tabular-nums"] }]}>
            ID: {kid}
          </Text>
        ) : null}
        {((user as any)?.city || (user as any)?.school) ? (
          <Text style={[Type.bodySm, { color: "rgba(255,255,255,0.85)", marginTop: Spacing.xs, textAlign: "center" }]}>
            {[(user as any)?.school, (user as any)?.city].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>

      {/* Stats row — students only */}
      {role === "student" ? (
        <View style={styles.statsRow}>
          {[
            { label: "Total", value: totalComps },
            { label: "Active", value: active },
            { label: "Completed", value: completed },
          ].map((s, i) => (
            <View key={s.label} style={[styles.statItem, i < 2 && styles.statBorder]}>
              <Text style={[Type.h1, { color: Brand.primary }]}>{s.value}</Text>
              <Text style={[Type.caption, { marginTop: 2 }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Menu */}
      <Card padding={0} style={styles.menuCard}>
        {menuItems.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            android_ripple={{ color: "rgba(99,102,241,0.06)" }}
            style={({ pressed }) => [
              styles.menuItem,
              i < menuItems.length - 1 && styles.menuItemBorder,
              pressed && { backgroundColor: Brand.primarySoft },
            ]}
          >
            <View style={styles.menuIcon}>
              <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            </View>
            <Text style={[Type.body, { flex: 1, fontWeight: "600" }]}>{item.label}</Text>
            <Text style={{ fontSize: 22, color: TextColor.tertiary, fontWeight: "300" }}>›</Text>
          </Pressable>
        ))}
      </Card>

      {/* Sign out */}
      <Pressable
        onPress={() => router.replace("/(auth)/login" as any)}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={{ ...Type.button, color: Brand.error }}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Surface.background,
    paddingHorizontal: Spacing.xl,
  },
  hero: {
    backgroundColor: Brand.primary,
    borderRadius: Radius["3xl"],
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    overflow: "hidden",
    ...Shadow.lg,
  },
  heroBlob: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Brand.primaryLight,
    opacity: 0.25,
    top: -90,
    right: -60,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 36, fontWeight: "800", color: Brand.primary },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginTop: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Surface.card,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.lg,
    ...Shadow.sm,
  },
  statItem: { flex: 1, alignItems: "center" },
  statBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: Surface.divider },
  menuCard: {
    marginTop: Spacing.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.divider,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  signOut: {
    backgroundColor: Brand.errorSoft,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
});
