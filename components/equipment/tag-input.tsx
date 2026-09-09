"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder = "입력 후 Enter 또는 쉼표로 추가",
  disabled,
  id,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value || tags.includes(value)) return;
    onTagsChange([...tags, value]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
    } else if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val.endsWith(",")) {
      addTag(val.slice(0, -1));
    } else {
      setInputValue(val);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) addTag(inputValue);
  };

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="rounded hover:text-destructive focus:outline-none"
              aria-label={`${tag} 제거`}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
    </div>
  );
}
