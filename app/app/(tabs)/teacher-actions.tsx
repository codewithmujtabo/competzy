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
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getUpcomingDeadlines, type Deadline } from "@/services/teachers.service";

export default function TeacherActionsScreen() {
  const { data: upcomingDeadlines, isLoading: isLoadingDeadlines } = useQuery({
    queryKey: ["upcomingDeadlines"],
    queryFn: getUpcomingDeadlines,
  });
  const recentActivities: Deadline[] = [];

  const quickActions = [
    {
      id: "view-competitions",
      icon: "trophy.fill",
      title: "Competitions",
      subtitle: "See which competitions your students joined",
      color: "#4F46E5",
      onPress: () => router.push("/(tabs)/teacher-analytics"),
    },
    {
      id: "view-reports",
      icon: "chart.bar.fill",
      title: "View Reports",
      subtitle: "Detailed performance overview",
      color: "#8B5CF6",
      onPress: () => router.push("/(tabs)/teacher-analytics"),
    },
    {
      id: "upcoming-deadlines",
      icon: "calendar.badge.clock",
      title: "Deadlines",
      subtitle: "Competitions closing soon",
      color: "#F59E0B",
      onPress: () => router.push("/(tabs)/teacher-dashboard"),
    },
    {
      id: "manage-students",
      icon: "person.3.fill",
      title: "My Students",
      subtitle: "View and manage your roster",
      color: "#10B981",
      onPress: () => router.push("/(tabs)/teacher-students"),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quick Actions</Text>
          <Text style={styles.headerSubtitle}>
            Fast access to common tasks
          </Text>
        </View>

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
                <IconSymbol name="person.2.fill" size={16} color="#64748B" />
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
    padding: 16,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  backButtonText: {
    ...Type.label,
    color: Brand.primary,
  },
  header: { marginBottom: Spacing["2xl"] },
  headerTitle: { ...Type.displayMd, marginBottom: 4 },
  headerSubtitle: { ...Type.body, color: TextColor.secondary },
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
  webPortalBannerArrow: { fontSize: 22, color: Brand.primary, fontWeight: "700" },
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
  deadlineBadgeText: { fontSize: 12, fontWeight: "700" },
  deadlineFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  deadlineCount: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 6,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 2,
  },
  activityCompetition: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: "#94A3B8",
  },
  loader: {
    marginVertical: 40,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
  },
});
