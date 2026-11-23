import { NavLink, Outlet } from "react-router-dom";
import Icon from "./Icon";
import OfflineBanner from "./OfflineBanner";
import InstallPrompt from "./InstallPrompt";
import UpdatePrompt from "./UpdatePrompt";

/**
 * Signed-in layout: offline banner, the active screen, install / update prompts and the bottom
 * navigation (one tab per enabled agent + Profile).
 */
const AppShell = ({ agents }) => (
    <div className="app">
        <OfflineBanner />
        <main className="app-main">
            <Outlet />
        </main>
        <div className="app-toasts">
            <UpdatePrompt />
            <InstallPrompt />
        </div>
        <nav className="bottom-nav" aria-label="Main">
            {agents.map((agent) => (
                <NavLink key={agent.key} to={agent.path} className="bottom-nav__item">
                    <Icon name={agent.icon} size={22} />
                    <span>{agent.label}</span>
                </NavLink>
            ))}
            <NavLink to="/profile" className="bottom-nav__item">
                <Icon name="user" size={22} />
                <span>Profile</span>
            </NavLink>
        </nav>
    </div>
);

export default AppShell;
