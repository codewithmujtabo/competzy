import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Brand, Radius, Spacing, Surface, Text as TextColor, Type } from "@/constants/theme";
import { Button } from "@/components/ui";
import * as usersService from "@/services/users.service";

/**
 * Field keys understood by the backend's profile-incomplete gate. Mirrors the
 * web ProfileCompletionDialog so a 409 from the same endpoint can be handled
 * identically on both surfaces.
 */
export type ProfileFieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "city"
  | "country"
  | "dateOfBirth"
  | "supervisorName"
  | "supervisorEmail"
  | "supervisorWhatsapp"
  | "supervisorPhone"
  | "schoolName"
  | "schoolEmail"
  | "schoolAddress"
  | "schoolWhatsapp"
  | "schoolPhone"
  | "parentName"
  | "parentWhatsapp"
  | "parentPhone"
  | "grade"
  | "nisn"
  | "npsn";

interface FieldDef {
  label: string;
  hint?: string;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words";
}

const FIELDS: Record<ProfileFieldKey, FieldDef> = {
  fullName:           { label: "Full name", placeholder: "Your full name", autoCapitalize: "words" },
  email:              { label: "Email", keyboardType: "email-address", autoCapitalize: "none", placeholder: "you@example.com" },
  phone:              { label: "WhatsApp / Phone", keyboardType: "phone-pad", placeholder: "08xxx or +628xxx" },
  city:               { label: "City", autoCapitalize: "words", placeholder: "Your city" },
  country:            { label: "Country", autoCapitalize: "words", placeholder: "e.g. Indonesia, Malaysia", hint: "Use the country name; we'll normalise it." },
  dateOfBirth:        { label: "Date of birth", placeholder: "YYYY-MM-DD", hint: "Format: 2014-05-01" },
  supervisorName:     { label: "Teacher / Supervisor name", autoCapitalize: "words" },
  supervisorEmail:    { label: "Teacher / Supervisor email", keyboardType: "email-address", autoCapitalize: "none" },
  supervisorWhatsapp: { label: "Teacher / Supervisor WhatsApp", keyboardType: "phone-pad" },
  supervisorPhone:    { label: "Teacher / Supervisor phone", keyboardType: "phone-pad" },
  schoolName:         { label: "School name", autoCapitalize: "words" },
  schoolEmail:        { label: "School email", keyboardType: "email-address", autoCapitalize: "none" },
  schoolAddress:      { label: "School address", autoCapitalize: "sentences" },
  schoolWhatsapp:     { label: "School WhatsApp", keyboardType: "phone-pad" },
  schoolPhone:        { label: "School phone", keyboardType: "phone-pad" },
  parentName:         { label: "Parent name", autoCapitalize: "words" },
  parentWhatsapp:     { label: "Parent WhatsApp", keyboardType: "phone-pad" },
  parentPhone:        { label: "Parent phone", keyboardType: "phone-pad" },
  grade:              { label: "Grade", keyboardType: "numeric", placeholder: "e.g. 9" },
  nisn:               { label: "NISN", keyboardType: "numeric" },
  npsn:               { label: "NPSN", keyboardType: "numeric" },
};

// Two-letter ISO country lookup for the common cases — keeps the dialog
// inputless while still saving a normalised code so analytics + the gate's
// validation pass. Anything not in the table is sent uppercase (max 2 chars)
// or rejected with a clear message.
const COUNTRY_ALIASES: Record<string, string> = {
  indonesia: "ID", id: "ID",
  malaysia: "MY", my: "MY",
  singapore: "SG", sg: "SG",
  philippines: "PH", ph: "PH",
  thailand: "TH", th: "TH",
  vietnam: "VN", vn: "VN",
  india: "IN", in: "IN",
  "united arab emirates": "AE", uae: "AE", ae: "AE",
  "united states": "US", usa: "US", us: "US",
  "united kingdom": "GB", uk: "GB", gb: "GB",
};

function normaliseCountry(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  if (COUNTRY_ALIASES[v]) return COUNTRY_ALIASES[v];
  if (/^[a-z]{2}$/.test(v)) return v.toUpperCase();
  return null;
}

interface Props {
  visible: boolean;
  /** Which fields the backend said are missing. */
  missingFields: ProfileFieldKey[];
  /** Friendly label — e.g. "Komodo — Online Round 1". */
  contextLabel?: string;
  onClose: () => void;
  /** Called after PUT /users/me succeeds — the parent retries the registration. */
  onCompleted: () => void;
}

