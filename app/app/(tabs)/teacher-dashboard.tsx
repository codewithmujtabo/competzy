import { Card, Pill, SectionHeader } from "@/components/ui";
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
import { getDashboardSummary, getUpcomingDeadlines } from "@/services/teachers.service";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TeacherDashboardScreen() {
  const { user } = useUser();
  const userRole = (user as any)?.role;
  const firstName = (user as any)?.fullName?.split(" ")[0] ?? "Teacher";

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["teacherSummary"],
    queryFn: getDashboardSummary,
    enabled: userRole === "teacher",
  });

  const { data: deadlines, isLoading: loadingDeadlines } = useQuery({
    queryKey: ["teacherDeadlines"],
    queryFn: getUpcomingDeadlines,
    enabled: userRole === "teacher",
  });

  useEffect(() => {
    if (userRole && userRole !== "teacher") {
      if (userRole === "parent") router.replace("/(tabs)/children");
      else if (userRole === "school_admin") router.replace("/(tabs)/profile");
      else router.replace("/(tabs)/competitions");
    }
  }, [userRole]);

  if (userRole && userRole !== "teacher") return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={[Type.bodySm, { color: "rgba(255,255,255,0.85)" }]}>Teacher Dashboard 👨‍🏫</Text>
          <Text style={[Type.displayMd, { color: TextColor.inverse, marginTop: Spacing.xs }]}>
            Hello, {firstName}!
          </Text>
          <Text style={[Type.body, { color: "rgba(255,255,255,0.9)", marginTop: Spacing.sm }]}>
            Monitor your students and their competition activity.
          </Text>
        </View>

        {loadingSummary ? (
          <ActivityIndicator style={styles.loader} color={Brand.primary} />
        ) : (
          <View style={styles.statRow}>
            <Card variant="flat" style={styles.statCell}>
              <Text style={{ fontSize: 28 }}>👥</Text>
              <Text style={[Type.h1, { color: Brand.primary, marginTop: 4 }]}>
                {summary?.totalStudents ?? 0}
              </Text>
              <Text style={Type.caption}>Students</Text>
            </Card>
            <Card variant="flat" style={styles.statCell}>
              <Text style={{ fontSize: 28 }}>📋</Text>
              <Text style={[Type.h1, { color: Brand.secondary, marginTop: 4 }]}>
                {summary?.totalRegistrations ?? 0}
              </Text>
              <Text style={Type.caption}>Registrations</Text>
            </Card>
            <Card variant="flat" style={styles.statCell}>
              <Text style={{ fontSize: 28 }}>✅</Text>
              <Text style={[Type.h1, { color: Brand.success, marginTop: 4 }]}>
                {summary?.confirmedRegistrations ?? 0}
              </Text>
              <Text style={Type.caption}>Approved</Text>
            </Card>
          </View>
        )}

        <SectionHeader title="Quick Actions" marginTop={Spacing["2xl"]} />
        <View style={styles.actionRow}>
          <Card onPress={() => router.push("/(tabs)/teacher-students")} style={styles.actionTile}>
            <View style={styles.actionEmoji}>
              <Text style={{ fontSize: 28 }}>👥</Text>
            </View>
            <Text style={[Type.title, { marginTop: Spacing.md }]}>My Students</Text>
            <Text style={[Type.bodySm, { marginTop: 2 }]}>View & manage roster</Text>
          </Card>
          <Card onPress={() => router.push("/(tabs)/teacher-analytics")} style={styles.actionTile}>
            <View style={[styles.actionEmoji, { backgroundColor: Brand.successSoft }]}>
              <Text style={{ fontSize: 28 }}>🏆</Text>
            </View>
            <Text style={[Type.title, { marginTop: Spacing.md }]}>Competitions</Text>
            <Text style={[Type.bodySm, { marginTop: 2 }]}>Joined by students</Text>
          </Card>
        </View>

        <SectionHeader title="Upcoming Deadlines" subtitle="Next 30 days" />
        <View style={{ paddingHorizontal: Spacing.xl, gap: Spacing.md }}>
          {loadingDeadlines ? (
            <ActivityIndicator color={Brand.primary} />
          ) : deadlines && deadlines.length > 0 ? (
            deadlines.slice(0, 4).map((item) => (
              <Card key={item.id}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={Type.title} numberOfLines={1}>
                      {item.competition}
                    </Text>
                    <Text style={[Type.bodySm, { marginTop: 2 }]}>{item.deadline}</Text>
                  </View>
                  <Pill
                    label={`${item.daysLeft} days left`}
                    tone={item.status === "urgent" ? "danger" : "info"}
                    size="sm"
                  />
                </View>
              </Card>
            ))
          ) : (
            <Card variant="tinted" tint={Brand.successSoft}>
              <Text style={[Type.body, { color: Brand.success }]}>
                ✓ No deadlines in the next 30 days
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scroll: { paddingBottom: Spacing["3xl"] },
  hero: {
    backgroundColor: Brand.primary,
    borderRadius: Radius["3xl"],
    padding: Spacing["2xl"],
    margin: Spacing.xl,
    ...Shadow.lg,
  },
  loader: { marginVertical: Spacing["3xl"] },
  statRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: Spacing.lg },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  actionTile: { flex: 1, alignItems: "center", paddingVertical: Spacing.xl },
  actionEmoji: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
