import { Card, GeometricHeader, StatTile } from "@/components/ui";
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
import { Ionicons } from "@expo/vector-icons";
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

const ROLE_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  student:      "school-outline",
  parent:       "people-outline",
  teacher:      "book-outline",
  school_admin: "business-outline",
};

type MenuItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tint: string;
  onPress: () => void;
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
  const completed  = role === "student" ? registrations.filter((r) => r.status === "completed").length : 0;
  const active     = role === "student" ? registrations.filter((r) => r.status === "paid").length : 0;

  const menuItems: MenuItem[] = [
    { icon: "person-circle-outline", label: "Edit Profile",         tint: Brand.primarySoft, onPress: () => router.push("/(tabs)/profile/edit") },
    ...(role === "student"
      ? [
          { icon: "document-attach-outline" as const, label: "Document Vault",       tint: Brand.skySoft,    onPress: () => router.push("/(tabs)/profile/document-vault") },
          { icon: "trophy-outline"          as const, label: "Competition History",  tint: Brand.sunshineSoft, onPress: () => router.push("/(tabs)/profile/history") },
          { icon: "people-outline"          as const, label: "Link Parent Account",  tint: Brand.mintSoft,   onPress: () => router.push("/(tabs)/profile/link-parent") },
        ]
      : []),
    ...(role === "school_admin"
      ? [
          { icon: "bar-chart-outline" as const, label: "School Dashboard",   tint: Brand.skySoft,    onPress: () => router.push("/school-dashboard") },
          { icon: "cloud-upload-outline" as const, label: "Bulk Registration", tint: Brand.coralSoft, onPress: () => router.push("/bulk-registration") },
        ]
      : []),
    { icon: "notifications-outline", label: "Notifications",    tint: Brand.coralSoft,  onPress: () => router.push("/(tabs)/notifications") },
    { icon: "settings-outline",      label: "Account Settings", tint: Surface.cardAlt,  onPress: () => {} },
    { icon: "help-circle-outline",   label: "Help & FAQ",       tint: Surface.cardAlt,  onPress: () => {} },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Spacing["4xl"] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Geometric hero header */}
      <GeometricHeader height={260 + insets.top} palette="purple">
        <View style={[styles.heroContent, { paddingTop: insets.top + Spacing["2xl"] }]}>
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
            <Ionicons name={ROLE_ICON[role] ?? "person-outline"} size={14} color="#FFFFFF" />
            <Text style={{ ...Type.label, color: "#FFFFFF", fontSize: 13, marginLeft: 6 }}>
              {ROLE_LABEL[role] ?? role}
            </Text>
          </View>
          {kid ? (
            <Text style={[Type.caption, { color: "rgba(255,255,255,0.9)", marginTop: Spacing.sm, fontVariant: ["tabular-nums"] }]}>
              ID: {kid}
            </Text>
          ) : null}
          {((user as any)?.city || (user as any)?.school) ? (
            <Text style={[Type.bodySm, { color: "rgba(255,255,255,0.9)", marginTop: Spacing.xs, textAlign: "center" }]}>
              {[(user as any)?.school, (user as any)?.city].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
        </View>
      </GeometricHeader>

      <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.lg }}>
        {/* Stats — students only, playful tiles */}
        {role === "student" ? (
          <View style={styles.statsRow}>
            <StatTile
              label="Total"
              value={totalComps}
              tint={Brand.primarySoft}
              accent={Brand.navy}
              icon={<Ionicons name="trophy" size={20} color={Brand.primary} />}
              style={{ flex: 1 }}
            />
            <StatTile
              label="Active"
              value={active}
              tint={Brand.sunshineSoft}
              accent={Brand.navy}
              icon={<Ionicons name="flash" size={20} color={Brand.warning} />}
              style={{ flex: 1 }}
            />
            <StatTile
              label="Done"
              value={completed}
              tint={Brand.mintSoft}
              accent={Brand.navy}
              icon={<Ionicons name="checkmark-circle" size={20} color={Brand.success} />}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        {/* Menu */}
        <Card variant="playful" padding={0} style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              android_ripple={{ color: `${Brand.primary}10` }}
              style={({ pressed }) => [
                styles.menuItem,
                i < menuItems.length - 1 && styles.menuItemBorder,
                pressed && { backgroundColor: Brand.primarySoft },
              ]}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.tint }]}>
                <Ionicons name={item.icon} size={20} color={Brand.navy} />
              </View>
              <Text style={[Type.body, { flex: 1, fontWeight: "700", color: TextColor.primary }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={TextColor.tertiary} />
            </Pressable>
          ))}
        </Card>

        {/* Sign out */}
        <Pressable
          onPress={() => router.replace("/(auth)/login" as any)}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={18} color={Brand.error} style={{ marginRight: 8 }} />
          <Text style={{ ...Type.button, color: Brand.error }}>Sign Out</Text>
        </Pressable>

        <Text style={[Type.caption, { textAlign: "center", marginTop: Spacing["2xl"], color: TextColor.tertiary }]}>
          Keep Learning ✨
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Surface.background,
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    ...Shadow.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 40, fontWeight: "900", color: Brand.primary },
  avatarImage:   { width: 96, height: 96, borderRadius: 48 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginTop: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
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
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  signOut: {
    flexDirection: "row",
    backgroundColor: Brand.errorSoft,
    borderRadius: Radius["2xl"],
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
});
