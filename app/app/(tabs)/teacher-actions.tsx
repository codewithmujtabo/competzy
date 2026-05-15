import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScreenHeader } from "@/components/ui";
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
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getUpcomingDeadlines } from "@/services/teachers.service";

export default function TeacherActionsScreen() {
  const { data: upcomingDeadlines, isLoading: isLoadingDeadlines } = useQuery({
    queryKey: ["upcomingDeadlines"],
    queryFn: getUpcomingDeadlines,
  });

  const quickActions = [
    {
      id: "view-competitions",
      icon: "trophy.fill",
      title: "Competitions",
      subtitle: "See which competitions your students joined",
      color: Brand.primary,
      onPress: () => router.push("/(tabs)/teacher-analytics"),
    },
    {
      id: "view-reports",
      icon: "chart.bar.fill",
      title: "View Reports",
      subtitle: "Detailed performance overview",
      color: Brand.sky,
      onPress: () => router.push("/(tabs)/teacher-analytics"),
    },
    {
      id: "upcoming-deadlines",
      icon: "calendar.badge.clock",
      title: "Deadlines",
      subtitle: "Competitions closing soon",
      color: Brand.coral,
      onPress: () => router.push("/(tabs)/teacher-dashboard"),
    },
    {
      id: "manage-students",
      icon: "person.3.fill",
      title: "My Students",
      subtitle: "View and manage your roster",
      color: Brand.success,
      onPress: () => router.push("/(tabs)/teacher-students"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Quick Actions" subtitle="Fast access to common tasks" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Web portal banner */}
        <TouchableOpacity
          style={styles.webPortalBanner}
          onPress={() => Linking.openURL("https://competzy.id/teacher")}
          activeOpacity={0.8}
        >
          <View style={styles.webPortalBannerContent}>
            <Text style={styles.webPortalBannerTitle}>Advanced reports on the web portal</Text>
            <Text style={styles.webPortalBannerBody}>
              Full analytics and detailed reports are available at competzy.id/teacher
            </Text>
          </View>
          <Text style={styles.webPortalBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* Quick Actions Grid */}
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={action.onPress}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}
              >
                <IconSymbol
                  name={action.icon as any}
                  size={28}
                  color={action.color}
                />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Deadlines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Deadlines</Text>
          <Text style={styles.sectionSubtitle}>
            Competitions closing soon
          </Text>

          {isLoadingDeadlines ? (
            <ActivityIndicator style={styles.loader} color={Brand.primary} />
          ) : upcomingDeadlines && upcomingDeadlines.length > 0 ? (
            upcomingDeadlines.map((item) => (
              <View key={item.id} style={styles.deadlineCard}>
              <View style={styles.deadlineHeader}>
                <View style={styles.deadlineInfo}>
                  <Text style={styles.deadlineName}>{item.competition}</Text>
                  <Text style={styles.deadlineDate}>{item.deadline}</Text>
                </View>
                <View
                  style={[
                    styles.deadlineBadge,
                    {
                      backgroundColor:
                        item.status === "urgent" ? "#FEE2E2" : "#DBEAFE",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deadlineBadgeText,
                      {
                        color: item.status === "urgent" ? "#EF4444" : "#3B82F6",
                      },
                    ]}
                  >
                    {item.daysLeft}d left
                  </Text>
                </View>
              </View>

              <View style={styles.deadlineFooter}>
                <IconSymbol name="person.2.fill" size={16} color={TextColor.tertiary} />
                <Text style={styles.deadlineCount}>
                  {item.registeredCount} students registered
                </Text>
              </View>
            </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No upcoming deadlines</Text>
            </View>
          )}
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <Text style={styles.sectionSubtitle}>
            Your recent actions and updates
          </Text>

          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Activity feed coming soon</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Surface.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["4xl"],
  },
  webPortalBanner: {
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Brand.primaryLight,
  },
  webPortalBannerContent: { flex: 1, marginRight: Spacing.sm },
  webPortalBannerTitle: { ...Type.title, color: Brand.primary, fontSize: 14 },
  webPortalBannerBody: { ...Type.bodySm, color: Brand.primary, marginTop: 4 },
  webPortalBannerArrow: { fontSize: 22, color: Brand.primary, fontFamily: FontFamily.bodyBold },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing["3xl"],
  },
  actionCard: {
    width: "48%",
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadow.md,
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  actionTitle: { ...Type.title, fontSize: 15, textAlign: "center", marginBottom: 4 },
  actionSubtitle: { ...Type.caption, textAlign: "center" },
  section: { marginBottom: Spacing["3xl"] },
  sectionTitle: { ...Type.h3, marginBottom: 4 },
  sectionSubtitle: { ...Type.bodySm, marginBottom: Spacing.lg },
  deadlineCard: {
    backgroundColor: Surface.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  deadlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  deadlineInfo: { flex: 1 },
  deadlineName: { ...Type.title, fontSize: 15 },
  deadlineDate: { ...Type.bodySm, marginTop: 2 },
  deadlineBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  deadlineBadgeText: { fontSize: 12, fontFamily: FontFamily.bodyBold },
  deadlineFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Surface.divider,
  },
  deadlineCount: {
    fontSize: 13,
    color: TextColor.secondary,
    marginLeft: 6,
  },
  loader: {
    marginVertical: Spacing["4xl"],
  },
  emptyState: {
    paddingVertical: Spacing["4xl"],
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: TextColor.tertiary,
    fontFamily: FontFamily.bodyMedium,
  },
});
