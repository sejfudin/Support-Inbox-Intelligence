'use client';

import * as React from 'react';
import { ChevronDown, Images, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { _useRichTextEditorContext } from './context';
import { _useHeading, _useToolbarItems } from './hooks';

function HeadingSelect() {
  const { headings, activeHeading } = _useHeading();

  const handleHeadingChange = React.useCallback(
    (value) => {
      const selectedOption = headings.find((option) => option.label === value);
      if (selectedOption && !selectedOption.disabled) {
        selectedOption.action();
      }
    },
    [headings]
  );

  return (
    <Select value={activeHeading} onValueChange={handleHeadingChange}>
      <SelectTrigger
        tabIndex={-1}
        className="h-8 w-14 border-none px-1.5 py-0 shadow-none dark:bg-transparent"
        aria-label="Text style"
      >
        <SelectValue>{activeHeading}</SelectValue>
      </SelectTrigger>
      <SelectContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        position="popper"
        sideOffset={4}
        className="z-[200] min-w-[140px]"
        container={document.body}
      >
        <SelectGroup>
          {headings.map((item) => (
            <SelectItem key={item.label} value={item.label} disabled={item.disabled}>
              {item.label}
              <span className="text-muted-foreground text-xs">({item.shortcut})</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ImageOptionsDropdown({ align, size, onAlignChange, onSizeChange }) {
  const currentSummary = `${align} ${size}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-10 items-center justify-center gap-1 rounded-md bg-muted/80 px-1 py-0 text-sm font-medium text-gray-700 shadow-none transition-colors hover:bg-muted dark:bg-transparent dark:text-gray-200"
          aria-label={`Image options (${currentSummary})`}
        >
          <Images className="h-3.5 w-3.5" />
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[220] w-44">
        <DropdownMenuLabel className="py-1 text-[11px] uppercase tracking-wider text-gray-500">
          Image Position
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={align} onValueChange={onAlignChange}>
          <DropdownMenuRadioItem value="left" onSelect={(e) => e.preventDefault()}>
            Left
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="center" onSelect={(e) => e.preventDefault()}>
            Center
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="right" onSelect={(e) => e.preventDefault()}>
            Right
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="py-1 text-[11px] uppercase tracking-wider text-gray-500">
          Image Size
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={size} onValueChange={onSizeChange}>
          <DropdownMenuRadioItem value="sm" onSelect={(e) => e.preventDefault()}>
            Small
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="md" onSelect={(e) => e.preventDefault()}>
            Medium
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="lg" onSelect={(e) => e.preventDefault()}>
            Large
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useEditorSelectionRerender(editor) {
  const [, forceRerender] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;

    const rerender = () => forceRerender((value) => value + 1);

    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    editor.on('focus', rerender);
    editor.on('blur', rerender);

    return () => {
      editor.off('selectionUpdate', rerender);
      editor.off('transaction', rerender);
      editor.off('focus', rerender);
      editor.off('blur', rerender);
    };
  }, [editor]);
}

function RichTextEditorImageOptions({ className }) {
  const { editor } = _useRichTextEditorContext();
  useEditorSelectionRerender(editor);

  if (!editor || !editor.isActive('image')) return null;

  const imageAttrs = editor.getAttributes('image');
  const currentAlign = imageAttrs?.align || 'center';
  const currentSize = imageAttrs?.size || 'md';

  const updateSelectedImage = (attributes) => {
    if (!editor.isActive('image')) return;
    const pos = editor.state.selection.from;
    editor.chain().focus().updateAttributes('image', attributes).setNodeSelection(pos).run();
  };

  return (
    <div className={cn('flex items-center', className)}>
      <ImageOptionsDropdown
        align={currentAlign}
        size={currentSize}
        onAlignChange={(align) => updateSelectedImage({ align })}
        onSizeChange={(size) => updateSelectedImage({ size })}
      />
    </div>
  );
}

function RichTextEditorToolbar({ className }) {
  const { editor } = _useRichTextEditorContext();
  useEditorSelectionRerender(editor);

  const toolbarItemGroup = _useToolbarItems();
  const isImageSelected = editor?.isActive('image');

  if (!editor) return null;

  const removeSelectedImage = () => {
    if (!editor.isActive('image')) return;
    editor.chain().focus().deleteSelection().run();
  };

  return (
    <div
      className={cn('flex flex-wrap items-center divide-x-1 p-1', className)}
      data-slot="rich-text-editor-toolbar"
    >
      <div className="flex items-center gap-1 pr-1.5 pl-1">
        <HeadingSelect />
      </div>
      {toolbarItemGroup.map((group) => (
        <div key={group.id} className="px-1.5">
          {group.items.map((item) => (
            <Tooltip key={item.tooltip}>
              <TooltipTrigger asChild>
                <Toggle
                  tabIndex={-1}
                  onPressedChange={item.onClick}
                  disabled={item.disabled}
                  size={'sm'}
                  className={cn({
                    'bg-accent': item.isActive,
                  })}
                  pressed={item.isActive}
                >
                  <item.icon />
                  <span className="sr-only">{item.tooltip}</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {item.tooltip}{' '}
                <span className="text-muted-foreground text-xs">({item.shortcut})</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ))}
      {isImageSelected && (
        <div className="flex items-center gap-1 px-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle size="sm" onPressedChange={() => removeSelectedImage()}>
                <Trash2 />
                <span className="sr-only">Remove image</span>
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Remove Image</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

RichTextEditorToolbar.displayName = 'RichTextEditorToolbar';

export {
  RichTextEditorToolbar as _RichTextEditorToolbar,
  RichTextEditorImageOptions as _RichTextEditorImageOptions,
};
