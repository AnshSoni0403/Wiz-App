import { Button, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCloudOff } from "@tabler/icons-react";
import markUrl from "../assets/images/marwiz-mark.png";
import Icon from "../components/Icon";
import OfflineBanner from "../components/OfflineBanner";
import { useAuth } from "../context/AuthContext";
import { friendlyMessage } from "../utils/errors";

/** Startup failed for a reason other than "not signed in" (offline, server down). */
const ConnectionErrorPage = () => {
    const { error, retry, logout, user } = useAuth();
    return (
        <div className="status-screen">
            <OfflineBanner />
            <div className="status-screen__center">
                <Paper className="auth-panel" withBorder shadow="md" p="xl" radius="xl">
                    <Stack gap="sm" align="center" ta="center">
                        <img src={markUrl} alt="Marwiz" width="44" height="44" />
                        <ThemeIcon size={48} radius="xl" variant="light" color="red">
                            <IconCloudOff size={24} stroke={1.75} />
                        </ThemeIcon>
                        <Title order={1} size="h2">
                            Can't reach Wizz
                        </Title>
                        <Text size="sm" c="dimmed">
                            {friendlyMessage(error)}
                        </Text>
                        <Stack gap="xs" w="100%" mt="sm">
                            <Button fullWidth leftSection={<Icon name="refresh" size={16} />} onClick={() => retry()}>
                                Try again
                            </Button>
                            {user ? (
                                <Button fullWidth variant="subtle" color="gray" leftSection={<Icon name="logout" size={16} />} onClick={logout}>
                                    Sign out
                                </Button>
                            ) : null}
                        </Stack>
                    </Stack>
                </Paper>
            </div>
        </div>
    );
};

export default ConnectionErrorPage;
