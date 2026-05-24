// LocationCascade — Indonesian province + city stay as searchable dropdowns
// sourced from emsifa.com (via `app/services/regions.service.ts`); for any
// other country the same two rows degrade into free-text inputs. This is the
// mobile mirror of `web/components/profile/location-cascade.tsx`.
//
// `users.province` + `users.city` are TEXT columns storing the names (not
// codes), so the cascade stores the picked names too. The selected
// province's code is held in component-internal state only — it's needed to
// fetch the matching regencies, but never persisted.

import { AppInput } from "@/components/common/AppInput";
import {
  Brand,
  FontFamily,
  Spacing,
  Type,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as regions from "@/services/regions.service";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  country: string | null | undefined; // ISO 3166-1 alpha-2; "ID" → cascade mode
  province: string;
  city: string;
  onChangeProvince: (name: string) => void;
  onChangeCity: (name: string) => void;
}

export function LocationCascade({
  country,
  province,
  city,
  onChangeProvince,
  onChangeCity,
}: Props) {
  const isIndonesia = (country ?? "").toUpperCase() === "ID";

  if (!isIndonesia) {
    // Anywhere else: plain text inputs (web does the same — there's no
    // universal province/city list to source).
    return (
      <View style={{ gap: Spacing.lg }}>
        <AppInput
          label="Province"
          placeholder="Your province (optional)"
          value={province}
          onChangeText={onChangeProvince}
        />
        <AppInput
          label="City"
          placeholder="Your city (optional)"
          value={city}
          onChangeText={onChangeCity}
        />
      </View>
    );
  }

  return (
    <IndonesianCascade
      province={province}
      city={city}
      onChangeProvince={onChangeProvince}
      onChangeCity={onChangeCity}
    />
  );
}

// ─── ID-only cascade ─────────────────────────────────────────────────────

