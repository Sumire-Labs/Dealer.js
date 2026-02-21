# Dealer.js 開発ガイド

Discord カジノ BOT「Dealer.js」のコードベース規約・パターンをまとめた開発ドキュメント。
新機能追加や保守の際に参照すること。

---

## 1. アーキテクチャ・ディレクトリ構造

```
src/
├── index.ts                        # エントリポイント — モジュール動的ロード & 起動
├── client.ts                       # Discord クライアント初期化
│
├── commands/                       # スラッシュコマンド定義
│   ├── registry.ts                 #   コマンドレジストリ（Map<name, module>）
│   ├── admin/                      #   管理者コマンド
│   │   ├── give.command.ts
│   │   ├── reset.command.ts
│   │   └── setting.command.ts
│   ├── casino/                     #   ゲームコマンド
│   │   ├── blackjack.command.ts
│   │   ├── coinflip.command.ts
│   │   ├── daily.command.ts
│   │   ├── horse-race.command.ts
│   │   ├── poker.command.ts
│   │   └── slots.command.ts
│   └── economy/                    #   経済コマンド
│       ├── balance.command.ts
│       ├── bank.command.ts
│       └── leaderboard.command.ts
│
├── interactions/                   # ボタン・モーダルハンドラ
│   ├── handler.ts                  #   グローバルルーター（prefix → handler 振り分け）
│   ├── buttons/                    #   ボタンハンドラ
│   │   ├── balance.buttons.ts
│   │   ├── bank.buttons.ts
│   │   ├── blackjack.buttons.ts
│   │   ├── coinflip.buttons.ts
│   │   ├── horse-race.buttons.ts
│   │   ├── leaderboard.buttons.ts
│   │   ├── poker.buttons.ts
│   │   ├── setting.buttons.ts
│   │   └── slots.buttons.ts
│   └── modals/                     #   モーダルハンドラ
│       ├── bank.modal.ts
│       ├── bet-amount.modal.ts
│       ├── poker.modal.ts
│       └── setting.modal.ts
│
├── games/                          # ゲームロジック（Discord 非依存）
│   ├── interfaces/
│   │   ├── game.interface.ts       #   GameResult / GameSession 基底型
│   │   └── multiplayer.interface.ts
│   ├── blackjack/
│   │   ├── blackjack.engine.ts     #   ゲーム状態管理・アクション処理
│   │   ├── blackjack.deck.ts       #   シュー（4 デッキ）管理
│   │   ├── blackjack.hand.ts       #   ハンド評価
│   │   └── blackjack.strategy.ts   #   ディーラー AI
│   ├── coinflip/
│   │   └── coinflip.engine.ts
│   ├── horse-race/
│   │   ├── race.engine.ts          #   レースシミュレーション
│   │   ├── race.session.ts         #   セッション管理（マルチプレイヤー）
│   │   ├── race.betting.ts         #   ベット・配当計算
│   │   └── race.horses.ts          #   馬データ生成
│   ├── poker/
│   │   ├── poker.engine.ts         #   ゲームフロー・ベッティングラウンド
│   │   ├── poker.deck.ts           #   デッキ管理
│   │   ├── poker.hand.ts           #   ハンドランク評価
│   │   └── poker.session.ts        #   ロビー・ゲーム状態
│   └── slots/
│       ├── slots.engine.ts         #   スピンロジック
│       ├── slots.paytable.ts       #   配当テーブル
│       └── slots.symbols.ts        #   シンボル定義（重み付き）
│
├── database/                       # データ永続化層
│   ├── client.ts                   #   Prisma クライアント
│   ├── repositories/               #   データアクセス
│   │   ├── user.repository.ts
│   │   ├── transaction.repository.ts
│   │   ├── leaderboard.repository.ts
│   │   ├── loan.repository.ts
│   │   ├── race.repository.ts
│   │   └── setting.repository.ts
│   └── services/                   #   ビジネスロジック
│       ├── economy.service.ts      #   チップ加減算（トランザクション内）
│       ├── daily.service.ts        #   デイリーボーナス
│       └── loan.service.ts         #   ローン・返済・破産
│
├── ui/                             # Discord UI 構築
│   ├── builders/                   #   画面ビルダー
│   │   ├── base.builder.ts         #   共通ヘルパー（createHeader, createDivider 等）
│   │   ├── balance.builder.ts
│   │   ├── bank.builder.ts
│   │   ├── blackjack.builder.ts
│   │   ├── coinflip.builder.ts
│   │   ├── horse-race.builder.ts
│   │   ├── leaderboard.builder.ts
│   │   ├── poker.builder.ts
│   │   ├── setting.builder.ts
│   │   └── slots.builder.ts
│   ├── components/                 #   再利用可能 UI パーツ
│   │   ├── bet-selector.ts
│   │   ├── chip-display.ts
│   │   └── game-header.ts
│   ├── animations/                 #   アニメーション生成
│   │   ├── slots.animation.ts
│   │   └── race.animation.ts
│   └── themes/
│       └── casino.theme.ts         #   色・プレフィックス定義
│
├── config/                         # 設定・定数
│   ├── index.ts                    #   config.yaml 読み込み & export
│   ├── config.service.ts           #   ConfigService（DB > YAML > defaults 優先）
│   ├── constants.ts                #   ゲーム定数（ベット上限、クールダウン等）
│   ├── games.ts                    #   ゲーム固有設定（リール数、デッキ枚数等）
│   ├── defaults.ts                 #   デフォルト値（馬名等）
│   └── yaml-loader.ts             #   YAML パーサー
│
├── scheduler/
│   └── daily-reset.scheduler.ts    # 定期タスク（利息計算等）
│
└── utils/                          # ユーティリティ
    ├── random.ts                   #   crypto.randomInt ラッパー
    ├── formatters.ts               #   formatChips / formatTimeDelta
    ├── cooldown.ts                 #   コマンドクールダウン管理
    ├── error-handler.ts            #   エラー → ephemeral 返却
    └── logger.ts                   #   ロガー
```

