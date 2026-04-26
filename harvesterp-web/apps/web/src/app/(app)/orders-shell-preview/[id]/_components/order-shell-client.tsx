"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { type UserRole } from "@harvesterp/lib";
import { OrderHeader } from "./order-header";
import { ClientDraftBanner } from "./client-draft-banner";
import { FactoryNotAssignedBanner } from "./factory-not-assigned-banner";
import { StageStepperSection } from "./stage-stepper-section";
import { TransitionActionBar } from "./transition-action-bar";
import { TransitionErrorBanner } from "./transition-error-banner";
import { CarriedItemsAlert } from "./carried-items-alert";
import { OrderTabs } from "./order-tabs";
import {
  DeleteOrderModal,
  ReopenOrderModal,
  TransitionConfirmModal,
  GoBackConfirmModal,
  WarningAckModal,
  JumpToStageModal,
} from "./order-modals";
import type {
  NextStagesResponse,
  OrderDetail,
  OrderTimelineResponse,
  StageOption,
  TransitionResponseBody,
} from "./types";

/**
 * <OrderShellClient> — interactive orchestrator for the order-detail shell.
 *
 * Receives the initial RSC-fetched `order` from the parent page; takes over
 * from there with TanStack Query (timeline + next-stages + factories on
 * demand) and React state for modal open/close + transition pending flags.
 *
 * Mirrors the behaviour of `OrderDetail.vue:1-429` script-setup but split
 * across small typed components.
 */

interface FactoryOption {
  id: string;
  name: string;
}

interface OrderShellClientProps {
  initialOrder: OrderDetail;
  role: UserRole | undefined;
}

