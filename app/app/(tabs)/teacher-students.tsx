import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { router } from "expo-router";
import { useUser } from "@/context/AuthContext";
import { getMyStudents, linkStudent, unlinkStudent, type Student } from "@/services/teachers.service";

export default function TeacherStudentsScreen() {
  const { user } = useUser();
  const userRole = (user as any)?.role;
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [addEmail, setAddEmail]       = useState("");
  const [adding, setAdding]           = useState(false);
  const [removingId, setRemovingId]   = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [showAddRow, setShowAddRow]   = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["teacherStudents", searchQuery],
    queryFn: () => getMyStudents(searchQuery),
    enabled: userRole === "teacher",
  });

  const students = data?.students ?? [];
  const stats    = data?.stats ?? { totalStudents: 0, totalRegistrations: 0, activeStudents: 0 };

  useEffect(() => {
    if (userRole && userRole !== "teacher") {
      if (userRole === "parent") router.replace("/(tabs)/children");
      else if (userRole === "school_admin") router.replace("/(tabs)/profile");
      else router.replace("/(tabs)/competitions");
    }
  }, [userRole]);

  if (userRole && userRole !== "teacher") return null;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    try {
      const res = await linkStudent(email);
      setAddEmail("");
      setShowAddRow(false);
      await queryClient.invalidateQueries({ queryKey: ["teacherStudents"] });
      await queryClient.invalidateQueries({ queryKey: ["teacherSummary"] });
      Alert.alert("Added", `${res.fullName} has been added to your roster.`);
    } catch (err: any) {
      Alert.alert("Failed", err?.message ?? "Could not add student");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (student: Student) => {
    Alert.alert(
      "Remove Student",
      `Remove ${student.fullName} from your roster? This won't affect their account or registrations.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setRemovingId(student.id);
            try {
              await unlinkStudent(student.id);
              await queryClient.invalidateQueries({ queryKey: ["teacherStudents"] });
              await queryClient.invalidateQueries({ queryKey: ["teacherSummary"] });
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to remove student");
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.fullName}</Text>
        <Text style={styles.studentEmail}>{item.email}</Text>
        <View style={styles.studentMeta}>
          {item.grade ? <Text style={styles.metaTag}>Grade {item.grade}</Text> : null}
          {item.school ? <Text style={styles.metaTag} numberOfLines={1}>{item.school}</Text> : null}
        </View>
        <Text style={styles.regCount}>
          {item.registrationCount} competition{item.registrationCount !== 1 ? "s" : ""} registered
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(item)}
        disabled={removingId === item.id}
      >
        {removingId === item.id
          ? <ActivityIndicator size="small" color={Brand.error} />
          : <Text style={styles.removeBtnText}>×</Text>
        }
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Students</Text>
          <Text style={styles.subtitle}>
            {stats.totalStudents} student{stats.totalStudents !== 1 ? "s" : ""} · {stats.totalRegistrations} registration{stats.totalRegistrations !== 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, showAddRow && styles.addButtonActive]}
          onPress={() => setShowAddRow(v => !v)}
        >
          <Text style={styles.addButtonText}>{showAddRow ? "Cancel" : "+ Add"}</Text>
        </TouchableOpacity>
      </View>

      {/* Add student row */}
      {showAddRow && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Student email address"
            placeholderTextColor={TextColor.tertiary}
            value={addEmail}
            onChangeText={setAddEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addConfirmBtn, adding && styles.addConfirmBtnDisabled]}
            onPress={handleAdd}
            disabled={adding || !addEmail.trim()}
          >
            {adding
              ? <ActivityIndicator size="small" color={TextColor.inverse} />
              : <Text style={styles.addConfirmBtnText}>Add</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email…"
          placeholderTextColor={TextColor.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : students.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No students match your search" : "No students yet"}
          </Text>
          <Text style={styles.emptyBody}>
            {searchQuery
              ? "Try a different name or email"
              : 'Tap "+ Add" to add a student by their email address.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { ...Type.displayMd },
  subtitle: { ...Type.bodySm, marginTop: 4 },
  addButton: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    ...Shadow.sm,
  },
  addButtonActive: { backgroundColor: TextColor.secondary },
  addButtonText: { color: TextColor.inverse, fontFamily: FontFamily.bodyBold, fontSize: 13 },
  addRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  addInput: {
    flex: 1,
    backgroundColor: Surface.card,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 14,
    color: TextColor.primary,
  },
  addConfirmBtn: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
  },
  addConfirmBtnDisabled: { opacity: 0.5 },
  addConfirmBtnText: { color: TextColor.inverse, fontFamily: FontFamily.bodyBold, fontSize: 14 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: Surface.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Surface.border,
    paddingHorizontal: Spacing.md,
    ...Shadow.sm,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 14, color: TextColor.primary },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 14, color: TextColor.tertiary },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing["3xl"] },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { ...Type.h2, textAlign: "center", marginBottom: Spacing.sm },
  emptyBody: { ...Type.body, color: TextColor.secondary, textAlign: "center" },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["2xl"] },
  studentCard: {
    flexDirection: "row",
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "flex-start",
    ...Shadow.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  avatarText: { fontSize: 18, fontFamily: FontFamily.displayExtra, color: Brand.primary },
  studentInfo: { flex: 1 },
  studentName: { ...Type.title, fontSize: 15 },
  studentEmail: { ...Type.caption, marginTop: 2 },
  studentMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  metaTag: {
    fontSize: 11,
    color: Brand.primary,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: FontFamily.bodySemi,
  },
  regCount: { marginTop: 6, ...Type.caption },
  removeBtn: { padding: Spacing.sm },
  removeBtnText: { fontSize: 24, color: TextColor.tertiary, fontFamily: FontFamily.bodyRegular },
});
