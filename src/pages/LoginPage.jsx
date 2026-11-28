import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconLock, IconMail } from "@tabler/icons-react";
import { useState } from "react";
import logoUrl from "../assets/images/marwiz-logo-gold.png";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { friendlyMessage, toApiError } from "../utils/errors";
import useOnlineStatus from "../hooks/useOnlineStatus";
import OfflineBanner from "../components/OfflineBanner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign in with the existing Marwiz Vision company login (same endpoint as the Admin). */
const LoginPage = () => {
    const { login } = useAuth();
    const online = useOnlineStatus();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const onSubmit = async (event) => {
        event.preventDefault();
        if (busy) return;
        if (!EMAIL_RE.test(email.trim())) {
            setError("Enter a valid email address.");
            return;
        }
        if (!password) {
            setError("Enter your password.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            await login({ email, password });
        } catch (err) {
            const e = toApiError(err);
            setError(e.kind === "http" && e.serverMessage ? e.serverMessage : friendlyMessage(e));
            setBusy(false);
        }
    };

    return (
        <div className="status-screen">
            <OfflineBanner />
            <div className="status-screen__center">
                <Paper className="auth-panel" withBorder shadow="md" p="xl" radius="xl">
                    <Stack gap={4} align="center" mb="lg">
                        <img src={logoUrl} alt="Marwiz Vision" className="auth-panel__logo" />
                        <Title order={1} size="h2" mt={8}>
                            Sign in to Wizz
                        </Title>
                        <Text size="sm" c="dimmed" ta="center">
                            Marwiz Vision's AI assistant
                        </Text>
                    </Stack>

                    <form onSubmit={onSubmit} noValidate>
                        <Stack gap="sm">
                            <TextInput
                                label="Work email"
                                placeholder="name@company.com"
                                type="email"
                                inputMode="email"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck="false"
                                leftSection={<IconMail size={16} stroke={1.75} />}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={busy}
                                required
                                size="md"
                            />
                            <PasswordInput
                                label="Password"
                                placeholder="Your password"
                                autoComplete="current-password"
                                leftSection={<IconLock size={16} stroke={1.75} />}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={busy}
                                required
                                size="md"
                                visibilityToggleButtonProps={{ "aria-label": "Show or hide password" }}
                            />

                            {error ? (
                                <Alert color="red" icon={<Icon name="alert" size={16} />} role="alert" py="xs">
                                    {error}
                                </Alert>
                            ) : null}

                            <Button type="submit" size="md" fullWidth loading={busy} disabled={!online} mt={4}>
                                Sign in
                            </Button>
                        </Stack>
                    </form>
                </Paper>
                <Text size="xs" c="dimmed" ta="center" mt="md" maw={340}>
                    Forgot your password? Reset it from the Marwiz Vision Admin sign-in page.
                </Text>
            </div>
        </div>
    );
};

export default LoginPage;
