/**
 * App icons (Tabler Icons, the set Mantine is designed around). Screens use <Icon name="…" /> so the icon
 * family can change in one place; unknown names fall back to "info".
 */
import {
    IconAlertTriangle,
    IconArrowLeft,
    IconBell,
    IconBook2,
    IconCalendarDue,
    IconCamera,
    IconCheck,
    IconChecklist,
    IconChevronDown,
    IconChevronRight,
    IconClock,
    IconCopy,
    IconDots,
    IconDownload,
    IconExternalLink,
    IconEye,
    IconFile,
    IconFileDescription,
    IconFilter,
    IconFlag,
    IconHistory,
    IconHome,
    IconInfoCircle,
    IconLink,
    IconList,
    IconLogout,
    IconMessage,
    IconMessageChatbot,
    IconPaperclip,
    IconPencil,
    IconPhoto,
    IconPlayerPlay,
    IconPlus,
    IconRefresh,
    IconSearch,
    IconSend2,
    IconSettings,
    IconShare,
    IconSparkles,
    IconBrandTelegram,
    IconTrash,
    IconUser,
    IconUserCircle,
    IconUsers,
    IconUsersGroup,
    IconVideo,
    IconX,
    IconDeviceMobile,
    IconAdjustmentsHorizontal,
    IconCircleCheck,
    IconProgress,
    IconBan,
    IconMessageCircleQuestion,
} from "@tabler/icons-react";

const ICONS = {
    // navigation & agents
    home: IconHome,
    book: IconBook2,
    ask: IconMessageChatbot,
    proposal: IconFileDescription,
    tasks: IconChecklist,
    users: IconUsers,
    team: IconUsersGroup,
    user: IconUser,
    profile: IconUserCircle,
    settings: IconSettings,
    // actions
    plus: IconPlus,
    send: IconSend2,
    search: IconSearch,
    filter: IconFilter,
    adjust: IconAdjustmentsHorizontal,
    refresh: IconRefresh,
    copy: IconCopy,
    trash: IconTrash,
    edit: IconPencil,
    share: IconShare,
    download: IconDownload,
    external: IconExternalLink,
    close: IconX,
    back: IconArrowLeft,
    more: IconDots,
    "chevron-right": IconChevronRight,
    "chevron-down": IconChevronDown,
    logout: IconLogout,
    check: IconCheck,
    done: IconCircleCheck,
    start: IconPlayerPlay,
    progress: IconProgress,
    blocked: IconBan,
    // content
    history: IconHistory,
    video: IconVideo,
    document: IconFile,
    image: IconPhoto,
    link: IconLink,
    paperclip: IconPaperclip,
    camera: IconCamera,
    message: IconMessage,
    question: IconMessageCircleQuestion,
    list: IconList,
    eye: IconEye,
    sparkle: IconSparkles,
    telegram: IconBrandTelegram,
    device: IconDeviceMobile,
    // status
    alert: IconAlertTriangle,
    info: IconInfoCircle,
    bell: IconBell,
    clock: IconClock,
    due: IconCalendarDue,
    flag: IconFlag,
};

export const ICON_NAMES = Object.keys(ICONS);

const Icon = ({ name, size = 20, className = "", title, stroke = 1.75 }) => {
    const Cmp = ICONS[name] || ICONS.info;
    return (
        <Cmp
            className={`icon ${className}`.trim()}
            size={size}
            stroke={stroke}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            focusable="false"
            title={title}
        />
    );
};

export default Icon;
