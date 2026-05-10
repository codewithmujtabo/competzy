import { AppInput } from "@/components/common/AppInput";
import { AppAutocomplete } from "@/components/common/AppAutocomplete";
import { Button, Card, Pill } from "@/components/ui";
import * as authService from "@/services/auth.service";
import * as regionsService from "@/services/regions.service";
import * as schoolsService from "@/services/schools.service";
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
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ROLES = [
  { id: "student", label: "Student", emoji: "🎒", desc: "Discover and register for competitions matching your grade." },
  { id: "parent",  label: "Parent", emoji: "👨‍👧", desc: "Help your child find and join competitions." },
  { id: "teacher", label: "Teacher", emoji: "📖", desc: "Encourage students to join academic competitions." },
] as const;
type Role = (typeof ROLES)[number]["id"];

const SD = ["1","2","3","4","5","6"];
const SMP = ["7","8","9"];
const SMA = ["10","11","12"];
const ALL_GRADES = [...SD, ...SMP, ...SMA] as const;
type Grade = (typeof ALL_GRADES)[number];

function GradePicker({ value, onChange, error }: { value: Grade; onChange: (g: Grade) => void; error?: string }) {
  const Group = ({ title, grades }: { title: string; grades: string[] }) => (
    <View style={{ marginTop: Spacing.md }}>
      <Text style={Type.label}>{title}</Text>
      <View style={styles.gradeRow}>
        {grades.map((g) => {
          const active = value === g;
          return (
            <Pressable
              key={g}
              onPress={() => onChange(g as Grade)}
              style={({ pressed }) => [
                styles.gradeBtn,
                active && { backgroundColor: Brand.primary, borderColor: Brand.primary },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={{
                  ...Type.label,
                  color: active ? "#FFFFFF" : TextColor.secondary,
                  fontSize: 14,
                }}
              >
                {g}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  return (
    <View style={{ marginTop: Spacing.md }}>
      <Group title="SD (1–6)" grades={SD} />
      <Group title="SMP (7–9)" grades={SMP} />
      <Group title="SMA (10–12)" grades={SMA} />
      {error ? (
        <Text style={[Type.caption, { color: Brand.error, marginTop: Spacing.sm }]}>{error}</Text>
      ) : null}
    </View>
  );
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fetchUser } = useUser();

  const [step, setStep] = useState<"role" | "details" | "consent">("role");
  const [consentChecked, setConsentChecked] = useState(false);
  const [role, setRole] = useState<Role>("student");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [city, setCity] = useState("");
  const [regencyCode, setRegencyCode] = useState("");

  const [school, setSchool] = useState("");
  const [schoolNpsn, setSchoolNpsn] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [grade, setGrade] = useState<Grade>("7");
  const [childName, setChildName] = useState("");
  const [childSchool, setChildSchool] = useState("");
  const [childGrade, setChildGrade] = useState<Grade>("7");
  const [teacherSchool, setTeacherSchool] = useState("");
  const [subject, setSubject] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [provincesList, setProvincesList] = useState<regionsService.Province[]>([]);
  const [citiesList, setCitiesList] = useState<regionsService.Regency[]>([]);

  useEffect(() => {
    regionsService.getProvinces().then(setProvincesList).catch(() => {});
  }, []);

  useEffect(() => {
    if (!provinceCode) return setCitiesList([]);
    regionsService.getRegencies(provinceCode).then(setCitiesList).catch(() => {});
  }, [provinceCode]);

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    else if (name.trim().length < 3) e.name = "Name must be at least 3 characters";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Minimum 6 characters";
    if (!phone.trim()) e.phone = "Phone number is required";
    else if (phone.replace(/\D/g, "").length < 9) e.phone = "Enter a valid phone number";
    if (!province.trim()) e.province = "Province is required";
    if (!city.trim()) e.city = "City/Regency is required";
    if (role === "student") {
      if (!school.trim()) e.school = "School is required";
      if (!grade) e.grade = "Pick a grade";
    } else if (role === "parent") {
      if (!childName.trim()) e.childName = "Child name is required";
      if (!childSchool.trim()) e.childSchool = "Child school is required";
      if (!childGrade) e.childGrade = "Pick child grade";
    } else if (role === "teacher") {
      if (!teacherSchool.trim()) e.teacherSchool = "School is required";
      if (!subject.trim()) e.subject = "Subject is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!consentChecked) {
      Alert.alert("Consent required", "You must agree to the privacy policy.");
      return;
    }
    setLoading(true);
    try {
      let roleData: any = {};
      if (role === "student") roleData = { school: school.trim(), grade, npsn: schoolNpsn || null, schoolAddress: schoolAddress || null };
      else if (role === "parent") roleData = { childName: childName.trim(), childSchool: childSchool.trim(), childGrade };
      else if (role === "teacher") roleData = { school: teacherSchool.trim(), subject: subject.trim() };

      const { user } = await authService.signup({
        email: email.trim(),
        password: password.trim(),
        fullName: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        province: province.trim(),
        role,
        roleData,
        consentAccepted: true,
      });
      Alert.alert("Success", "Account created. Welcome to Competzy!");
      if (user?.id) await fetchUser(user.id);
      const r = user?.role || role;
      if (r === "admin") router.replace("/(tabs)/web-portal-redirect");
      else if (r === "teacher") router.replace("/(tabs)/teacher-dashboard");
      else if (r === "parent") router.replace("/(tabs)/children");
      else if (r === "school_admin") router.replace("/(tabs)/profile");
      else router.replace("/(tabs)/competitions");
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("already")) Alert.alert("Account exists", "This email is already registered. Please sign in.");
      else if (msg.includes("rate limit")) Alert.alert("Too fast", "Wait 2 minutes and try again.");
      else Alert.alert("Error", err?.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 1: Role ────────────────────────────────────────────────────────
  if (step === "role") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start", marginBottom: Spacing.lg }}>
            <Text style={[Type.label, { color: Brand.primary }]}>← Back to Login</Text>
          </Pressable>

          <View style={{ alignItems: "center", marginBottom: Spacing["2xl"] }}>
            <View style={styles.logoTile}>
              <Text style={{ fontSize: 32 }}>👋</Text>
            </View>
            <Text style={[Type.displayMd, { marginTop: Spacing.lg }]}>Hello! Who are you?</Text>
            <Text style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm }]}>
              Choose your role so we can tailor your experience.
            </Text>
          </View>

          <View style={{ gap: Spacing.md }}>
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <Card
                  key={r.id}
                  onPress={() => setRole(r.id)}
                  style={
                    active
                      ? { borderWidth: 2, borderColor: Brand.primary, backgroundColor: Brand.primarySoft }
                      : { borderWidth: 2, borderColor: "transparent" }
                  }
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.roleEmojiTile, { backgroundColor: active ? "#FFFFFF" : Brand.primarySoft }]}>
                      <Text style={{ fontSize: 28 }}>{r.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={[Type.title, { color: active ? Brand.primary : TextColor.primary }]}>
                        {r.label}
                      </Text>
                      <Text style={[Type.bodySm, { marginTop: 2 }]} numberOfLines={2}>
                        {r.desc}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        active && { borderColor: Brand.primary },
                      ]}
                    >
                      {active ? <View style={styles.radioInner} /> : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button label="Continue" onPress={() => setStep("details")} fullWidth size="lg" />
        </View>
      </View>
    );
  }

  // ─── Step 3: Consent ─────────────────────────────────────────────────────
  if (step === "consent") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}>
          <View style={{ alignItems: "center", marginBottom: Spacing.xl }}>
            <View style={styles.logoTile}>
              <Text style={{ fontSize: 32 }}>🔐</Text>
            </View>
            <Text style={[Type.displayMd, { marginTop: Spacing.lg, textAlign: "center" }]}>
              Privacy Policy
            </Text>
            <Text style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.sm, textAlign: "center" }]}>
              Before creating an account, please read and agree to the terms below.
            </Text>
          </View>

          <Card>
            <Text style={Type.label}>DATA WE COLLECT</Text>
            <Text style={[Type.body, { marginTop: Spacing.sm }]}>
              • Profile & identity (name, email, phone, city){"\n"}
              • Education data (school, grade, scores){"\n"}
              • Documents you upload (report cards, certificates, photos){"\n"}
              • App usage activity
            </Text>

            <Text style={[Type.label, { marginTop: Spacing.lg }]}>HOW DATA IS USED</Text>
            <Text style={[Type.body, { marginTop: Spacing.sm }]}>
              • Display relevant competitions{"\n"}
              • Process registrations & payments{"\n"}
              • Send important notifications{"\n"}
              • Improve Competzy service quality
            </Text>

            <Text style={[Type.label, { marginTop: Spacing.lg }]}>DATA SECURITY</Text>
            <Text style={[Type.body, { marginTop: Spacing.sm }]}>
              Your data is stored securely and not sold to third parties. Per UU PDP No. 27/2022,
              you may request data deletion by contacting our team.
            </Text>
          </Card>

          <Pressable
            style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.85 }]}
            onPress={() => setConsentChecked((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consentChecked }}
          >
            <View style={[styles.checkbox, consentChecked && { backgroundColor: Brand.primary, borderColor: Brand.primary }]}>
              {consentChecked ? <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>✓</Text> : null}
            </View>
            <Text style={[Type.body, { flex: 1, color: TextColor.secondary }]}>
              I have read and agree to the{" "}
              <Text
                style={{ color: Brand.primary, textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("https://competzy.id/privacy")}
              >
                Privacy Policy
              </Text>{" "}
              Competzy.
            </Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footerRow, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button label="Back" variant="ghost" onPress={() => setStep("details")} />
          <View style={{ flex: 1 }}>
            <Button
              label="Create Account"
              onPress={handleCreateAccount}
              loading={loading}
              disabled={!consentChecked}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </View>
    );
  }

  // ─── Step 2: Details ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.xl }}>
          <Pressable onPress={() => setStep("role")} hitSlop={12} style={{ marginRight: Spacing.md }}>
            <Text style={[Type.label, { color: Brand.primary }]}>← Back</Text>
          </Pressable>
          <Text style={Type.h2}>Complete Your Profile</Text>
        </View>

        <Card>
          <Text style={Type.label}>BASIC INFO</Text>
          <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
            <AppInput label="Full Name" placeholder="e.g. John Doe" value={name} onChangeText={setName} error={errors.name} />
            <AppInput
              label="Email"
              placeholder="e.g. john@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <AppInput
              label="Password"
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
            />
            <AppInput
              label="Phone Number"
              placeholder="e.g. 08123456789"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <AppAutocomplete
              label="Province"
              placeholder="Pick a province"
              value={province}
              onChangeText={setProvince}
              onSelect={(item) => {
                setProvince(item.name);
                setProvinceCode(item.id);
                setCity("");
                setRegencyCode("");
              }}
              fetchSuggestions={async (q) => {
                const list = !q?.trim()
                  ? provincesList.slice(0, 20)
                  : provincesList.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
                return list.map((p) => ({ id: p.code, name: p.name }));
              }}
              error={errors.province}
              minSearchLength={0}
              allowCustom={false}
              autoCapitalize="characters"
            />
            <AppAutocomplete
              label="City / Regency"
              placeholder={provinceCode ? "Pick city/regency" : "Pick province first"}
              value={city}
              onChangeText={setCity}
              onSelect={(item) => {
                setCity(item.name);
                setRegencyCode(item.id);
              }}
              fetchSuggestions={async (q) => {
                if (!provinceCode) return [];
                const list = !q?.trim()
                  ? citiesList.slice(0, 20)
                  : citiesList.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
                return list.map((r) => ({ id: r.code, name: r.name }));
              }}
              error={errors.city}
              minSearchLength={0}
              allowCustom={false}
              editable={!!provinceCode}
              autoCapitalize="characters"
            />
          </View>
        </Card>

        {role === "student" ? (
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={Type.label}>STUDENT INFO</Text>
            <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
              <AppAutocomplete
                label="NPSN / School Name"
                placeholder={regencyCode ? "Search school" : "Pick city first"}
                value={school}
                onChangeText={setSchool}
                onSelect={(item) => {
                  setSchool(item.name);
                  setSchoolNpsn(item.metadata?.npsn || "");
                  setSchoolAddress(item.metadata?.address || "");
                }}
                fetchSuggestions={async (q) => {
                  if (!regencyCode) return [];
                  const txt = q.trim();
                  if (!txt) {
                    const schools = await schoolsService.searchSchools({ regencyCode, grade, page: 1 });
                    return schools.slice(0, 20).map((s) => ({
                      id: s.npsn || s.id,
                      name: `${s.npsn ? `${s.npsn} - ` : ""}${s.name}`,
                      metadata: { npsn: s.npsn, address: s.address },
                    }));
                  }
                  if (txt.length < 3) return [];
                  const isNpsn = /^\d{5,}$/.test(txt);
                  const schools = await schoolsService.searchSchools(
                    isNpsn ? { npsn: txt } : { name: txt, regencyCode, grade }
                  );
                  return schools.map((s) => ({
                    id: s.npsn || s.id,
                    name: `${s.npsn ? `${s.npsn} - ` : ""}${s.name}`,
                    metadata: { npsn: s.npsn, address: s.address },
                  }));
                }}
                error={errors.school}
                minSearchLength={3}
                debounceMs={500}
                allowCustom
                customLabel="My school is not listed — enter manually"
                editable={!!regencyCode}
                autoCapitalize="characters"
              />
              {schoolNpsn ? (
                <View style={{ alignSelf: "flex-start" }}>
                  <Pill label={`✓ NPSN ${schoolNpsn}`} tone="info" />
                </View>
              ) : null}
              <View>
                <Text style={Type.label}>GRADE KELAS</Text>
                <GradePicker value={grade} onChange={setGrade} error={errors.grade} />
              </View>
            </View>
          </Card>
        ) : null}

        {role === "parent" ? (
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={Type.label}>CHILD INFO</Text>
            <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
              <AppInput label="Child Name" placeholder="e.g. Jane Doe" value={childName} onChangeText={setChildName} error={errors.childName} />
              <AppAutocomplete
                label="Child School"
                placeholder={regencyCode ? "Search child school" : "Pick city first"}
                value={childSchool}
                onChangeText={setChildSchool}
                onSelect={(item) => setChildSchool(item.name)}
                fetchSuggestions={async (q) => {
                  if (!regencyCode) return [];
                  const txt = q.trim();
                  if (txt.length < 3) return [];
                  const isNpsn = /^\d{5,}$/.test(txt);
                  const schools = await schoolsService.searchSchools(isNpsn ? { npsn: txt } : { name: txt, regencyCode });
                  return schools.map((s) => ({ id: s.npsn || s.id, name: `${s.npsn ? `${s.npsn} - ` : ""}${s.name}` }));
                }}
                error={errors.childSchool}
                minSearchLength={3}
                debounceMs={500}
                allowCustom
                customLabel="Not listed — enter manually"
                editable={!!regencyCode}
                autoCapitalize="characters"
              />
              <View>
                <Text style={Type.label}>GRADE KELAS ANAK</Text>
                <GradePicker value={childGrade} onChange={setChildGrade} error={errors.childGrade} />
              </View>
            </View>
          </Card>
        ) : null}

        {role === "teacher" ? (
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={Type.label}>TEACHING INFO</Text>
            <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
              <AppAutocomplete
                label="School"
                placeholder={regencyCode ? "Search school" : "Pick city first"}
                value={teacherSchool}
                onChangeText={setTeacherSchool}
                onSelect={(item) => setTeacherSchool(item.name)}
                fetchSuggestions={async (q) => {
                  if (!regencyCode) return [];
                  const txt = q.trim();
                  if (txt.length < 3) return [];
                  const isNpsn = /^\d{5,}$/.test(txt);
                  const schools = await schoolsService.searchSchools(isNpsn ? { npsn: txt } : { name: txt, regencyCode });
                  return schools.map((s) => ({ id: s.npsn || s.id, name: `${s.npsn ? `${s.npsn} - ` : ""}${s.name}` }));
                }}
                error={errors.teacherSchool}
                minSearchLength={3}
                debounceMs={500}
                allowCustom
                customLabel="Not listed — enter manually"
                editable={!!regencyCode}
                autoCapitalize="characters"
              />
              <AppInput label="Subject" placeholder="e.g. Matematika" value={subject} onChangeText={setSubject} error={errors.subject} />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footerRow, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button label="Back" variant="ghost" onPress={() => setStep("role")} disabled={loading} />
        <View style={{ flex: 1 }}>
          <Button
            label="Continue"
            onPress={() => {
              if (validateDetails()) setStep("consent");
            }}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["3xl"] },
  logoTile: {
    width: 80,
    height: 80,
    borderRadius: Radius["2xl"],
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  roleEmojiTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Surface.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.primary,
  },
  gradeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  gradeBtn: {
    minWidth: 52,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Surface.card,
    borderWidth: 1,
    borderColor: Surface.border,
    alignItems: "center",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Surface.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    backgroundColor: Surface.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    backgroundColor: Surface.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
  },
});
