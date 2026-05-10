import { Button, Card, EmptyState, Pill } from "@/components/ui";
import {
  Brand,
  CategoryAccent,
  CategoryBg,
  CategoryEmoji,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Text as TextColor,
  Type,
} from "@/constants/theme";
import { useUser, type Registration } from "@/context/AuthContext";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as favoritesService from "@/services/favorites.service";
import type { Favorite } from "@/services/favorites.service";

const TABS = [
  { key: "Saved", label: "Saved", emoji: "💙" },
  { key: "Applications", label: "Applications", emoji: "📝" },
  { key: "Joined", label: "Joined", emoji: "🏅" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABEL: Record<string, { label: string; tone: any }> = {
  pending_payment: { label: "Payment Required", tone: "info" },
  pending_review:  { label: "Awaiting Review", tone: "info" },
  approved:        { label: "Approved",     tone: "success" },
  rejected:        { label: "Rejected",       tone: "danger" },
  paid:            { label: "Approved",     tone: "success" },
  completed:       { label: "Completed",       tone: "brand" },
  pending_approval:{ label: "Under Review",      tone: "warning" },
  registered:      { label: "Payment Required", tone: "info" },
};

function formatCurrency(amount: number) {
  return amount === 0 ? "FREE" : `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function MyCompetitionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registrations, registerCompetition, refreshRegistrations } = useUser();

  const [activeTab, setActiveTab] = useState<TabKey>("Applications");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyCompId, setBusyCompId] = useState<string | null>(null);
  const refreshRef = useRef(refreshRegistrations);
  const loadFavRef = useRef<() => Promise<void>>(async () => {});

  const loadFavorites = useCallback(async () => {
    setLoadingFavorites(true);
    try {
      const data = await favoritesService.list();
      setFavorites(data);
    } catch (err) {
      console.error("Failed to load favorites:", err);
    } finally {
      setLoadingFavorites(false);
    }
  }, []);

  useEffect(() => {
    refreshRef.current = refreshRegistrations;
  }, [refreshRegistrations]);
  useEffect(() => {
    loadFavRef.current = loadFavorites;
  }, [loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      void refreshRef.current();
      void loadFavRef.current();
    }, [])
  );

  const registeredIds = useMemo(
    () => new Set(registrations.map((r) => r.compId)),
    [registrations]
  );

  const savedItems = useMemo(
    () => favorites.filter((f) => !registeredIds.has(f.id)),
    [favorites, registeredIds]
  );
  const applications = useMemo(
    () =>
      registrations.filter((r) =>
        ["pending_payment", "pending_review", "rejected", "pending_approval", "registered"].includes(r.status)
      ),
    [registrations]
  );
  const joinedItems = useMemo(
    () => registrations.filter((r) => ["approved", "paid", "completed"].includes(r.status)),
    [registrations]
  );

  const tabCounts: Record<TabKey, number> = {
    Saved: savedItems.length,
    Applications: applications.length,
    Joined: joinedItems.length,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshRegistrations(), loadFavorites()]);
    setRefreshing(false);
  };

  const handleRemoveFavorite = async (favorite: Favorite) => {
    try {
      setBusyCompId(favorite.id);
      await favoritesService.remove(favorite.id);
      setFavorites((c) => c.filter((i) => i.id !== favorite.id));
    } catch {
      Alert.alert("Error", "Failed to remove from saved list.");
    } finally {
      setBusyCompId(null);
    }
  };

  const handleApplyFromSaved = async (favorite: Favorite) => {
    try {
      setBusyCompId(favorite.id);
      const reg = await registerCompetition(favorite.id, {
        competitionName: favorite.name,
        fee: favorite.fee,
        category: favorite.category,
      });
      await favoritesService.remove(favorite.id).catch(() => undefined);
      setFavorites((c) => c.filter((i) => i.id !== favorite.id));

      if (favorite.fee > 0 && reg.status === "pending_payment") {
        router.push({ pathname: "/(payment)/pay", params: { registrationId: reg.id } });
      } else {
        setActiveTab("Applications");
        Alert.alert(
          "Registration Submitted",
          "Your registration is under admin review. You'll be notified when it's approved."
        );
      }
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message || "Unable to register for this competition.");
    } finally {
      setBusyCompId(null);
    }
  };

  const renderSavedCard = ({ item }: { item: Favorite }) => {
    const accent = CategoryAccent[item.category ?? ""] ?? Brand.primary;
    const bg = CategoryBg[item.category ?? ""] ?? Brand.primarySoft;
    const emoji = CategoryEmoji[item.category ?? ""] ?? "🏆";
    return (
      <Card accentColor={accent}>
        <CardHeader emoji={emoji} bg={bg} title={item.name} subtitle={`${item.organizer_name} • ${item.category}`} onTitlePress={() => router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: item.id } })} />
        <Text style={[Type.title, { marginTop: Spacing.sm }]}>{formatCurrency(item.fee)}</Text>
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <Button
              label={busyCompId === item.id ? "Menghapus..." : "Remove"}
              variant="ghost"
              fullWidth
              onPress={() => handleRemoveFavorite(item)}
              disabled={busyCompId === item.id}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={busyCompId === item.id ? "Applying..." : "Apply"}
              fullWidth
              onPress={() => handleApplyFromSaved(item)}
              loading={busyCompId === item.id}
            />
          </View>
        </View>
      </Card>
    );
  };

  const renderApplicationCard = ({ item }: { item: Registration }) => {
    const cat = item.meta?.category as string | undefined;
    const accent = CategoryAccent[cat ?? ""] ?? Brand.primary;
    const bg = CategoryBg[cat ?? ""] ?? Brand.primarySoft;
    const emoji = CategoryEmoji[cat ?? ""] ?? "📝";
    const status = STATUS_LABEL[item.status];
    return (
      <Card accentColor={accent}>
        <CardHeader emoji={emoji} bg={bg} title={item.competitionName} subtitle={formatCurrency(item.fee)} onTitlePress={() => router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: item.compId } })} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md }}>
          {status ? <Pill label={status.label} tone={status.tone} size="sm" /> : null}
          {item.registrationNumber ? (
            <Pill label={item.registrationNumber} tone="brand" size="sm" />
          ) : null}
        </View>
        {(item.status === "pending_payment" || item.status === "registered") ? (
          <Text style={[Type.bodySm, { marginTop: Spacing.md }]}>
            Completedkan pembayaran untuk mengirim pendaftaran.
          </Text>
        ) : null}
        {item.status === "pending_review" ? (
          <Text style={[Type.bodySm, { marginTop: Spacing.md }]}>
            Payment received. Awaiting final admin review.
          </Text>
        ) : null}
        {item.status === "pending_approval" ? (
          <Text style={[Type.bodySm, { marginTop: Spacing.md }]}>
            Your registration is under admin review. You will be notified.
          </Text>
        ) : null}
        {item.status === "rejected" ? (
          <Text style={[Type.bodySm, { marginTop: Spacing.md, color: Brand.error }]}>
            Your registration was not approved. Contact support for details.
          </Text>
        ) : null}
        <View style={styles.actionRow}>
          {item.fee > 0 && (item.status === "pending_payment" || item.status === "registered") ? (
            <Button
              label="Pay Now"
              fullWidth
              onPress={() =>
                router.push({ pathname: "/(payment)/pay", params: { registrationId: item.id } })
              }
            />
          ) : (
            <Button
              label="View Competition"
              variant="secondary"
              fullWidth
              onPress={() =>
                router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: item.compId } })
              }
            />
          )}
        </View>
      </Card>
    );
  };

  const renderJoinedCard = ({ item }: { item: Registration }) => {
    const cat = item.meta?.category as string | undefined;
    const accent = CategoryAccent[cat ?? ""] ?? Brand.success;
    const bg = CategoryBg[cat ?? ""] ?? Brand.successSoft;
    const emoji = CategoryEmoji[cat ?? ""] ?? "🏅";
    return (
      <Card accentColor={accent}>
        <CardHeader emoji={emoji} bg={bg} title={item.competitionName} subtitle={formatCurrency(item.fee)} onTitlePress={() => router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: item.compId } })} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md }}>
          <Pill label="✓ Bergabung" tone="success" size="sm" />
          {item.registrationNumber ? <Pill label={item.registrationNumber} tone="brand" size="sm" /> : null}
        </View>
        <Text style={[Type.bodySm, { marginTop: Spacing.md }]}>
          View competition details, schedule, platform, venue, and participant instructions.
        </Text>
        <View style={styles.actionRow}>
          <Button
            label="View Details"
            fullWidth
            onPress={() =>
              router.push({ pathname: "/(tabs)/my-registration-details", params: { id: item.id } })
            }
          />
        </View>
      </Card>
    );
  };

  const currentData =
    activeTab === "Saved" ? savedItems : activeTab === "Applications" ? applications : joinedItems;

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={{ paddingHorizontal: Spacing.xl }}>
        <Text style={Type.displayMd}>My Competitions</Text>
        <Text style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.xs }]}>
          Saved competitions, active applications, and ones you've joined.
        </Text>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <Pressable
                key={tab.key}
                style={({ pressed }) => [
                  styles.tabBtn,
                  active && styles.tabBtnActive,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ fontSize: 14 }}>{tab.emoji}</Text>
                <Text
                  style={{
                    ...Type.label,
                    color: active ? Brand.primary : TextColor.secondary,
                    fontSize: 13,
                  }}
                >
                  {tab.label}
                </Text>
                {count > 0 ? (
                  <View style={[styles.countDot, active && { backgroundColor: Brand.primary }]}>
                    <Text style={[styles.countText, active && { color: "#FFFFFF" }]}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {activeTab === "Saved" && loadingFavorites ? (
        <EmptyState
          emoji="⏳"
          title="Loading..."
          message="Pull down to refresh if it takes too long."
        />
      ) : currentData.length === 0 ? (
        <EmptyState
          emoji={activeTab === "Saved" ? "💙" : activeTab === "Applications" ? "📋" : "🏁"}
          title={
            activeTab === "Saved"
              ? "Nothing saved yet"
              : activeTab === "Applications"
              ? "No active applications"
              : "No joined competitions yet"
          }
          message={
            activeTab === "Saved"
              ? "Save competitions from the detail page, then apply when ready."
              : activeTab === "Applications"
              ? "Applications appear here after you apply and wait for approval."
              : "Once your application is approved, details will appear here."
          }
          ctaLabel={activeTab === "Saved" ? "Browse Competitions" : undefined}
          onCta={activeTab === "Saved" ? () => router.push("/(tabs)/competitions") : undefined}
        />
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item: any) => item.favorite_id || item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={renderSep}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
          renderItem={
            activeTab === "Saved"
              ? (renderSavedCard as any)
              : activeTab === "Applications"
              ? (renderApplicationCard as any)
              : (renderJoinedCard as any)
          }
        />
      )}
    </View>
  );
}

function CardHeader({
  emoji,
  bg,
  title,
  subtitle,
  onTitlePress,
}: {
  emoji: string;
  bg: string;
  title: string;
  subtitle: string;
  onTitlePress?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <View style={[styles.emojiTile, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <Pressable onPress={onTitlePress} hitSlop={4}>
          <Text style={Type.title} numberOfLines={2}>
            {title}
          </Text>
        </Pressable>
        <Text style={[Type.bodySm, { marginTop: 4 }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const renderSep = () => <View style={{ height: Spacing.md }} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.lg,
    padding: 4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.xs,
  },
  tabBtnActive: {
    backgroundColor: Surface.card,
    ...Shadow.sm,
  },
  countDot: {
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countText: {
    color: Brand.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  emojiTile: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
