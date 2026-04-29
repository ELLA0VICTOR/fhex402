import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { GhostIcon, PayrollIcon, ShieldIcon, VaultIcon } from "@/components/icons";

const NAV = [
  { path: "/", label: "Dashboard", Icon: GhostIcon },
  { path: "/payroll", label: "Payroll", Icon: PayrollIcon },
  { path: "/vault", label: "Vault", Icon: VaultIcon },
  { path: "/audit", label: "Audit", Icon: ShieldIcon },
];

export function Sidebar({ open, onClose }) {
  return (
    <aside className={`app-sidebar ${open ? "open" : "closed"}`} aria-hidden={!open}>
      <div className="sidebar-brand">
        <div>
          <div className="sidebar-title">Workspace</div>
          <div className="sidebar-subtitle">Private payroll rail</div>
        </div>
        <button type="button" onClick={onClose} className="sidebar-close" title="Close navigation rail">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer" aria-hidden="true" />
    </aside>
  );
}
