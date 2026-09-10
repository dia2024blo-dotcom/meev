// MEEV — Frontend TypeScript contract types (docs/meev-api-contract.md).

export type MiniUser = {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  level: number;
  presence: string;
  nameColor: string;
  isBot: boolean;
  // v5 staff identity (badges next to names)
  role?: string;
  verified?: boolean;
  // v2 cosmetics
  avatarPhoto?: string | null;
  nameGradient?: string;
  frameKey?: string;
  badgeShop?: string;
  avatarAcc?: string;
  // v3 cosmetics
  coverKey?: string;
  profileEffect?: string;
  avatarAnim?: boolean;
  // v11: name-effect slot + level-999 legend cover photo
  nameFx?: string;
  coverPhoto?: string | null;
  // v4 Instagram-style note (thought bubble above the profile)
  note?: string | null;
};

export type PublicUser = MiniUser & {
  bio: string;
  city: string | null;
  interests: string[];
  xp: number;
  coins: number;
  role: string;
  isGuest: boolean;
  createdAt: string;
  lastActiveAt: string;
  email?: string;
  emailVerified?: boolean;
  privacy?: Record<string, string>;
  stats?: { followers: number; following: number; posts: number; friends: number };
  badges?: { key: string; earnedAt: string }[];
  // v2
  lang?: "ar" | "en" | "fr" | "es" | "tr" | "de";
  lastSpinAt?: string | null;
  // v4
  note?: string | null;
  twoFactorEnabled?: boolean;
  // v5
  verified?: boolean;
  customStatus?: string | null;
  nameChangedAt?: string | null;
  interestsChangedAt?: string | null;
};

export type Reaction = { emoji: string; users: MiniUser[] };

export type MessageDTO = {
  id: string;
  scope: "dm" | "server";
  conversationId: string | null;
  channelId: string | null;
  author: MiniUser;
  content: string;
  kind: "text" | "sticker" | "gift" | "system" | "poll" | "voice" | "game" | "story_react" | "post_share";
  attachmentUrl: string | null;
  meta: {
    question?: string;
    options?: string[];
    giftKey?: string;
    note?: string;
    mood?: string;
    stickerKey?: string;
    stickerEmoji?: string; // v2: emoji sticker
    // v6: story reaction / reply (Instagram-style DM card)
    story?: { id: string; kind: string; gradient: string; content: string; imageUrl: string | null };
    reply?: boolean;
    // v13: shared post card (Facebook-style "send post to a friend")
    post?: {
      id: string;
      kind: string;
      content: string;
      imageUrl: string | null;
      author: {
        id: string;
        username: string;
        displayName: string;
        avatarSeed: string;
        avatarPhoto?: string | null;
        level?: number;
      };
    };
    // v2 RPS duel
    game?: "rps";
    rps?: {
      challengerId: string;
      challengerMove: string;
      opponentMove?: string;
      status: "awaiting" | "done";
      result?: "win" | "lose" | "draw";
      winnerId?: string;
    };
  } | null;
  createdAt: string;
  reactions: Reaction[];
};

export type ReactionKind = "like" | "love" | "care" | "laugh" | "wow" | "sad" | "angry";
export type ReactionCounts = { like: number; love: number; care: number; laugh: number; wow: number; sad: number; angry: number };

export type PostDTO = {
  id: string;
  content: string;
  imageUrl: string | null;
  kind: "text" | "image";
  createdAt: string;
  author: MiniUser;
  likeCount: number; // legacy = total reactions
  commentCount: number;
  likedByMe: boolean; // legacy = any reaction present
  // v13: Facebook-style reactions
  reactions: ReactionCounts;
  myReaction: ReactionKind | null;
  // v13 feed: do I follow the author? (follow chip in post headers)
  authorFollowedByMe?: boolean;
};

export type CommentDTO = { id: string; content: string; createdAt: string; author: MiniUser };

export type StoryDTO = {
  id: string;
  kind: "text" | "image";
  content: string;
  gradient: string;
  imageUrl: string | null;
  createdAt: string;
  // v8: when the 24h window ends (drives the live countdown in the viewer)
  expiresAt: string;
  viewedByMe: boolean;
  // v6: how many people watched it (own stories only)
  viewerCount?: number;
};

export type StoryGroup = { author: MiniUser; stories: StoryDTO[] };

// v6: one entry of a story's viewers list ("vu" — Instagram-style)
export type StoryViewerEntry = { user: MiniUser; viewedAt: string };

export type GiftCatalogItem = {
  key: string;
  name: string;
  description: string;
  price: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  mood: string;
  xpReward: number;
};

export type GiftDTO = {
  id: string;
  giftKey: string;
  gift: GiftCatalogItem;
  note: string;
  coins: number;
  contextType: string;
  createdAt: string;
  sender: MiniUser;
  recipient: MiniUser;
};

export type NotificationDTO = {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export type Conversation = {
  id: string;
  partner: MiniUser;
  lastMessage: { content: string; kind: string; authorId: string; createdAt: string } | null;
  updatedAt: string;
  // v3 streak flame + chat settings
  streakDays?: number;
  themeKey?: string;
  muted?: boolean;
  // v6 Instagram-style read receipts ("vu")
  myReadAt?: string | null;
  partnerReadAt?: string | null;
};

export type ServerDTO = {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  accentColor: string;
  isOfficial: boolean;
  memberCount: number;
  myRole: string | null;
  channels: ChannelDTO[];
};

export type ChannelDTO = { id: string; name: string; topic: string; kind: string; position: number };

export type ServerMember = { user: MiniUser; role: string };

export type SuggestedUser = PublicUser & { score: number; mutualCount: number; sharedInterests: string[] };

export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  devOtp?: { code: string; purpose: string; expiresAt: string };
};

export type SessionInfo = {
  id: string;
  device: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type GameXO = {
  board: (string | null)[];
  turn: "x" | "o";
  status: "active" | "finished" | "abandoned";
  winner: string | null;
  players?: { x: string; o: string };
};

export type MatchMessage = {
  id: string;
  author: MiniUser;
  content: string;
  kind: string;
  createdAt: string;
};

export type XpMe = {
  xp: number;
  level: number;
  progress: {
    level: number;
    intoLevel: number;
    needed: number;
    percent: number;
    isMax: boolean;
  };
  unlocks: { level: number; title: string; desc: string }[];
  nextUnlock?: { level: number; title: string; desc: string };
  pointsLog: { amount: number; reason: string; createdAt: string }[];
};

// ------------------------- v2: shop, support, spin -------------------------

export type ShopItemDTO = {
  key: string;
  // v3: full shop type union (matches ShopType in constants)
  type: "name_gradient" | "name_color" | "name_effect" | "frame" | "badge" | "accessory" | "profile_effect" | "cover" | "animated_avatar";
  name: string;
  description: string;
  price: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  payload: Record<string, unknown>;
  levelRequired: number;
  xpReward: number;
  owned: boolean;
  equipped: boolean;
};

export type SupportTicketDTO = {
  id: string;
  subject: string;
  category: string;
  message: string;
  /** v19: instant bot ack — shown until a human staff reply lands */
  autoReply: string;
  /** v19: the HUMAN reply from the desk (empty while awaiting one) */
  reply: string;
  status: "open" | "answered";
  createdAt: string;
  repliedAt: string | null;
};

export type SpinResult = {
  prizeIndex: number;
  prize: { coins: number; label: string; labelAr: string };
  coinsLeft: number;
  leveledUp: boolean;
  nextSpinAt: string;
};
