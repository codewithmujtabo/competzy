import { AppInput } from "@/components/common/AppInput";
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
import * as userService from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  school: string;
  grade?: string;
  nisn?: string;
  photo_url?: string;
  city: string;
  role: string;
}

export default function ProfileCompletionScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nisn, setNisn] = useState("");
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await userService.getProfile();

      if (!data) return;

      setProfile({
        id: data.id,
        full_name: data.fullName || "",
        phone: data.phone || "",
        school: data.school || "",
        grade: data.grade,
        nisn: data.nisn,
        photo_url: data.photoUrl,
        city: data.city || "",
        role: data.role || "student",
      });
      setNisn(data.nisn || "");
      setCity(data.city || "");
    } catch (err) {
      console.error("Error fetching profile:", err);
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (nisn && nisn.length < 16) {
      e.nisn = "NISN must be 16 digits";
    }
    if (!city.trim()) {
      e.city = "City is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateForm() || !profile) return;

    setSaving(true);
    try {
      await userService.updateProfile({
        nisn: nisn || null,
        city: city.trim(),
      });

      Alert.alert("Success", "Profile updated!");
      setProfile({ ...profile, nisn, city });
    } catch (err) {
      Alert.alert("Error", "Failed to update profile");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing["2xl"] },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profilePhotoBox}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.profilePhoto} />
          ) : (
            <Text style={styles.profilePhotoPlaceholder}>
              {profile.full_name?.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Add more information so organizers can verify your identity.
        </Text>
      </View>

      {/* Current Info (Read-only) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Information</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{profile.full_name}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{profile.phone}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>School</Text>
          <Text style={styles.infoValue}>{profile.school}</Text>
        </View>

        {profile.grade && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Grade</Text>
            <Text style={styles.infoValue}>{profile.grade}</Text>
          </View>
        )}
      </View>

      {/* Editable Fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Information</Text>

        <AppInput
          label="NISN (National Student ID)"
          placeholder="e.g. 1234567890123456"
          value={nisn}
          onChangeText={setNisn}
          keyboardType="number-pad"
          error={errors.nisn}
          maxLength={16}
        />

        <AppInput
          label="City"
          placeholder="e.g. Jakarta"
          value={city}
          onChangeText={setCity}
          error={errors.city}
          autoCapitalize="words"
        />
      </View>

      {/* Note */}
      <View style={styles.noteBox}>
        <Ionicons name="information-circle" size={18} color={Brand.primary} />
        <Text style={styles.noteText}>
          This information helps organizers verify your eligibility for competitions. You can update it anytime from your profile.
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
        onPress={handleSaveProfile}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Surface.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  centered: { justifyContent: "center", alignItems: "center" },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  profilePhotoBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Brand.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
  },
  profilePhotoPlaceholder: {
    fontSize: 32,
    fontFamily: FontFamily.displayExtra,
    color: Brand.primary,
  },
  title: {
    ...Type.displayMd,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    ...Type.body,
    color: TextColor.secondary,
    textAlign: "center",
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    ...Type.label,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  infoBox: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Surface.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Surface.border,
    marginBottom: Spacing.md,
  },
  infoLabel: {
    ...Type.caption,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    ...Type.title,
  },
  noteBox: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.lg,
    marginBottom: Spacing["2xl"],
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  noteText: {
    ...Type.caption,
    color: Brand.primary,
    lineHeight: 17,
    flex: 1,
  },
  primaryButton: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primary,
    alignItems: "center",
    ...Shadow.playful,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...Type.button,
  },
  errorText: {
    ...Type.body,
    color: Brand.error,
    textAlign: "center",
  },
});
