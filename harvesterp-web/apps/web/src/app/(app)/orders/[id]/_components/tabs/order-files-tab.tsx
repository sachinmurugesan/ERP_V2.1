"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type UserRole,
  Resource,
  canAccess,
  formatDate,
} from "@harvesterp/lib";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/primitives/card";
import { Button } from "@/components/primitives/button";
import { Skeleton } from "@/components/primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { Select } from "@/components/primitives/select";
import { Label } from "@/components/primitives/label";
import { RoleGate } from "@/components/composed/role-gate";
import { DeleteConfirmDialog } from "@/components/composed/delete-confirm-dialog";
import { useBlobDownload } from "@/lib/use-blob-download";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Download,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";

import type { OrderDetail } from "../types";
import type { OrderDocument } from "@/app/api/orders/[id]/documents/route";

/**
 * <OrderFilesTab> — Files tab content for the order-detail shell.
 *
 * Vue source: `frontend/src/components/order/FilesTab.vue` (33 LOC,
 * read-only display). This Next.js migration adds the full CRUD that
 * backend has supported since day one (upload + download + delete) but
 * Vue never surfaced. See migration log §1.3 (D-1=B decision).
 *
 * Self-fetches the document list via TanStack Query (per the precedent
 * set by OrderDashboardTab — Phase 2 §3.1 of feat/orders-dashboard-tab).
 * The shell does NOT plumb documents through.
 *
 * Role gating (matches matrix.ts and backend documents.py:132 exactly):
 *   - List:     any internal role (no gate)
 *   - Upload:   DOCUMENT_UPLOAD = [ADMIN, OPERATIONS] (+ SUPER_ADMIN bypass)
 *   - Download: any internal role (no gate)
 *   - Delete:   DOCUMENT_DELETE = [ADMIN, OPERATIONS] (+ SUPER_ADMIN bypass)
 */

const DOC_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "PI", label: "Proforma Invoice (PI)" },
  { value: "INVOICE", label: "Commercial Invoice" },
  { value: "BOL", label: "Bill of Lading (BOL)" },
  { value: "PACKING_LIST", label: "Packing List" },
  { value: "CUSTOMS", label: "Customs / BOE" },
  { value: "OTHER", label: "Other" },
];

const ACCEPTED_FILE_TYPES =
  ".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg,.txt,.csv";

interface OrderFilesTabProps {
  orderId: string;
  order: OrderDetail;
  role: UserRole | undefined;
}

