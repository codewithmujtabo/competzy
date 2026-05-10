import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Brand, Spacing, Surface, Type, Text as TextColor } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  trailing?: React.ReactNode;
};

function ScreenHeaderImpl({ title, subtitle, showBack = true, onBack, trailing }: Props) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  return (
    <View
      style={{
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        backgroundColor: Surface.background,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: Surface.card,
            alignItems: "center",
            justifyContent: "center",
            marginRight: Spacing.md,
            opacity: pressed ? 0.7 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <IconSymbol name="chevron.left" size={20} color={TextColor.primary} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {title ? <Text style={Type.h2} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? (
          <Text style={[Type.bodySm, { marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export const ScreenHeader = memo(ScreenHeaderImpl);
