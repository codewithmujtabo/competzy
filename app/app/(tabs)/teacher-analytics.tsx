import React, { useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Brand,
  CategoryAccent,
  CategoryBg,
  CategoryEmoji,
  FontFamily,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import { getMyCompetitions, type MyCompetition } from "@/services/teachers.service";

const STATUS_COLOR: Record<string, string> = {
  pending_approval: "#F59E0B",
  registered:       "#3B82F6",
  paid:             "#059669",
  approved:         "#059669",
  rejected:         "#EF4444",
  completed:        "#6366F1",
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending",
  registered:       "Payment Due",
  paid:             "Confirmed",
  approved:         "Confirmed",
  rejected:         "Rejected",
  completed:        "Completed",
};

function formatFee(fee: number) {
  return fee === 0 ? "Free" : `Rp ${fee.toLocaleString("id-ID")}`;
}

export default function TeacherCompetitionsScreen() {
  const { user } = useUser();
  const userRole = (user as any)?.role;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["teacherCompetitions"],
    queryFn: getMyCompetitions,
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

  const competitions = data?.competitions ?? [];

  const renderCompetition = ({ item }: { item: MyCompetition }) => {
    const accent = CategoryAccent[item.category ?? ""] ?? Brand.primary;
    const bg     = CategoryBg[item.category ?? ""] ?? Brand.primarySoft;
    const emoji  = CategoryEmoji[item.category ?? ""] ?? "🏆";

    return (
      <View style={[styles.card, { borderLeftColor: accent }]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: bg }]}>
            <Text style={styles.iconEmoji}>{emoji}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.compName}>{item.name}</Text>
            <Text style={styles.compFee}>{formatFee(item.fee)}</Text>
            {item.category ? <Text style={styles.compCategory}>{item.category}</Text> : null}
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{item.students.length}</Text>
            <Text style={styles.countLabel}>student{item.students.length !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        <View style={styles.studentList}>
          {item.students.map((s) => (
            <View key={s.id} style={styles.studentRow}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>{s.fullName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.studentRowInfo}>
                <Text style={styles.studentRowName}>{s.fullName}</Text>
                {s.registrationNumber ? (
                  <Text style={styles.studentRegNum}>{s.registrationNumber}</Text>
                ) : null}
              </View>
              <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[s.status] ?? "#94A3B8") + "20" }]}>
                <Text style={[styles.statusPillText, { color: STATUS_COLOR[s.status] ?? "#94A3B8" }]}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Competitions</Text>
        <Text style={styles.subtitle}>Competitions your students are registered for</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.primary} size="large" />
        </View>
      ) : competitions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🏅</Text>
          <Text style={styles.emptyTitle}>No registrations yet</Text>
          <Text style={styles.emptyBody}>
            Once your students register for competitions, they'll appear here grouped by competition.
          </Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(tabs)/teacher-students")}>
            <Text style={styles.addBtnText}>Manage My Students</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={competitions}
          keyExtractor={(item) => item.id}
          renderItem={renderCompetition}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={Brand.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { ...Type.displayMd },
  subtitle: { ...Type.body, color: TextColor.secondary, marginTop: 4, marginBottom: Spacing.sm },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing["3xl"] },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { ...Type.h2, textAlign: "center", marginBottom: Spacing.sm },
  emptyBody: { ...Type.body, color: TextColor.secondary, textAlign: "center", marginBottom: Spacing.xl },
  addBtn: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    ...Shadow.md,
  },
  addBtnText: { color: TextColor.inverse, fontFamily: FontFamily.bodyBold, fontSize: 14 },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["3xl"], paddingTop: Spacing.sm },
  card: {
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
    borderLeftWidth: 4,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.md },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  iconEmoji: { fontSize: 24 },
  cardMeta: { flex: 1 },
  compName: { ...Type.title, fontSize: 15 },
  compFee: { ...Type.bodySm, fontFamily: FontFamily.bodySemi, marginTop: 3 },
  compCategory: { ...Type.caption, marginTop: 3 },
  countBadge: {
    alignItems: "center",
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  countText: { fontSize: 22, fontFamily: FontFamily.displayExtra, color: Brand.primary },
  countLabel: { fontSize: 10, color: Brand.primary, fontFamily: FontFamily.bodySemi, marginTop: 2 },
  studentList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
    paddingTop: Spacing.md,
    gap: Spacing.sm + 2,
  },
  studentRow: { flexDirection: "row", alignItems: "center" },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm + 2,
  },
  studentAvatarText: { fontSize: 14, fontFamily: FontFamily.displayExtra, color: Brand.primary },
  studentRowInfo: { flex: 1 },
  studentRowName: { ...Type.title, fontSize: 14 },
  studentRegNum: { ...Type.caption, marginTop: 1 },
  statusPill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontFamily: FontFamily.bodyBold },
});
