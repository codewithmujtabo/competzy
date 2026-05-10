import {
  Brand,
  CategoryAccent,
  CategoryBg,
  CategoryEmoji,
  GradeBg,
  GradeText,
  Radius,
  Shadow,
  Spacing,
  Surface,
  Type,
  Text as TextColor,
} from "@/constants/theme";
import { Button, Card, EmptyState, Pill, SectionHeader } from "@/components/ui";
import { useUser } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as competitionsService from "@/services/competitions.service";
import * as favoritesService from "@/services/favorites.service";
import * as parentsService from "@/services/parents.service";
import { Analytics } from "@/services/analytics";

// ─── Filters & helpers ───────────────────────────────────────────────────────

function formatPrice(fee: number) {
  return fee === 0 ? "FREE" : `Rp ${fee.toLocaleString("id-ID")}`;
}

function formatDeadline(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDeadlineStatus(date: string | null) {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return null;
  if (days <= 3) return { label: `${days} days left`, tone: "danger" as const };
  if (days <= 7) return { label: `${days} days left`, tone: "warning" as const };
  if (days <= 14) return { label: `${days} days left`, tone: "warning" as const };
  return null;
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ─── Skeleton card ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card variant="flat" style={{ opacity: 0.6 }}>
      <View style={styles.skLine} />
      <View style={[styles.skLine, { width: "60%", marginTop: Spacing.sm }]} />
      <View style={[styles.skLine, { width: "40%", marginTop: Spacing.sm }]} />
    </Card>
  );
}

// ─── Competition card (memoized) ────────────────────────────────────────────
type CompetitionCardProps = {
  item: any;
  isFavorited: boolean;
  onPress: (item: any) => void;
  onToggleFavorite: (id: string, isFavorited: boolean) => void;
};

const CompetitionCard = memo(function CompetitionCard({
  item,
  isFavorited,
  onPress,
  onToggleFavorite,
}: CompetitionCardProps) {
  const cats = item.category.split("\n").map((c: string) => c.trim()).filter(Boolean);
  const firstCat = cats[0] || "General";
  const accent = CategoryAccent[firstCat] ?? Brand.primary;
  const catBg = CategoryBg[firstCat] ?? Brand.primarySoft;
  const emoji = CategoryEmoji[firstCat] ?? "🏆";
  const urgency = getDeadlineStatus(item.regCloseDate);
  const grades = item.gradeLevel.split(",").map((g: string) => g.trim()).filter(Boolean);

  return (
    <Card onPress={() => onPress(item)} accentColor={accent} style={{ position: "relative" }}>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onToggleFavorite(item.id, isFavorited);
        }}
        hitSlop={10}
        style={({ pressed }) => [
          styles.heartBtn,
          pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        <Text style={{ fontSize: 18 }}>{isFavorited ? "❤️" : "🤍"}</Text>
      </Pressable>

      <View style={{ paddingRight: 36 }}>
        <View style={styles.cardEmojiRow}>
          <View style={[styles.emojiTile, { backgroundColor: catBg }]}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.title, { lineHeight: 22 }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[Type.caption, { marginTop: 2 }]} numberOfLines={1}>
              {item.organizerName}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Pill
            label={cats.length > 1 ? `${firstCat} +${cats.length - 1}` : firstCat}
            tone="neutral"
            size="sm"
            style={{ backgroundColor: catBg, borderColor: catBg }}
          />
          {grades.slice(0, 3).map((g: string) => (
            <View
              key={g}
              style={[styles.gradeChip, { backgroundColor: GradeBg[g] ?? Surface.cardAlt }]}
            >
              <Text style={[Type.label, { color: GradeText[g] ?? TextColor.secondary, fontSize: 11 }]}>
                {g}
              </Text>
            </View>
          ))}
          {urgency ? <Pill label={urgency.label} tone={urgency.tone} size="sm" /> : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        {item.fee === 0 ? (
          <Pill label="FREE" tone="success" />
        ) : (
          <Text style={[Type.h3, { color: TextColor.primary }]}>{formatPrice(item.fee)}</Text>
        )}
        <View style={styles.viewBtn}>
          <Text style={[Type.label, { color: accent }]}>View details →</Text>
        </View>
      </View>

      {!urgency && item.regCloseDate ? (
        <Text style={[Type.caption, { marginTop: Spacing.sm }]}>
          Closes: {formatDeadline(item.regCloseDate)}
        </Text>
      ) : null}
    </Card>
  );
});

