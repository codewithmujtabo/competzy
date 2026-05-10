import React, { memo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Brand, Radius, Shadow, Spacing, Type, Surface, Text as TextColor } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 56 };
const PAD_H: Record<Size, number> = { sm: Spacing.lg, md: Spacing.xl, lg: Spacing["2xl"] };

function ButtonImpl({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  leadingIcon,
  trailingIcon,
  fullWidth,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case "primary":
        return { bg: Brand.primary, fg: "#FFFFFF", press: Brand.primaryDark, ring: undefined };
      case "secondary":
        return { bg: Brand.primarySoft, fg: Brand.primary, press: "#E0E7FF", ring: undefined };
      case "ghost":
        return { bg: "transparent", fg: Brand.primary, press: Brand.primarySoft, ring: undefined };
      case "destructive":
        return { bg: Brand.error, fg: "#FFFFFF", press: "#DC2626", ring: undefined };
    }
  })();

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      android_ripple={
        variant === "ghost" ? { color: Brand.primarySoft, borderless: false } : undefined
      }
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD_H[size],
          borderRadius: Radius.pill,
          backgroundColor: pressed && !isDisabled ? palette.press : palette.bg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.5 : 1,
          ...(variant === "primary" && !isDisabled ? Shadow.md : null),
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {leadingIcon ? <View style={styles.iconLead}>{leadingIcon}</View> : null}
          <Text style={[Type.button, { color: palette.fg, fontSize: size === "sm" ? 14 : 16 }]}>
            {label}
          </Text>
          {trailingIcon ? <View style={styles.iconTrail}>{trailingIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  iconLead: { marginRight: Spacing.sm },
  iconTrail: { marginLeft: Spacing.sm },
});

export const Button = memo(ButtonImpl);
