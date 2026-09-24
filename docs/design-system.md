# Confluence Design System (v2.1)

A precision-engineered design system for Confluence, built on restrained typography, disciplined 4px spacing, tonal depth, hairline borders, and purposeful motion.

---

## 1. Design Philosophy

- **Precision over decoration**: Every pixel value derives from tokens. No arbitrary spacing, radii, or colors.
- **Tonal depth over shadow**: Hierarchy comes from surface steps, hairline borders, and light rather than heavy drop shadows.
- **One accent, used with intent**: Indigo (`--accent`) signals primary user action and focus. Violet (`--ai`) signals AI identity. Live cyan (`--ai-live`) indicates active streaming or listening.
- **Content is the hero**: App chrome recedes into the background; conversation timelines dominate with clean document surfaces.
- **Motion explains**: Animation illustrates state changes (a message arrives, AI joins, a mode toggles). Ambient motion is restricted to hero lighting.
- **Trust as a feature**: Clear visual indicators for conversation boundaries, room membership, and AI listening posture.

---

## 2. Color System & Contrast Calibration

All colors are exposed as CSS custom properties in `src/styles/tokens.css` and mapped into Tailwind CSS theme variables. Both dark and light themes are independently designed with 100% WCAG 2.2 AA programmatic contrast verification (54/54 test pairs passing).

### 2.1 Dark Palette (Primary Identity)

| Token | Value | Primary Role |
| :--- | :--- | :--- |
| `--bg-page` | `#06070A` | App shell and page background |
| `--bg-elevated` | `#0A0C10` | Sidebar, navigation headers |
| `--surface` | `#0E1116` | Cards, panels |
| `--surface-elevated` | `#13171D` | Popovers, raised cards, AI message surfaces |
| `--surface-hover` | `#171C23` | Interactive row and button hover state |
| `--surface-active` | `#1C222B` | Pressed/selected rows |
| `--surface-input` | `#0B0E12` | Inputs, composer text areas |
| `--surface-modal` | `#12161C` | Dialogs and command palette |
| `--border-subtle` | `rgba(255, 255, 255, 0.06)` | Dividers, subtle card boundaries |
| `--border` | `rgba(255, 255, 255, 0.10)` | Input borders, controls |
| `--border-strong` | `rgba(255, 255, 255, 0.16)` | Active borders, hover outlines |
| `--text-primary` | `#F3F5F8` | Headings, message bodies, high-contrast text |
| `--text-secondary` | `#B4BBC6` | Body text, descriptions, secondary items |
| `--text-muted` | `#7C8593` | Metadata, timestamps, placeholders |
| `--text-disabled` | `#4F5762` | Disabled states |
| `--accent` | `#5457EC` | Primary interactive fill (white text $\ge$ 5:1) |
| `--accent-hover` | `#6467F2` | Primary interactive hover |
| `--accent-active` | `#4649D6` | Primary interactive pressed |
| `--accent-text` | `#A5A8FF` | Accent text/icons on dark surfaces ($\ge$ 7:1) |
| `--accent-subtle` | `rgba(84, 87, 236, 0.14)` | Selected row wash, focus halos |
| `--ai` | `#A78BFA` | AI identity: avatar rings, mode chips, message left rules |
| `--ai-subtle` | `rgba(167, 139, 250, 0.12)` | AI message surface washes, mention badges |
| `--ai-live` | `#22D3EE` | Active AI streaming / listening indicator dot |
| `--success` | `#34D399` | Online presence, verified status |
| `--warning` | `#FBBF24` | Safety warnings, network degradation |
| `--error` | `#F87171` | Validation errors, destructive actions |
| `--info` | `#60A5FA` | Information notices |
| `--focus-ring` | `#8B8EFF` | 2px focus ring with 2px offset |

### 2.2 Light Palette

