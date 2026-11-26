import type { BaseInfo, ProjectInfo } from "./types.ts";

// The bases of an export (v1.8, CONTRACT.md §2, §5.6, §7): the primitive libraries a project's
// components are offered on. The default base keeps the paths an export without bases uses
// (`r/`, `embed/<framework>/`); every other base lives one folder down (`r/<name>/`,
// `embed/<framework>/<name>/`). An export without `bases` has one implicit default base.
// Node-free: the site's client code reads it too.

/** A project's bases, the default first; none when it declares none. */
export function basesOf(project: Pick<ProjectInfo, "bases">): BaseInfo[] {
    const bases = project.bases ?? [];
    return [
        ...bases.filter((base) => base.default),
        ...bases.filter((base) => !base.default),
    ];
}

/** The non-default bases: the ones with folders of their own. */
export function extraBases(project: Pick<ProjectInfo, "bases">): BaseInfo[] {
    return (project.bases ?? []).filter((base) => !base.default);
}

/** A base's folder under `r/` or `embed/<framework>/`: "" for the default (or no) base. */
export function baseDir(
    base: Pick<BaseInfo, "name" | "default"> | undefined,
): string {
    return base && !base.default ? `${base.name}/` : "";
}
