import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import logoGlyph from "../assets/logo-glyph.png";
import type { ProPlanId, Usuario } from "../types";
import UserAvatar from "./UserAvatar";
import "./AppSidebar.css";

export type SidebarItemKey =
  | "home"
  | "entrenamiento"
  | "rutinas"
  | "descubrir"
  | "buscar"
  | "notificaciones"
  | "perfil"
  | "mas"
  | "gemini"
  | "plan";

type ThemeMode = "dark" | "light";

type AppSidebarProps = {
  usuario: Usuario;
  canTrain: boolean;
  activeKey: SidebarItemKey | null;
  unreadNotifications: number;
  notificationsOpen: boolean;
  themeMode: ThemeMode;
  proPlan: ProPlanId | null;
  onGoHome: () => void;
  onGoTraining: () => void;
  onGoRoutines: () => void;
  onGoDiscover: () => void;
  onGoSearch: () => void;
  onToggleNotifications: () => void;
  onGoProfile: () => void;
  onOpenGemini: () => void;
  onGoPlan: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

const PLAN_LABELS: Record<ProPlanId, string> = {
  monthly: "PRO",
  yearly: "LOOKSMAXXER",
  lifetime: "CHAD",
};

const HOVER_EXPAND_DELAY_MS = 70;
const GLYPH_STYLE = { "--sidebar-glyph-url": `url("${logoGlyph}")` } as CSSProperties;
const MOBILE_QUERY = "(max-width: 767px)";

const subscribeToMobileQuery = (callback: () => void) => {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

const getIsMobile = () => window.matchMedia(MOBILE_QUERY).matches;

type IconProps = { active?: boolean };

const strokeWidth = (active?: boolean) => (active ? 2.5 : 1.9);

function HomeIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function TrainingIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h18" />
      <path d="M6 6v4" />
      <path d="M18 6v4" />
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8v5" />
      <path d="M8 13h8" />
      <path d="M9 18l3-5 3 5" />
    </svg>
  );
}

function RoutinesIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3h8" />
      <path d="M9 3v3h6V3" />
      <path d="M6 5h12v16H6z" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

function DiscoverIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21" />
      <path d="M12 3C9.5 5.4 8.2 8.4 8.2 12S9.5 18.6 12 21" />
    </svg>
  );
}

function SearchIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" />
    </svg>
  );
}

function BellIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function MenuIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function SparkleIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth(active)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5c.8 3.3 1.7 4.9 3 6.2s2.9 2.2 6.2 3c-3.3.8-4.9 1.7-6.2 3s-2.2 2.9-3 6.2c-.8-3.3-1.7-4.9-3-6.2s-2.9-2.2-6.2-3c3.3-.8 4.9-1.7 6.2-3s2.2-2.9 3-6.2Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .91l-.02.05a2 2 0 0 1-3.66 0l-.02-.05a1.7 1.7 0 0 0-1-.91 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.91-1l-.05-.02a2 2 0 0 1 0-3.66l.05-.02a1.7 1.7 0 0 0 .91-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 0 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-.91l.02-.05a2 2 0 0 1 3.66 0l.02.05a1.7 1.7 0 0 0 1 .91 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.37 9c.38.14.7.45.91.82l.05.02a2 2 0 0 1 0 3.66l-.05.02a1.7 1.7 0 0 0-.88 1.48Z" />
    </svg>
  );
}

