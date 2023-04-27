export function parseDocumentationData(data: any): string {
    return data.primaryContentSections
        .filter((section: any) => section.kind === "content")[0].content
        .map((content: any) => parseContent(data, content))
        .join('\n\n');
}

export function parseAbstract(data: any): string {
    return data.abstract.map((line: any) => parseInline(data, line)).join('\n');
}

export function parseInline(data: any, inline: any): string {
    switch (inline.type) {
        case "text":
            return inline.text;
        case "codeVoice":
            return `\`${inline.code}\``;
        case "reference":
            const title = data.references[inline.identifier].title;
            try {
                const url = new URL(inline.identifier);
                return `[\`${title}\`](${url.toString()})`;
            } catch {
                return `\`${title}\``;
            }
        default:
            return `~~${inline.type}~~`;
    }
}

export function parseContent(data: any, content: any): string {
    switch (content.type) {
        case "heading":
            return `${"#".repeat(content.level)} ${content.text}`;
        case "paragraph":
            return content.inlineContent.map((inline: any) => parseInline(data, inline)).join('');
        case "codeListing":
            return `\`\`\`${content.syntax}\n${content.code.join('\n')}\n\`\`\``;
        case "unorderedList":
            return content.items.map((item: any) => "* " + item.content.map((child: any) => parseContent(data, child)).join('')).join('\n');
        case "aside":
            return `> **${content.name}**\n` + content.content.map((child: any) => "> " + parseContent(data, child)).join('\n');
        default:
            return `~~${content.type}~~`;
    }
}

export function findAttributes(data: any): string[] {
    return data.topicSections
        .filter((section: any) => section.title === "Instance Properties")[0].identifiers
        .map((prop: string) => data.references[prop].title);
}