// CountrySelect — mobile mirror of web/components/ui/country-select.tsx.
//
// Renders an input-shaped pressable row showing the selected country's flag +
// full name (or a placeholder). Tapping opens a full-screen Modal with a
// search field and a FlatList of every ISO 3166-1 alpha-2 country, priority
// countries (Indonesia, neighbours) surfaced on top. The picker is uncontrolled
// on text-input style: the parent owns the ISO code, this component takes
// `value` + `onChange` (returns the upper-case code).
//
// Visual parity with `AppInput` — same 52pt height, 12 radius, neutral border,
// primary border on focus, error red when there's a validation problem.

import { COUNTRIES, countryByCode } from "@/constants/countries";
import { Brand, FontFamily, Spacing, Type } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
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
  label?: string;
  value: string | null | undefined;
  onChange: (code: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function CountrySelect({
  label,
  value,
  onChange,
  placeholder = "Select country",
  error,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();

  const selected = useMemo(() => countryByCode(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <View>
      {label && (
        <Text style={[Type.label, styles.label]}>{label}</Text>
      )}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.input,
          error ? styles.inputError : null,
          pressed && !disabled ? styles.inputPressed : null,
          disabled ? styles.inputDisabled : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label ?? "Country"}
        accessibilityHint="Opens a country picker"
      >
        {selected ? (
          <View style={styles.selectedRow}>
            <Text style={styles.flag}>{selected.flag}</Text>
            <Text style={[Type.body, styles.selectedText]} numberOfLines={1}>
              {selected.name}
            </Text>
          </View>
        ) : (
          <Text style={[Type.body, styles.placeholder]}>{placeholder}</Text>
        )}
        <Ionicons name="chevron-down" size={18} color="#94A3B8" />
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { paddingTop: insets.top + Spacing.md },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={Type.h2}>Select country</Text>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close" size={22} color="#1E293B" />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons
              name="search"
              size={18}
              color="#94A3B8"
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries…"
              autoCapitalize="none"
              autoCorrect={false}
              style={[Type.body, styles.searchInput]}
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={8}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[Type.body, { color: "#94A3B8" }]}>No countries match</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isActive = item.code === (value ?? "").toUpperCase();
              return (
                <Pressable
                  onPress={() => pick(item.code)}
                  style={({ pressed }) => [
                    styles.row,
                    isActive && styles.rowActive,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[Type.body, styles.rowName]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowCode}>{item.code}</Text>
                  {isActive && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={Brand.primary}
                      style={{ marginLeft: Spacing.sm }}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
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
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  selectedText: {
    color: "#0F172A",
    fontFamily: FontFamily.bodyMedium,
    flex: 1,
  },
  placeholder: { color: "#94A3B8", flex: 1 },
  flag: { fontSize: 20, lineHeight: 22 },
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
  rowCode: {
    fontFamily: "Menlo",
    fontSize: 12,
    color: "#94A3B8",
  },
  empty: { padding: Spacing.xl, alignItems: "center" },
});
