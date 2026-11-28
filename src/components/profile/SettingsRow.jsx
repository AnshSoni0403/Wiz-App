import { Group, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import Icon from "../Icon";

/**
 * One row of a settings list (iOS/Android style): icon, label + description, and a right-hand control
 * (`right`) or a chevron when the row is pressable (`onClick` / `component`).
 */
const SettingsRow = ({ icon, iconColor = "gold", label, description, right = null, onClick, component, danger = false, ...rest }) => {
    const pressable = Boolean(onClick || component);
    const body = (
        <Group gap="sm" wrap="nowrap" className="settings-row__inner">
            {icon ? (
                <ThemeIcon size={34} radius="md" variant="light" color={danger ? "red" : iconColor}>
                    {typeof icon === "string" ? <Icon name={icon} size={18} /> : icon}
                </ThemeIcon>
            ) : null}
            <div className="settings-row__text">
                <Text size="sm" fw={500} c={danger ? "red.7" : undefined}>
                    {label}
                </Text>
                {description ? (
                    <Text size="xs" c="dimmed" component="div">
                        {description}
                    </Text>
                ) : null}
            </div>
            {right}
            {pressable && !right ? <Icon name="chevron-right" size={16} className="settings-row__chevron" /> : null}
        </Group>
    );
    if (!pressable) return <div className="settings-row">{body}</div>;
    return (
        <UnstyledButton className="settings-row settings-row--pressable" onClick={onClick} component={component} {...rest}>
            {body}
        </UnstyledButton>
    );
};

export default SettingsRow;
