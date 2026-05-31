"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, ChevronLeft, ChevronRight, ImageUp, LayoutDashboard, LogOut, Sprout, UserCircle2 } from "lucide-react";

type AppShellProps = {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  variant?: "default" | "map";
};

const menuItems = [
  { href: "/dashboard", label: "Dashboard", description: "Parcelas y mapa", icon: LayoutDashboard },
  { href: "/upload", label: "Verificar semillas", description: "Productor, lote y analisis", icon: ImageUp },
  { href: "/assistant", label: "Asistente IA", description: "Chat con Gemini", icon: Bot },
];

export function AppShell({ children, title, eyebrow = "Area privada", variant = "default" }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("nexo-token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setEmail(window.localStorage.getItem("nexo-email") ?? "Sesion activa");
    setCollapsed(window.localStorage.getItem("nexo-sidebar-collapsed") === "true");
    setReady(true);
  }, [router]);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("nexo-sidebar-collapsed", String(next));
      return next;
    });
  }

  function logout() {
    window.localStorage.removeItem("nexo-token");
    window.localStorage.removeItem("nexo-email");
    window.localStorage.removeItem("nexo-user");
    window.localStorage.removeItem("nexo-auth-provider");
    router.push("/");
  }

  if (!ready) {
    return (
      <main className="appLoading">
        <Sprout size={28} />
        Preparando tu espacio...
      </main>
    );
  }

  return (
    <main className={collapsed ? "appShell sidebarCollapsed" : "appShell"}>
      <aside className="appSidebar" aria-label="Menu principal">
        <div className="sidebarTop">
          <Link className="brand sidebarBrand" href="/dashboard" aria-label="NEXO dashboard">
            <span>NX</span>
            <strong>NEXO</strong>
          </Link>
          <button
            className="sidebarToggle"
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
            title={collapsed ? "Expandir menu" : "Minimizar menu"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebarNav" aria-label="Menu de funcionalidades">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} className={active ? "menuItem active" : "menuItem"} href={item.href} title={collapsed ? item.label : undefined}>
                <Icon size={20} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <div className="sidebarUser" title={collapsed ? email : undefined}>
            <UserCircle2 size={28} />
            <span>
              <strong>{email}</strong>
              <small>Cuenta demo</small>
            </span>
          </div>
          <button className="logoutButton" type="button" onClick={logout} title={collapsed ? "Salir" : undefined}>
            <LogOut size={18} />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      <section className={variant === "map" ? "appMain mapAppMain" : "appMain"}>
        <header className={variant === "map" ? "appHeader mapAppHeader" : "appHeader"}>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <span>{email}</span>
        </header>
        {children}
      </section>
    </main>
  );
}
