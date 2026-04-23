import { Resource, UserRole } from "@harvesterp/lib";
import { RoleGate } from "@/components/composed/role-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/primitives/alert";
import { Badge } from "@/components/primitives/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/primitives/card";
import { GallerySection } from "../GallerySection";
import { Lock, ShieldCheck } from "lucide-react";

function GateDemo({
  label,
  user,
  permission,
}: {
  label: string;
  user: { role: UserRole };
  permission: Resource;
}) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Badge variant="secondary">{user.role}</Badge>
          <span className="text-muted-foreground">→</span>
          <code className="text-xs rounded bg-muted px-1">{permission}</code>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RoleGate
          user={user}
          permission={permission}
          fallback={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Access denied — {label}
            </div>
          }
        >
          <div className="flex items-center gap-2 text-sm text-green-700">
            <ShieldCheck className="h-4 w-4" />
            Access granted — {label}
          </div>
        </RoleGate>
      </CardContent>
    </Card>
  );
}

export function RoleGateGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">RoleGate (D-004 / D-009-A2 / D-010)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Canonical permission gate — every role-gated UI element MUST use this instead of
          checking <code className="rounded bg-muted px-1">user.role</code> directly (D-004-A6).
        </p>
      </div>

      <Alert>
        <AlertTitle>SUPER_ADMIN bypass</AlertTitle>
        <AlertDescription>
          SUPER_ADMIN passes all checks automatically (mirrors backend has_any_role() bypass).
        </AlertDescription>
      </Alert>

      <GallerySection title="D-009-A2 — Factory Ledger: FINANCE ✓ / ADMIN ✗" stacked>
        <GateDemo user={{ role: UserRole.SUPER_ADMIN }} permission={Resource.FACTORY_LEDGER_VIEW} label="Factory Ledger View" />
        <GateDemo user={{ role: UserRole.FINANCE }} permission={Resource.FACTORY_LEDGER_VIEW} label="Factory Ledger View" />
        <GateDemo user={{ role: UserRole.ADMIN }} permission={Resource.FACTORY_LEDGER_VIEW} label="Factory Ledger View" />
        <GateDemo user={{ role: UserRole.OPERATIONS }} permission={Resource.FACTORY_LEDGER_VIEW} label="Factory Ledger View" />
      </GallerySection>

      <GallerySection title="D-010-A3/A4 — Dashboard payments: ADMIN+FINANCE ✓ / OPERATIONS ✗" stacked>
        <GateDemo user={{ role: UserRole.ADMIN }} permission={Resource.DASHBOARD_PAYMENTS_TAB} label="Dashboard Payments Tab" />
        <GateDemo user={{ role: UserRole.FINANCE }} permission={Resource.DASHBOARD_PAYMENTS_TAB} label="Dashboard Payments Tab" />
        <GateDemo user={{ role: UserRole.OPERATIONS }} permission={Resource.DASHBOARD_PAYMENTS_TAB} label="Dashboard Payments Tab" />
      </GallerySection>

      <GallerySection title="Null user (unauthenticated)" stacked>
        <RoleGate
          user={null}
          permission={Resource.ORDER_LIST}
          fallback={
            <Alert variant="destructive">
              <AlertTitle>Not authenticated</AlertTitle>
              <AlertDescription>No user session — redirect to login.</AlertDescription>
            </Alert>
          }
        >
          <p>This should not render.</p>
        </RoleGate>
      </GallerySection>
    </div>
  );
}
