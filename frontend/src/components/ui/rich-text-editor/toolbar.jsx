"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { _useRichTextEditorContext } from "./context"
import { _useHeading, _useToolbarItems } from "./hooks"

function HeadingSelect() {
  const { headings, activeHeading } = _useHeading()

  const handleHeadingChange = React.useCallback((value) => {
    const selectedOption = headings.find((option) => option.label === value)
    if (selectedOption && !selectedOption.disabled) {
      selectedOption.action()
    }
  }, [headings])

  return (
    <Select value={activeHeading} onValueChange={handleHeadingChange}>
      <SelectTrigger
        className="h-8 w-14 border-none px-1.5 py-0 shadow-none dark:bg-transparent"
        aria-label="Text style">
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
              <span className="text-muted-foreground text-xs">
                ({item.shortcut})
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function RichTextEditorToolbar({
  className
}) {
  const { editor } = _useRichTextEditorContext()

  const toolbarItemGroup = _useToolbarItems()

  if (!editor) return null

  return (
    <div
      className={cn("flex flex-wrap items-center divide-x-1 p-1", className)}
      data-slot="rich-text-editor-toolbar">
      <div className="pr-1.5 pl-1">
        <HeadingSelect />
      </div>
      {toolbarItemGroup.map((group) => (
        <div key={group.id} className="px-1.5">
          {group.items.map((item) => (
            <Tooltip key={item.tooltip}>
              <TooltipTrigger asChild>
                <Toggle
                  onPressedChange={item.onClick}
                  disabled={item.disabled}
                  size={"sm"}
                  className={cn({
                    "bg-accent": item.isActive,
                  })}
                  pressed={item.isActive}>
                  <item.icon />
                  <span className="sr-only">{item.tooltip}</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {item.tooltip}{" "}
                <span className="text-muted-foreground text-xs">
                  ({item.shortcut})
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  );
}

RichTextEditorToolbar.displayName = "RichTextEditorToolbar"

export { RichTextEditorToolbar as _RichTextEditorToolbar }
