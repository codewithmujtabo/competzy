import { AppInput } from "@/components/common/AppInput";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { INTEREST_CATEGORIES } from "@/constants/interests";
import { useUser } from "@/context/AuthContext";
import * as usersService from "@/services/users.service";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatDateForDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

function formatDateForBackend(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("/")) {
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { user, fetchUser } = useUser();
  const role = (user as any)?.role ?? "student";

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Common fields (all roles)
  const [fullName, setFullName] = useState((user as any)?.fullName || (user as any)?.name || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [email] = useState((user as any)?.email || "");
  const [city, setCity] = useState((user as any)?.city || "");
  const [photoUrl, setPhotoUrl] = useState((user as any)?.photoUrl || (user as any)?.avatarUrl || null);

  // Student-only fields
  const [dateOfBirth, setDateOfBirth] = useState(formatDateForDisplay((user as any)?.dateOfBirth) || "");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [otherInterest, setOtherInterest] = useState("");
  const [referralSource, setReferralSource] = useState((user as any)?.referralSource || "");
  const [studentCardUrl, setStudentCardUrl] = useState((user as any)?.studentCardUrl || null);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [schoolName, setSchoolName] = useState((user as any)?.schoolName || "");
  const [grade, setGrade] = useState((user as any)?.level || "");
  const [npsn, setNpsn] = useState((user as any)?.npsn || "");
  const [schoolAddress, setSchoolAddress] = useState((user as any)?.schoolAddress || "");
  const [schoolEmail, setSchoolEmail] = useState((user as any)?.schoolEmail || "");
  const [schoolWhatsapp, setSchoolWhatsapp] = useState((user as any)?.schoolWhatsapp || "");
  const [schoolPhone, setSchoolPhone] = useState((user as any)?.schoolPhone || "");
  const [supervisorName, setSupervisorName] = useState((user as any)?.supervisorName || "");
  const [supervisorEmail, setSupervisorEmail] = useState((user as any)?.supervisorEmail || "");
  const [supervisorWhatsapp, setSupervisorWhatsapp] = useState((user as any)?.supervisorWhatsapp || "");
  const [supervisorPhone, setSupervisorPhone] = useState((user as any)?.supervisorPhone || "");
  const [parentName, setParentName] = useState((user as any)?.parentName || "");
  const [parentOccupation, setParentOccupation] = useState((user as any)?.parentOccupation || "");
  const [parentWhatsapp, setParentWhatsapp] = useState((user as any)?.parentWhatsapp || "");
  const [parentPhone, setParentPhone] = useState((user as any)?.parentPhone || "");

  // Teacher-only fields
  const [teacherSchool, setTeacherSchool] = useState((user as any)?.school || "");
  const [subject, setSubject] = useState((user as any)?.subject || "");
  const [department, setDepartment] = useState((user as any)?.department || "");

  useEffect(() => {
    if (!user) return;
    const u = user as any;
    setFullName(u.fullName || u.name || "");
    setPhone(u.phone || "");
    setCity(u.city || "");
    setPhotoUrl(u.photoUrl || u.avatarUrl || null);

    if (role === "student") {
      setDateOfBirth(formatDateForDisplay(u.dateOfBirth) || "");
      setReferralSource(u.referralSource || "");
      setStudentCardUrl(u.studentCardUrl || null);
      setSchoolName(u.schoolName || "");
      setGrade(u.level || "");
      setNpsn(u.npsn || "");
      setSchoolAddress(u.schoolAddress || "");
      setSchoolEmail(u.schoolEmail || "");
      setSchoolWhatsapp(u.schoolWhatsapp || "");
      setSchoolPhone(u.schoolPhone || "");
      setSupervisorName(u.supervisorName || "");
      setSupervisorEmail(u.supervisorEmail || "");
      setSupervisorWhatsapp(u.supervisorWhatsapp || "");
      setSupervisorPhone(u.supervisorPhone || "");
      setParentName(u.parentName || "");
      setParentOccupation(u.parentOccupation || "");
      setParentWhatsapp(u.parentWhatsapp || "");
      setParentPhone(u.parentPhone || "");

      if (u.interests) {
        const parsed = u.interests.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
        const matched: string[] = [];
        const unmatched: string[] = [];
        for (const i of parsed) {
          if (INTEREST_CATEGORIES.includes(i as any)) matched.push(i);
          else unmatched.push(i);
        }
        setSelectedInterests(matched);
        setOtherInterest(unmatched.join(", "));
      }
    } else if (role === "teacher") {
      setTeacherSchool(u.school || "");
      setSubject(u.subject || "");
      setDepartment(u.department || "");
    }
  }, [user]);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as const,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingPhoto(true);
      try {
        const { photoUrl: newUrl } = await usersService.uploadPhoto(result.assets[0].uri);
        setPhotoUrl(newUrl);
        Alert.alert("Success", "Profile photo updated");
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to upload photo");
      } finally {
        setUploadingPhoto(false);
      }
    }
  }

  async function handlePickStudentCard() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as const,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingCard(true);
      try {
        const { studentCardUrl: newUrl } = await usersService.uploadStudentCard(result.assets[0].uri);
        setStudentCardUrl(newUrl);
        Alert.alert("Success", "Student card uploaded");
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to upload student card");
      } finally {
        setUploadingCard(false);
      }
    }
  }

  async function handleSave() {
    if (!fullName.trim()) {
      Alert.alert("Error", "Full name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = { fullName, phone, city };

      if (role === "student") {
        const allInterests = [...selectedInterests];
        if (otherInterest.trim()) allInterests.push(otherInterest.trim());
        Object.assign(payload, {
          dateOfBirth: dateOfBirth ? formatDateForBackend(dateOfBirth) : undefined,
          interests: allInterests.join(", ") || undefined,
          referralSource: referralSource || undefined,
          schoolName: schoolName || undefined,
          grade: grade || undefined,
          npsn: npsn || undefined,
          schoolAddress: schoolAddress || undefined,
          schoolEmail: schoolEmail || undefined,
          schoolWhatsapp: schoolWhatsapp || undefined,
          schoolPhone: schoolPhone || undefined,
          supervisorName: supervisorName || undefined,
          supervisorEmail: supervisorEmail || undefined,
          supervisorWhatsapp: supervisorWhatsapp || undefined,
          supervisorPhone: supervisorPhone || undefined,
          parentName: parentName || undefined,
          parentOccupation: parentOccupation || undefined,
          parentWhatsapp: parentWhatsapp || undefined,
          parentPhone: parentPhone || undefined,
        });
      } else if (role === "teacher") {
        Object.assign(payload, {
          school: teacherSchool || undefined,
          subject: subject || undefined,
          department: department || undefined,
        });
      }

      await usersService.updateProfile(payload);
      await fetchUser((user as any)?.id);
      Alert.alert("Success", "Profile updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const initial = fullName.charAt(0).toUpperCase() || "?";
  const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace("/api", "") || "";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            style={styles.photoWrapper}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
          >
            {photoUrl ? (
              <Image source={{ uri: `${API_BASE}${photoUrl}` }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoInitial}>{initial}</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.photoLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {/* ── STUDENT FORM ── */}
        {role === "student" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Details</Text>
              <AppInput label="Full Name" placeholder="Enter your full name" value={fullName} onChangeText={setFullName} />
              <AppInput label="Date of Birth" placeholder="DD/MM/YYYY" value={dateOfBirth} onChangeText={setDateOfBirth} keyboardType="numbers-and-punctuation" />
              <AppInput label="WhatsApp / Phone" placeholder="08xxx or +628xxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <AppInput label="Email" placeholder="email@example.com" value={email} editable={false} />
              <AppInput label="City" placeholder="Your city" value={city} onChangeText={setCity} />
              <View>
                <Text style={styles.inputLabel}>Interests</Text>
                <View style={styles.interestChips}>
                  {INTEREST_CATEGORIES.map((category) => {
                    const isSelected = selectedInterests.includes(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                        onPress={() => {
                          if (isSelected) setSelectedInterests(selectedInterests.filter((i) => i !== category));
                          else setSelectedInterests([...selectedInterests, category]);
                        }}
                      >
                        <Text style={[styles.interestChipText, isSelected && styles.interestChipTextSelected]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <AppInput label="Other Interests (optional)" placeholder="e.g., Robotics, Gaming" value={otherInterest} onChangeText={setOtherInterest} />
              </View>
              <AppInput label="How did you hear about us?" placeholder="e.g., Social media, friend..." value={referralSource} onChangeText={setReferralSource} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Student Card</Text>
              {studentCardUrl && (
                <View style={styles.cardPreview}>
                  <Image source={{ uri: `${API_BASE}${studentCardUrl}` }} style={styles.cardImage} resizeMode="contain" />
                </View>
              )}
              <TouchableOpacity
                style={[styles.uploadBtn, uploadingCard && styles.uploadBtnDisabled]}
                onPress={handlePickStudentCard}
                disabled={uploadingCard}
              >
                {uploadingCard ? (
                  <ActivityIndicator color={Brand.primary} size="small" />
                ) : (
                  <Text style={styles.uploadBtnText}>{studentCardUrl ? "Change Student Card" : "Upload Student Card"}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>School Details</Text>
              <AppInput label="School Name" placeholder="Enter school name" value={schoolName} onChangeText={setSchoolName} />
              <AppInput label="Grade" placeholder="e.g., 10, 11, 12" value={grade} onChangeText={setGrade} />
              <AppInput label="NPSN" placeholder="National School Number" value={npsn} onChangeText={setNpsn} keyboardType="number-pad" />
              <AppInput label="School Address" placeholder="School address" value={schoolAddress} onChangeText={setSchoolAddress} />
              <AppInput label="School Email" placeholder="School email" value={schoolEmail} onChangeText={setSchoolEmail} keyboardType="email-address" />
              <AppInput label="School WhatsApp" placeholder="School WhatsApp" value={schoolWhatsapp} onChangeText={setSchoolWhatsapp} keyboardType="phone-pad" />
              <AppInput label="School Phone" placeholder="School phone" value={schoolPhone} onChangeText={setSchoolPhone} keyboardType="phone-pad" />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Supervisor / Teacher</Text>
              <AppInput label="Name" placeholder="Supervisor name" value={supervisorName} onChangeText={setSupervisorName} />
              <AppInput label="Email" placeholder="Supervisor email" value={supervisorEmail} onChangeText={setSupervisorEmail} keyboardType="email-address" />
              <AppInput label="WhatsApp" placeholder="Supervisor WhatsApp" value={supervisorWhatsapp} onChangeText={setSupervisorWhatsapp} keyboardType="phone-pad" />
              <AppInput label="Phone" placeholder="Supervisor phone" value={supervisorPhone} onChangeText={setSupervisorPhone} keyboardType="phone-pad" />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Parent / Guardian</Text>
              <AppInput label="Name" placeholder="Parent name" value={parentName} onChangeText={setParentName} />
              <AppInput label="Occupation" placeholder="Parent occupation" value={parentOccupation} onChangeText={setParentOccupation} />
              <AppInput label="WhatsApp" placeholder="Parent WhatsApp" value={parentWhatsapp} onChangeText={setParentWhatsapp} keyboardType="phone-pad" />
              <AppInput label="Phone" placeholder="Parent phone" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" />
            </View>
          </>
        )}

        {/* ── TEACHER FORM ── */}
        {role === "teacher" && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Details</Text>
              <AppInput label="Full Name" placeholder="Enter your full name" value={fullName} onChangeText={setFullName} />
              <AppInput label="WhatsApp / Phone" placeholder="08xxx or +628xxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <AppInput label="Email" placeholder="email@example.com" value={email} editable={false} />
              <AppInput label="City" placeholder="Your city" value={city} onChangeText={setCity} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Professional Info</Text>
              <AppInput label="School / Institution" placeholder="Where do you teach?" value={teacherSchool} onChangeText={setTeacherSchool} />
              <AppInput label="Subject" placeholder="e.g., Mathematics, Physics" value={subject} onChangeText={setSubject} />
              <AppInput label="Department" placeholder="e.g., Sciences, Languages" value={department} onChangeText={setDepartment} />
            </View>
          </>
        )}

        {/* ── PARENT FORM ── */}
        {role === "parent" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Details</Text>
            <AppInput label="Full Name" placeholder="Enter your full name" value={fullName} onChangeText={setFullName} />
            <AppInput label="WhatsApp / Phone" placeholder="08xxx or +628xxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <AppInput label="Email" placeholder="email@example.com" value={email} editable={false} />
            <AppInput label="City" placeholder="Your city" value={city} onChangeText={setCity} />
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["4xl"] },
  header: { marginBottom: Spacing["2xl"] },
  backBtn: { marginBottom: Spacing.md, alignSelf: "flex-start" },
  backBtnText: { ...Type.label, color: Brand.primary },
  title: { ...Type.displayMd },

  photoSection: { alignItems: "center", marginBottom: Spacing["3xl"] },
  photoWrapper: { position: "relative" },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: Surface.card,
    ...Shadow.md,
  },
  photoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Brand.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: Surface.card,
    ...Shadow.md,
  },
  photoInitial: { fontSize: 44, fontWeight: "800", color: Brand.primary },
  photoLoading: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 55,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoBadge: {
    position: "absolute",
    bottom: 0, right: 0,
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: Brand.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Surface.background,
    ...Shadow.sm,
  },
  photoBadgeText: { fontSize: 16 },
  photoHint: { ...Type.caption, marginTop: Spacing.md },

  section: {
    marginBottom: Spacing["2xl"],
    gap: Spacing.md,
    backgroundColor: Surface.card,
    borderRadius: Radius["2xl"],
    padding: Spacing.lg,
    ...Shadow.md,
  },
  sectionTitle: { ...Type.h3, marginBottom: Spacing.xs },

  inputLabel: { ...Type.label, marginBottom: Spacing.sm },
  interestChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  interestChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Surface.cardAlt,
    borderWidth: 1,
    borderColor: Surface.border,
  },
  interestChipSelected: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  interestChipText: { ...Type.label, color: TextColor.secondary, fontSize: 13 },
  interestChipTextSelected: { color: "#FFFFFF" },

  cardPreview: {
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardImage: { width: "100%", height: 200, borderRadius: Radius.md },

  uploadBtn: {
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { ...Type.label, color: Brand.primary, fontSize: 14 },

  saveBtn: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.md,
    ...Shadow.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...Type.button },
});
