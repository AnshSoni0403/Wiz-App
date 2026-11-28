import { Button, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useState } from "react";
import markUrl from "../assets/images/marwiz-mark.png";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { NO_ACCESS_MESSAGE } from "../utils/errors";

/** Signed in, but GET /wizz/me answered 403 WIZZ_NO_ACCESS. */
const NoAccessPage = () => {
    const { user, logout, retry } = useAuth();
    const [busy, setBusy] = useState(false);
    const name = user?.employeeName;

    return (
        <div className="status-screen">
            <div className="status-screen__center">
                <Paper className="auth-panel" withBorder shadow="md" p="xl" radius="xl">
                    <Stack gap="sm" align="center" ta="center">
                        <img src={markUrl} alt="Marwiz" width="44" height="44" />
                        <ThemeIcon size={48} radius="xl" variant="light" color="gold">
                            <Icon name="blocked" size={24} />
                        </ThemeIcon>
                        <Title order={1} size="h2">
                            {name ? `Hi ${name}` : "No Wizz access"}
                        </Title>
                        <Text size="sm" c="dimmed">
                            {NO_ACCESS_MESSAGE}
                        </Text>
                        <Stack gap="xs" w="100%" mt="sm">
                            <Button
                                fullWidth
                                loading={busy}
                                leftSection={<Icon name="refresh" size={16} />}
                                onClick={async () => {
                                    setBusy(true);
                                    await retry({ silent: true });
                                    setBusy(false);
                                }}
                            >
                                Check again
                            </Button>
                            <Button fullWidth variant="subtle" color="gray" leftSection={<Icon name="logout" size={16} />} onClick={logout}>
                                Sign out
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </div>
        </div>
    );
};

export default NoAccessPage;
