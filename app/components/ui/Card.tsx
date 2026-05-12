import React, { memo } from "react";
import { Pressable, View, ViewProps, ViewStyle, StyleSheet } from "react-native";
import { Brand, Radius, Shadow, Spacing, Surface } from "@/constants/theme";

type Variant = "elevated" | "flat" | "outline" | "tinted" | "playful";

type Props = ViewProps & {
  variant?: Variant;
  padding?: keyof typeof Spacing | 0;
  radius?: keyof typeof Radius;
  tint?: string;
  onPress?: () => void;
  pressableStyle?: ViewStyle;
  accentColor?: string;
};

function CardImpl({
  variant = "elevated",
  padding = "lg",
  radius = "2xl",
  tint,
  onPress,
  style,
  pressableStyle,
  accentColor,
  children,
  ...rest
}: Props) {
  const baseStyle: ViewStyle = {
    borderRadius: variant === "playful" ? Radius["3xl"] : Radius[radius],
    padding: padding === 0 ? 0 : Spacing[padding],
    backgroundColor:
      variant === "tinted" ? tint ?? Surface.cardAlt : Surface.card,
    ...(variant === "elevated" ? Shadow.md : null),
    ...(variant === "playful" ? Shadow.lg : null),
    ...(variant === "outline"
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: Surface.border }
      : null),
    ...(accentColor
      ? { borderLeftWidth: 4, borderLeftColor: accentColor, paddingLeft: Spacing.lg }
      : null),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: `${Brand.primary}14` }}
        style={({ pressed }) => [
          baseStyle,
          pressed && { transform: [{ scale: 0.985 }], opacity: 0.96 },
          style,
          pressableStyle,
        ]}
        {...(rest as any)}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[baseStyle, style]} {...rest}>
      {children}
    </View>
  );
}

export const Card = memo(CardImpl);
