import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Brand, Spacing, Type, Text as TextColor } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  trailingLabel?: string;
  onTrailingPress?: () => void;
  marginTop?: number;
};

function SectionHeaderImpl({ title, subtitle, trailingLabel, onTrailingPress, marginTop = Spacing.xl }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginTop,
        marginBottom: Spacing.md,
        paddingHorizontal: Spacing.xl,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={Type.h2}>{title}</Text>
        {subtitle ? (
          <Text style={[Type.bodySm, { marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailingLabel && onTrailingPress ? (
        <Pressable onPress={onTrailingPress} hitSlop={10}>
          <Text style={{ ...Type.label, color: Brand.primary }}>{trailingLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderImpl);
