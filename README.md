# Pixel MMORPG Tycoon

Браузерний 2D pixel-art симулятор створення власної MMORPG.
Стек: **React 18 · TypeScript · Phaser 3 · Vite · Zustand · IndexedDB**.

![Town](pixel-mmorpg-tycoon/docs/phase2-town.png)

## Запуск

```bash
cd pixel-mmorpg-tycoon
npm install
npm run dev        # http://localhost:5173
npm test           # unit-тести (vitest)
npm run build      # production-збірка в dist/
```

## Фази

| Фаза | Зміст | Статус |
|---|---|---|
| 1. Foundation | меню, карта, редактор тайлів, камера, збереження | ✅ |
| 2. World Building | об'єкти, будівлі, регіони, NPC, монстри, спавни | ✅ |
| 3. RPG Systems | предмети, інвентар, економіка, торговці, квести, прокачка | далі |
| 4. Simulation | віртуальні гравці, Utility AI, бої, квести, торгівля | |
| 5. Management | аналітика, події, налаштування світу | |
| 6. Polish | оптимізація, анімації, звуки, ефекти, тести | |

## PHASE 2 — WORLD BUILDING ✅

| Система | Що працює |
|---|---|
| Об'єкти | 35 типів: дерева, каміння, кущі, будинки, магазин, кузня, таверна, храм, банк, вежа, стіни, дороги, мости, декор, портали, входи в підземелля й печери. Процедурний pixel-art в одному атласі |
| Розміщення | Прев'ю-привид (червоний = не можна), малювання протягуванням для 1×1, перевірка перекриттів і води/лави; мости роблять воду прохідною |
| Виділення | Select (V): клік, Shift+клік, рамка; перетягування = переміщення; Ctrl+C / Ctrl+V (у курсор) / Ctrl+D; Delete; Erase (E); усе з undo |
| Регіони | Village, Town, City, Forest, Dungeon, Cave, Wilderness, Safe Zone з рівнями. Кнопка **Populate** генерує село, місто, мегаполіс зі стінами, ліс з вовками, підземелля зі скелетами й босом, печеру з павуками; скасовується одним Ctrl+Z |
| Spawn points | Точки появи гравців (для Phase 4) |
| NPC | 9 типів; редактор: ім'я, рівень, HP, позиція, швидкість, поведінка Stationary/Wander/Patrol з waypoints, робочі години, радіус, інвентар, магазин; таблиця з пошуком і фільтрами |
| Поведінка NPC | Ходять по A*, поза робочими годинами йдуть додому відпочивати (Zz), охоронці патрулюють і атакують монстрів, мирні NPC тікають, гинуть і відроджуються |
| Монстри | 9 типів (Slime, Goblin, Wolf, Skeleton, Orc, Spider, Zombie, Dragon, Boss), бестіарій з усіма параметрами й loot table, зони спавну з лімітом, респавн, агресія Passive/Defensive/Aggressive, переслідування з поверненням додому |
| Стартовий контент | Новий світ отримує поселення з **точною кількістю NPC із налаштувань**, ліс з вовками і табір гоблінів |
| Бої | Шкода, захист, кулдаун, плаваючі числа шкоди та XP, HP-бари, журнал вбивств |

Технічно: `EntityStore` (усі сутності + undo), `ObjectIndex`, `NavGrid` + `Pathfinder` (A* з бінарною купою й лімітом вузлів), `SpatialHash` для пошуку цілей, `ActorManager` + `NpcSystem`/`CreatureSystem` на фіксованому кроці, пул спрайтів і y-сортування в `EntityRenderer`. Збереження: схема v2 з автоматичною міграцією світів Phase 1.

## PHASE 1 — FOUNDATION ✅

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

## Підготовка до PHASE 3 — RPG SYSTEMS

- Інвентар NPC, асортимент магазинів і loot table зараз зберігають **назви** предметів; Phase 3 додасть базу предметів і замінить назви на посилання (з міграцією збережень).
- Бойові характеристики NPC зараз виводяться з рівня (`npcCombatStats`); Phase 3 замінить їх на атрибути, класи й спорядження.
- Скарбниця світу (`startingGold`) стане балансом економіки.
