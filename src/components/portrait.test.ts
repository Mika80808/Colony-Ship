import assert from 'node:assert/strict';
import { resolvePortrait } from './DialogueSection';
import { INITIAL_NPCS } from '../data/initialGameData';
import { loadBuiltinStory } from '../data/story';
import { NPCData } from '../types';

/**
 * 頭像挑圖的退路。
 *
 * 這條鏈在畫面上壞掉時是「安靜地」壞 —— 頭像框空著或破圖，沒有錯誤訊息，
 * 而且要等 GM 剛好標到那個表情才看得到。所以改用查表而非拼路徑，並在這裡
 * 把每一段退路釘住。
 */

const lucian = INITIAL_NPCS.find((npc) => npc.id === 'lucian') as NPCData;

assert.equal(
  resolvePortrait(lucian, 'happy'),
  '/assets/lucian/happy.webp',
  '有對應表情圖時應使用表情圖'
);
assert.equal(
  resolvePortrait(lucian, undefined),
  lucian.portraitUrl,
  '敘述段落沒有表情，應退回預設頭像'
);
assert.equal(
  resolvePortrait(lucian, 'thinking'),
  lucian.portraitUrl,
  'thinking 目前沒有素材，應退回預設頭像而不是拼出不存在的路徑'
);
assert.equal(resolvePortrait(undefined, 'happy'), undefined, '不在場的角色沒有頭像');

const noArt: NPCData = { ...lucian, portraitUrl: undefined, expressionUrls: undefined };
assert.equal(resolvePortrait(noArt, 'happy'), undefined, '完全沒有素材時應回 undefined，交給佔位圖示');

// 預設頭像必須也是表情組的一員，否則對白一開始頭像就會從一種畫風跳到另一種。
assert.ok(
  Object.values(lucian.expressionUrls ?? {}).includes(lucian.portraitUrl as string),
  '預設頭像應取自表情組'
);

// --- 存檔不該把素材路徑凍結住 ---
// 實際踩到過：改了 initialGameData 之後畫面仍載入舊圖，因為 NPC 連同圖檔路徑
// 一起存進了 localStorage。舊路徑還在、圖也載得出來，所以完全沒有徵兆。

// 內建內容存在 localStorage 裡，載入時圖檔欄位要換回程式碼版本。
const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};
memory.set('starport_builtin_story', JSON.stringify({
  npcs: [{
    ...lucian,
    name: '路西恩（改過）',
    portraitUrl: '/assets/lucian/portrait.png',
    fullBodyUrl: '/assets/lucian/profile.png',
    expressionUrls: undefined,
  }],
  items: [], chapters: [], sectors: [],
}));
const restored = loadBuiltinStory().npcs.find((npc) => npc.id === 'lucian') as NPCData;

assert.equal(restored.portraitUrl, lucian.portraitUrl, '存下來的頭像路徑應被程式碼版本覆蓋');
assert.equal(restored.fullBodyUrl, lucian.fullBodyUrl, '存下來的立繪路徑應被程式碼版本覆蓋');
assert.deepEqual(restored.expressionUrls, lucian.expressionUrls, '存下來沒有表情圖時應補上');
assert.equal(restored.name, '路西恩（改過）', '圖檔以外的內容以存下來的為準');

memory.clear();
assert.deepEqual(JSON.parse(JSON.stringify(loadBuiltinStory().npcs)), JSON.parse(JSON.stringify(INITIAL_NPCS)), '第一次啟動時使用程式碼裡的種子');

// --- 素材路徑必須指到真的檔案 ---
// 少一張圖在畫面上是安靜地壞：破圖或空框，要等剛好走到那個畫面才看得到。
{
  const { existsSync, readFileSync, readdirSync } = await import('node:fs');
  const expressions = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy'] as const;
  for (const npc of INITIAL_NPCS.filter((entry) => entry.source === 'builtin')) {
    assert.deepEqual(Object.keys(npc.expressionUrls ?? {}).sort(), [...expressions].sort(), `${npc.name} 應有六個表情鍵`);
    assert.equal(npc.portraitUrl, npc.expressionUrls?.neutral, `${npc.name} 的預設頭像應為 neutral`);
    // 不先 filter(Boolean)：缺少整個欄位也必須被檢出。
    const assets = [
      [npc.portraitUrl, [514, 514]], [npc.fullBodyUrl, [540, 960]],
      [npc.cardUrl, [512, 512]], [npc.walkUrl, [688, 688]],
      ...Object.values(npc.expressionUrls ?? {}).map((url) => [url, [514, 514]] as const),
    ] as const;
    assert.ok(readdirSync('public/assets').includes(npc.id), `${npc.name} 的目錄必須使用小寫 id`);
    for (const [url, size] of assets) {
      assert.ok(url, `${npc.name} 缺少素材路徑`);
      assert.ok(url.startsWith(`/assets/${npc.id}/`), `${npc.name} 的素材應位於自己的小寫目錄`);
      assert.ok(existsSync(`public${url}`), `${npc.name} 的素材 ${url} 不存在`);
      assert.ok(readdirSync(`public/assets/${npc.id}`).includes(url.split('/').at(-1)!), `${url} 檔名大小寫不符`);
      const bytes = readFileSync(`public${url}`);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${url} 應為 WebP`);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${url} 應為 WebP`);
      // 有 Photoshop / ICC metadata 的 WebP 會先有 VP8X，逐段尋找 VP8L。
      let losslessOffset: number | undefined;
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const length = bytes.readUInt32LE(offset + 4);
        if (bytes.toString('ascii', offset, offset + 4) === 'VP8L') {
          losslessOffset = offset;
          break;
        }
        offset += 8 + length + (length % 2);
      }
      assert.ok(losslessOffset !== undefined, `${url} 應為無損 WebP`);
      const bits = bytes.readUInt32LE(losslessOffset + 9);
      assert.deepEqual([(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1], size, `${url} 尺寸不符`);
    }
  }
}

console.log('components/portrait: 全部通過');
