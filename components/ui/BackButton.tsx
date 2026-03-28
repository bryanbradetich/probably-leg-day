import Link from "next/link";

type BackButtonProps = {
  href: string;
  label: string;
};

export function BackButton({ href, label }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-theme-text-muted transition hover:text-theme-text-primary"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
