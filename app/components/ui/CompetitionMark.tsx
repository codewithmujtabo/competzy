import React, { memo } from "react";
import { View, Image } from "react-native";
import { Surface } from "@/constants/theme";
import { SubjectCircle } from "./SubjectCircle";

type Props = {
  name: string;                     // competition name — used for the fallback letter
  logoUrl?: string | null;          // uploaded logo; absolute URL
  size?: number;                    // px (default 48)
};

/**
 * Competition avatar. When the competition has an uploaded logo we show it on a
 * rounded-square white plate with `resizeMode="contain"` — logos come in every
 * aspect ratio (often wide), so a circular `cover` mask would crop them to an
 * unreadable slice. White plate because logos are designed for a white ground.
 * With no logo we fall back to the lettered SubjectCircle disk.
 */
function CompetitionMarkImpl({ name, logoUrl, size = 48 }: Props) {
  if (!logoUrl) {
    return <SubjectCircle label={name} size={size} />;
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name} logo`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: Surface.border,
        alignItems: "center",
        justifyContent: "center",
        padding: Math.round(size * 0.14),
        overflow: "hidden",
      }}
    >
      <Image
        source={{ uri: logoUrl }}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

export const CompetitionMark = memo(CompetitionMarkImpl);
