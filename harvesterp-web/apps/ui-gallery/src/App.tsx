"use client";

import { Routes, Route, Navigate } from "react-router-dom";
import { GalleryLayout } from "./gallery/GalleryLayout";

// Gallery pages — primitives
import { ButtonGallery } from "./gallery/pages/ButtonGallery";
import { InputGallery } from "./gallery/pages/InputGallery";
import { SelectGallery } from "./gallery/pages/SelectGallery";
import { DialogGallery } from "./gallery/pages/DialogGallery";
import { DropdownMenuGallery } from "./gallery/pages/DropdownMenuGallery";
import { TabsGallery } from "./gallery/pages/TabsGallery";
import { BadgeGallery } from "./gallery/pages/BadgeGallery";
import { CardGallery } from "./gallery/pages/CardGallery";
import { CheckboxGallery } from "./gallery/pages/CheckboxGallery";
import { TextareaGallery } from "./gallery/pages/TextareaGallery";
import { TooltipGallery } from "./gallery/pages/TooltipGallery";
import { SkeletonGallery } from "./gallery/pages/SkeletonGallery";
import { AlertGallery } from "./gallery/pages/AlertGallery";
import { TableGallery } from "./gallery/pages/TableGallery";
import { ToastGallery } from "./gallery/pages/ToastGallery";

// Gallery pages — composed aggregator
import { ComposedGallery } from "./gallery/pages/ComposedGallery";

// Gallery pages — composed
import { ConfirmDialogGallery } from "./gallery/pages/ConfirmDialogGallery";
import { ClientAvatarGallery } from "./gallery/pages/ClientAvatarGallery";
import { LedgerPageGallery } from "./gallery/pages/LedgerPageGallery";
import { HighlightScrollTargetGallery } from "./gallery/pages/HighlightScrollTargetGallery";
import { CarryForwardStepperGallery } from "./gallery/pages/CarryForwardStepperGallery";
import { RoleGateGallery } from "./gallery/pages/RoleGateGallery";
import { PageShellGallery } from "./gallery/pages/PageShellGallery";
import { KpiCardGallery } from "./gallery/pages/KpiCardGallery";

// Gallery pages — design system & shells
import { DesignSystemGallery } from "./gallery/pages/DesignSystemGallery";
import { SidebarGallery } from "./gallery/pages/SidebarGallery";
import { TopbarGallery } from "./gallery/pages/TopbarGallery";

// Gallery pages — screen ports
import { DashboardV1Screen } from "./gallery/pages/screens/DashboardV1Screen";
import { DashboardV2Screen } from "./gallery/pages/screens/DashboardV2Screen";
import { DashboardV3Screen } from "./gallery/pages/screens/DashboardV3Screen";
import { FinanceScreen } from "./gallery/pages/screens/FinanceScreen";
import { InventoryScreen } from "./gallery/pages/screens/InventoryScreen";
import { SalesScreen } from "./gallery/pages/screens/SalesScreen";
import { SettingsScreen } from "./gallery/pages/screens/SettingsScreen";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/gallery/button" replace />} />
      <Route path="/gallery" element={<GalleryLayout />}>
        {/* Primitives */}
        <Route path="button" element={<ButtonGallery />} />
        <Route path="input" element={<InputGallery />} />
        <Route path="select" element={<SelectGallery />} />
        <Route path="dialog" element={<DialogGallery />} />
        <Route path="dropdown-menu" element={<DropdownMenuGallery />} />
        <Route path="tabs" element={<TabsGallery />} />
        <Route path="badge" element={<BadgeGallery />} />
        <Route path="card" element={<CardGallery />} />
        <Route path="checkbox" element={<CheckboxGallery />} />
        <Route path="textarea" element={<TextareaGallery />} />
        <Route path="tooltip" element={<TooltipGallery />} />
        <Route path="skeleton" element={<SkeletonGallery />} />
        <Route path="alert" element={<AlertGallery />} />
        <Route path="table" element={<TableGallery />} />
        <Route path="toast" element={<ToastGallery />} />
        {/* Composed — aggregator */}
        <Route path="composed" element={<ComposedGallery />} />
        {/* Composed — individual */}
        <Route path="confirm-dialog" element={<ConfirmDialogGallery />} />
        <Route path="client-avatar" element={<ClientAvatarGallery />} />
        <Route path="ledger-page" element={<LedgerPageGallery />} />
        <Route
          path="highlight-scroll-target"
          element={<HighlightScrollTargetGallery />}
        />
        <Route
          path="carry-forward-stepper"
          element={<CarryForwardStepperGallery />}
        />
        <Route path="role-gate" element={<RoleGateGallery />} />
        <Route path="page-shell" element={<PageShellGallery />} />
        <Route path="kpi-card" element={<KpiCardGallery />} />
        {/* Design system */}
        <Route path="design-system" element={<DesignSystemGallery />} />
        <Route path="sidebar" element={<SidebarGallery />} />
        <Route path="topbar" element={<TopbarGallery />} />
        {/* Screen ports — full-bleed, rendered outside GalleryLayout padding */}
      </Route>
      {/* Full-bleed screen routes (outside gallery chrome) */}
      <Route path="/gallery/screen/dashboard-v1" element={<DashboardV1Screen />} />
      <Route path="/gallery/screen/dashboard-v2" element={<DashboardV2Screen />} />
      <Route path="/gallery/screen/dashboard-v3" element={<DashboardV3Screen />} />
      <Route path="/gallery/screen/finance"      element={<FinanceScreen />} />
      <Route path="/gallery/screen/inventory"    element={<InventoryScreen />} />
      <Route path="/gallery/screen/sales"        element={<SalesScreen />} />
      <Route path="/gallery/screen/settings"     element={<SettingsScreen />} />
    </Routes>
  );
}