---

## 2. 命名規則・ファイル分割ルール

### サフィックス一覧

| サフィックス | 配置先 | 役割 |
|---|---|---|
| `.command.ts` | `commands/` | スラッシュコマンド定義 + execute |
| `.buttons.ts` | `interactions/buttons/` | ボタンクリックハンドラ |
| `.modal.ts` | `interactions/modals/` | モーダル送信ハンドラ |
| `.engine.ts` | `games/<name>/` | ゲームコアロジック |
| `.deck.ts` | `games/<name>/` | カードデッキ管理 |
| `.hand.ts` | `games/<name>/` | ハンド評価 |
| `.session.ts` | `games/<name>/` | セッション状態管理 |
| `.strategy.ts` | `games/<name>/` | AI / 戦略ロジック |
| `.paytable.ts` | `games/<name>/` | 配当テーブル |
| `.symbols.ts` | `games/<name>/` | シンボル / エンティティ定義 |
| `.betting.ts` | `games/<name>/` | ベット計算 |
| `.horses.ts` | `games/<name>/` | ゲーム固有エンティティ |
| `.builder.ts` | `ui/builders/` | Discord UI ビルダー |
| `.animation.ts` | `ui/animations/` | アニメーション生成 |
| `.theme.ts` | `ui/themes/` | テーマ定義 |
| `.service.ts` | `database/services/` | ビジネスロジック |
| `.repository.ts` | `database/repositories/` | DB アクセス |
| `.interface.ts` | `games/interfaces/` | 型定義 |
| `.scheduler.ts` | `scheduler/` | 定期タスク |

### 「1ファイル1機能」原則

各ファイルは **単一の責務** を持つ。ゲーム1つを追加する場合でも、ロジック・UI・コマンド・インタラクションは別ファイルに分離する。

例: **Coinflip**（最小構成 = 4 ファイル）

```
coinflip.command.ts   → コマンド登録 & 初期実行
coinflip.engine.ts    → 勝敗判定ロジック
coinflip.buttons.ts   → 再プレイ・ベット変更ボタン
coinflip.builder.ts   → idle / flipping / result 画面構築
```

