"use client";

/**
 * Toast primitive — thin re-export of sonner's Toaster + toast utility.
 *
 * Usage:
 *   // In app root: <Toaster richColors position="top-right" />
 *   import { toast } from '@/components/primitives/toast';
 *   toast.success('Saved');
 *   toast.error('Something went wrong');
 */
export { Toaster } from "sonner";
export { toast } from "sonner";
