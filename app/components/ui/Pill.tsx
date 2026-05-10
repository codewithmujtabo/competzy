import React, { memo } from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { Brand, Radius, Spacing, Surface, Type, Text as TextColor } from "@/constants/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
  leadingIcon?: React.ReactNode;
  style?: ViewStyle;
};

function tonePalette(tone: Props["tone"], selected: boolean) {
  if (selected) return { bg: Brand.primary, fg: "#FFFFFF", border: Brand.primary };
  switch (tone) {
    case "brand":
      return { bg: Brand.primarySoft, fg: Brand.primary, border: Brand.primarySoft };
    case "success":
      return { bg: Brand.successSoft, fg: Brand.success, border: Brand.successSoft };
    case "warning":
      return { bg: Brand.warningSoft, fg: "#B45309", border: Brand.warningSoft };
    case "danger":
      return { bg: Brand.errorSoft, fg: Brand.error, border: Brand.errorSoft };
    case "info":
      return { bg: Brand.infoSoft, fg: Brand.info, border: Brand.infoSoft };
    default:
      return { bg: Surface.cardAlt, fg: TextColor.secondary, border: Surface.border };
  }
}

function PillImpl({
  label,
  selected = false,
  onPress,
  tone = "neutral",
  size = "md",
  leadingIcon,
  style,
}: Props) {
  const p = tonePalette(tone, selected);
  const padV = size === "sm" ? Spacing.xs : Spacing.sm;
  const padH = size === "sm" ? Spacing.md : Spacing.lg;
  const inner = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: 1,
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderRadius: Radius.pill,
        },
        style,
      ]}
    >
      {leadingIcon ? <View style={{ marginRight: 6 }}>{leadingIcon}</View> : null}
      <Text
        style={{
          ...Type.label,
          color: p.fg,
          fontSize: size === "sm" ? 12 : 13,
        }}
      >
        {label}
      </Text>
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export const Pill = memo(PillImpl);