例: **Slots**（中規模 = 7 ファイル）— エンジンがシンボル・配当・スピンに分離

### モジュール登録パターン

各ファイルは **自己登録** する。import された時点で register 関数が呼ばれ、ハンドラ Map に登録される。

**コマンド登録** (`commands/registry.ts`):

```ts
// 定義側（slots.command.ts）
import { registerCommand } from '../registry.js';

const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('スロットマシン — リールを回して一攫千金！')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // ...
}

registerCommand({ data, execute });
```

**ボタンハンドラ登録** (`interactions/handler.ts`):

```ts
// 定義側（slots.buttons.ts）
import { registerButtonHandler } from '../handler.js';

async function handleSlotsButton(interaction: ButtonInteraction): Promise<void> {
  // ...
}

registerButtonHandler('slots', handleSlotsButton as never);
```

**モーダルハンドラ登録** も同様に `registerModalHandler(prefix, handler as never)` を使用。

### 動的ロード順序 (`src/index.ts`)

```ts
async function loadModules(): Promise<void> {
  // 1. Economy コマンド
  await import('./commands/economy/balance.command.js');
  await import('./commands/economy/leaderboard.command.js');
  await import('./commands/economy/bank.command.js');

  // 2. Casino コマンド
  await import('./commands/casino/daily.command.js');
  await import('./commands/casino/slots.command.js');
  await import('./commands/casino/coinflip.command.js');
  await import('./commands/casino/blackjack.command.js');
  await import('./commands/casino/horse-race.command.js');
  await import('./commands/casino/poker.command.js');

  // 3. ボタンハンドラ
  await import('./interactions/buttons/slots.buttons.js');
  await import('./interactions/buttons/coinflip.buttons.js');
  // ... 他のボタンハンドラ

  // 4. モーダルハンドラ
  await import('./interactions/modals/bet-amount.modal.js');
  // ... 他のモーダルハンドラ

  // 5. Admin コマンド & ボタン
  await import('./commands/admin/give.command.js');
  // ...
}
```

**起動フロー**: `configService.initialize()` → `loadModules()` → `startBot()` → `startScheduler()`

---

## 3. コーディング規約

### 通貨値は BigInt

全てのチップ金額に `bigint` を使用する。`number` は禁止。

```ts
// ✅ 正しい
const bet = 1_000n;
const chips: bigint = user.chips;

// ❌ 誤り
const bet = 1000;
```

定数も BigInt リテラルで定義:

```ts
export const MIN_BET = 100n;
export const MAX_BET_SLOTS = 50_000n;
```

表示には `formatChips()` を使用:

```ts
import { formatChips } from '../utils/formatters.js';

formatChips(1_000n);  // → "$1,000"
formatChips(-500n);   // → "-$500"
```

### Components V2

Embed ではなく **Components V2** を使用する。主要コンポーネント:

- `ContainerBuilder` — 最上位コンテナ（`setAccentColor` でサイドカラー指定）
- `TextDisplayBuilder` — テキスト表示（Markdown 対応）
- `SeparatorBuilder` — 区切り線
- `ActionRowBuilder` — ボタン行

```ts
const container = new ContainerBuilder()
  .setAccentColor(CasinoTheme.colors.gold)
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**結果**: 勝利！'),
  )
  .addSeparatorComponents(createDivider())
  .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(replayButton),
  );

await interaction.reply({
  components: [container],
  flags: MessageFlags.IsComponentsV2,
});
```

### customId 形式

`"prefix:action:userId:param"` — コロン区切り。先頭の prefix で handler にルーティングされる。

```ts
// ビルダー側で生成
`coinflip:heads:${userId}`
`blackjack:hit:${userId}`
`bank:loan:${userId}`
`racebet:${channelId}:${horseIndex}`

// ハンドラ側でパース
const parts = interaction.customId.split(':');
const action = parts[1];
const ownerId = parts[2];
```

### アクセス制御

customId に埋め込んだ `userId` でボタン操作者を照合する:

