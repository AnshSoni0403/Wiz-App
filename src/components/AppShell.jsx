import { Box, Indicator, Tooltip, UnstyledButton } from "@mantine/core";
import { NavLink, Outlet } from "react-router-dom";
import markUrl from "../assets/images/marwiz-mark.png";
import Icon from "./Icon";
import OfflineBanner from "./OfflineBanner";
import InstallPrompt from "./InstallPrompt";
import UpdatePrompt from "./UpdatePrompt";
import NotificationsDrawer from "./NotificationsDrawer";
import UserMenu from "./UserMenu";
import { NotificationsProvider, useNotifications } from "../context/NotificationsContext";

/**
 * Primary navigation. Phones: a bottom tab bar (icon + short label). Tablet/desktop (≥768px): a slim left
 * rail with the brand on top and the account menu at the bottom. Profile lives in the account menu.
 */
const MainNav = ({ agents }) => {
    const n = useNotifications();
    const unread = n?.available ? n.unread : 0;
    return (
        <nav className="main-nav" aria-label="Main">
            <div className="main-nav__brand" aria-hidden="true">
                <img src={markUrl} alt="" width="30" height="30" />
            </div>
            <div className="main-nav__items">
                {agents.map((agent) => {
                    const badge = agent.key === "tasks" && unread > 0;
                    return (
                        <UnstyledButton
                            key={agent.key}
                            component={NavLink}
                            to={agent.path}
                            className="main-nav__item"
                            aria-label={badge ? `${agent.label}, ${unread} unread notifications` : agent.label}
                        >
                            <Indicator disabled={!badge} label={unread > 99 ? "99+" : unread} size={15} offset={3}>
                                <span className="main-nav__icon">
                                    <Icon name={agent.icon} size={22} />
                                </span>
                            </Indicator>
                            <span className="main-nav__label">{agent.label}</span>
                        </UnstyledButton>
                    );
                })}
            </div>
            <Tooltip label="Account" position="right">
                <div className="main-nav__account">
                    <UserMenu size={34} position="right-end" />
                </div>
            </Tooltip>
        </nav>
    );
};

/** Signed-in layout: offline banner, the active screen, install/update prompts, inbox and navigation. */
const AppShell = ({ agents }) => {
    const hasTasks = agents.some((a) => a.key === "tasks");
    const tasksPath = agents.find((a) => a.key === "tasks")?.path || "/tasks";
    return (
        <NotificationsProvider enabled={hasTasks}>
            <Box className="app">
                <MainNav agents={agents} />
                <Box className="app-main" component="main">
                    <OfflineBanner />
                    <Outlet />
                </Box>
                <div className="app-toasts">
                    <UpdatePrompt />
                    <InstallPrompt />
                </div>
            </Box>
            {hasTasks ? <NotificationsDrawer tasksPath={tasksPath} /> : null}
        </NotificationsProvider>
    );
};

export default AppShell;
