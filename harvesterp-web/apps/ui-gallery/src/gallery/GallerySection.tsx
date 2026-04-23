import { cn } from "@/lib/utils";

interface GallerySectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  stacked?: boolean;
}

export function GallerySection({
  title,
  description,
  children,
  className,
  stacked = false,
}: GallerySectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div
        className={cn(
          stacked ? "flex flex-col gap-3" : "flex flex-wrap items-center gap-3",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
