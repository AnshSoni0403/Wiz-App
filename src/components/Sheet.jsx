import { Drawer } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

const Sheet = ({ open, title, onClose, children, footer = null, side = "bottom", busy = false }) => {
    const wide = useMediaQuery("(min-width: 700px)");
    const position = side === "bottom" && wide ? "right" : side;

    return (
        <Drawer
            opened={open}
            onClose={onClose}
            title={title}
            position={position}
            size={position === "bottom" ? "min(88dvh, 42rem)" : "min(100vw, 27rem)"}
            classNames={{
                content: "wizz-drawer wizz-drawer--" + position,
                title: "wizz-drawer__title",
                header: "wizz-drawer__header",
                body: "wizz-drawer__body",
            }}
            overlayProps={{ backgroundOpacity: 0.28 }}
            closeOnEscape={!busy}
            closeOnClickOutside={!busy}
            closeButtonProps={{ disabled: busy, "aria-label": `Close ${title}` }}
        >
            {children}
            {footer ? <div className="sheet__footer">{footer}</div> : null}
        </Drawer>
    );
};

export default Sheet;