/**
 * Mobile counterpart of the web ProfileCompletionDialog. Renders inputs for
 * each field the backend's 409 PROFILE_INCOMPLETE response named, PUTs the
 * filled values to /users/me, and signals the parent to retry the
 * registration. Pre-fills any values the student has already typed.
 */
export function ProfileCompletionModal({
  visible,
  missingFields,
  contextLabel,
  onClose,
  onCompleted,
}: Props) {
  const fields = useMemo(
    () => missingFields.filter((k): k is ProfileFieldKey => k in FIELDS),
    [missingFields],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setValues({});
    // Best-effort pre-fill — if the user has partial data we surface it so
    // they don't retype.
    (async () => {
      try {
        const me = await usersService.getProfile();
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const k of fields) {
          const raw = (me as Record<string, any>)[k];
          if (typeof raw === "string") {
            // DATE columns come back as ISO strings — slice to YYYY-MM-DD
            // for the date-of-birth input.
            if (k === "dateOfBirth" && raw.includes("T")) {
              next[k] = raw.slice(0, 10);
            } else {
              next[k] = raw;
            }
          }
        }
        setValues(next);
      } catch {
        /* pre-fill is best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [visible, fields]);

  const set = (k: ProfileFieldKey, v: string) =>
    setValues((cur) => ({ ...cur, [k]: v }));

  const canSave =
    !saving && fields.every((f) => (values[f] || "").trim().length > 0);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const k of fields) {
        const raw = (values[k] || "").trim();
        if (k === "country") {
          const iso = normaliseCountry(raw);
          if (!iso) {
            Alert.alert(
              "Country not recognised",
              "Type a country name (e.g. Indonesia) or its 2-letter code (e.g. ID).",
            );
            setSaving(false);
            return;
          }
          payload.country = iso;
        } else {
          payload[k] = raw;
        }
      }
      await usersService.updateProfile(payload as any);
      onCompleted();
    } catch (e: any) {
      Alert.alert(
        "Couldn't save your details",
        e?.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={Type.h2}>Complete your profile</Text>
              {contextLabel ? (
                <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
                  {contextLabel} needs a few more details before you can register and pay.
                </Text>
              ) : (
                <Text style={[Type.bodySm, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
                  This competition needs a few more details before you can register and pay.
                </Text>
              )}
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={20} color={TextColor.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.banner}>
              <Ionicons name="information-circle" size={16} color={Brand.primary} />
              <Text style={[Type.bodySm, { color: Brand.primary, flex: 1, marginLeft: Spacing.xs }]}>
                We&apos;ll save these to your profile so you only enter them once.
              </Text>
            </View>

            {fields.map((k) => {
              const def = FIELDS[k];
              return (
                <View key={k} style={styles.field}>
                  <Text style={[Type.label, { color: TextColor.primary, marginBottom: Spacing.xs }]}>
                    {def.label}
                  </Text>
                  <TextInput
                    value={values[k] ?? ""}
                    onChangeText={(t) => set(k, t)}
                    placeholder={def.placeholder ?? ""}
                    placeholderTextColor={TextColor.tertiary}
                    keyboardType={def.keyboardType ?? "default"}
                    autoCapitalize={def.autoCapitalize ?? "sentences"}
                    autoCorrect={false}
                    style={styles.input}
                  />
                  {def.hint ? (
                    <Text style={[Type.caption, { marginTop: Spacing.xs }]}>{def.hint}</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[Type.button, { color: Brand.primary }]}>Cancel</Text>
            </Pressable>
            <Button
              label={saving ? "Saving…" : "Save and continue"}
              onPress={handleSave}
              disabled={!canSave}
              loading={saving}
              fullWidth={false}
            />
            {saving && <ActivityIndicator color={Brand.primary} style={{ marginLeft: Spacing.sm }} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 5, 44, 0.55)",
    justifyContent: "flex-end",
  },
  // The sheet hugs its content (no `flex`) so a short 1-2 field form sits
  // compactly above the actions, while a longer form still works thanks to
  // the maxHeight + ScrollView combo.
  sheet: {
    maxHeight: "90%",
    backgroundColor: Surface.background,
    borderTopLeftRadius: Radius["2xl"],
    borderTopRightRadius: Radius["2xl"],
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Surface.cardAlt,
    marginLeft: Spacing.sm,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Brand.primarySoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  field: { marginBottom: Spacing.lg },
  input: {
    backgroundColor: Surface.card,
    borderWidth: 1,
    borderColor: Surface.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    color: TextColor.primary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Surface.divider,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
