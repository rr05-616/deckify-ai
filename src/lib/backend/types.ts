/**
 * Replaces `@/convex/_generated/dataModel`'s `Id<T>` type.
 *
 * Convex's `Id<"decks">` was a branded string; our REST backend's `_id`
 * fields are plain UUID strings, so this is the same shape with no runtime
 * behavior — it exists purely so `Id<"decks">` keeps type-checking in
 * DeckView.tsx / ShareView.tsx without changes to how they use it.
 */
export type Id<T extends string = string> = string & { __tableName?: T };

export interface AuthUser {
  _id: string;
  _creationTime: number;
  name?: string;
  image?: string;
  email?: string;
  emailVerificationTime?: number;
  isAnonymous?: boolean;
  role?: "admin" | "user" | "member";
  plan?: string;
  bio?: string;
  walletAddress?: string;
}