export function OrderFilesTab({
  orderId,
  order: _order,
  role,
}: OrderFilesTabProps): React.ReactElement {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<OrderDocument | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const documentsQuery = useQuery<OrderDocument[], Error>({
    queryKey: ["order-documents", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/documents`,
        { signal },
      );
      if (!res.ok) {
        throw new Error(`Failed to load documents (${res.status})`);
      }
      return (await res.json()) as OrderDocument[];
    },
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();
  const blob = useBlobDownload();

  const user = role ? { role } : null;
  const canUpload = !!role && canAccess(role, Resource.DOCUMENT_UPLOAD);

  function refresh(): void {
    void queryClient.invalidateQueries({
      queryKey: ["order-documents", orderId],
    });
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/documents/${encodeURIComponent(pendingDelete.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      setPendingDelete(null);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload(doc: OrderDocument): Promise<void> {
    const url = `/api/orders/${encodeURIComponent(orderId)}/documents/${encodeURIComponent(doc.id)}/download`;
    try {
      await blob.download(url, doc.filename);
    } catch {
      // useBlobDownload already captures the error in its internal state.
    }
  }

  const documents = documentsQuery.data ?? [];

  return (
    <div className="space-y-3" data-testid="order-files-tab">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Paperclip
              size={16}
              aria-hidden="true"
              className="text-blue-500"
            />
            Documents{documents.length > 0 ? ` (${documents.length})` : ""}
          </CardTitle>
          <RoleGate
            user={user}
            permission={Resource.DOCUMENT_UPLOAD}
            fallback={null}
          >
            <Button
              size="sm"
              onClick={() => setUploadOpen(true)}
              data-testid="files-upload-button"
            >
              <Upload size={14} className="mr-1.5" aria-hidden="true" />
              Upload document
            </Button>
          </RoleGate>
        </CardHeader>
        <CardContent>
          {documentsQuery.isPending ? <FilesTableSkeleton /> : null}

          {documentsQuery.isError ? (
            <FilesError onRetry={() => documentsQuery.refetch()} />
          ) : null}

          {blob.error ? (
            <div
              className="mb-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="files-download-error"
            >
              <span>Download failed: {blob.error}</span>
              <button
                type="button"
                onClick={blob.clearError}
                className="text-xs font-medium underline-offset-2 hover:underline"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {documentsQuery.isSuccess && documents.length === 0 ? (
            <FilesEmptyState
              canUpload={canUpload}
              onUpload={() => setUploadOpen(true)}
            />
          ) : null}

          {documentsQuery.isSuccess && documents.length > 0 ? (
            <FilesTable
              documents={documents}
              role={role}
              isDownloading={blob.isDownloading}
              onDownload={handleDownload}
              onDelete={(doc) => {
                setDeleteError(null);
                setPendingDelete(doc);
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <UploadDocumentModal
        open={uploadOpen}
        orderId={orderId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          refresh();
        }}
      />

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete document?"
        body={
          pendingDelete
            ? `Delete “${pendingDelete.filename}”? This cannot be undone.`
            : ""
        }
        isPending={deleting}
      />

      {deleteError ? (
        <p
          className="text-sm text-red-700"
          data-testid="files-delete-error"
          role="alert"
        >
          Delete failed: {deleteError}
        </p>
      ) : null}
    </div>
  );
}

// ── Files table ──────────────────────────────────────────────────────────────

function FilesTable({
  documents,
  role,
  isDownloading,
  onDownload,
  onDelete,
}: {
  documents: OrderDocument[];
  role: UserRole | undefined;
  isDownloading: boolean;
  onDownload: (doc: OrderDocument) => void;
  onDelete: (doc: OrderDocument) => void;
}): React.ReactElement {
  const user = role ? { role } : null;
  return (
    <Table data-testid="files-table">
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Filename</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id} data-testid={`files-row-${doc.id}`}>
            <TableCell>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {doc.doc_type}
              </span>
            </TableCell>
            <TableCell className="max-w-[280px] truncate font-medium text-slate-800">
              {doc.filename}
            </TableCell>
            <TableCell className="text-slate-600">
              {formatFileSize(doc.file_size)}
            </TableCell>
            <TableCell className="text-slate-600">
              {formatDate(doc.uploaded_at)}
            </TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(doc)}
                  disabled={isDownloading}
                  data-testid={`files-download-${doc.id}`}
                >
                  <Download size={14} aria-hidden="true" />
                  <span className="ml-1.5">Download</span>
                </Button>
                <RoleGate
                  user={user}
                  permission={Resource.DOCUMENT_DELETE}
                  fallback={null}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(doc)}
                    aria-label={`Delete ${doc.filename}`}
                    data-testid={`files-delete-${doc.id}`}
                  >
                    <Trash2
                      size={14}
                      aria-hidden="true"
                      className="text-red-600"
                    />
                  </Button>
                </RoleGate>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function FilesEmptyState({
  canUpload,
  onUpload,
}: {
  canUpload: boolean;
  onUpload: () => void;
}): React.ReactElement {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
      data-testid="files-empty-state"
    >
      <Paperclip
        size={32}
        aria-hidden="true"
        className="text-slate-300"
      />
      <p className="text-sm font-medium text-slate-600">
        No files attached to this order yet.
      </p>
      {canUpload ? (
        <Button onClick={onUpload} data-testid="files-empty-upload-cta">
          <Upload size={14} className="mr-1.5" aria-hidden="true" />
          Upload your first file
        </Button>
      ) : (
        <p className="text-xs text-slate-400">
          When a document is attached it will appear here.
        </p>
      )}
    </div>
  );
}

// ── Loading + error states ───────────────────────────────────────────────────

function FilesTableSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2" data-testid="files-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function FilesError({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div
      className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      data-testid="files-error"
    >
      <span>Failed to load documents.</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

// ── Upload modal ─────────────────────────────────────────────────────────────

function UploadDocumentModal({
  open,
  orderId,
  onClose,
  onUploaded,
}: {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onUploaded: () => void;
}): React.ReactElement {
  const [docType, setDocType] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset internal state when the modal re-opens.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setDocType("");
      setFile(null);
      setError(null);
      setSubmitting(false);
    }
  }

  const canSubmit = docType.length > 0 && file !== null && !submitting;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", docType);
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/documents`,
        { method: "POST", body: formData },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
          data-testid="files-upload-modal"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-800">
                Upload document
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Pick a document type and select a file to attach to this order.
              </Dialog.Description>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-doc-type">Document type</Label>
              <Select
                id="upload-doc-type"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={submitting}
                data-testid="files-upload-doc-type"
              >
                <option value="">Select a type...</option>
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-file">File</Label>
              <input
                id="upload-file"
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={submitting}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                data-testid="files-upload-file"
              />
              {file ? (
                <p className="text-xs text-slate-500">
                  {file.name} ({formatFileSize(file.size)})
                </p>
              ) : null}
            </div>

            {error ? (
              <p
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
                data-testid="files-upload-error"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={!canSubmit}
                data-testid="files-upload-submit"
              >
                {submitting ? (
                  <>
                    <Loader2
                      size={14}
                      className="mr-1.5 animate-spin"
                      aria-hidden="true"
                    />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}