function IndonesianCascade({
  province,
  city,
  onChangeProvince,
  onChangeCity,
}: {
  province: string;
  city: string;
  onChangeProvince: (name: string) => void;
  onChangeCity: (name: string) => void;
}) {
  const [provinces, setProvinces] = useState<regions.Province[] | null>(null);
  const [provincesError, setProvincesError] = useState<string | null>(null);
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);

  const [regencies, setRegencies] = useState<regions.Regency[] | null>(null);
  const [regenciesLoading, setRegenciesLoading] = useState(false);
  const [regenciesError, setRegenciesError] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  // Province code derived from the saved name. The user already has a name
  // text stored on first load — we look up the matching code so the city
  // picker can fetch regencies without forcing the user to re-pick province.
  const provinceCode = useMemo(() => {
    if (!provinces || !province) return null;
    return provinces.find((p) => p.name === province)?.code ?? null;
  }, [provinces, province]);

  useEffect(() => {
    let alive = true;
    regions
      .getProvinces()
      .then((rows) => {
        if (alive) setProvinces(rows);
      })
      .catch(() => {
        if (alive) setProvincesError("Could not load provinces");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Whenever provinceCode resolves (either via picker or via initial-load
  // lookup) refetch regencies. Clears regencies if province is cleared.
  useEffect(() => {
    let alive = true;
    if (!provinceCode) {
      setRegencies(null);
      return;
    }
    setRegenciesLoading(true);
    setRegenciesError(null);
    regions
      .getRegencies(provinceCode)
      .then((rows) => {
        if (alive) setRegencies(rows);
      })
      .catch(() => {
        if (alive) setRegenciesError("Could not load cities");
      })
      .finally(() => {
        if (alive) setRegenciesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [provinceCode]);

  const pickProvince = (p: regions.Province) => {
    setProvincePickerOpen(false);
    if (p.name !== province) {
      onChangeProvince(p.name);
      onChangeCity(""); // changing province clears city
    }
  };

  const pickCity = (r: regions.Regency) => {
    setCityPickerOpen(false);
    onChangeCity(r.name);
  };

  return (
    <View style={{ gap: Spacing.lg }}>
      <ComboField
        label="Province"
        placeholder="Select your province"
        value={province}
        onOpen={() => provinces && setProvincePickerOpen(true)}
        loading={provinces === null && !provincesError}
        error={provincesError ?? undefined}
      />
      <ComboField
        label="City / Regency"
        placeholder={
          province ? "Select your city" : "Pick a province first"
        }
        value={city}
        onOpen={() => provinceCode && setCityPickerOpen(true)}
        loading={regenciesLoading}
        error={regenciesError ?? undefined}
        disabled={!provinceCode}
      />

      <SearchablePicker
        title="Select province"
        visible={provincePickerOpen}
        items={provinces ?? []}
        currentName={province}
        onClose={() => setProvincePickerOpen(false)}
        onPick={pickProvince}
      />
      <SearchablePicker
        title="Select city"
        visible={cityPickerOpen}
        items={regencies ?? []}
        currentName={city}
        onClose={() => setCityPickerOpen(false)}
        onPick={pickCity}
      />
    </View>
  );
}

// ─── ComboField (input-shaped pressable row) ─────────────────────────────

function ComboField({
  label,
  placeholder,
  value,
  onOpen,
  loading,
  error,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onOpen: () => void;
  loading?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <View>
      <Text style={[Type.label, styles.label]}>{label}</Text>
      <Pressable
        onPress={() => !disabled && !loading && onOpen()}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.input,
          error ? styles.inputError : null,
          pressed && !disabled && !loading ? styles.inputPressed : null,
          disabled ? styles.inputDisabled : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Brand.primary} />
        ) : value ? (
          <Text style={[Type.body, styles.value]} numberOfLines={1}>
            {value}
          </Text>
        ) : (
          <Text style={[Type.body, styles.placeholder]} numberOfLines={1}>
            {placeholder}
          </Text>
        )}
        <Ionicons name="chevron-down" size={18} color="#94A3B8" />
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ─── Reusable searchable picker modal ────────────────────────────────────

function SearchablePicker<T extends { code: string; name: string }>({
  visible,
  items,
  currentName,
  title,
  onClose,
  onPick,
}: {
  visible: boolean;
  items: T[];
  currentName: string;
  title: string;
  onClose: () => void;
  onPick: (item: T) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalContainer, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.modalHeader}>
          <Text style={Type.h2}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color="#1E293B" />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            autoCapitalize="none"
            autoCorrect={false}
            style={[Type.body, styles.searchInput]}
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(it) => it.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
          renderItem={({ item }) => {
            const isActive = item.name === currentName;
            return (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => [
                  styles.row,
                  isActive && styles.rowActive,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[Type.body, styles.rowName]} numberOfLines={1}>
                  {item.name}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark" size={18} color={Brand.primary} />
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.xs,
    color: "#475569",
    fontFamily: FontFamily.bodySemi,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#FFFFFF",
  },
  inputError: { borderColor: "#EF4444" },
  inputPressed: { borderColor: Brand.primary, opacity: 0.92 },
  inputDisabled: { opacity: 0.5 },
  value: {
    color: "#0F172A",
    fontFamily: FontFamily.bodyMedium,
    flex: 1,
  },
  placeholder: { color: "#94A3B8", flex: 1 },
  errorText: {
    marginTop: 4,
    color: "#EF4444",
    fontSize: 12,
    fontFamily: FontFamily.bodyMedium,
  },
  modalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  searchWrap: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontFamily: FontFamily.bodyRegular,
    paddingVertical: 0,
  },
  clearBtn: { padding: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowActive: { backgroundColor: Brand.primarySoft },
  rowPressed: { backgroundColor: "#F8FAFC" },
  rowName: {
    flex: 1,
    color: "#0F172A",
    fontFamily: FontFamily.bodyMedium,
  },
});
