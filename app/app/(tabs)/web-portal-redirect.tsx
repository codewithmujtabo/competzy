import { Button } from "@/components/ui";
import {
  Brand,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WebPortalRedirectScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing["3xl"] }]}>
      <View style={styles.iconTile}>
        <Text style={{ fontSize: 56 }}>🖥️</Text>
      </View>
      <Text style={[Type.displayMd, { textAlign: "center", marginTop: Spacing.xl }]}>
        Admin Panel
      </Text>
      <Text
        style={[
          Type.body,
          { color: TextColor.secondary, textAlign: "center", marginTop: Spacing.md },
        ]}
      >
        The admin dashboard is on the web portal. Please open it in a browser to manage competitions, users, and reviews.
      </Text>
      <View style={{ marginTop: Spacing["2xl"] }}>
        <Button
          label="Open Web Portal"
          onPress={() => Linking.openURL("https://competzy.id/admin")}
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Surface.background,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: Spacing["2xl"],
  },
  iconTile: {
    width: 120,
    height: 120,
    borderRadius: Radius["3xl"],
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.lg,
  },
});
