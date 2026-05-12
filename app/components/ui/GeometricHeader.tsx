import React, { memo } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
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
      return { base: Brand.coral, accent: Brand.sunshine, deep: Brand.primary };
    case "ocean":
      return { base: Brand.sky, accent: Brand.primary, deep: Brand.navy };
    default:
      return { base: Brand.primary, accent: Brand.sunshine, deep: Brand.navy };
  }
}

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
          borderBottomLeftRadius: rounded ? Radius["3xl"] : 0,
          borderBottomRightRadius: rounded ? Radius["3xl"] : 0,
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
        {/* Large coral/accent blob top-left */}
        <Path
          d="M-40,-20 C60,40 120,-40 220,40 C320,120 240,200 100,180 C-40,160 -100,80 -40,-20 Z"
          fill={c.accent}
          opacity={0.95}
        />
        {/* Deep purple/navy blob bottom-right */}
        <Path
          d="M260,40 C360,0 460,60 420,160 C380,260 240,260 200,180 C160,100 200,80 260,40 Z"
          fill={c.deep}
          opacity={0.85}
        />
        {/* Sunshine accent dot */}
        <Circle cx="320" cy="60" r="22" fill={Brand.sunshine} opacity={0.9} />
        {/* Hairline arcs for depth */}
        <Path
          d="M0,180 Q200,80 400,180"
          stroke="#FFFFFF"
          strokeOpacity={0.22}
          strokeWidth={2}
          fill="none"
        />
        <Path
          d="M0,140 Q200,40 400,140"
          stroke="#FFFFFF"
          strokeOpacity={0.14}
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}

export const GeometricHeader = memo(GeometricHeaderImpl);
