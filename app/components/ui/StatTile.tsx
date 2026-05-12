import React, { memo } from "react";
import { Pressable, View, Text, ViewStyle } from "react-native";
import { Brand, Radius, Shadow, Spacing, Type, Text as TextColor } from "@/constants/theme";

type Props = {
  label: string;
  value: string | number;
  icon?: React.ReactNode;        // optional Ionicons / vector icon node
  tint?: string;                 // pastel background (defaults to lavender)
  accent?: string;               // value/icon color (defaults to navy)
  onPress?: () => void;
  style?: ViewStyle;
  badge?: React.ReactNode;       // tiny floating mark in the corner (e.g. status dot)
};

function StatTileImpl({
  label,
  value,
  icon,
  tint = Brand.primarySoft,
  accent = Brand.navy,
  onPress,
  style,
  badge,
}: Props) {
  const inner = (
    <View
      style={[
        {
          backgroundColor: tint,
          borderRadius: Radius["3xl"],
          paddingVertical: Spacing.xl,
          paddingHorizontal: Spacing.xl,
          minHeight: 112,
          justifyContent: "space-between",
          ...Shadow.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ ...Type.label, color: TextColor.secondary, letterSpacing: 0.3 }}>
          {label}
        </Text>
        {badge}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        {icon ? (
          <View style={{
            width: 36,
            height: 36,
            borderRadius: Radius.pill,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {icon}
          </View>
        ) : null}
        <Text style={{ ...Type.displayMd, fontSize: 26, color: accent }}>
          {value}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: `${Brand.primary}14` }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export const StatTile = memo(StatTileImpl);