```ts
if (interaction.user.id !== ownerId) {
  await interaction.reply({
    content: 'これはあなたのゲームではありません！',
    flags: MessageFlags.Ephemeral,
  });
  return;
}
```

### セッション管理

ゲームセッションは `Map<string, T>` でインメモリ管理する。キーは `userId` または `channelId`。

```ts
export const slotsSessionManager = new Map<string, bigint>();

// セッション取得（デフォルト値付き）
function getSessionBet(userId: string): bigint {
  return slotsSessionManager.get(userId) ?? MIN_BET;
}
```

永続化が必要なデータ（レースセッション等）のみ Prisma に保存する。

### エラーハンドリング

`handler.ts` の `handleInteraction()` が全インタラクションを `try-catch` で包み、`handleInteractionError()` で ephemeral エラーメッセージを返す。個別ハンドラでは基本的に catch 不要。

```ts
// handler.ts（グローバルキャッチ）
try {
  // コマンド / ボタン / モーダル処理
} catch (error) {
  await handleInteractionError(interaction, error);
}
```

`handleInteractionError()` は replied/deferred 状態を自動判定し、`reply` または `followUp` で返却する。

### 乱数

`Math.random()` **禁止**。暗号学的に安全な `crypto.randomInt()` のラッパーを使用する。

```ts
import { secureRandomInt, weightedRandom, shuffleArray } from '../utils/random.js';

secureRandomInt(1, 6);                         // 1〜6 の整数
weightedRandom([{ value: 'A', weight: 70 }, { value: 'B', weight: 30 }]);
shuffleArray(deck);                            // Fisher-Yates シャッフル
```

### DB トランザクション

チップの増減は **必ず `prisma.$transaction` 内** で行い、残高更新と Transaction レコード作成をアトミックにする。

```ts
export async function addChips(
  userId: string, amount: bigint, type: TransactionType, game?: GameType,
): Promise<bigint> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { chips: { increment: amount } },
    });
    await tx.transaction.create({
      data: { userId, type, game: game ?? null, amount, balanceAfter: user.chips },
    });
    return user.chips;
  });
}
```

### import スタイル

- **ESM**（`"type": "module"` in package.json）
- **named export** を使用（default export 不使用）
- import パスに **`.js` 拡張子** を付ける

```ts
import { registerCommand } from '../registry.js';
import { formatChips } from '../utils/formatters.js';
import { CasinoTheme } from '../ui/themes/casino.theme.js';
```

### 型安全: `as never` パターン

ハンドラ登録時、型の不一致を `as never` で解消する。registry 側は `(interaction: never) => Promise<void>` で型を消去し、各ハンドラが具体的な型を使用する。

```ts
// registry 側
const buttonHandlers = new Map<string, (interaction: never) => Promise<void>>();

// 登録側
registerButtonHandler('coinflip', handleCoinflipButton as never);
```

### UI テーマ

色とプレフィックス文字列は `CasinoTheme` に集約する:

```ts
// casino.theme.ts
export const CasinoTheme = {
  colors: {
    gold: 0xFFD700,      // 勝利・ハイライト
    darkGreen: 0x1B5E20, // BJ・ポーカー
    purple: 0x7B1FA2,    // 競馬
    red: 0xD32F2F,       // 敗北・危険アクション
    silver: 0xC0C0C0,    // コインフリップ
    diamondBlue: 0x00BCD4,
  },
  prefixes: {
    slots: '🎰 ━━━ SLOTS ━━━ 🎰',
    blackjack: '🃏 ━━━ BLACKJACK ━━━ 🃏',
    coinflip: '🪙 ━━━ COIN FLIP ━━━ 🪙',
    race: '🏇 ━━━ 競馬 ━━━ 🏇',
    poker: '🃏 ━━━ POKER ━━━ 🃏',
    bank: '🏦 ━━━ BANK ━━━ 🏦',
    // ...
  },
} as const;
```

使用例:

