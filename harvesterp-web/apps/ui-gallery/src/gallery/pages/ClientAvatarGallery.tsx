import { UserRole } from "@harvesterp/lib";
import { ClientAvatar } from "@/components/composed/client-avatar";
import { GallerySection } from "../GallerySection";

export function ClientAvatarGallery() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">ClientAvatar (P-020)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consolidates 4 inline implementations. Uses Layer 1{" "}
          <code className="rounded bg-muted px-1">getInitials</code> +{" "}
          <code className="rounded bg-muted px-1">getAvatarHexColor</code> +{" "}
          <code className="rounded bg-muted px-1">getAvatarClass</code>.
        </p>
      </div>

      <GallerySection title='Variant "class" — role-based Tailwind classes'>
        <ClientAvatar name="Sachin Murugesan" role={UserRole.ADMIN} size="lg" />
        <ClientAvatar name="Finance User" role={UserRole.FINANCE} size="lg" />
        <ClientAvatar name="Ops Team" role={UserRole.OPERATIONS} size="lg" />
        <ClientAvatar name="Client Name" role={UserRole.CLIENT} size="lg" />
        <ClientAvatar name="Factory Ltd" role={UserRole.FACTORY} size="lg" />
      </GallerySection>

      <GallerySection title='Variant "hex" — name-based deterministic colour'>
        <ClientAvatar name="Alice Johnson" variant="hex" size="lg" />
        <ClientAvatar name="Bob Smith" variant="hex" size="lg" />
        <ClientAvatar name="charlie@example.com" variant="hex" size="lg" />
        <ClientAvatar name="David.Chen" variant="hex" size="lg" />
        <ClientAvatar name="Priya Natarajan" variant="hex" size="lg" />
      </GallerySection>

      <GallerySection title="Sizes (sm / md / lg)">
        <ClientAvatar name="Alice Johnson" variant="hex" size="sm" />
        <ClientAvatar name="Alice Johnson" variant="hex" size="md" />
        <ClientAvatar name="Alice Johnson" variant="hex" size="lg" />
      </GallerySection>

      <GallerySection title="Edge cases">
        <ClientAvatar name="" variant="hex" size="md" />
        <ClientAvatar name="X" variant="hex" size="md" />
        <ClientAvatar name="alice@example.com" variant="hex" size="md" />
      </GallerySection>
    </div>
  );
}
