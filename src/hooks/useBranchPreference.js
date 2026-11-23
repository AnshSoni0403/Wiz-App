import { useCallback, useMemo, useState } from "react";
import { readPref, writePref } from "../utils/storage";
import { ALL_BRANCHES } from "../components/knowledge/BranchPicker";

/**
 * Selected branch for questions. Defaults to the member's home branch; remembers the last choice
 * on this device. Returns `[value, setValue, branchForApi]` where branchForApi is undefined for
 * "All my branches".
 */
const useBranchPreference = (wizz) => {
    const allowed = useMemo(() => (wizz?.branches || []).map((b) => b.code), [wizz]);
    const home = wizz?.member?.homeBranch;
    const key = `branch.${wizz?.member?.id || "default"}`;

    const fallback = allowed.includes(home) ? home : allowed[0] || ALL_BRANCHES;
    const [stored, setStored] = useState(() => readPref(key, null));

    const value = stored === ALL_BRANCHES || allowed.includes(stored) ? stored : fallback;

    const setValue = useCallback(
        (next) => {
            setStored(next);
            writePref(key, next);
        },
        [key]
    );

    return [value, setValue, value === ALL_BRANCHES ? undefined : value];
};

export default useBranchPreference;
