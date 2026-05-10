import { Button, Card, Pill, ScreenHeader } from "@/components/ui";
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
import { useUser } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import * as competitionsService from "@/services/competitions.service";
import * as favoritesService from "@/services/favorites.service";
import { Analytics } from "@/services/analytics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatPrice(fee: number) {
  return fee === 0 ? "FREE" : `Rp ${fee.toLocaleString("id-ID")}`;
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_PILL: Record<string, { label: string; tone: any }> = {
  pending_payment: { label: "Pay Now", tone: "info" },
  registered:      { label: "Pay Now", tone: "info" },
  pending_review:  { label: "Under Review",       tone: "warning" },
  pending_approval:{ label: "Under Review",       tone: "warning" },
  approved:        { label: "Approved",      tone: "success" },
  paid:            { label: "Paid",        tone: "success" },
  rejected:        { label: "Rejected",        tone: "danger" },
  completed:       { label: "Completed",        tone: "brand" },
};

export default function CompetitionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, registrations, registerCompetition } = useUser();
  const [activeTab, setActiveTab] = useState<"overview" | "registration" | "payment">("overview");
  const viewStartTime = useRef<number | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const isParent = (user as any)?.role === "parent";

  const { data: comp, isLoading, isError } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => competitionsService.get(id!),
    staleTime: 0,
    enabled: !!id,
  });

  useEffect(() => {
    if (comp) {
      Analytics.track("competition_viewed", {
        competitionId: comp.id,
        name: comp.name,
        category: comp.category,
      });
    }
  }, [comp?.id]);

  useEffect(() => {
    viewStartTime.current = Date.now();
    return () => {
      if (viewStartTime.current && comp?.id) {
        const duration = Math.floor((Date.now() - viewStartTime.current) / 1000);
        if (duration >= 10) competitionsService.trackView(comp.id, duration);
      }
    };
  }, [comp?.id]);

  useEffect(() => setActiveTab("overview"), [id]);

  useEffect(() => {
    if (!id) return;
    favoritesService.checkFavorited(id).then(setIsFavorited).catch(() => {});
  }, [id]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.push("/(tabs)/competitions");
  };

  const handleToggleFavorite = async () => {
    if (!id || loadingFavorite) return;
    setLoadingFavorite(true);
    try {
      if (isFavorited) {
        await favoritesService.remove(id);
        setIsFavorited(false);
      } else {
        await favoritesService.add(id);
        setIsFavorited(true);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update favorites");
    } finally {
      setLoadingFavorite(false);
    }
  };

  const existingReg = comp ? registrations.find((r) => r.compId === comp.id) : null;
  const already = !!existingReg;
  const isClosed = comp?.regCloseDate ? new Date(comp.regCloseDate) < new Date() : false;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Brand.primary} size="large" />
      </View>
    );
  }

  if (isError || !comp) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScreenHeader title="Not found" onBack={handleBack} />
        <View style={[styles.center, { paddingHorizontal: Spacing.xl }]}>
          <Text style={[Type.body, { color: TextColor.secondary, marginBottom: Spacing.lg }]}>
            Unable to load competition.
          </Text>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const cats = comp.category.split("\n").map((c) => c.trim()).filter(Boolean);
  const firstCat = cats[0] || "General";
  const accent = CategoryAccent[firstCat] ?? Brand.primary;
  const accentBg = CategoryBg[firstCat] ?? Brand.primarySoft;
  const emoji = CategoryEmoji[firstCat] ?? "🏆";

  const ctaLabel = isClosed
    ? "Registration Closed"
    : already
    ? existingReg && (existingReg.status === "pending_payment" || existingReg.status === "registered")
      ? "Complete Payment"
      : existingReg && ["approved", "paid", "completed"].includes(existingReg.status)
      ? "Open Details"
      : "View Registration"
    : "Register Now";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Competition Detail"
        onBack={handleBack}
        trailing={
          isParent ? null : existingReg ? (
            <Pill
              label={STATUS_PILL[existingReg.status]?.label ?? existingReg.status}
              tone={STATUS_PILL[existingReg.status]?.tone ?? "neutral"}
              size="sm"
            />
          ) : (
            <Pressable
              onPress={handleToggleFavorite}
              hitSlop={10}
              disabled={loadingFavorite}
              style={({ pressed }) => [
                styles.favBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Text style={{ fontSize: 18 }}>
                {loadingFavorite ? "⏳" : isFavorited ? "❤️" : "🤍"}
              </Text>
            </Pressable>
          )
        }
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: accentBg }]}>
          <View style={styles.heroEmoji}>
            <Text style={{ fontSize: 44 }}>{emoji}</Text>
          </View>
          <Text style={[Type.h1, { textAlign: "center", marginTop: Spacing.lg }]} numberOfLines={3}>
            {comp.name}
          </Text>
          <Text style={[Type.body, { color: TextColor.secondary, marginTop: 4, textAlign: "center" }]}>
            by {comp.organizerName}
          </Text>
          <View style={styles.heroPills}>
            {cats.slice(0, 3).map((cat) => (
              <Pill key={cat} label={cat} tone="brand" size="sm" />
            ))}
            <Pill label={comp.gradeLevel.replace(/,/g, ", ")} tone="neutral" size="sm" />
          </View>
          {isClosed ? (
            <View style={{ marginTop: Spacing.md }}>
              <Pill label="Registration Closed" tone="danger" />
            </View>
          ) : null}
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <Card variant="flat" style={styles.statCell}>
            <Text style={[Type.caption, { color: TextColor.tertiary }]}>FEE</Text>
            <Text
              style={[
                Type.h2,
                { color: comp.fee === 0 ? Brand.success : TextColor.primary, marginTop: 4 },
              ]}
            >
              {formatPrice(comp.fee)}
            </Text>
          </Card>
          <Card variant="flat" style={styles.statCell}>
            <Text style={[Type.caption, { color: TextColor.tertiary }]}>CLOSES</Text>
            <Text style={[Type.title, { marginTop: 4 }]} numberOfLines={1}>
              {formatDate(comp.regCloseDate)}
            </Text>
          </Card>
          {comp.quota ? (
            <Card variant="flat" style={styles.statCell}>
              <Text style={[Type.caption, { color: TextColor.tertiary }]}>QUOTA</Text>
              <Text style={[Type.h2, { marginTop: 4 }]}>{comp.quota}</Text>
            </Card>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {([
            { key: "overview", label: "About" },
            { key: "registration", label: "Applications" },
            { key: "payment", label: "Payment" },
          ] as const).map((tab) => (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tab,
                activeTab === tab.key && styles.tabActive,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Text
                style={{
                  ...Type.label,
                  color: activeTab === tab.key ? Brand.primary : TextColor.tertiary,
                  fontSize: 13,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg }}>
          {activeTab === "overview" ? (
            <View style={{ gap: Spacing.lg }}>
              <Card>
                <Text style={Type.h3}>About Kompetisi</Text>
                <Text style={[Type.body, { marginTop: Spacing.sm }]}>{comp.description}</Text>
              </Card>

              <Card>
                <Text style={Type.h3}>Important Dates</Text>
                <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
                  <Row label="Registration opens" value={formatDate(comp.regOpenDate)} />
                  <Row label="Registration closes" value={formatDate(comp.regCloseDate)} accent={isClosed ? Brand.error : undefined} />
                  <Row label="Competition date" value={formatDate(comp.competitionDate)} />
                </View>
              </Card>

              {cats.length > 1 ? (
                <Card>
                  <Text style={Type.h3}>Kategori</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md }}>
                    {cats.map((cat) => (
                      <Pill key={cat} label={cat} tone="brand" />
                    ))}
                  </View>
                </Card>
              ) : null}
            </View>
          ) : null}

          {activeTab === "registration" ? (
            <View style={{ gap: Spacing.lg }}>
              <Card>
                <Text style={Type.h3}>Registration Status</Text>
                <View style={{ marginTop: Spacing.md }}>
                  <Pill
                    label={already ? "✓ Already Registered" : "Not Registered"}
                    tone={already ? "success" : "neutral"}
                  />
                </View>
              </Card>
              <Card>
                <Text style={Type.h3}>Required Documents</Text>
                {comp.requiredDocs.length > 0 ? (
                  <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                    {comp.requiredDocs.map((doc, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: Spacing.sm }}>
                        <Text style={{ color: accent, fontWeight: "800" }}>•</Text>
                        <Text style={[Type.body, { flex: 1 }]}>
                          {doc.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[Type.body, { marginTop: Spacing.sm, color: TextColor.secondary }]}>
                    No required documents.
                  </Text>
                )}
              </Card>
            </View>
          ) : null}

          {activeTab === "payment" ? (
            <View style={{ gap: Spacing.lg }}>
              <Card variant={comp.fee === 0 ? "tinted" : "elevated"} tint={Brand.successSoft}>
                <Text style={Type.h3}>Total Fee</Text>
                <Text
                  style={[
                    Type.displayMd,
                    {
                      color: comp.fee === 0 ? Brand.success : TextColor.primary,
                      marginTop: Spacing.sm,
                    },
                  ]}
                >
                  {formatPrice(comp.fee)}
                </Text>
                {comp.fee === 0 ? (
                  <Text style={[Type.body, { marginTop: Spacing.sm, color: Brand.success }]}>
                    ✓ This competition is free. No registration fee.
                  </Text>
                ) : (
                  <Text style={[Type.body, { marginTop: Spacing.sm, color: TextColor.secondary }]}>
                    Payment methods (GoPay, OVO, Dana, Bank Transfer) will be available after you register.
                  </Text>
                )}
              </Card>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button
          label={ctaLabel}
          onPress={async () => {
            if (!already && !isClosed) {
              Analytics.track("registration_started", {
                competitionId: comp.id,
                name: comp.name,
                fee: comp.fee,
              });
              const reg = await registerCompetition(comp.id, {
                competitionName: comp.name,
                fee: comp.fee,
                category: comp.category,
              });
              if (comp.fee > 0 && reg.status === "pending_payment") {
                router.push({ pathname: "/(payment)/pay", params: { registrationId: reg.id } });
              } else {
                router.push("/(tabs)/my-competitions");
              }
              return;
            }
            if (existingReg && (existingReg.status === "pending_payment" || existingReg.status === "registered")) {
              router.push({ pathname: "/(payment)/pay", params: { registrationId: existingReg.id } });
              return;
            }
            if (existingReg && ["approved", "paid", "completed"].includes(existingReg.status)) {
              router.push({ pathname: "/(tabs)/my-registration-details", params: { id: existingReg.id } });
              return;
            }
            router.push("/(tabs)/my-competitions");
          }}
          disabled={isClosed && !already}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={[Type.bodySm, { color: TextColor.secondary }]}>{label}</Text>
      <Text style={[Type.title, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
    alignItems: "center",
    borderBottomLeftRadius: Radius["3xl"],
    borderBottomRightRadius: Radius["3xl"],
  },
  heroEmoji: {
    width: 88,
    height: 88,
    borderRadius: Radius["2xl"],
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.md,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.lg,
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    backgroundColor: Surface.cardAlt,
    borderRadius: Radius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: Surface.card,
    ...Shadow.sm,
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Surface.card,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.sm,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Surface.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
  },
});
