import React, { memo } from "react";
import { Text, View, ViewStyle } from "react-native";
import { Brand, Radius, Spacing, Type, Text as TextColor } from "@/constants/theme";
import { Button } from "./Button";

type Props = {
  emoji?: string;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
  style?: ViewStyle;
};

function EmptyStateImpl({ emoji = "✨", title, message, ctaLabel, onCta, style }: Props) {
  return (
    <View
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: Spacing["4xl"],
          paddingHorizontal: Spacing["2xl"],
        },
        style,
      ]}
    >
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: Radius.pill,
          backgroundColor: Brand.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: Spacing.xl,
        }}
      >
        <Text style={{ fontSize: 44 }}>{emoji}</Text>
      </View>
      <Text style={[Type.h2, { textAlign: "center" }]}>{title}</Text>
      {message ? (
        <Text style={[Type.body, { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.sm }]}>
          {message}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <View style={{ marginTop: Spacing.xl }}>
          <Button label={ctaLabel} onPress={onCta} />
        </View>
      ) : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateImpl);
