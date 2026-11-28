import { ActionIcon, Group, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import markUrl from "../assets/images/marwiz-mark.png";
import Icon from "./Icon";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

/**
 * Slim app header (52px). Left: back button (sub-screens) or the brand mark (phones), then title/subtitle.
 * Right: the screen's own actions (children), the notification bell and the account menu.
 * `back` = path or true (history back). `leading` is kept for older callers.
 */
const TopBar = ({ title = "Wizz", subtitle = null, back = null, leading = null, children = null, bell = true, account = true }) => {
    const navigate = useNavigate();
    const backBtn = back ? (
        <ActionIcon onClick={() => (back === true ? navigate(-1) : navigate(back))} aria-label="Back" color="dark">
            <Icon name="back" size={20} />
        </ActionIcon>
    ) : (
        leading
    );
    return (
        <Group component="header" wrap="nowrap" gap="xs" className="topbar">
            {backBtn || <img src={markUrl} alt="" className="topbar__mark" width="26" height="26" />}
            <div className="topbar__titles">
                <Text component="h1" className="topbar__title" truncate>
                    {title}
                </Text>
                {subtitle ? (
                    <Text className="topbar__subtitle" truncate>
                        {subtitle}
                    </Text>
                ) : null}
            </div>
            <Group gap={2} wrap="nowrap" className="topbar__trailing">
                {children}
                {bell ? <NotificationBell /> : null}
                {account ? <span className="topbar__account"><UserMenu size={28} /></span> : null}
            </Group>
        </Group>
    );
};

export default TopBar;
