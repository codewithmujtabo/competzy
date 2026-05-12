import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { Button } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const slides = [
  {
    id: "1",
    icon: "trophy" as const,
    accent: Brand.primary,
    accentSoft: Brand.primarySoft,
    title: "One Place for\nAll Competitions",
    description:
      "EMC, ISPO, OSEBI, Komodo Math, IGO, and hundreds more national & international competitions — all in one place.",
  },
  {
    id: "2",
    icon: "flash" as const,
    accent: Brand.coral,
    accentSoft: Brand.coralSoft,
    title: "Register & Pay\nIn Just Minutes",
    description:
      "Fill the form once, pick your favorite payment method, and get instant confirmation. Simple and secure.",
  },
  {
    id: "3",
    icon: "school" as const,
    accent: Brand.navy,
    accentSoft: Brand.sunshineSoft,
    title: "Track Results &\nGrow Further",
    description:
      "Download your e-certificate, track your ranking, and discover the next competition that matches your interests and grade.",
  },
] as const;

type Slide = (typeof slides)[number];

function OnboardingSlide({ item, width }: { item: Slide; width: number }) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.blobLarge, { backgroundColor: item.accentSoft }]} />
      <View style={[styles.blobSmall, { backgroundColor: item.accent, opacity: 0.18 }]} />
      <View style={[styles.iconTile, { shadowColor: item.accent, backgroundColor: "#FFFFFF" }]}>
        <View style={[styles.iconInner, { backgroundColor: item.accentSoft }]}>
          <Ionicons name={item.icon} size={64} color={item.accent} />
        </View>
      </View>
      <Text style={[styles.title, { color: item.accent }]}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );
}

function Dots({ current, accent }: { current: number; accent: string }) {
  return (
    <View style={styles.dotsRow}>
      {slides.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current
              ? { width: 28, backgroundColor: accent }
              : { backgroundColor: Surface.borderStrong, opacity: 0.5 },
          ]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const currentAccent = slides[activeIndex].accent;

  const goToAuth = () => router.replace("/(auth)/login" as any);

  const onViewable = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
    }
  ).current;

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      goToAuth();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Text style={[Type.label, { color: currentAccent }]}>COMPETZY</Text>
        <Pressable onPress={goToAuth} hitSlop={12}>
          <Text style={[Type.label, { color: TextColor.secondary }]}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OnboardingSlide item={item} width={width} />}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        style={{ flex: 1 }}
      />

      <View style={styles.footer}>
        <Dots current={activeIndex} accent={currentAccent} />
        <View style={{ marginTop: Spacing.xl, width: "100%" }}>
          <Button
            label={activeIndex === slides.length - 1 ? "Get Started" : "Next"}
            onPress={handleNext}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    paddingBottom: Spacing["2xl"],
  },
  blobLarge: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    top: "12%",
    opacity: 0.55,
  },
  blobSmall: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: "8%",
    right: "8%",
  },
  iconTile: {
    width: 168,
    height: 168,
    borderRadius: Radius["4xl"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["3xl"],
    padding: 8,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 12,
  },
  iconInner: {
    flex: 1,
    width: "100%",
    borderRadius: Radius["3xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 38,
    marginBottom: Spacing.lg,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 15,
    color: TextColor.secondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: Radius.pill,
    width: 8,
  },
});
