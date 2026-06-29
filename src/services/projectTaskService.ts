import type { MesClient } from "./mesClient.js";
import { BatchDictService, type DictValueLabelMap } from "./abstract/BatchDictService.js";

export interface ProjectTask {
    id: string;
    projectId: string;
    parentId: string | null;
    taskName: string;
    dutyUserName: string;
    planStartDate: string;
    planEndDate: string;
    planHours: number | null;
    actualHours: number | null;
    progress: number | null;
    delayDays: number | null;
    taskDetail: string;
    notifyType: string;
    taskStatus: string | null;
    [key: string]: unknown;
}

export interface ProjectTaskNode extends ProjectTask {
    depth: number;
    children: ProjectTaskNode[];
    raw: ProjectTask;
}

export interface ProjectTaskTreeResult {
    tree: ProjectTaskNode[];
    flat: ProjectTaskNode[];
}

interface ProjectTaskListResponse {
    code?: number;
    msg?: string;
    message?: string;
    data?: ProjectTask[];
}

export class ProjectTaskService {
    private static readonly DICT_TYPES = ["notify_type", "proj_status"];

    protected readonly client: MesClient;

    constructor(client: MesClient) {
        this.client = client;
    }


    /**
     * 获得数据字典
     */
    async getProjectTaskDictItemByTypes(): Promise<DictValueLabelMap> {
        const batchDictService = new BatchDictService(this.client);
        return batchDictService.getDictMapByTypes(ProjectTaskService.DICT_TYPES);
    }

    /**
     * 通过项目id获得项目任务列表
     * @param projectId
     */
    async getTasksByProject(projectId: string): Promise<ProjectTask[]> {
        const response = await this.client.customJsonPost<ProjectTaskListResponse>(
            "/projTask/getTasksByProject",
            { projectId }
        );
        if (Number(response?.code) !== 0) {
            throw new Error(response?.msg || response?.message || "查询项目任务失败");
        }
        return Array.isArray(response.data) ? response.data : [];
    }

    /**
     * 获得树形结构和扁平化结构的数据
     * @param projectId
     */
    async getTaskTreeByProject(projectId: string): Promise<ProjectTaskTreeResult> {
        const tasks = await this.getTasksByProject(projectId);
        return this.buildTaskTree(tasks);
    }

    /**
     * 构建任务树形
     * @param tasks
     */
    buildTaskTree(tasks: ProjectTask[]): ProjectTaskTreeResult {
        const nodeMap = new Map<string, ProjectTaskNode>();
        const roots: ProjectTaskNode[] = [];

        for (const task of tasks) {
            const id = String(task.id ?? "").trim();
            if (!id) {
                continue;
            }

            nodeMap.set(id, {
                ...task,
                id,
                parentId: normalizeParentId(task.parentId),
                depth: 0,
                children: [],
                raw: task,
            });
        }

        for (const node of nodeMap.values()) {
            const parentId = normalizeParentId(node.parentId);
            if (parentId && nodeMap.has(parentId)) {
                nodeMap.get(parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        }

        sortTaskNodes(roots);

        const flat: ProjectTaskNode[] = [];
        for (const root of roots) {
            flattenTaskNode(root, 0, flat);
        }

        return {
            tree: roots,
            flat,
        };
    }
}

function normalizeParentId(parentId: unknown): string | null {
    const value = String(parentId ?? "").trim();
    if (!value || value === "ROOT" || value === "0" || value.toLowerCase() === "null") {
        return null;
    }
    return value;
}

function flattenTaskNode(
    node: ProjectTaskNode,
    depth: number,
    flat: ProjectTaskNode[]
): void {
    node.depth = depth;
    flat.push(node);

    for (const child of node.children) {
        flattenTaskNode(child, depth + 1, flat);
    }
}

function sortTaskNodes(nodes: ProjectTaskNode[]): void {
    nodes.sort(compareTaskNodes);
    for (const node of nodes) {
        sortTaskNodes(node.children);
    }
}

function compareTaskNodes(a: ProjectTaskNode, b: ProjectTaskNode): number {
    const sortA = Number(a.sort);
    const sortB = Number(b.sort);
    if (Number.isFinite(sortA) && Number.isFinite(sortB) && sortA !== sortB) {
        return sortA - sortB;
    }

    const startCompare = String(a.planStartDate ?? "").localeCompare(String(b.planStartDate ?? ""));
    if (startCompare !== 0) {
        return startCompare;
    }

    return String(a.createTime ?? "").localeCompare(String(b.createTime ?? ""));
}
