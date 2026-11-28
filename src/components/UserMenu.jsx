import { Avatar, Menu, Text, UnstyledButton } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useAuth } from "../context/AuthContext";
import { useInstallPrompt } from "../pwa/installPrompt";
import { ROLE_LABELS, initials } from "../utils/format";

/** Avatar in the header: who is signed in, Profile & settings, install, sign out. */
const UserMenu = ({ size = 30, position = "bottom-end" }) => {
    const { user, wizz, logout } = useAuth();
    const navigate = useNavigate();
    const { canInstall, promptInstall, standalone } = useInstallPrompt();
    const member = wizz?.member || {};
    const name = member.name || user?.employeeName || "Wizz member";
    const email = member.email || user?.emailOffice || "";
    return (
        <Menu position={position}>
            <Menu.Target>
                <UnstyledButton className="user-menu__btn" aria-label={`Account menu for ${name}`}>
                    <Avatar size={size} radius="xl" color="gold" variant="filled">
                        {initials(name)}
                    </Avatar>
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
                <div className="user-menu__who">
                    <Text fw={600} size="sm" truncate>{name}</Text>
                    {email ? <Text size="xs" c="dimmed" truncate>{email}</Text> : null}
                    <Text size="xs" c="gold.7" fw={600}>{ROLE_LABELS[member.role] || (wizz?.isOwner ? "Owner" : "Member")}</Text>
                </div>
                <Menu.Divider />
                <Menu.Item leftSection={<Icon name="settings" size={16} />} onClick={() => navigate("/profile")}>
                    Profile &amp; settings
                </Menu.Item>
                {!standalone && canInstall ? (
                    <Menu.Item leftSection={<Icon name="download" size={16} />} onClick={() => promptInstall()}>
                        Install app
                    </Menu.Item>
                ) : null}
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<Icon name="logout" size={16} />} onClick={logout}>
                    Sign out
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
};

export default UserMenu;
