import { Card, EmptyState } from "@/components/ui";
import {
  Brand,
  Radius,
  Spacing,
  Surface,
  Type,
} from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
import { useUser } from "@/context/AuthContext";
import * as notificationsService from "@/services/notifications.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TYPE_ICON: { match: string; icon: IoniconName; tint: string }[] = [
  { match: "deadline",    icon: "alarm",                tint: Brand.coralSoft    },
  { match: "approval",    icon: "checkmark-circle",     tint: Brand.mintSoft     },
  { match: "payment",     icon: "card",                 tint: Brand.sunshineSoft },
  { match: "competition", icon: "trophy",               tint: Brand.primarySoft  },
  { match: "registration", icon: "document-text",       tint: Brand.skySoft      },
  { match: "child",       icon: "people",               tint: Brand.primarySoft  },
  { match: "parent_link", icon: "link",                 tint: Brand.primarySoft  },
];

function iconForType(type: string): { icon: IoniconName; tint: string } {
  for (const t of TYPE_ICON) if (type.includes(t.match)) return { icon: t.icon, tint: t.tint };
  return { icon: "notifications", tint: Brand.primarySoft };
}

function relativeDate(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} days ago`;
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useUser();
  const userId = (user as any)?.id;
  const userRole = (user as any)?.role;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => notificationsService.getNotifications(50, 0),
    enabled: !!userId,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useFocusEffect(
    useCallback(() => {
      if (userId) queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }, [queryClient, userId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handlePress = async (item: notificationsService.Notification) => {
    if (!item.read) {
      await notificationsService.markAsRead(item.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }
    const compId = item.data?.compId;
    const studentId = item.data?.studentId;
    const type = item.type;
    if (userRole === "parent") {
      if (type.startsWith("child_")) {
        router.push({
          pathname: "/(tabs)/children",
          params: { studentId: studentId ?? "", compId: compId ?? "" },
        });
        return;
      }
      if (type.startsWith("parent_link_")) {
        router.push("/(tabs)/children");
        return;
      }
    }
    if (compId && (type.includes("competition") || type.includes("registration") || type.includes("deadline"))) {
      router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: compId } });
      return;
    }
    if (type.includes("payment")) router.push("/(tabs)/my-competitions");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + Spacing.lg }]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.heading}>
          <Text style={Type.displayMd}>Notifications</Text>
        </View>
        <EmptyState
          icon={<Ionicons name="cloud-offline-outline" size={44} color={Brand.error} />}
          tint={Brand.errorSoft}
          title="Failed to load notifications"
          ctaLabel="Try again"
          onCta={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={Type.displayMd}>Notifications</Text>
          <Text style={[Type.bodySm, { marginTop: 2 }]}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            onPress={async () => {
              await notificationsService.markAllAsRead();
              queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
            }}
            hitSlop={10}
          >
            <Text style={[Type.label, { color: Brand.primary }]}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="notifications-outline" size={44} color={Brand.primary} />}
          title="No notifications yet"
          message={
            userRole === "parent"
              ? "Updates about your linked children, approvals, and competition progress will appear here."
              : "Registration updates, reminders, and alerts will appear here."
          }
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Brand.primary} />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={renderSep}
          renderItem={({ item }) => {
            const { icon, tint } = iconForType(item.type);
            return (
              <Card
                onPress={() => handlePress(item)}
                variant={item.read ? "elevated" : "playful"}
                accentColor={item.read ? undefined : Brand.primary}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={[styles.iconTile, { backgroundColor: tint }]}>
                    <Ionicons name={icon} size={22} color={Brand.navy} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={[Type.title, { flex: 1 }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {!item.read ? <View style={styles.dot} /> : null}
                    </View>
                    <Text style={[Type.bodySm, { marginTop: 4 }]} numberOfLines={3}>
                      {item.body}
                    </Text>
                    <Text style={[Type.caption, { marginTop: Spacing.sm }]}>
                      {relativeDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const renderSep = () => <View style={{ height: Spacing.md }} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background, paddingHorizontal: Spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heading: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: Spacing.xl,
  },
  listContent: { paddingBottom: Spacing["3xl"] },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.primary,
    marginLeft: Spacing.sm,
  },
});
