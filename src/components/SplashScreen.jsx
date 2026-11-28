import { Loader, Stack, Text } from "@mantine/core";
import markUrl from "../assets/images/marwiz-mark.png";

const SplashScreen = ({ label = "Loading Wizz…" }) => (
    <div className="status-screen" role="status" aria-live="polite">
        <div className="status-screen__center">
            <Stack gap="md" align="center">
                <img src={markUrl} alt="" className="splash__mark" width="64" height="64" />
                <Loader size="sm" type="dots" color="gold" aria-hidden="true" />
                <Text size="xs" c="dimmed" className="sr-only">
                    {label}
                </Text>
            </Stack>
        </div>
    </div>
);

export default SplashScreen;
