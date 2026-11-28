import { ActionIcon, Indicator } from "@mantine/core";
import Icon from "./Icon";
import { useNotifications } from "../context/NotificationsContext";

/** Bell with the unread count; opens the inbox. Hidden where the inbox is not available. */
const NotificationBell = () => {
    const n = useNotifications();
    if (!n?.available) return null;
    const count = n.unread;
    const label = count ? `Notifications, ${count} unread` : "Notifications";
    return (
        <Indicator label={count > 99 ? "99+" : count} disabled={!count} size={16} offset={6} withBorder>
            <ActionIcon onClick={n.openInbox} aria-label={label} color="dark">
                <Icon name="bell" size={20} />
            </ActionIcon>
        </Indicator>
    );
};

export default NotificationBell;