| Token | Value | Primary Role |
| :--- | :--- | :--- |
| `--bg-page` | `#F7F8FA` | App and page background |
| `--bg-elevated` | `#FFFFFF` | Navigation and sidebar |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--surface-elevated` | `#FFFFFF` | Raised surfaces (with border & shadow-2) |
| `--surface-hover` | `#F1F3F6` | Hover state |
| `--surface-active` | `#E9ECF1` | Selected state |
| `--surface-input` | `#FFFFFF` | Input fields |
| `--surface-modal` | `#FFFFFF` | Dialogs and popups |
| `--border-subtle` | `rgba(12, 16, 24, 0.07)` | Subtle hairlines |
| `--border` | `rgba(12, 16, 24, 0.12)` | Standard boundaries |
| `--border-strong` | `rgba(12, 16, 24, 0.20)` | Focused/hover borders |
| `--text-primary` | `#0D1117` | High contrast headings & text |
| `--text-secondary` | `#3E4756` | Descriptions and body |
| `--text-muted` | `#66707F` | Metadata and timestamps |
| `--accent` | `#4F46E5` | Primary action button |
| `--accent-hover` | `#4338CA` | Action hover |
| `--accent-text` | `#4338CA` | Accent text on light |
| `--accent-subtle` | `rgba(79, 70, 229, 0.08)` | Selected row wash |
| `--ai` | `#7C3AED` | AI identity on light |
| `--ai-subtle` | `rgba(124, 58, 237, 0.07)` | AI message wash |
| `--ai-live` | `#0891B2` | Streaming live signal |
| `--success` | `#059669` | Success state |
| `--warning` | `#B45309` | Warning notice |
| `--error` | `#DC2626` | Destructive / error state |

---

## 3. Spacing & Radius Tokens

### 3.1 4px Spacing Scale

Tokens: `--space-0` (0px), `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px), `--space-10` (40px), `--space-12` (48px), `--space-16` (64px), `--space-20` (80px), `--space-24` (96px).

- **App Shell**: Sidebar width `280px` (or `64px` collapsed), header height `56px`.
- **Chat Column**: Message container max width `760px`, aligned with composer.
- **Touch Target**: Minimum `44px x 44px` interactive area on mobile layouts.

### 3.2 Radius Tokens

- `--r-xs` (4px): Tags, kbd, inline code.
- `--r-sm` (6px): Chips, tooltips, small controls.
- `--r-md` (8px): Buttons, text inputs, menus.
- `--r-lg` (12px): Cards, attachment previews, composer.
- `--r-xl` (16px): Dialogs, modal sheets, panels.
- `--r-2xl` (22px): Landing page preview frame.
- `--r-full` (9999px): Avatars, presence indicators, pill badges.

---

## 4. Motion System

- `--dur-micro` (90ms): Press states, micro toggles.
- `--dur-fast` (140ms): Hover transitions, tooltips.
- `--dur-base` (220ms): Menus, popovers, item entries.
- `--dur-emph` (360ms): Dialog entrances, drawer slide-overs.
- `--dur-slow` (600ms): Hero line convergence.
- `--dur-ambient` (10s): Subtle radial ambient light drift (landing hero only).
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce`. All transforms are removed, transitions fall back to instant or opacity-only $\le$ 120ms, and ambient loops pause.

---

## 5. Core Components Inventory

1. `<Logo size={16 | 24 | 32} />`: Converging thin strokes motif (1.5px stroke, rounded terminals).
2. `<AiAvatar status="normal" | "listening" | "responding" />`: Custom AI visual indicator with violet ring and live cyan streaming node.
3. `<Button variant="primary" | "secondary" | "ghost" | "danger" />`: Unified tactile interactive primitive.
4. `<Modal>` & `<ConfirmDialog>`: Accessible dialogs featuring exact-name deletion gating, double-click debounce protection, and focus trapping.
5. `<Composer>`: Auto-growing docked message composer with mode indicator, attachment handling, and send/stop crossfade.
6. `<LandingNav>`: Translucent blur header with skip-link, keyboard focus, and responsive sheet.

---

## 6. Accessibility & Compliance Rules

- **WCAG 2.2 AA Minimum**: Every background/foreground pair exceeds 4.5:1 for body and 3:1 for graphical controls.
- **Roving Tabindex**: Keyboard navigation across sidebar lists, menus, and radiogroups.
- **Screen Reader Announcements**: Polite `aria-live` streaming text announcer prevents repetitive DOM churn announcements.
- **Focus Management**: Open modals trap focus inside the dialog; closing safely restores focus to the trigger element.
- **State by Shape & Text**: Semantic states (presence, AI mode, errors) always combine color with an icon and text label.
