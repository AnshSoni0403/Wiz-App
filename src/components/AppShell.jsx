import { NavLink, Outlet } from "react-router-dom";
import Icon from "./Icon";
import OfflineBanner from "./OfflineBanner";
import InstallPrompt from "./InstallPrompt";
import UpdatePrompt from "./UpdatePrompt";
import NotificationsDrawer from "./NotificationsDrawer";
import { NotificationsProvider, useNotifications } from "../context/NotificationsContext";

/** Bottom navigation; the Tasks tab carries the unread notification count. */
const BottomNav = ({ agents }) => {
    const n = useNotifications();
    const unread = n?.available ? n.unread : 0;
    return (
        <nav className="bottom-nav" aria-label="Main">
            {agents.map((agent) => {
                const badge = agent.key === "tasks" && unread > 0;
                return (
                    <NavLink
                        key={agent.key}
                        to={agent.path}
                        className="bottom-nav__item"
                        aria-label={badge ? `${agent.label}, ${unread} unread notifications` : undefined}
                    >
                        <span className="bottom-nav__icon">
                            <Icon name={agent.icon} size={22} />
                            {badge ? (
                                <span className="count-badge count-badge--nav" aria-hidden="true">
                                    {unread > 99 ? "99+" : unread}
                                </span>
                            ) : null}
                        </span>
                        <span>{agent.label}</span>
                    </NavLink>
                );
            })}
            <NavLink to="/profile" className="bottom-nav__item">
                <Icon name="user" size={22} />
                <span>Profile</span>
            </NavLink>
        </nav>
    );
};

/**
 * Signed-in layout: offline banner, the active screen, install / update prompts, the notification
 * inbox and the bottom navigation (one tab per enabled agent + Profile).
 */
const AppShell = ({ agents }) => {
    const hasTasks = agents.some((a) => a.key === "tasks");
    const tasksPath = agents.find((a) => a.key === "tasks")?.path || "/tasks";
    return (
        <NotificationsProvider enabled={hasTasks}>
            <div className="app">
                <OfflineBanner />
                <main className="app-main">
                    <Outlet />
                </main>
                <div className="app-toasts">
                    <UpdatePrompt />
                    <InstallPrompt />
                </div>
                <BottomNav agents={agents} />
            </div>
            {hasTasks ? <NotificationsDrawer tasksPath={tasksPath} /> : null}
        </NotificationsProvider>
    );
};

export default AppShell;
