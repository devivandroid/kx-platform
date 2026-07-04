import { isAddress } from "ethers";
import { seededRatings, type RatingSummary, type ResourceRating } from "@/lib/ratings";
import { isPostgresEnabled, pgQuery } from "@/lib/server/postgres";

const globalForRatings = globalThis as typeof globalThis & {
  knowledgeExchangeServerRatings?: ResourceRating[];
};

let ratingsSeededPromise: Promise<void> | null = null;

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function clampRating(rating: number): number {
  return Math.min(5, Math.max(1, Math.round(rating)));
}

function getMemoryRatings(): ResourceRating[] {
  globalForRatings.knowledgeExchangeServerRatings ??= [...seededRatings];
  return globalForRatings.knowledgeExchangeServerRatings;
}

async function ensureDbRatingsSeeded() {
  if (!isPostgresEnabled()) return;

  ratingsSeededPromise ??= (async () => {
    for (const rating of seededRatings) {
      await pgQuery(
        `
          INSERT INTO resource_ratings (
            resource_id,
            wallet_address,
            rating,
            data,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz)
          ON CONFLICT (resource_id, wallet_address) DO NOTHING
        `,
        [
          rating.resourceId,
          normalizeAddress(rating.walletAddress),
          clampRating(rating.rating),
          JSON.stringify({ ...rating, walletAddress: normalizeAddress(rating.walletAddress) }),
          rating.createdAt,
          rating.updatedAt ?? null
        ]
      );
    }
  })();

  await ratingsSeededPromise;
}

function summarize(ratings: ResourceRating[]): RatingSummary {
  if (!ratings.length) return { average: 0, count: 0 };

  const total = ratings.reduce((sum, rating) => sum + rating.rating, 0);
  return {
    average: Number((total / ratings.length).toFixed(1)),
    count: ratings.length
  };
}

export async function getResourceRatingsAsync(resourceId: string): Promise<ResourceRating[]> {
  if (!isPostgresEnabled()) {
    return getMemoryRatings().filter((rating) => rating.resourceId === resourceId);
  }

  await ensureDbRatingsSeeded();
  const rows = await pgQuery<{ data: ResourceRating }>(
    `
      SELECT data
      FROM resource_ratings
      WHERE resource_id = $1
      ORDER BY COALESCE(updated_at, created_at) DESC
    `,
    [resourceId]
  );
  return rows.length > 0
    ? rows.map((row) => row.data)
    : getMemoryRatings().filter((rating) => rating.resourceId === resourceId);
}

export async function getResourceRatingSummaryAsync(resourceId: string): Promise<RatingSummary> {
  return summarize(await getResourceRatingsAsync(resourceId));
}

export async function getUserResourceRatingAsync({
  resourceId,
  walletAddress
}: {
  resourceId: string;
  walletAddress?: string | null;
}): Promise<ResourceRating | null> {
  if (!walletAddress || !isAddress(walletAddress)) return null;

  const normalizedAddress = normalizeAddress(walletAddress);

  if (!isPostgresEnabled()) {
    return (
      getMemoryRatings().find(
        (rating) =>
          rating.resourceId === resourceId &&
          normalizeAddress(rating.walletAddress) === normalizedAddress
      ) ?? null
    );
  }

  await ensureDbRatingsSeeded();
  const rows = await pgQuery<{ data: ResourceRating }>(
    `
      SELECT data
      FROM resource_ratings
      WHERE resource_id = $1 AND wallet_address = $2
      LIMIT 1
    `,
    [resourceId, normalizedAddress]
  );
  return rows[0]?.data ?? (
    getMemoryRatings().find(
      (rating) =>
        rating.resourceId === resourceId &&
        normalizeAddress(rating.walletAddress) === normalizedAddress
    ) ?? null
  );
}

export async function saveResourceRatingAsync({
  resourceId,
  walletAddress,
  rating
}: {
  resourceId: string;
  walletAddress: string;
  rating: number;
}): Promise<ResourceRating> {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address.");
  }

  const normalizedAddress = normalizeAddress(walletAddress);
  const normalizedRating = clampRating(rating);
  const existing = await getUserResourceRatingAsync({ resourceId, walletAddress: normalizedAddress });
  const now = new Date().toISOString();
  const nextRating: ResourceRating = {
    resourceId,
    walletAddress: normalizedAddress,
    rating: normalizedRating,
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing ? now : undefined
  };

  if (!isPostgresEnabled()) {
    const ratings = getMemoryRatings().filter(
      (item) =>
        !(
          item.resourceId === resourceId &&
          normalizeAddress(item.walletAddress) === normalizedAddress
        )
    );
    ratings.push(nextRating);
    globalForRatings.knowledgeExchangeServerRatings = ratings;
    return nextRating;
  }

  const ratings = getMemoryRatings().filter(
    (item) =>
      !(
        item.resourceId === resourceId &&
        normalizeAddress(item.walletAddress) === normalizedAddress
      )
  );
  ratings.push(nextRating);
  globalForRatings.knowledgeExchangeServerRatings = ratings;

  await ensureDbRatingsSeeded();
  await pgQuery(
    `
      INSERT INTO resource_ratings (
        resource_id,
        wallet_address,
        rating,
        data,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz)
      ON CONFLICT (resource_id, wallet_address) DO UPDATE SET
        rating = EXCLUDED.rating,
        data = EXCLUDED.data,
        updated_at = NOW()
    `,
    [
      resourceId,
      normalizedAddress,
      normalizedRating,
      JSON.stringify(nextRating),
      nextRating.createdAt,
      nextRating.updatedAt ?? null
    ]
  );

  return nextRating;
}
