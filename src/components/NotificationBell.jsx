import { ActionIcon } from "@mantine/core";
import Icon from "./Icon";
import { useNotifications } from "../context/NotificationsContext";

/** Bell with the unread count; opens the inbox. Hidden where the inbox is not available. */
const NotificationBell = () => {
    const n = useNotifications();
    if (!n?.available) return null;
    const count = n.unread;
    const label = count ? `Notifications, ${count} unread` : "Notifications";
    return (
        <ActionIcon unstyled type="button" className="icon-btn bell-btn" onClick={n.openInbox} aria-label={label}>
            <Icon name="bell" size={22} />
            {count ? (
                <span className="count-badge" aria-hidden="true">
                    {count > 99 ? "99+" : count}
                </span>
            ) : null}
        </ActionIcon>
    );
};

export default NotificationBell;
