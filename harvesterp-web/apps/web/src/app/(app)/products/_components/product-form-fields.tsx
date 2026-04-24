"use client";

import * as React from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/primitives/input";
import { Textarea } from "@/components/primitives/textarea";
import { Select } from "@/components/primitives/select";
import { Label } from "@/components/primitives/label";
import { cn } from "@/lib/utils";
import { PART_TYPES, CATEGORY_ADD_SENTINEL } from "./constants";
import type { ProductFormData } from "./schemas";

interface FieldProps {
  name: keyof ProductFormData;
  label: string;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  helperText?: string | undefined;
  readOnly?: boolean | undefined;
  className?: string | undefined;
  children?: React.ReactNode | undefined;
}

export function FieldRow({
  name,
  label,
  required,
  helperText,
  className,
  children,
}: FieldProps): React.ReactElement {
  const {
    formState: { errors },
  } = useFormContext<ProductFormData>();
  const fieldError = errors[name];
  const id = `field-${name}`;
  const describedBy = fieldError
    ? `${id}-error`
    : helperText
      ? `${id}-help`
      : undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": fieldError ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={cn("space-y-1", className)}>
      <Label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
      >
        {label} {required ? <span className="text-red-500">*</span> : null}
      </Label>
      {child}
      {fieldError ? (
        <p id={`${id}-error`} className="text-xs text-red-500">
          {String(fieldError.message)}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="text-xs text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps {
  name: keyof ProductFormData;
  label: string;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  helperText?: string | undefined;
  readOnly?: boolean | undefined;
  type?: "text" | "number" | undefined;
  step?: string | undefined;
  className?: string | undefined;
}

export function TextField({
  name,
  label,
  required,
  placeholder,
  helperText,
  readOnly,
  type = "text",
  step,
  className,
}: TextFieldProps): React.ReactElement {
  const { register } = useFormContext<ProductFormData>();
  const registerOpts =
    type === "number"
      ? {
          setValueAs: (v: unknown) => {
            if (v === "" || v === null || v === undefined) return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          },
        }
      : {};
  return (
    <FieldRow
      name={name}
      label={label}
      required={required}
      helperText={helperText}
      className={className}
    >
      <Input
        type={type}
        step={step}
        placeholder={placeholder}
        readOnly={readOnly}
        {...register(name as never, registerOpts)}
      />
    </FieldRow>
  );
}

interface TextareaFieldProps {
  name: keyof ProductFormData;
  label: string;
  placeholder?: string | undefined;
  rows?: number | undefined;
  className?: string | undefined;
}

export function TextareaField({
  name,
  label,
  placeholder,
  rows = 3,
  className,
}: TextareaFieldProps): React.ReactElement {
  const { register } = useFormContext<ProductFormData>();
  return (
    <FieldRow name={name} label={label} className={className}>
      <Textarea
        rows={rows}
        placeholder={placeholder}
        {...register(name as never)}
      />
    </FieldRow>
  );
}

interface CategoryFieldProps {
  categories: string[];
  className?: string | undefined;
}

export function CategoryField({
  categories,
  className,
}: CategoryFieldProps): React.ReactElement {
  const { register, setValue, watch } = useFormContext<ProductFormData>();
  const value = watch("category") ?? "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === CATEGORY_ADD_SENTINEL) {
      // TODO: open inline add-category UI (future work)
      return;
    }
    setValue("category", v || null, { shouldDirty: true });
    // Clear subcategory when category changes — Vue bug fix #4
    setValue("subcategory", null, { shouldDirty: true });
  }

  return (
    <FieldRow name="category" label="Category" className={className}>
      <Select
        {...register("category")}
        value={value ?? ""}
        onChange={handleChange}
      >
        <option value="">Select category…</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </FieldRow>
  );
}

interface PartTypeFieldProps {
  className?: string | undefined;
}

export function PartTypeField({
  className,
}: PartTypeFieldProps): React.ReactElement {
  const { register } = useFormContext<ProductFormData>();
  return (
    <FieldRow name="part_type" label="Part Type" className={className}>
      <Select {...register("part_type")}>
        <option value="">Select type…</option>
        {PART_TYPES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
    </FieldRow>
  );
}
