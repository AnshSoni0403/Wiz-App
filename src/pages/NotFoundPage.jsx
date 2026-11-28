import { Button, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import Icon from "../components/Icon";
import { DEFAULT_AGENT_PATH } from "../agents/registry";

const NotFoundPage = () => (
    <div className="page">
        <TopBar title="Wizz" />
        <div className="page__body page__body--center">
            <Stack gap="sm" align="center" ta="center" maw={320}>
                <ThemeIcon size={56} radius="xl" variant="light" color="gold">
                    <Icon name="search" size={26} />
                </ThemeIcon>
                <Title order={2}>Page not found</Title>
                <Text size="sm" c="dimmed">
                    This screen doesn't exist in Wizz.
                </Text>
                <Button component={Link} to={DEFAULT_AGENT_PATH} leftSection={<Icon name="back" size={16} />} mt="xs">
                    Back to Wizz
                </Button>
            </Stack>
        </div>
    </div>
);

export default NotFoundPage;
