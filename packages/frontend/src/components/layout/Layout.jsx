import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches;
}

export function Layout({ children }) {
  const { isConnected } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobileViewport());
  const showSidebar = isConnected && sidebarOpen;

  useEffect(() => {
    if (isConnected) setSidebarOpen(!isMobileViewport());
  }, [isConnected]);

  return (
    <div className="app-shell">
      <TopBar
        sidebarOpen={showSidebar}
        showSidebarControls={isConnected}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />

      <div className={`app-body ${showSidebar ? "has-sidebar" : ""}`}>
        {isConnected && <Sidebar open={showSidebar} onClose={() => setSidebarOpen(false)} />}
        <main className="app-main">
          <div className="app-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
