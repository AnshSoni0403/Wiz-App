import { Group, Text } from "@mantine/core";
import markUrl from "../assets/images/marwiz-mark.png";
import NotificationBell from "./NotificationBell";

/** Page header: optional leading action, brand + title, trailing content, then the notification bell. */
const TopBar = ({ leading = null, title = "Wizz", subtitle = null, children = null, bell = true }) => (
    <Group component="header" wrap="nowrap" className="topbar">
        <div className="topbar__leading">{leading}</div>
        <div className="topbar__brand">
            <img src={markUrl} alt="" className="topbar__mark" width="28" height="28" />
            <div className="topbar__titles">
                <Text component="h1" className="topbar__title" truncate>{title}</Text>
                {subtitle ? <Text className="topbar__subtitle" truncate>{subtitle}</Text> : null}
            </div>
        </div>
        <div className="topbar__trailing">
            {children}
            {bell ? <NotificationBell /> : null}
        </div>
    </Group>
);

export default TopBar;
