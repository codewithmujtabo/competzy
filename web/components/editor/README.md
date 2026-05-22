# Rich-text editor (`rich-text-editor.tsx`)

A headless TipTap + KaTeX editor wired to the Competzy design system.
Lives in `web/components/editor/rich-text-editor.tsx` and is the standard
editor for any operator-authored long-form HTML — question stems, MC
options, explanations, announcements, materials.

## Usage

```tsx
import dynamic from 'next/dynamic';

// Dynamic-imported so the ~120 KB ProseMirror + KaTeX bundle only ships on
// pages that mount the editor.
const RichTextEditor = dynamic(
  () => import('@/components/editor/rich-text-editor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[140px] rounded-md border" /> },
);

<RichTextEditor
  value={html}
  onChange={setHtml}
  placeholder="Type the question…"
  minHeight="min-h-[160px]"
/>
```

## What you get

| Toolbar button         | Shortcut          | Notes                                                     |
| ---------------------- | ----------------- | --------------------------------------------------------- |
| Bold / Italic / Strike | `⌘B` / `⌘I`       | StarterKit                                                |
| H2 / H3                | —                 | StarterKit                                                |
| Bullet / Ordered list  | —                 | StarterKit                                                |
| Inline code            | —                 | StarterKit                                                |
| Link                   | —                 | `extension-link`, opens via `window.prompt`               |
| **Math (Σ)**           | `⌘⇧M`             | Insert via popover; renders KaTeX synchronously           |
| Image-by-URL           | —                 | `extension-image`; base64 disabled                        |

Math uses `$…$` inline delimiters. The `@tiptap/extension-mathematics`
extension auto-recognises the delimited form and renders it as a math node
via KaTeX. The keyboard shortcut inserts a `$$` skeleton; the toolbar
popover writes `$<latex>$` directly.

## Where KaTeX styles come from

`katex/dist/katex.min.css` is imported **once** in `web/app/layout.tsx`. Any
page that renders a math node (editor mounted OR a read-only display via
`dangerouslySetInnerHTML`) renders correctly without extra setup.

## Adding a new TipTap extension

1. `npm install @tiptap/extension-<name>` in `web/`.
2. Import it at the top of `rich-text-editor.tsx`.
3. Add it to the `extensions: [...]` array passed to `useEditor`.
4. If it needs a toolbar button, add a `<ToolbarButton>` using one of the
   chain commands the extension exposes — match the existing pattern of
   `editor.isActive(...)` (for the pressed state) and
   `editor.chain().focus().toggle…().run()` (for the action).

For nodes that need a popover (image upload, link picker, math, etc.),
copy the `MathButton` / `ImageButton` pattern — both are tiny wrappers
around shadcn `Popover`.

## Read-only mode

Pass `editable={false}` to render the same HTML without the toolbar.
Same component, no rerender of the underlying TipTap instance — perfect
for the student exam runner and the review screen, which need consistent
math rendering with the editor.
