// <Pills items strike?> (§3.4): a row of pills, as on the dockable landing. `strike` crosses them
// out: "what it never ships".

export function Pills({
    items,
    strike = false,
}: {
    items: string[];
    strike?: boolean;
}) {
    return (
        <ul
            data-testid="pills"
            data-strike={strike ? "" : undefined}
            className="not-prose my-6 flex list-none flex-wrap gap-2 p-0"
        >
            {items.map((item) => (
                <li
                    key={item}
                    className="rounded-full border border-palette-line bg-palette-soft/40 px-3 py-1 font-mono text-palette-accent/85 text-xs"
                >
                    {strike ? (
                        <s className="decoration-palette-line">{item}</s>
                    ) : (
                        item
                    )}
                </li>
            ))}
        </ul>
    );
}
