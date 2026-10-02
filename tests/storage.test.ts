import { describe, expect, it } from "vitest";
import {
    LEGACY_KEYS,
    STORAGE_KEYS,
    storageMigrationScript,
} from "@/lib/storage";

// The site's localStorage keys and the inline script that moves the keys written before the
// `@fragiola:` prefix (lib/storage.ts). The script is run as the page runs it: its text, against
// a window whose localStorage is a Map.

class MemoryStorage {
    readonly map = new Map<string, string>();
    get length() {
        return this.map.size;
    }
    key(index: number) {
        return [...this.map.keys()][index] ?? null;
    }
    getItem(key: string) {
        return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.map.set(key, value);
    }
    removeItem(key: string) {
        this.map.delete(key);
    }
}

function migrate(entries: Record<string, string>): Record<string, string> {
    const storage = new MemoryStorage();
    for (const [key, value] of Object.entries(entries))
        storage.setItem(key, value);
    new Function("window", storageMigrationScript())({ localStorage: storage });
    return Object.fromEntries(storage.map);
}

describe("storage keys", () => {
    it("are all under @fragiola:", () => {
        const keys = [
            STORAGE_KEYS.theme,
            STORAGE_KEYS.framework,
            STORAGE_KEYS.exampleTheme("ui"),
            STORAGE_KEYS.examplesSidebar,
            STORAGE_KEYS.codePanelWidth,
        ];
        for (const key of keys) expect(key).toMatch(/^@fragiola:/);
        for (const [, to] of LEGACY_KEYS) expect(to).toMatch(/^@fragiola:/);
    });
});

describe("the migration script", () => {
    it("moves every legacy key, one per project for the example theme", () => {
        expect(
            migrate({
                theme: "light",
                "fragiola:framework": "react",
                "fragiola:example-theme:ui": "terminal",
                "fragiola:example-theme:dockable": "paper",
                "dockable:layout": "{}",
            }),
        ).toEqual({
            "@fragiola:theme": "light",
            "@fragiola:framework": "react",
            "@fragiola:example-theme:ui": "terminal",
            "@fragiola:example-theme:dockable": "paper",
            "dockable:layout": "{}",
        });
    });

    it("leaves the new keys alone, and a newer choice wins over a legacy one", () => {
        expect(
            migrate({
                theme: "light",
                "@fragiola:theme": "dark",
                "@fragiola:framework": "react",
                "@fragiola:example-theme:ui": "terminal",
            }),
        ).toEqual({
            "@fragiola:theme": "dark",
            "@fragiola:framework": "react",
            "@fragiola:example-theme:ui": "terminal",
        });
    });

    it("is idempotent", () => {
        const once = migrate({ theme: "light", "fragiola:framework": "vue" });
        expect(migrate(once)).toEqual(once);
    });

    it("is silent when storage is unavailable", () => {
        const window = {
            get localStorage(): Storage {
                throw new Error("SecurityError");
            },
        };
        expect(() =>
            new Function("window", storageMigrationScript())(window),
        ).not.toThrow();
    });
});