export function OrderShellClient({
  initialOrder,
  role,
}: OrderShellClientProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = initialOrder.id;

  // ── Order envelope (re-fetched after each mutation) ─────────────────
  const orderQuery = useQuery<OrderDetail, Error>({
    queryKey: ["order-detail", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        signal,
      });
      if (!res.ok) throw new Error(`Failed to load order (${res.status})`);
      return (await res.json()) as OrderDetail;
    },
    initialData: initialOrder,
    staleTime: 30_000,
  });
  const order = orderQuery.data ?? initialOrder;

  // ── Timeline ────────────────────────────────────────────────────────
  const timelineQuery = useQuery<OrderTimelineResponse, Error>({
    queryKey: ["order-timeline", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/timeline`,
        { signal },
      );
      if (!res.ok) throw new Error(`Failed to load timeline (${res.status})`);
      return (await res.json()) as OrderTimelineResponse;
    },
    staleTime: 30_000,
  });

  // ── Next stages ─────────────────────────────────────────────────────
  const nextStagesQuery = useQuery<NextStagesResponse, Error>({
    queryKey: ["order-next-stages", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/next-stages`,
        { signal },
      );
      if (!res.ok)
        throw new Error(`Failed to load next stages (${res.status})`);
      return (await res.json()) as NextStagesResponse;
    },
    staleTime: 30_000,
  });

  // ── Factories (lazy-loaded on banner focus) ─────────────────────────
  const [factoriesNeeded, setFactoriesNeeded] = React.useState(false);
  const factoriesQuery = useQuery<FactoryOption[], Error>({
    queryKey: ["factories-list"],
    queryFn: async () => {
      const res = await fetch("/api/factories?per_page=200");
      if (!res.ok) throw new Error(`Failed to load factories (${res.status})`);
      const data = (await res.json()) as { items?: FactoryOption[] };
      return data.items ?? [];
    },
    enabled: factoriesNeeded,
    staleTime: 5 * 60_000,
  });

  // ── Modal state ─────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showReopen, setShowReopen] = React.useState(false);
  const [transitionTarget, setTransitionTarget] =
    React.useState<StageOption | null>(null);
  const [showGoBack, setShowGoBack] = React.useState(false);
  const [warningWarnings, setWarningWarnings] = React.useState<string[] | null>(
    null,
  );
  const [pendingTransitionTarget, setPendingTransitionTarget] =
    React.useState<StageOption | null>(null);
  const [jumpTarget, setJumpTarget] = React.useState<{
    target: StageOption;
    isBackward: boolean;
  } | null>(null);

  // ── Mutation pending flags ──────────────────────────────────────────
  const [pending, setPending] = React.useState(false);
  const [transitionError, setTransitionError] = React.useState<string | null>(
    null,
  );

  function refetchAll(): Promise<unknown> {
    return Promise.all([
      orderQuery.refetch(),
      timelineQuery.refetch(),
      nextStagesQuery.refetch(),
    ]);
  }

  // ── Action handlers ─────────────────────────────────────────────────
  async function handleDelete() {
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("Delete failed");
      setShowDeleteConfirm(false);
      router.push("/orders");
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Delete failed",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleReopen(reason?: string) {
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/reopen`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? "" }),
        },
      );
      if (!res.ok) throw new Error("Re-open failed");
      setShowReopen(false);
      await refetchAll();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Re-open failed",
      );
    } finally {
      setPending(false);
    }
  }

  async function performTransition(
    target: StageOption,
    acknowledge_warnings: boolean,
    transition_reason?: string,
  ) {
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/transition`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_status: target.status,
            acknowledge_warnings,
            ...(transition_reason ? { transition_reason } : {}),
          }),
        },
      );
      const body = (await res.json()) as {
        ok?: boolean;
        result?: TransitionResponseBody;
        error?: string;
      };
      if (!res.ok || body.error) {
        throw new Error(body.error ?? `Transition failed (${res.status})`);
      }
      // Backend may signal warnings on first attempt — open the warning modal.
      if (body.result?.status === "warnings" && body.result.warnings) {
        setWarningWarnings(body.result.warnings);
        setPendingTransitionTarget(target);
        setTransitionTarget(null);
        return;
      }
      setTransitionTarget(null);
      setWarningWarnings(null);
      setPendingTransitionTarget(null);
      setTransitionError(null);
      await refetchAll();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Transition failed",
      );
      setTransitionTarget(null);
      setWarningWarnings(null);
      setPendingTransitionTarget(null);
    } finally {
      setPending(false);
    }
  }

  async function handleGoBack() {
    if (!nextStagesQuery.data?.prev_stage) {
      setShowGoBack(false);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/go-back`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Stage reversal" }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok || body.error) {
        throw new Error(body.error ?? `Go-back failed (${res.status})`);
      }
      setShowGoBack(false);
      setTransitionError(null);
      await refetchAll();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Go-back failed");
      setShowGoBack(false);
    } finally {
      setPending(false);
    }
  }

  async function handleJumpToStage() {
    if (!jumpTarget) return;
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/jump-to-stage`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_status: jumpTarget.target.status,
            reason: "Direct stage navigation",
          }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok || body.error) {
        throw new Error(body.error ?? `Stage jump failed (${res.status})`);
      }
      setJumpTarget(null);
      setTransitionError(null);
      await refetchAll();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Stage jump failed");
      setJumpTarget(null);
    } finally {
      setPending(false);
    }
  }

  async function handleApproveInquiry(factoryId: string, currency: string) {
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/approve-inquiry`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factory_id: factoryId, currency }),
        },
      );
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errBody.error ?? "Approval failed");
      }
      await refetchAll();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Approval failed",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleAssignFactory(factoryId: string) {
    setPending(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factory_id: factoryId }),
        },
      );
      if (!res.ok) throw new Error("Assign factory failed");
      await refetchAll();
    } catch (err) {
      setTransitionError(
        err instanceof Error ? err.message : "Assign factory failed",
      );
    } finally {
      setPending(false);
    }
  }

  function handleErrorBannerJump(target: { tab: string; highlightSection: string }) {
    // Update URL — order-tabs.tsx will react to ?tab= change.
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", target.tab);
    params.set("section", target.highlightSection);
    router.replace(`?${params.toString()}`, { scroll: false });
    setTransitionError(null);
  }

  // ── Render ──────────────────────────────────────────────────────────
  const isClientDraft = order.status === "CLIENT_DRAFT";
  const showFactoryBanner =
    order.status === "DRAFT" && order.factory_id === null;

  return (
    <div className="space-y-4">
      <OrderHeader
        order={order}
        role={role}
        onDeleteClick={() => setShowDeleteConfirm(true)}
        onReopenClick={() => setShowReopen(true)}
      />

      <CarriedItemsAlert />

      {isClientDraft ? (
        <ClientDraftBanner
          role={role}
          factories={factoriesQuery.data ?? []}
          factoriesLoading={factoriesQuery.isFetching}
          onFactoriesNeeded={() => setFactoriesNeeded(true)}
          onApprove={handleApproveInquiry}
          isPending={pending}
        />
      ) : null}

      {showFactoryBanner ? (
        <FactoryNotAssignedBanner
          role={role}
          factories={factoriesQuery.data ?? []}
          factoriesLoading={factoriesQuery.isFetching}
          onFactoriesNeeded={() => setFactoriesNeeded(true)}
          onAssign={handleAssignFactory}
          isPending={pending}
        />
      ) : null}

      <StageStepperSection
        timeline={timelineQuery.data ?? null}
        nextStages={nextStagesQuery.data ?? null}
        onJumpToStage={(target) => setJumpTarget({ target, isBackward: false })}
        onJumpBackToStage={(target) =>
          setJumpTarget({ target, isBackward: true })
        }
      />

      <TransitionActionBar
        nextStages={nextStagesQuery.data ?? null}
        role={role}
        pending={pending}
        onAdvance={(target) => setTransitionTarget(target)}
        onGoBack={() => setShowGoBack(true)}
        onReturnTo={(target) => setJumpTarget({ target, isBackward: false })}
      />

      <TransitionErrorBanner
        error={transitionError}
        onDismiss={() => setTransitionError(null)}
        onJumpToFix={handleErrorBannerJump}
      />

      <OrderTabs
        order={order}
        role={role}
        initialTab={searchParams.get("tab")}
        initialQuery={searchParams.get("query")}
      />

      {/* Modals */}
      <DeleteOrderModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        orderNumber={order.order_number ?? "DRAFT"}
        onConfirm={handleDelete}
        isPending={pending}
      />

      <ReopenOrderModal
        open={showReopen}
        onClose={() => setShowReopen(false)}
        onConfirm={handleReopen}
        isPending={pending}
      />

      <TransitionConfirmModal
        target={transitionTarget}
        onCancel={() => setTransitionTarget(null)}
        onConfirm={() => {
          if (transitionTarget) {
            void performTransition(transitionTarget, false);
          }
        }}
        isPending={pending}
      />

      <GoBackConfirmModal
        prevStage={showGoBack ? nextStagesQuery.data?.prev_stage ?? null : null}
        onCancel={() => setShowGoBack(false)}
        onConfirm={handleGoBack}
      />

      <WarningAckModal
        open={warningWarnings !== null}
        warnings={warningWarnings ?? []}
        onCancel={() => {
          setWarningWarnings(null);
          setPendingTransitionTarget(null);
        }}
        onProceed={(reason) => {
          if (pendingTransitionTarget) {
            void performTransition(pendingTransitionTarget, true, reason);
          }
        }}
        isPending={pending}
      />

      <JumpToStageModal
        target={jumpTarget?.target ?? null}
        isBackward={jumpTarget?.isBackward ?? false}
        onCancel={() => setJumpTarget(null)}
        onConfirm={handleJumpToStage}
      />
    </div>
  );
}
