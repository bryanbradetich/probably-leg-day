import Link from "next/link";

type BackButtonProps = {
  href: string;
  label: string;
};

export function BackButton({ href, label }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
