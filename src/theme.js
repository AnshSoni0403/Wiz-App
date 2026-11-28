import { createTheme } from "@mantine/core";

/**
 * Wizz design system on Mantine. Colours are the existing Marwiz gold/cream (styles/theme.css, from the
 * Admin's GOLD_THEME) — unchanged. Component defaults make every screen compact and consistent:
 * small controls, 12px radius cards with hairline borders, light badges, pill segmented filters.
 */
export const theme = createTheme({
    fontFamily: "var(--font)",
    headings: { fontFamily: "var(--font)", fontWeight: "600", sizes: { h1: { fontSize: "20px" }, h2: { fontSize: "16px" }, h3: { fontSize: "14px" } } },
    primaryColor: "gold",
    primaryShade: 6,
    colors: {
        gold: ["#f7f0e4", "#f3e8d5", "#ead8ba", "#d9bf91", "#bea169", "#a8863a", "#8f6b2f", "#735423", "#61451e", "#4d3718"],
    },
    defaultRadius: "md",
    radius: { xs: "6px", sm: "8px", md: "10px", lg: "14px", xl: "20px" },
    fontSizes: { xs: "11px", sm: "13px", md: "14px", lg: "16px", xl: "18px" },
    spacing: { xs: "6px", sm: "10px", md: "14px", lg: "18px", xl: "24px" },
    shadows: { xs: "0 1px 2px rgba(31,41,55,.05)", sm: "0 2px 8px rgba(31,41,55,.06)", md: "0 6px 20px rgba(31,41,55,.08)" },
    cursorType: "pointer",
    focusRing: "auto",
    components: {
        Button: { defaultProps: { size: "sm", radius: "md" }, styles: { root: { fontWeight: 600 } } },
        ActionIcon: { defaultProps: { variant: "subtle", color: "gray", size: "lg", radius: "md" } },
        Card: { defaultProps: { withBorder: true, radius: "lg", padding: "sm", shadow: "xs" } },
        Paper: { defaultProps: { radius: "lg" } },
        Badge: { defaultProps: { variant: "light", radius: "sm", size: "sm" }, styles: { root: { textTransform: "none", fontWeight: 600 } } },
        TextInput: { defaultProps: { size: "sm", radius: "md" } },
        PasswordInput: { defaultProps: { size: "sm", radius: "md" } },
        Textarea: { defaultProps: { size: "sm", radius: "md", autosize: true, minRows: 1, maxRows: 6 } },
        Select: { defaultProps: { size: "sm", radius: "md", comboboxProps: { shadow: "md" } } },
        MultiSelect: { defaultProps: { size: "sm", radius: "md", comboboxProps: { shadow: "md" } } },
        SegmentedControl: { defaultProps: { radius: "xl", size: "xs", fullWidth: true } },
        Tabs: { defaultProps: { variant: "pills", radius: "xl" } },
        Drawer: { defaultProps: { radius: "lg", overlayProps: { backgroundOpacity: 0.35, blur: 2 } } },
        Modal: { defaultProps: { radius: "lg", centered: true, overlayProps: { backgroundOpacity: 0.35, blur: 2 } } },
        Menu: { defaultProps: { shadow: "md", radius: "md", width: 220, position: "bottom-end" } },
        Tooltip: { defaultProps: { withArrow: true, openDelay: 400 } },
        Indicator: { defaultProps: { color: "red", size: 16, offset: 4, withBorder: true } },
        Skeleton: { defaultProps: { radius: "md" } },
        Alert: { defaultProps: { radius: "md", variant: "light" } },
        Notification: { defaultProps: { radius: "md" } },
    },
});

export const cssVariablesResolver = () => ({
    variables: {},
    light: {
        "--mantine-color-body": "var(--canvas)",
        "--mantine-color-text": "var(--text)",
        "--mantine-color-dimmed": "var(--text-muted)",
        "--mantine-color-default": "var(--surface)",
        "--mantine-color-default-border": "var(--border)",
        "--mantine-color-default-hover": "var(--brand-soft)",
    },
    dark: {},
});

/** Status → Mantine colour for badges (tasks, research runs, proposals). */
export const STATUS_COLORS = {
    pending: "gray",
    accepted: "blue",
    in_progress: "gold",
    blocked: "red",
    completed: "teal",
    verified: "green",
    declined: "gray",
    cancelled: "gray",
};

export const PRIORITY_COLORS = { low: "gray", medium: "blue", high: "orange", urgent: "red" };
