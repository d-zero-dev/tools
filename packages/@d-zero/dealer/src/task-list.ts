import { from } from './from.js';
import { pipe } from './pipe.js';

/**
 * 型安全な逐次パイプライン・ビルダーのエントリポイント。
 * `.pipe()` で連結するたびに前段の出力型 `T` を受け取り `R` へ変換する新しい
 * ステップが追加され、`.run()` を呼ぶと `Lanes` を使ったタスクリストTUIが
 * 自動的に生成され、先頭から逐次実行される。
 * @example
 * ```ts
 * import { TaskList } from '@d-zero/dealer';
 *
 * const result = await TaskList.pipe('fetch', () => fetchUser(userId))
 *   .pipe('normalize', (user) => normalizeUser(user))
 *   .pipe('save', async (user, ctx) => {
 *     ctx.progress('writing to db...');
 *     await db.save(user);
 *     return user.id;
 *   })
 *   .run();
 * ```
 */
export const TaskList = { pipe, from } as const;