```ts
const container = new ContainerBuilder()
  .setAccentColor(CasinoTheme.colors.gold);

new TextDisplayBuilder()
  .setContent(CasinoTheme.prefixes.slots);
```

### ユーザー向けテキスト

ユーザーに表示するテキストは全て **日本語** で記述する:

```ts
.setDescription('コイントス — 一か八かの勝負！')
content: 'チップが不足しています！'
content: 'これはあなたのゲームではありません！'
```

---

## 4. 新機能追加ガイド

新しいゲーム **「ルーレット」** を追加する場合の手順。

### チェックリスト

- [ ] **1. ゲームエンジン作成**

  `src/games/roulette/roulette.engine.ts` を作成。Discord に依存しない純粋なロジックを実装する。

  ```ts
  // 例: ベット種別・当選判定・配当計算
  export function spinRoulette(): number { /* 0-36 */ }
  export function evaluateBet(bet: RouletteBet, result: number): bigint { /* 配当 */ }
  ```

- [ ] **2. DB スキーマ更新**

  `prisma/schema.prisma` の `GameType` enum に `ROULETTE` を追加:

  ```prisma
  enum GameType {
    SLOTS
    BLACKJACK
    HORSE_RACE
    COINFLIP
    POKER
    ROULETTE    // ← 追加
  }
  ```

  ```bash
  npx prisma generate
  ```

- [ ] **3. UI ビルダー作成**

  `src/ui/builders/roulette.builder.ts` — 各画面を構築する関数を定義:

  - `buildRouletteIdleView()` — ベット選択画面
  - `buildRouletteSpinningView()` — スピン中アニメーション
  - `buildRouletteResultView()` — 結果表示

  `base.builder.ts` の `createHeader()`, `createDivider()` を活用すること。

- [ ] **4. テーマ追加**

  `src/ui/themes/casino.theme.ts` の `prefixes` に追加:

  ```ts
  roulette: '🎡 ━━━ ROULETTE ━━━ 🎡',
  ```

  必要に応じて `colors` にも追加。

- [ ] **5. コマンド作成**

  `src/commands/casino/roulette.command.ts`:

  ```ts
  import { registerCommand } from '../registry.js';

  const data = new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('ルーレット — 赤か黒か、運命を賭けろ！')
    .toJSON();

  async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // 残高チェック → ゲーム開始 → ビルダーで UI 返却
  }

  registerCommand({ data, execute });
  ```

- [ ] **6. ボタンハンドラ作成**

  `src/interactions/buttons/roulette.buttons.ts`:

  ```ts
  import { registerButtonHandler } from '../handler.js';

  async function handleRouletteButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const ownerId = parts[2];

    // アクセス制御
    if (interaction.user.id !== ownerId) { /* reject */ }

    // action に応じた処理
  }

  registerButtonHandler('roulette', handleRouletteButton as never);
  ```

- [ ] **7. 定数追加**

  `src/config/constants.ts`:

  ```ts
  export const MAX_BET_ROULETTE = 100_000n;
  ```

- [ ] **8. モジュール登録**

  `src/index.ts` の `loadModules()` に追加:

  ```ts
  // Casino コマンド
  await import('./commands/casino/roulette.command.js');

  // ボタンハンドラ
  await import('./interactions/buttons/roulette.buttons.js');
  ```

- [ ] **9. 型チェック**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **10. コマンドデプロイ**

  ```bash
  npm run deploy-commands
  ```

### ファイル構成まとめ

新ゲーム追加後に作成・変更されるファイル:

| 操作 | ファイル |
|---|---|
| **新規** | `src/games/roulette/roulette.engine.ts` |
| **新規** | `src/ui/builders/roulette.builder.ts` |
| **新規** | `src/commands/casino/roulette.command.ts` |
| **新規** | `src/interactions/buttons/roulette.buttons.ts` |
| **変更** | `prisma/schema.prisma` — GameType に追加 |
| **変更** | `src/ui/themes/casino.theme.ts` — prefix 追加 |
| **変更** | `src/config/constants.ts` — ベット上限追加 |
| **変更** | `src/index.ts` — import 追加 |
