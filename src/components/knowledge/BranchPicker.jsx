import { Button, Menu } from "@mantine/core";
import { IconCheck, IconChevronDown, IconMapPin } from "@tabler/icons-react";

export const ALL_BRANCHES = "*";

/**
 * Branch filter for questions (header menu). Only branches from /wizz/me; "All my branches" sends no
 * branch. Hidden when the member has a single branch (nothing to choose).
 */
const BranchPicker = ({ branches, value, onChange, disabled = false }) => {
    if (!branches || branches.length < 2) return null;
    const current = branches.find((b) => b.code === value);
    const label = current ? current.code : "All";
    const options = [{ code: ALL_BRANCHES, name: "All my branches" }, ...branches];
    return (
        <Menu position="bottom-end" width={210}>
            <Menu.Target>
                <Button
                    variant="subtle"
                    color="dark"
                    size="compact-sm"
                    disabled={disabled}
                    leftSection={<IconMapPin size={15} stroke={1.75} />}
                    rightSection={<IconChevronDown size={13} stroke={1.75} />}
                    aria-label={`Branch: ${current ? current.name || current.code : "All my branches"}`}
                    className="branch-btn"
                >
                    {label}
                </Button>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>Answer for branch</Menu.Label>
                {options.map((b) => {
                    const selected = b.code === value || (b.code === ALL_BRANCHES && !current);
                    return (
                        <Menu.Item
                            key={b.code}
                            onClick={() => onChange(b.code)}
                            rightSection={selected ? <IconCheck size={15} stroke={2} /> : null}
                            fw={selected ? 600 : 400}
                        >
                            {b.name || b.code}
                        </Menu.Item>
                    );
                })}
            </Menu.Dropdown>
        </Menu>
    );
};

export default BranchPicker;
