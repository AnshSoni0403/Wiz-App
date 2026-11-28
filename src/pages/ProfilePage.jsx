import { Avatar, Badge, Group, Paper, Stack, Text } from "@mantine/core";
import TopBar from "../components/TopBar";
import Icon from "../components/Icon";
import SettingsRow from "../components/profile/SettingsRow";
import TelegramLinkCard from "../components/profile/TelegramLinkCard";
import PushNotificationsCard from "../components/profile/PushNotificationsCard";
import { useAuth } from "../context/AuthContext";
import { useInstallPrompt } from "../pwa/installPrompt";
import { AUDIENCE_LABELS, ROLE_LABELS, branchName, initials } from "../utils/format";
import { canUseTasks } from "../agents/access";

const TASK_ROLE_LABELS = { owner: "Task owner", branch_head: "Branch head", team_lead: "Team lead", staff: "Staff" };

const Section = ({ title, children }) => (
    <section className="settings-section">
        <Text component="h2" size="xs" fw={600} c="dimmed" tt="uppercase" className="settings-section__title">
            {title}
        </Text>
        <Paper withBorder radius="lg" className="settings-section__list">
            {children}
        </Paper>
    </section>
);

/** Profile & settings (reached from the account menu): who you are, access, devices, sign out. */
const ProfilePage = () => {
    const { user, wizz, logout } = useAuth();
    const { canInstall, promptInstall, standalone, ios } = useInstallPrompt();
    const member = wizz?.member || {};
    const branches = wizz?.branches || [];
    const name = member.name || user?.employeeName || "Wizz member";
    const email = member.email || user?.emailOffice || "";
    const memberBranches = member.branches?.length ? member.branches : branches.map((b) => b.code);
    const taskRole = wizz?.tasks?.enabled ? TASK_ROLE_LABELS[wizz.tasks.role] : null;

    return (
        <div className="page">
            <TopBar title="Profile & settings" back="/" />
            <div className="page__body">
                <Paper withBorder radius="lg" p="md" className="profile-hero">
                    <Group gap="md" wrap="nowrap">
                        <Avatar size={56} radius="xl" color="gold" variant="filled" aria-hidden="true">
                            {initials(name)}
                        </Avatar>
                        <Stack gap={2} style={{ minWidth: 0 }}>
                            <Text fw={600} size="lg" truncate>
                                {name}
                            </Text>
                            {email ? (
                                <Text size="sm" c="dimmed" truncate>
                                    {email}
                                </Text>
                            ) : null}
                            <Group gap={6} mt={4}>
                                <Badge color="gold">{ROLE_LABELS[member.role] || member.role || "Member"}</Badge>
                                {wizz?.isOwner ? <Badge color="gold" variant="outline">Full access</Badge> : null}
                                {taskRole && taskRole !== "Staff" ? <Badge color="blue">{taskRole}</Badge> : null}
                            </Group>
                        </Stack>
                    </Group>
                </Paper>

                <Section title="Access">
                    <SettingsRow
                        icon="home"
                        label="Branches"
                        description={
                            <Group gap={6} mt={4}>
                                {memberBranches.map((code) => (
                                    <Badge key={code} color="gray" variant={code === member.homeBranch ? "filled" : "light"}>
                                        {branchName(code, branches)}
                                        {code === member.homeBranch ? " · Home" : ""}
                                    </Badge>
                                ))}
                            </Group>
                        }
                    />
                    {member.maxAudience ? (
                        <SettingsRow icon="eye" label="Knowledge access" description={`Wizz answers from ${AUDIENCE_LABELS[member.maxAudience] || member.maxAudience}.`} />
                    ) : null}
                </Section>

                <Section title="Connections & devices">
                    <TelegramLinkCard />
                    {canUseTasks(wizz) ? <PushNotificationsCard /> : null}
                    {!standalone && (canInstall || ios) ? (
                        canInstall ? (
                            <SettingsRow icon="download" label="Install the app" description="Add Wizz to your home screen." onClick={() => promptInstall()} />
                        ) : (
                            <SettingsRow
                                icon="device"
                                label="Install the app"
                                description={
                                    <>
                                        In Safari, tap <Icon name="share" size={12} className="inline-icon" /> Share, then <b>Add to Home Screen</b>.
                                    </>
                                }
                            />
                        )
                    ) : null}
                </Section>

                <Section title="Account">
                    <SettingsRow icon="info" iconColor="gray" label="About Wizz" description={`Version ${__APP_VERSION__} · Marwiz Vision`} />
                    <SettingsRow icon="logout" label="Sign out" danger onClick={logout} />
                </Section>
            </div>
        </div>
    );
};

export default ProfilePage;
