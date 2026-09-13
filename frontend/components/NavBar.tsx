import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

export function NavBar() {
  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          🤝 Handshake
        </Link>
        <nav className="flex items-center gap-5 text-sm text-ink/70">
          <Link href="/create" className="hover:text-ink">Create</Link>
          <Link href="/my-deals" className="hover:text-ink">My Deals</Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
