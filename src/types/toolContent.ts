/**
 * MCP Tool 返回内容类型（text + image）
 */

export type ToolTextContent = {
    type: "text";
    text: string;
};

export type ToolImageContent = {
    type: "image";
    data: string;
    mimeType: string;
};

export type ToolContentBlock = ToolTextContent | ToolImageContent;

export type ToolCallResult = {
    isError?: boolean;
    content: ToolContentBlock[];
};
