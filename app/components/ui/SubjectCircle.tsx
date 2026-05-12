import React, { memo } from "react";
import { View, Text } from "react-native";
import { Radius, Type, subjectColorFor } from "@/constants/theme";

type Props = {
  label: string;                    // full subject/competition name
  letter?: string;                  // optional override; defaults to first alpha char
  size?: number;                    // px (default 48)
  bg?: string;                      // override fill
  fg?: string;                      // override text color
};

function pickLetter(label: string): string {
  const m = label.match(/[A-Za-z]/);
  return (m ? m[0] : "?").toUpperCase();
}

function SubjectCircleImpl({ label, letter, size = 48, bg, fg }: Props) {
  const palette = subjectColorFor(label);
  const ch = letter ?? pickLetter(label);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${label} subject mark`}
      style={{
        width: size,
        height: size,
        borderRadius: Radius.pill,
        backgroundColor: bg ?? palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          ...Type.h2,
          fontSize: Math.round(size * 0.46),
          lineHeight: Math.round(size * 0.46) + 2,
          color: fg ?? palette.fg,
        }}
      >
        {ch}
      </Text>
    </View>
  );
}

export const SubjectCircle = memo(SubjectCircleImpl);
