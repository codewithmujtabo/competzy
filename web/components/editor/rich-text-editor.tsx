'use client';

// Phase 3 of the Komodo-parity rollout. A headless TipTap editor styled with
// shadcn tokens, with a small toolbar for B / I / U / H2 / H3 / lists / link /
// code / inline math / image-by-URL. KaTeX renders math synchronously (no
// async re-flow flicker) via the @tiptap/extension-mathematics package.
//
// Phases 4 + 5 reuse this component — phase 4 swaps the 6-language tabs to
// feed it per-language HTML; phase 5 mounts it `editable={false}` on the
// student exam runner so KaTeX renders math identically there.

import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Mathematics from '@tiptap/extension-mathematics';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Sigma,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface Props {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  /** Min-height of the editable area. Tailwind class, e.g. `min-h-[160px]`. */
  minHeight?: string;
}

// One toolbar button — wired to a chain command. Disabled visually when the
// command isn't applicable (e.g. a heading can't toggle inside a code-block).
function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        'flex size-7 items-center justify-center rounded text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function MathButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [latex, setLatex] = useState('');

  const insert = () => {
    const tex = latex.trim();
    if (!tex) {
      setOpen(false);
      return;
    }
    // Insert as `$…$` — the Mathematics extension auto-recognises the
    // delimited form and renders it as an inline math node via KaTeX.
    editor.chain().focus().insertContent(`$${tex}$`).run();
    setLatex('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Insert math (LaTeX)"
          title="Insert math, LaTeX (Cmd/Ctrl+Shift+M)"
          className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Sigma className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        <p className="text-xs font-medium text-foreground">LaTeX expression</p>
        <textarea
          autoFocus
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              insert();
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="e.g. \\frac{1}{2} or \\sqrt{x^2+y^2}"
          className="h-20 w-full resize-y rounded border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={insert} disabled={!latex.trim()}>
            Insert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImageButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  const insert = () => {
    const src = url.trim();
    if (!src) {
      setOpen(false);
      return;
    }
    editor.chain().focus().setImage({ src }).run();
    setUrl('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Insert image by URL"
          title="Insert image by URL"
          className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ImageIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 p-3" align="start">
        <p className="text-xs font-medium text-foreground">Image URL</p>
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              insert();
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="https://…"
          className="block w-full rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={insert} disabled={!url.trim()}>
            Insert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <ToolbarButton
      active={editor.isActive('link')}
      onClick={setLink}
      label="Link"
    >
      <LinkIcon className="size-4" />
    </ToolbarButton>
  );
}

export function RichTextEditor({
  value,
  onChange,
  editable = true,
  placeholder,
  className,
  minHeight = 'min-h-[140px]',
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Code blocks via the inline `Code` button + Cmd-E shortcut from
        // StarterKit are enough; no full CodeBlock language picker.
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
        emptyEditorClass: 'is-empty',
      }),
      // Mathematics renders math nodes via KaTeX synchronously. Inline math
      // uses $…$ syntax (block math uses $$…$$); both are auto-detected.
      Mathematics,
    ],
    content: value || '',
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none px-3 py-2 focus:outline-none',
          minHeight,
        ),
      },
      handleKeyDown: (_view, event) => {
        // Cmd/Ctrl + Shift + M — quick-insert math placeholder. We can't
        // open the popover directly from here without a ref, so just drop
        // a `$ … $` skeleton so the author can fill it in.
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
          event.preventDefault();
          // Insert `$$`, then move the caret one left so the user types between.
          editor?.chain().focus().insertContent('$$').run();
          // Move caret back by 1 char so the next keystroke goes inside.
          const { from } = editor!.state.selection;
          editor!.commands.setTextSelection(from - 1);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
  });

  // Keep the editor in sync when `value` changes from outside (e.g. parent
  // hydrates the form after fetch). Skip when the editor's already showing
  // the same HTML to avoid wiping selection mid-typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  // Toggle editable when the prop changes (used by the read-only review +
  // student-exam-display paths).
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border border-input bg-background',
          minHeight,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background',
        editable ? 'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40' : 'opacity-95',
        className,
      )}
    >
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold (Cmd/Ctrl+B)"
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic (Cmd/Ctrl+I)"
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="Strikethrough"
          >
            <Strikethrough className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            label="Heading 2"
          >
            <Heading2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            label="Heading 3"
          >
            <Heading3 className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Bullet list"
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="Ordered list"
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
            label="Inline code"
          >
            <Code className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <LinkButton editor={editor} />
          <MathButton editor={editor} />
          <ImageButton editor={editor} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
