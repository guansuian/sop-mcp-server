# Andon SOP MCP Server

这是一个面向 WorkBuddy 的本地 MCP Server，用于连接 MES 系统，提供 SOP 上传辅助工具和异常报表查询工具。

当前项目通过 MCP stdio 协议与 WorkBuddy 通信，通过 HTTP REST 接口访问 MES 后端。

## 架构

```text
WorkBuddy
   |
   | MCP Protocol (stdio)
   v
本地 MCP Server（本项目）
   |
   | HTTP REST / 登录鉴权
   v
MES 系统
```

## 环境要求

- Node.js >= 18
- npm
- WorkBuddy
- 可访问的 MES 后端服务
- MES 登录账号和密码，或可用的 MES 鉴权配置

## 快速开始

### 1. 安装依赖

进入项目根目录：

```powershell
cd D:\svn-workspace\andon_sop-mcp
```

安装依赖：

```powershell
npm install
```

### 2. 配置 MES 连接

配置文件位于：

```text
config\mes-config.json
```

示例：

```json
{
  "mes": {
    "baseUrl": "http://localhost:9998",
    "auth": {
      "type": "login",
      "username": "superadmin",
      "password": "1234554321",
      "loginUrl": "/main/login",
      "contentType": "application/x-www-form-urlencoded"
    },
    "timeout": 300000,
    "queryTimeoutMs": 25000,
    "retry": 3,
    "writeIntervalMs": 2400
  },
  "tools": {
    "likeSelectMaterielList": true,
    "selectCategoryTreeList": true,
    "uploadSop": true,
    "queryAbnormalReportPage": true
  }
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `mes.baseUrl` | MES 后端地址。如果 MES 不在本机，不要使用 `localhost`，要改成真实地址。 |
| `mes.auth.type` | 当前使用 `login`，表示通过用户名密码登录 MES。 |
| `mes.auth.username` | MES 用户名。 |
| `mes.auth.password` | MES 密码。 |
| `mes.auth.loginUrl` | MES 登录接口路径。 |
| `mes.timeout` | 普通请求超时时间，单位毫秒。 |
| `mes.queryTimeoutMs` | 查询类请求超时时间，单位毫秒。 |
| `mes.retry` | 网络失败后的重试次数。 |
| `mes.writeIntervalMs` | 写入类接口调用间隔，用于避开 MES 防重复提交限制。 |
| `tools.*` | 控制 MCP 工具是否启用，`true` 启用，`false` 禁用。 |

### 3. 编译

```powershell
npm run build
```

编译后入口文件是：

```text
dist\src\index.js
```

### 4. 本地手动启动测试

```powershell
$env:MES_CONFIG_PATH="D:\svn-workspace\andon_sop-mcp\config\mes-config.json"
node D:\svn-workspace\andon_sop-mcp\dist\src\index.js
```

如果看到类似日志，说明 MCP Server 已启动：

```text
MES TaskReport MCP Server starting...
Config loaded from: D:\svn-workspace\andon_sop-mcp\config\mes-config.json
Registered 4 tools: likeSelectMaterielList, selectCategoryTreeList, uploadSop, queryAbnormalReportPage
MES TaskReport MCP Server is ready. Waiting for requests...
```

这是 stdio MCP，启动后会等待客户端连接，终端没有继续输出是正常的。测试结束后按 `Ctrl + C` 退出。

## WorkBuddy 配置

在 WorkBuddy 的自定义 MCP 配置中填写：

```json
{
  "mcpServers": {
    "andon-sop-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "D:\\svn-workspace\\andon_sop-mcp\\dist\\src\\index.js"
      ],
      "cwd": "D:\\svn-workspace\\andon_sop-mcp",
      "env": {
        "MES_CONFIG_PATH": "D:\\svn-workspace\\andon_sop-mcp\\config\\mes-config.json"
      }
    }
  }
}
```

说明：

| 字段 | 说明 |
|---|---|
| `type` | 固定使用 `stdio`。 |
| `command` | 启动命令，这里是 `node`。 |
| `args` | MCP 编译后的入口文件。 |
| `cwd` | 项目根目录，即 `package.json` 所在目录。建议保留。 |
| `env.MES_CONFIG_PATH` | 指定 `mes-config.json` 的绝对路径。建议保留，避免配置文件找不到。 |

Windows 路径写到 JSON 中时，`\` 要写成 `\\`。

## 可用工具

| Tool | 用途 |
|---|---|
| `likeSelectMaterielList` | 按物料名称模糊分页查询物料，返回物料 ID、名称、编码。 |
| `selectCategoryTreeList` | 查询 SOP 分类列表，返回分类 ID 和分类名称。 |
| `uploadSop` | 上传 SOP 文件到 MES。 |
| `queryAbnormalReportPage` | 分页查询异常报表，支持开单人、发生时间范围、关闭状态、异常类型、关闭人等条件。 |

## 典型使用流程

### 上传 SOP

1. 准备或生成 SOP 文件，并拿到本地文件路径 `file_path`。
2. 如果只有物料名称，调用 `likeSelectMaterielList` 查询物料，让用户选择正确物料，使用表格中的物料 ID 作为 `materielId`。
3. 如果没有 SOP 分类 ID，调用 `selectCategoryTreeList` 查询分类，让用户选择正确分类，使用表格中的分类 ID 作为 `esopCategoryId`。
4. 确认 `version`、`procedureId`。
5. 参数齐全后调用 `uploadSop`。

`uploadSop` 必需参数：

| 参数 | 说明 |
|---|---|
| `file_path` | 本地 SOP 文件路径，MCP Server 所在机器必须能读取。 |
| `version` | SOP 版本号。 |
| `materielId` | 物料 ID。 |
| `procedureId` | 工序 ID。 |
| `esopCategoryId` | SOP 分类 ID。 |

不要猜测 `materielId`、`procedureId`、`esopCategoryId`。如果用户没有明确提供，应先查询或追问。

### 查询异常报表

调用 `queryAbnormalReportPage`。

常用参数：

| 参数 | 说明 |
|---|---|
| `page` | 页码，默认 1。 |
| `limit` | 每页数量，默认 5，最大 100。 |
| `billUserName` | 开单人姓名，模糊查询。 |
| `beginOccurDateStart` | 发生开始时间，格式 `yyyy-MM-dd HH:mm:ss`。 |
| `beginOccurDateEnd` | 发生结束时间，格式 `yyyy-MM-dd HH:mm:ss`。 |
| `closeStatus` | 关闭状态，模糊查询。 |
| `abnormalType` | 异常类型，模糊查询。 |
| `closeUserName` | 关闭人姓名，模糊查询。 |

返回结果中包含：

- 当前页表格
- `hasPrevPage`
- `prevPage`
- `hasNextPage`
- `nextPage`

如果 `hasNextPage=true`，可以继续查询下一页。

## Skills

项目内置了 WorkBuddy 使用流程说明：

```text
skills\mes-sop-abnormal-workflows\SKILL.md
```

该技能重点说明：

- 上传 SOP 应按什么流程调用 MCP 工具
- 查询异常报表应使用哪个工具和哪些参数
- 哪些 ID 不能猜，必须查询或询问用户

## 自包含打包

项目提供 `scripts\bundle.mjs`，用于把 MCP Server 打包成单个 JS 文件：

```powershell
npm run bundle
```

输出文件：

```text
andon_sop-mcp.js
```

这种方式适合分发给其他电脑使用。对方仍需要：

- Node.js >= 18
- `config\mes-config.json`
- WorkBuddy MCP 配置指向打包后的 JS 文件

如果执行 `npm run bundle` 报找不到 `esbuild`，先执行：

```powershell
npm install
```

## 项目结构

```text
andon_sop-mcp/
├─ config/
│  ├─ mes-config.json              # MES 实际连接配置
│  ├─ mes-config.example.json      # MES 配置示例
│  └─ 说明.txt                     # WorkBuddy 配置简要说明
├─ docs/
│  └─ workbuddy配置教程.md          # WorkBuddy 详细配置教程
├─ scripts/
│  └─ bundle.mjs                   # esbuild 打包脚本
├─ skills/
│  └─ mes-sop-abnormal-workflows/
│     └─ SKILL.md                  # WorkBuddy 业务流程技能说明
├─ src/
│  ├─ index.ts                     # MCP Server 入口
│  ├─ tools/
│  │  ├─ index.ts                  # 工具注册
│  │  ├─ like_select_materiel_list.ts
│  │  ├─ select_category_tree_list.ts
│  │  ├─ upload_sop.ts
│  │  └─ query_abnormal_report_page.ts
│  ├─ services/
│  │  ├─ mesClient.ts              # MES HTTP 客户端
│  │  ├─ authService.ts            # 登录和 token 管理
│  │  └─ entityResolverService.ts
│  ├─ types/
│  │  ├─ api.ts
│  │  └─ toolContent.ts
│  └─ utils/
│     └─ logger.ts                 # 日志输出到 stderr，避免干扰 MCP stdio
├─ test/
├─ package.json
└─ tsconfig.json
```

## 常见问题

### `MCP error -32000: Connection closed`

通常表示 WorkBuddy 启动了本地 MCP 进程，但 MCP 进程马上退出。

优先检查：

1. 是否执行过 `npm run build`。
2. `dist\src\index.js` 是否存在。
3. WorkBuddy 配置里的 `cwd` 是否是项目根目录。
4. `MES_CONFIG_PATH` 是否指向真实存在的 `config\mes-config.json`。
5. `mes-config.json` 是否是合法 JSON。
6. `node` 命令是否可用。

### MES 接口连不上

检查 `config\mes-config.json`：

```json
"baseUrl": "http://localhost:9998"
```

如果 MES 后端不在本机，必须改成真实 MES 地址。

### 工具没有出现

检查 `config\mes-config.json` 的 `tools` 配置。设置为 `false` 的工具不会注册。

## 开发命令

```powershell
# 编译 TypeScript
npm run build

# 运行测试
npm test

# 启动 MCP Server
npm start

# 打包成单个 JS 文件
npm run bundle
```

## 扩展工具

新增 MCP 工具时：

1. 在 `src\tools` 下新增工具文件。
2. 导出 `name`、`description`、`inputSchema`、`handler`。
3. 在 `src\tools\index.ts` 中注册。
4. 在 `config\mes-config.json` 的 `tools` 中增加开关。
5. 添加对应测试。
