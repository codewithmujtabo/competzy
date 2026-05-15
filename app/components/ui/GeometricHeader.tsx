import React, { memo } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Brand, Radius } from "@/constants/theme";

type Palette = "purple" | "sunset" | "ocean";

type Props = {
  height?: number;
  palette?: Palette;
  children?: React.ReactNode;       // overlay content (avatar + name)
  style?: ViewStyle;
  rounded?: boolean;                 // whether to clip with bottom corner radius
};

function paletteColors(p: Palette) {
  switch (p) {
    case "sunset":
      return { base: Brand.coral, dot: Brand.sunshine };
    case "ocean":
      return { base: Brand.primaryDark, dot: Brand.primaryLight };
    default:
      return { base: Brand.primary, dot: Brand.sunshine };
  }
}

/**
 * Editorial header — a solid brand panel with a restrained concentric-ring
 * motif (competzy.com feel). Replaces the Sprint-19 playful SVG blobs.
 */
function GeometricHeaderImpl({
  height = 220,
  palette = "purple",
  children,
  style,
  rounded = true,
}: Props) {
  const c = paletteColors(palette);
  return (
    <View
      style={[
        {
          height,
          overflow: "hidden",
          backgroundColor: c.base,
          borderBottomLeftRadius: rounded ? Radius["2xl"] : 0,
          borderBottomRightRadius: rounded ? Radius["2xl"] : 0,
        },
        style,
      ]}
    >
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Concentric rings, top-right */}
        <Circle cx="344" cy="44" r="128" stroke="#FFFFFF" strokeOpacity={0.09} strokeWidth={1.5} fill="none" />
        <Circle cx="344" cy="44" r="84" stroke="#FFFFFF" strokeOpacity={0.13} strokeWidth={1.5} fill="none" />
        <Circle cx="344" cy="44" r="44" stroke="#FFFFFF" strokeOpacity={0.17} strokeWidth={1.5} fill="none" />
        {/* Small accent dot on the ring */}
        <Circle cx="344" cy="44" r="9" fill={c.dot} opacity={0.95} />
        {/* Faint counter-ring, bottom-left */}
        <Circle cx="36" cy="208" r="72" stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1.5} fill="none" />
      </Svg>
      {children}
    </View>
  );
}

export const GeometricHeader = memo(GeometricHeaderImpl);