// ─── Recommended card (horizontal) ──────────────────────────────────────────
const RecommendedCard = memo(function RecommendedCard({
  item,
  onPress,
}: {
  item: any;
  onPress: (item: any) => void;
}) {
  const cats = item.category.split("\n").map((c: string) => c.trim()).filter(Boolean);
  const firstCat = cats[0] || "General";
  const accent = CategoryAccent[firstCat] ?? Brand.primary;
  const catBg = CategoryBg[firstCat] ?? Brand.primarySoft;
  const emoji = CategoryEmoji[firstCat] ?? "🏆";
  const urgency = getDeadlineStatus(item.regCloseDate);

  return (
    <Card
      onPress={() => onPress(item)}
      style={{ width: 220, marginRight: Spacing.md }}
      padding="lg"
    >
      <View style={[styles.recoEmoji, { backgroundColor: catBg }]}>
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
      </View>
      <Text style={[Type.title, { marginTop: Spacing.md }]} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={[Type.caption, { marginTop: 2 }]} numberOfLines={1}>
        {item.organizerName}
      </Text>
      <View style={{ flexDirection: "row", marginTop: Spacing.md, alignItems: "center" }}>
        <Text style={[Type.h3, { color: accent, flex: 1 }]}>{formatPrice(item.fee)}</Text>
        {urgency ? <Pill label={urgency.label} tone={urgency.tone} size="sm" /> : null}
      </View>
    </Card>
  );
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, registrations } = useUser();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const displayName =
    (user as any)?.fullName?.split(" ")[0] ?? (user as any)?.name?.split(" ")[0] ?? "there";
  const userRole = (user as any)?.role ?? "";
  const isParent = userRole === "parent";

  useEffect(() => {
    if (userRole === "teacher") router.replace("/(tabs)/teacher-dashboard");
    else if (userRole === "admin") router.replace("/(tabs)/web-portal-redirect");
  }, [userRole]);

  const { data: allCompetitions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => competitionsService.list(),
    staleTime: 0,
  });

  const {
    data: linkedChildren = [],
    isLoading: isLoadingChildren,
    isError: isChildrenError,
    refetch: refetchChildren,
  } = useQuery({
    queryKey: ["myChildren", (user as any)?.id],
    queryFn: () => parentsService.getMyChildren("active"),
    enabled: isParent,
    staleTime: 60 * 1000,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => competitionsService.getRecommended(10),
    staleTime: 0,
    enabled: !isParent && registrations.length > 0,
  });

  useEffect(() => {
    if (isParent) return;
    favoritesService
      .list()
      .then((favs) => setFavoritedIds(new Set(favs.map((f: any) => f.id))))
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback(async (compId: string, isFavorited: boolean) => {
    try {
      if (isFavorited) {
        await favoritesService.remove(compId);
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          next.delete(compId);
          return next;
        });
      } else {
        await favoritesService.add(compId);
        setFavoritedIds((prev) => new Set(prev).add(compId));
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  }, []);

  const goToDetail = useCallback(
    (item: any) => {
      Analytics.track("competition_viewed", {
        competitionId: item.id,
        name: item.name,
        category: item.category,
      });
      router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: item.id } });
    },
    [router]
  );

  const goToReco = useCallback(
    (item: any) => {
      Analytics.track("recommendation_clicked", {
        competitionId: item.id,
        name: item.name,
        category: item.category,
        score: item.score,
      });
      router.push({ pathname: "/(tabs)/competitions/[id]", params: { id: item.id } });
    },
    [router]
  );

  const categories = useMemo(() => {
    const all = allCompetitions.flatMap((c: any) =>
      c.category.split("\n").map((cat: string) => cat.trim()).filter(Boolean)
    );
    return [...new Set(all)].sort() as string[];
  }, [allCompetitions]);

  const filtered = useMemo(() => {
    return allCompetitions.filter((c: any) => {
      if (activeCategory) {
        const cats = c.category.split("\n").map((x: string) => x.trim()).filter(Boolean);
        if (!cats.includes(activeCategory)) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.organizerName.toLowerCase().includes(q) &&
          !c.category.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allCompetitions, query, activeCategory]);

  const parentSummary = useMemo(() => {
    const activeChildren = linkedChildren.filter((c: any) => c.linkStatus === "active");
    const allRegs = activeChildren.flatMap((child: any) =>
      child.registrations.map((r: any) => ({
        ...r,
        childName: child.fullName,
        childId: child.studentId,
        childGrade: child.grade,
        childSchool: child.school,
      }))
    );
    const attentionStatuses = new Set(["pending_review", "registered", "rejected"]);
    const needsAttention = allRegs.filter((r: any) => attentionStatuses.has(r.status));
    const joined = new Set(allRegs.map((r: any) => r.competitionId));
    const childGrades = new Set(
      activeChildren.map((c: any) => String(c.grade || "").trim()).filter(Boolean)
    );
    const suggested = allCompetitions
      .filter((c: any) => {
        if (joined.has(c.id)) return false;
        if (childGrades.size === 0) return false;
        return c.gradeLevel.split(",").map((g: string) => g.trim()).some((g: string) => childGrades.has(g));
      })
      .sort((a: any, b: any) => {
        const at = a.regCloseDate ? new Date(a.regCloseDate).getTime() : Infinity;
        const bt = b.regCloseDate ? new Date(b.regCloseDate).getTime() : Infinity;
        return at - bt;
      })
      .slice(0, 6);
    const upcoming = [...allRegs]
      .filter((r: any) => r.regCloseDate)
      .sort((a, b) => new Date(a.regCloseDate).getTime() - new Date(b.regCloseDate).getTime())
      .slice(0, 5);
    return { activeChildren, allRegistrations: allRegs, needsAttention, suggestedCompetitions: suggested, upcomingDeadlines: upcoming };
  }, [allCompetitions, linkedChildren]);

  // ─── Parent branch ─────────────────────────────────────────────────────────
  if (isParent) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.parentScroll}>
          <View style={styles.parentHero}>
            <Text style={{ fontSize: 32 }}>👨‍👩‍👧</Text>
            <Text style={[Type.displayMd, { color: "#FFFFFF", marginTop: Spacing.md }]}>
              Parent Home
            </Text>
            <Text style={[Type.body, { color: "rgba(255,255,255,0.92)", marginTop: Spacing.sm }]}>
              Monitor your children, view registration status, and find competitions by grade.
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={[Type.displayMd, { color: Brand.primary }]}>
                {parentSummary.activeChildren.length}
              </Text>
              <Text style={Type.caption}>Linked Children</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[Type.displayMd, { color: Brand.secondary }]}>
                {parentSummary.allRegistrations.length}
              </Text>
              <Text style={Type.caption}>Registrations</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[Type.displayMd, { color: Brand.warning }]}>
                {parentSummary.needsAttention.length}
              </Text>
              <Text style={Type.caption}>Needs Action</Text>
            </View>
          </View>

          <SectionHeader
            title="Your Children"
            trailingLabel="Manage"
            onTrailingPress={() => router.push("/(tabs)/children")}
            marginTop={Spacing["2xl"]}
          />
          {isLoadingChildren ? (
            <ActivityIndicator color={Brand.primary} style={{ marginVertical: Spacing["2xl"] }} />
          ) : isChildrenError ? (
            <View style={styles.parentSlot}>
              <Card>
                <Text style={Type.title}>Failed to load linked children</Text>
                <View style={{ marginTop: Spacing.md, alignSelf: "flex-start" }}>
                  <Button label="Try again" variant="secondary" size="sm" onPress={() => refetchChildren()} />
                </View>
              </Card>
            </View>
          ) : parentSummary.activeChildren.length === 0 ? (
            <View style={styles.parentSlot}>
              <EmptyState
                emoji="🔗"
                title="No linked children yet"
                message="Ask your child to invite you via the app, then enter the PIN to link the account."
                ctaLabel="Open Children Tab"
                onCta={() => router.push("/(tabs)/children")}
              />
            </View>
          ) : (
            <View style={styles.parentSlot}>
              {parentSummary.activeChildren.map((child: any) => (
                <Card key={child.linkId} style={{ marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.parentAvatar}>
                      <Text style={[Type.h2, { color: Brand.primary }]}>
                        {child.fullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={Type.title}>{child.fullName}</Text>
                      <Text style={[Type.bodySm, { marginTop: 2 }]}>
                        Grade {child.grade || "-"} • {child.school || "School not set"}
                      </Text>
                    </View>
                    <Pill label={`${child.registrations.length} competitions`} tone="brand" size="sm" />
                  </View>
                </Card>
              ))}
            </View>
          )}

          <SectionHeader
            title="Needs Attention"
            subtitle="Applications awaiting review, rejected, or needing payment."
          />
          <View style={styles.parentSlot}>
            {parentSummary.needsAttention.length === 0 ? (
              <Card variant="tinted" tint={Brand.successSoft}>
                <Text style={Type.title}>All clear ✨</Text>
                <Text style={[Type.bodySm, { marginTop: 4 }]}>
                  No applications need your follow-up right now.
                </Text>
              </Card>
            ) : (
              parentSummary.needsAttention.map((r: any) => {
                const tone =
                  r.status === "pending_review"
                    ? "info"
                    : r.status === "rejected"
                    ? "danger"
                    : "warning";
                return (
                  <Card key={r.registrationId} style={{ marginBottom: Spacing.md }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: Spacing.md,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={Type.title}>{r.competitionName}</Text>
                        <Text style={[Type.bodySm, { marginTop: 4 }]}>
                          {r.childName} • {r.category} • {r.level}
                        </Text>
                      </View>
                      <Pill label={formatStatusLabel(r.status)} tone={tone as any} size="sm" />
                    </View>
                  </Card>
                );
              })
            )}
          </View>

          <SectionHeader
            title="Upcoming Deadlines"
            subtitle="Nearest registration deadlines for your child competitions."
          />
          <View style={styles.parentSlot}>
            {parentSummary.upcomingDeadlines.length === 0 ? (
              <Card>
                <Text style={Type.title}>No active deadlines</Text>
                <Text style={[Type.bodySm, { marginTop: 4 }]}>
                  Deadlines will appear once your child registers for competitions.
                </Text>
              </Card>
            ) : (
              parentSummary.upcomingDeadlines.map((r: any) => (
                <Card
                  key={`${r.registrationId}-deadline`}
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={Type.title}>{r.competitionName}</Text>
                    <Text style={[Type.bodySm, { marginTop: 4 }]}>{r.childName}</Text>
                  </View>
                  <Pill label={formatDeadline(r.regCloseDate)} tone="brand" size="sm" />
                </Card>
              ))
            )}
          </View>

          <SectionHeader
            title="Recommended"
            subtitle="Matching the grade of your linked child."
          />
          <View style={styles.parentSlot}>
            {isLoading ? (
              <ActivityIndicator color={Brand.primary} style={{ marginVertical: Spacing["2xl"] }} />
            ) : parentSummary.suggestedCompetitions.length === 0 ? (
              <Card>
                <Text style={Type.title}>No recommendations yet</Text>
                <Text style={[Type.bodySm, { marginTop: 4 }]}>
                  Add your child grade info to get competition suggestions.
                </Text>
              </Card>
            ) : (
              parentSummary.suggestedCompetitions.map((item: any) => (
                <View key={item.id} style={{ marginBottom: Spacing.md }}>
                  <CompetitionCard
                    item={item}
                    isFavorited={false}
                    onPress={goToDetail}
                    onToggleFavorite={() => {}}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Student branch ────────────────────────────────────────────────────────
  const ListHeader = useCallback(
    () => (
      <View>
        {/* Hero greeting */}
        <View style={styles.heroBlock}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={[Type.bodySm, { color: TextColor.tertiary }]}>Welcome 👋</Text>
              <Text style={[Type.displayMd, { marginTop: 2 }]}>Hello, {displayName}!</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={{ fontSize: 28 }}>🏆</Text>
            </View>
          </View>
          <Text style={[Type.body, { color: TextColor.secondary, marginTop: Spacing.sm }]}>
            {isLoading
              ? "Finding the best competitions..."
              : `${allCompetitions.length} competitions available for you`}
          </Text>
        </View>

        {/* Recommended carousel */}
        {registrations.length > 0 && recommendations.length > 0 ? (
          <View style={{ marginTop: Spacing.xl }}>
            <SectionHeader
              title="✨ For You"
              subtitle="Based on your interests and history"
              marginTop={0}
            />
            <FlatList
              data={recommendations}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
              renderItem={({ item }) => <RecommendedCard item={item} onPress={goToReco} />}
            />
          </View>
        ) : null}

        {/* Category chips */}
        {categories.length > 0 ? (
          <View>
            <Text style={[Type.label, styles.filterLabel]}>CATEGORY</Text>
            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(c) => c}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item: cat }) => {
                const isActive = activeCategory === cat;
                const accent = CategoryAccent[cat] ?? Brand.primary;
                const bg = CategoryBg[cat] ?? Brand.primarySoft;
                return (
                  <Pressable
                    onPress={() => setActiveCategory((p) => (p === cat ? null : cat))}
                    style={({ pressed }) => [
                      styles.catChip,
                      isActive
                        ? { backgroundColor: accent }
                        : { backgroundColor: bg },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={{ fontSize: 16, marginRight: 6 }}>
                      {CategoryEmoji[cat] ?? "🏷️"}
                    </Text>
                    <Text
                      style={{
                        ...Type.label,
                        color: isActive ? "#FFFFFF" : accent,
                        fontSize: 13,
                      }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        ) : null}

        {/* Active filters */}
        {activeCategory ? (
          <View style={styles.activeFilters}>
            <Text style={[Type.label, { color: TextColor.secondary }]}>
              Kategori: {activeCategory}
            </Text>
            <Pressable
              onPress={() => setActiveCategory(null)}
              hitSlop={10}
            >
              <Text style={[Type.label, { color: Brand.error }]}>Clear filters</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [
      activeCategory,
      allCompetitions.length,
      categories,
      displayName,
      goToReco,
      isLoading,
      recommendations,
      registrations.length,
    ]
  );

  if (isError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          emoji="😕"
          title="Failed to load competitions"
          message="Check your internet connection and try again."
          ctaLabel="Try again"
          onCta={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar — kept OUTSIDE FlatList so it doesn't unmount on every keystroke */}
      <View style={styles.searchWrap}>
        <Text style={{ fontSize: 18, marginRight: Spacing.sm }}>🔍</Text>
        <TextInput
          placeholder="Search competitions, organizers, categories..."
          placeholderTextColor={TextColor.tertiary}
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10} style={styles.searchClear}>
            <Text style={{ color: TextColor.secondary, fontWeight: "700" }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={isLoading ? [] : filtered}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={renderSep}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: Spacing.xl }}>
              {[1, 2, 3, 4].map((k) => (
                <View key={k} style={{ marginBottom: Spacing.md }}>
                  <SkeletonCard />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              emoji="🔍"
              title="No matching competitions"
              message="Try changing the search keyword or filters."
            />
          )
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: Spacing.xl }}>
            <CompetitionCard
              item={item}
              isFavorited={favoritedIds.has(item.id)}
              onPress={goToDetail}
              onToggleFavorite={toggleFavorite}
            />
          </View>
        )}
      />
    </View>
  );
}

const renderSep = () => <View style={{ height: Spacing.md }} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Surface.background },
  listContent: { paddingBottom: Spacing["4xl"] },

  // Hero
  heroBlock: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.sm,
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: Surface.card,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    height: 52,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Surface.divider,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TextColor.primary,
    fontWeight: "500",
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Surface.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },

  // Filters
  filterLabel: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  chipRow: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  activeFilters: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },

  // Card
  cardEmojiRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  emojiTile: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.md,
  },
  gradeChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.divider,
  },
  viewBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primarySoft,
  },
  heartBtn: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Surface.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
    ...Shadow.sm,
  },

  // Recommended
  recoEmoji: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  // Skeleton
  skLine: { height: 14, backgroundColor: Surface.cardAlt, borderRadius: 6, width: "80%" },

  // Parent
  parentScroll: { paddingBottom: Spacing["4xl"] },
  parentHero: {
    backgroundColor: Brand.primary,
    borderRadius: Radius["3xl"],
    padding: Spacing["2xl"],
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.xl,
    ...Shadow.lg,
  },
  statRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Surface.card,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    ...Shadow.sm,
  },
  parentSlot: { paddingHorizontal: Spacing.xl },
  parentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
