# Pixel MMORPG Tycoon

Браузерний 2D pixel-art симулятор створення власної MMORPG.
Стек: **React 18 · TypeScript · Phaser 3 · Vite · Zustand · IndexedDB**.

![Editor](docs/editor.png)

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit-тести (vitest)
npm run build      # production-збірка в dist/
```

## Статус: PHASE 1 — FOUNDATION ✅

| Система | Що працює |
|---|---|
| Головне меню | Continue, Create New World, My Worlds, Load World, Settings; анімований фон зі згенерованого світу |
| Створення світу | Назва, розмір (пресети 48–256 або custom 16–512), 7 типів світу, складність, стартове золото, seed, к-сть NPC/гравців; живе прев'ю карти + склад місцевості |
| Карта | Phaser tilemap 32×32, 8 типів місцевості × 4 варіанти, процедурний pixel-art тайлсет, анімація води та лави |
| Редактор тайлів | Brush (1–15, квадрат/коло, без розривів при швидкому русі), Fill, Rectangle (заливка/контур), Picker; Undo/Redo (200 кроків); зміна розміру карти з якорем; регенерація |
| Камера | WASD/стрілки (Shift = швидше), drag правою/середньою кнопкою або Space+ЛКМ, плавний zoom колесом до курсора (20–400%), Fit, мінікарта з кліком/перетягуванням |
| Симуляція (основа) | Fixed-timestep рушій (10 тіків/с), Play/Pause, x1/x2/x4, ігровий час, день/ніч з освітленням |
| Збереження | IndexedDB; Autosave + 3 ручні слоти; автозбереження за інтервалом; Ctrl+S; експорт/імпорт JSON з валідацією; rename/duplicate/delete; попередження при закритті вкладки |
| UI | Верхня панель, вкладки, ліва (інструменти/місцевість), права (мінікарта, інспектор, статистика карти), нижня (журнал з фільтрами) |

Вкладки та секції наступних фаз показані **заблокованими з позначкою фази** — вони не вдають, що працюють.
Лічильник гравців у верхній панелі чесно показує 0 до Phase 4.

## Архітектура

```
src/
  core/          EventBus, ID-генератор, seeded RNG, noise — без залежностей
  data/          Реєстри: terrain (id, палітра, walkable, moveCost), пресети світів
  models/        TileGrid (Uint8Array + RLE), типи збережень WorldSave/WorldMeta
  simulation/    WorldRuntime (живий стан світу), SimulationEngine (fixed timestep),
                 systems/ClockSystem, time (день/ніч)
  systems/
    editor/      TerrainPainter (штрихи, fill, rect), History (команди undo/redo), shapes
    generation/  WorldGenerator (elevation/moisture noise), createWorld
  persistence/   db (IndexedDB), WorldRepository (слоти), serializer (JSON, валідація, міграції)
  session/       GameSession — з'єднує runtime + engine + history + save; sessionActions
  game/          Phaser: WorldScene (рендер + ввід), CameraController, TilesetPainter
  stores/        Zustand: session, editor, settings (persist), log, toast, dialog
  ui/            screens/ (меню), editor/ (панелі редактора), components/, hooks/
tests/           TileGrid/RLE, інструменти, undo, рушій, IndexedDB, JSON
```

Потік даних:

```
React UI ──(Zustand: інструмент, налаштування)──► WorldScene (Phaser)
   ▲                                                  │ pointer → TerrainPainter
   │ події (tiles:changed, map:replaced)              ▼
   └──────────────── WorldRuntime ◄── SimulationEngine (fixed tick, власний rAF)
                          │
                    WorldRepository (IndexedDB) / JSON
```

Ключові правила:
- **Симуляція не залежить від React і Phaser** — вона змінює лише `WorldRuntime`. Рушій працює з фіксованим кроком; швидкість x2/x4 збільшує кількість тіків, а не їхній розмір (детермінізм).
- **Великі дані не живуть у React-стані**: сітка тайлів — `Uint8Array` у `WorldRuntime`; Phaser і мінікарта оновлюються інкрементально лише для змінених тайлів.
- **Усі сутності мають унікальні ID** (`core/ids.ts`).
- **Збереження версіоновані** (`schemaVersion` + `migrate()`), RLE-стиснення карти.

## Продуктивність (вже закладено)

- Tilemap rendering з culling; 1px-екструзія тайлсету (без швів при дробовому zoom).
- Grid малюється лише для видимої області.
- Анімація води/лави — перемальовування двох рядків тайлсету, а не тайлів карти.
- Fixed timestep з обмеженням тіків на кадр; `interval` у системах для розподілу важкої роботи.
- Phaser вантажиться ліниво (окремий chunk) — меню стартує швидко.

## Підготовка до PHASE 2 — WORLD BUILDING

Точки розширення вже на місці:
1. **Об'єкти/будівлі** → новий шар `entities` у `WorldSave` (+ `schemaVersion: 2` і міграція), реєстр `data/objects.ts` за зразком `terrain.ts`, команда `PlaceObjectCommand` у `History`.
2. **Регіони та spawn-точки** → прямокутники/полігони в моделі, інструмент вибору ділянки поверх `normalizeRect`.
3. **NPC / монстри** → `SimulationSystem` з `interval`, спрайти з object pooling у `WorldScene`, `moveCost`/`walkable` з `terrain.ts` для A*-пошуку шляху.
4. Розблокувати вкладки NPC/Creatures у `TabBar` і секції в `LeftPanel`.
