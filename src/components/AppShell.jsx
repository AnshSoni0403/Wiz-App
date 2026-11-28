import { Box, UnstyledButton } from "@mantine/core";
import markUrl from "../assets/images/marwiz-mark.png";
import { NavLink, Outlet } from "react-router-dom";
import Icon from "./Icon";
import OfflineBanner from "./OfflineBanner";
import InstallPrompt from "./InstallPrompt";
import UpdatePrompt from "./UpdatePrompt";
import NotificationsDrawer from "./NotificationsDrawer";
import { NotificationsProvider, useNotifications } from "../context/NotificationsContext";

/** Primary navigation with a task notification count. */
const MainNav = ({ agents }) => {
    const n = useNotifications();
    const unread = n?.available ? n.unread : 0;
    return (
        <nav className="bottom-nav" aria-label="Main">
            <div className="nav-brand">
                <img src={markUrl} alt="" width="28" height="28" />
                <span>Wizz</span>
            </div>
            {agents.map((agent) => {
                const badge = agent.key === "tasks" && unread > 0;
                return (
                    <UnstyledButton
                        component={NavLink}
                        key={agent.key}
                        to={agent.path}
                        className="bottom-nav__item"
                        aria-label={badge ? `${agent.label}, ${unread} unread notifications` : undefined}
                    >
                        <span className="bottom-nav__icon">
                            <Icon name={agent.icon} size={19} />
                            {badge ? (
                                <span className="count-badge count-badge--nav" aria-hidden="true">
                                    {unread > 99 ? "99+" : unread}
                                </span>
                            ) : null}
                        </span>
                        <span>{agent.label}</span>
                    </UnstyledButton>
                );
            })}
            <UnstyledButton component={NavLink} to="/profile" className="bottom-nav__item bottom-nav__profile">
                <Icon name="user" size={19} />
                <span>Profile</span>
            </UnstyledButton>
        </nav>
    );
};

/**
 * Signed-in layout: offline banner, the active screen, install / update prompts, the notification
 * inbox and primary navigation (one tab per enabled agent + Profile).
 */
const AppShell = ({ agents }) => {
    const hasTasks = agents.some((a) => a.key === "tasks");
    const tasksPath = agents.find((a) => a.key === "tasks")?.path || "/tasks";
    return (
        <NotificationsProvider enabled={hasTasks}>
            <Box className="app">
                <OfflineBanner />
                <Box className="app-main" component="main">
                    <Outlet />
                </Box>
                <div className="app-toasts">
                    <UpdatePrompt />
                    <InstallPrompt />
                </div>
                <MainNav agents={agents} />
            </Box>
            {hasTasks ? <NotificationsDrawer tasksPath={tasksPath} /> : null}
        </NotificationsProvider>
    );
};

export default AppShell;
