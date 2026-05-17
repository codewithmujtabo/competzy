import { HapticTab } from "@/components/haptic-tab";
import { NotificationTabIcon } from "@/components/NotificationTabIcon";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Brand, FontFamily, Surface, Text as TextColor } from "@/constants/theme";
import { useUser } from "@/context/AuthContext";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const userRole = (user as any)?.role ?? "";

  const tabBarHeight =
    Platform.OS === "ios" ? 85 : 60 + insets.bottom;
  const tabBarPaddingBottom =
    Platform.OS === "ios" ? 28 : insets.bottom + 8;

  // Determine which tabs to show based on role
  const isStudent = userRole === "student";
  const isParent = userRole === "parent";
  const isTeacher = userRole === "teacher";
  const isAdmin = userRole === "admin";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: TextColor.tertiary,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Surface.card,
          borderTopColor: Surface.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: FontFamily.bodySemi,
        },
      }}
    >
      {/* STUDENT & PARENT: Discover tab */}
      <Tabs.Screen
        name="competitions"
        options={{
          title: "Discover",
          href: (isStudent || isParent) ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="trophy.fill" color={color} />
          ),
        }}
      />

      {/* STUDENT ONLY: My Registrations tab */}
      <Tabs.Screen
        name="my-competitions"
        options={{
          title: "My Regs",
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="checkmark.seal.fill" color={color} />
          ),
        }}
      />

      {/* PARENT ONLY: Children tab */}
      <Tabs.Screen
        name="children"
        options={{
          title: "Children",
          href: isParent ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.2.fill" color={color} />
          ),
        }}
      />

      {/* TEACHER ONLY: Dashboard tab */}
      <Tabs.Screen
        name="teacher-dashboard"
        options={{
          title: "Dashboard",
          href: isTeacher ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="square.grid.2x2.fill" color={color} />
          ),
        }}
      />

      {/* TEACHER ONLY: My Students tab */}
      <Tabs.Screen
        name="teacher-students"
        options={{
          title: "Students",
          href: isTeacher ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.3.fill" color={color} />
          ),
        }}
      />

      {/* Hidden teacher screens */}
      <Tabs.Screen name="teacher-analytics" options={{ href: null }} />
      <Tabs.Screen name="teacher-actions" options={{ href: null }} />

      {/* ADMIN ONLY: Web portal redirect — admin management moved to web */}
      <Tabs.Screen
        name="web-portal-redirect"
        options={{
          title: "Admin",
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="desktopcomputer" color={color} />
          ),
        }}
      />

      {/* ALL ROLES: Notifications tab */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, focused }) => (
            <NotificationTabIcon color={color} focused={focused} />
          ),
        }}
      />

      {/* ALL ROLES: Profile tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.fill" color={color} />
          ),
        }}
      />

      {/* Always hidden screens */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="competitions/[id]" options={{ href: null }} />
      <Tabs.Screen name="my-registration-details" options={{ href: null }} />
    </Tabs>
  );
}
