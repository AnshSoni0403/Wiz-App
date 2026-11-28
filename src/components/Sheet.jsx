import { Drawer, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

/**
 * Bottom sheet on phones, centred dialog from 768px (`side="bottom"`, the default). `side="right"` keeps a
 * side drawer on every size. Props are stable: open, title, onClose, children, footer, side, busy.
 * The footer sticks to the bottom of the sheet; put the primary action there.
 */
const Sheet = ({ open, title, onClose, children, footer = null, side = "bottom", busy = false, size }) => {
    const wide = useMediaQuery("(min-width: 768px)");
    const common = {
        opened: open,
        onClose,
        title,
        closeOnEscape: !busy,
        closeOnClickOutside: !busy,
        closeButtonProps: { disabled: busy, "aria-label": `Close ${title}` },
        classNames: { title: "tk-sheet__title", header: "tk-sheet__header", body: "tk-sheet__body" },
    };
    const body = (
        <>
            <div className="tk-sheet__content">{children}</div>
            {footer ? <div className="tk-sheet__footer sheet__footer">{footer}</div> : null}
        </>
    );

    if (side === "bottom" && wide) {
        return (
            <Modal {...common} size={size || "lg"} radius="lg">
                {body}
            </Modal>
        );
    }
    return (
        <Drawer
            {...common}
            position={side}
            size={side === "bottom" ? "auto" : size || "min(100vw, 26rem)"}
            radius={side === "bottom" ? "lg" : 0}
            classNames={{ ...common.classNames, content: `tk-sheet tk-sheet--${side}` }}
        >
            {body}
        </Drawer>
    );
};

export default Sheet;