function ThemeIcon({ themeMode }: { themeMode: ThemeMode }) {
  if (themeMode === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 7.4A8 8 0 1 1 12 3Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

type SideItemProps = {
  itemKey: SidebarItemKey;
  label: string;
  sublabel?: string;
  active: boolean;
  icon: ReactNode;
  badge?: number;
  className?: string;
  onClick: () => void;
  ariaExpanded?: boolean;
  ariaHasPopup?: "menu" | "dialog";
};

function SideItem({
  itemKey,
  label,
  sublabel,
  active,
  icon,
  badge,
  className = "",
  onClick,
  ariaExpanded,
  ariaHasPopup,
}: SideItemProps) {
  return (
    <button
      type="button"
      className={`side-item side-item-${itemKey} ${active ? "is-active" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-current={active && !ariaHasPopup ? "page" : undefined}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-label={label}
    >
      <span className="side-item-icon">
        {icon}
        {badge && badge > 0 ? <span className="side-item-badge">{badge > 9 ? "9+" : badge}</span> : null}
      </span>
      <span className="side-item-text">
        <span className="side-item-label">{label}</span>
        {sublabel ? <small className="side-item-sublabel">{sublabel}</small> : null}
      </span>
    </button>
  );
}

function AppSidebar({
  usuario,
  canTrain,
  activeKey,
  unreadNotifications,
  notificationsOpen,
  themeMode,
  proPlan,
  onGoHome,
  onGoTraining,
  onGoRoutines,
  onGoDiscover,
  onGoSearch,
  onToggleNotifications,
  onGoProfile,
  onOpenGemini,
  onGoPlan,
  onOpenSettings,
  onToggleTheme,
  onLogout,
}: AppSidebarProps) {
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);
  const mobileMoreRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useSyncExternalStore(subscribeToMobileQuery, getIsMobile, () => false);
  const expanded = !isMobile && !notificationsOpen && (hovered || keyboardFocused || moreOpen);
  const planLabel = proPlan ? PLAN_LABELS[proPlan] : null;

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current != null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (moreWrapRef.current?.contains(target) || mobileMoreRef.current?.contains(target))
      ) {
        return;
      }
      setMoreOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setHovered(true);
      hoverTimerRef.current = null;
    }, HOVER_EXPAND_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHovered(false);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
      setKeyboardFocused(true);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) {
      setKeyboardFocused(false);
    }
  };

  const runAndCloseMenu = (action: () => void) => {
    setMoreOpen(false);
    action();
  };

  const moreMenu = moreOpen ? (
    <div className="side-more-menu" role="menu" aria-label="Más opciones">
      <button
        type="button"
        role="menuitem"
        className="side-more-option"
        onClick={() => runAndCloseMenu(onOpenSettings)}
      >
        <span className="side-more-option-icon">
          <GearIcon />
        </span>
        <span>Configuración</span>
      </button>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={themeMode === "dark"}
        className="side-more-option"
        onClick={onToggleTheme}
      >
        <span className="side-more-option-icon">
          <ThemeIcon themeMode={themeMode} />
        </span>
        <span className="side-more-option-copy">
          <span>Tema</span>
          <small>{themeMode === "dark" ? "Oscuro" : "Claro"}</small>
        </span>
        <span className={`side-theme-switch ${themeMode === "dark" ? "on" : ""}`} aria-hidden="true">
          <span />
        </span>
      </button>
      <div className="side-more-divider" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="side-more-option side-more-logout"
        onClick={() => runAndCloseMenu(onLogout)}
      >
        <span>Salir</span>
      </button>
    </div>
  ) : null;

  return (
    <>
      <header className="mobile-topbar" style={GLYPH_STYLE}>
        <button type="button" className="mobile-brand" onClick={onGoHome} aria-label="Ir al inicio">
          <span className="sidebar-glyph" aria-hidden="true" />
          <span className="mobile-brand-word">GymMaxxing</span>
        </button>
        <div className="mobile-topbar-actions">
          <button type="button" className="mobile-icon-btn gemini" onClick={onOpenGemini} aria-label="Abrir Gemini">
            <SparkleIcon />
          </button>
          <button
            type="button"
            className={`mobile-pro-btn ${proPlan ? "subscribed" : ""} ${activeKey === "plan" ? "is-active" : ""}`}
            onClick={onGoPlan}
            aria-label="Tu plan"
          >
            {planLabel ?? "PRO"}
          </button>
          <button
            type="button"
            className={`mobile-icon-btn ${activeKey === "notificaciones" ? "is-active" : ""}`}
            onClick={onToggleNotifications}
            aria-label="Notificaciones"
          >
            <BellIcon active={activeKey === "notificaciones"} />
            {unreadNotifications > 0 ? (
              <span className="side-item-badge">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
            ) : null}
          </button>
          <div className="mobile-more-wrap" ref={mobileMoreRef}>
            <button
              type="button"
              className={`mobile-icon-btn ${moreOpen || activeKey === "mas" ? "is-active" : ""}`}
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-label="Más"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <MenuIcon active={moreOpen || activeKey === "mas"} />
            </button>
            {isMobile ? moreMenu : null}
          </div>
        </div>
      </header>

      <aside
        className={`app-sidebar ${expanded ? "is-expanded" : ""} ${notificationsOpen ? "has-drawer" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label="Navegación principal"
        style={GLYPH_STYLE}
      >
        <button type="button" className="sidebar-brand" onClick={onGoHome} aria-label="GymMaxxing, ir al inicio">
          <span className="sidebar-glyph" aria-hidden="true" />
          <span className="sidebar-wordmark" aria-hidden="true">
            {"GymMaxxing".split("").map((letter, index) => (
              <span key={`${letter}-${index}`} style={{ transitionDelay: `${60 + index * 18}ms` }}>
                {letter}
              </span>
            ))}
          </span>
        </button>

        <nav className="sidebar-nav">
          <SideItem
            itemKey="home"
            label="Inicio"
            active={activeKey === "home"}
            icon={<HomeIcon active={activeKey === "home"} />}
            onClick={onGoHome}
          />
          {canTrain ? (
            <SideItem
              itemKey="entrenamiento"
              label="Entrenamiento"
              active={activeKey === "entrenamiento"}
              icon={<TrainingIcon active={activeKey === "entrenamiento"} />}
              onClick={onGoTraining}
            />
          ) : null}
          <SideItem
            itemKey="rutinas"
            label="Rutinas"
            active={activeKey === "rutinas"}
            icon={<RoutinesIcon active={activeKey === "rutinas"} />}
            onClick={onGoRoutines}
          />
          <SideItem
            itemKey="descubrir"
            label="Descubrir"
            active={activeKey === "descubrir"}
            icon={<DiscoverIcon active={activeKey === "descubrir"} />}
            onClick={onGoDiscover}
          />
          <SideItem
            itemKey="buscar"
            label="Buscar"
            active={activeKey === "buscar"}
            icon={<SearchIcon active={activeKey === "buscar"} />}
            onClick={onGoSearch}
          />
          <SideItem
            itemKey="notificaciones"
            label="Notificaciones"
            active={activeKey === "notificaciones"}
            icon={<BellIcon active={activeKey === "notificaciones"} />}
            badge={unreadNotifications}
            ariaHasPopup="dialog"
            ariaExpanded={notificationsOpen}
            onClick={() => {
              setMoreOpen(false);
              onToggleNotifications();
            }}
          />
          <SideItem
            itemKey="perfil"
            label="Perfil"
            active={activeKey === "perfil"}
            icon={
              <UserAvatar
                username={usuario.username}
                photoUrl={usuario.foto_perfil_url}
                className="side-profile-avatar"
              />
            }
            onClick={onGoProfile}
          />
        </nav>

        <div className="sidebar-footer">
          <div className="side-more-wrap" ref={moreWrapRef}>
            {isMobile ? null : moreMenu}
            <SideItem
              itemKey="mas"
              label="Más"
              active={moreOpen || activeKey === "mas"}
              icon={<MenuIcon active={moreOpen || activeKey === "mas"} />}
              ariaHasPopup="menu"
              ariaExpanded={moreOpen}
              onClick={() => setMoreOpen((prev) => !prev)}
            />
          </div>
          <SideItem
            itemKey="gemini"
            label="Gemini"
            sublabel="Crear rutinas con IA"
            active={false}
            icon={<SparkleIcon />}
            onClick={onOpenGemini}
          />
          <SideItem
            itemKey="plan"
            label={planLabel ? `Plan ${planLabel}` : "Plan gratuito"}
            sublabel={planLabel ? "Suscripción activa" : "Pasate a PRO"}
            active={activeKey === "plan"}
            className={proPlan ? "is-subscribed" : ""}
            icon={<span className="side-pro-pill">PRO</span>}
            onClick={onGoPlan}
          />
        </div>
      </aside>
    </>
  );
}

export default AppSidebar;
