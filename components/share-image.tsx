import { ImageResponse } from "next/og";
import { BRAND, MARK } from "@/lib/brand";
import { SHARE_IMAGE } from "@/lib/seo";

// The share card of `/` and of each project (app/**/og.png/route.tsx), drawn at build time by
// next/og with its default font: the mark, a title, one line of description, on the dark
// surface. Every colour is a token of Fragiola UI's theme (lib/brand.ts).

/** The description's first sentence: the card's line (two at most, for a long one). */
function firstSentence(text: string): string {
    return /^.*?[.!?](?=\s|$)/s.exec(text.trim())?.[0] ?? text.trim();
}

export function shareImage({
    title,
    description,
    eyebrow,
}: {
    title: string;
    description: string;
    eyebrow?: string;
}): ImageResponse {
    const markHeight = 96;
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 80,
                background: BRAND.surfaceDark,
                color: BRAND.contrastDark,
                borderTop: `12px solid ${BRAND.purpleDark}`,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <svg
                    width={(MARK.width / MARK.height) * markHeight}
                    height={markHeight}
                    viewBox={`0 0 ${MARK.width} ${MARK.height}`}
                    role="img"
                    aria-label="Fragiola"
                >
                    {MARK.bars.map((bar) => (
                        <rect
                            key={bar.y}
                            y={bar.y}
                            width={bar.width}
                            height={bar.height}
                            rx={MARK.radius}
                            fill={BRAND.purpleDark}
                        />
                    ))}
                </svg>
                {eyebrow ? (
                    <div
                        style={{
                            fontSize: 36,
                            color: BRAND.accentDark,
                            letterSpacing: 1,
                        }}
                    >
                        {eyebrow}
                    </div>
                ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div
                    style={{
                        fontSize: 88,
                        fontWeight: 700,
                        letterSpacing: -2,
                        lineHeight: 1.05,
                    }}
                >
                    {title}
                </div>
                <div
                    style={{
                        fontSize: 34,
                        lineHeight: 1.4,
                        color: BRAND.accentDark,
                        paddingTop: 28,
                        borderTop: `2px solid ${BRAND.lineDark}`,
                    }}
                >
                    {firstSentence(description)}
                </div>
            </div>
        </div>,
        SHARE_IMAGE,
    );
}
