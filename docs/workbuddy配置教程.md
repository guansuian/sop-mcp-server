# WorkBuddy 配置本地 MES MCP 教程

本文档说明如何让 WorkBuddy 连接本项目提供的 MCP Server，以及 `mes-config.json` 的作用和配置方法。

## 1. 两个配置分别负责什么

连接 WorkBuddy 时会涉及两个配置：

| 配置 | 作用 | 给谁用 |
|---|---|---|
| WorkBuddy MCP 配置 | 告诉 WorkBuddy 如何启动这个 MCP Server | WorkBuddy |
| `mes-config.json` | 告诉 MCP Server 如何连接 MES 后端、启用哪些工具 | 本项目的 MCP Server |

简单理解：

- WorkBuddy MCP 配置负责启动本地 Node 进程。
- `mes-config.json` 负责配置 MES 地址、账号密码、超时时间、启用工具。
- 如果 WorkBuddy 能启动 MCP，但 MCP 找不到 `mes-config.json`，就会出现 `MCP error -32000: Connection closed`。

## 2. 项目准备

先进入项目根目录，也就是 `package.json` 所在目录：

```powershell
cd D:\svn-workspace\andon_sop-mcp
```

安装依赖：

```powershell
npm install
```

编译项目：

```powershell
npm run build
```

编译成功后，应存在这个文件：

```text
D:\svn-workspace\andon_sop-mcp\dist\src\index.js
```

WorkBuddy 实际启动的就是这个编译后的 JS 文件。

## 3. `mes-config.json` 的作用

本项目的 MES 配置文件是：

```text
D:\svn-workspace\andon_sop-mcp\src\config\mes-config.json
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
| `mes.baseUrl` | MES 后端服务地址。`http://localhost:9998` 表示 MES 后端在本机 9998 端口。 |
| `mes.auth.type` | 鉴权方式。当前使用 `login`，表示 MCP 会通过账号密码登录 MES。 |
| `mes.auth.username` | MES 登录用户名。 |
| `mes.auth.password` | MES 登录密码。 |
| `mes.auth.loginUrl` | MES 登录接口路径。 |
| `mes.timeout` | 普通请求超时时间，单位毫秒。 |
| `mes.queryTimeoutMs` | 查询类接口超时时间，单位毫秒。 |
| `mes.retry` | 请求失败后的重试次数。 |
| `mes.writeIntervalMs` | 写入类接口间隔时间，避免 MES 防重复提交限制。 |
| `tools` | 控制哪些 MCP 工具启用，`true` 表示启用，`false` 表示禁用。 |

注意：

- 如果 MES 后端不在本机，必须把 `baseUrl` 改成真实 MES 地址。
- `mes-config.json` 不是 WorkBuddy 的配置，它是 MCP Server 自己读取的业务配置。
- WorkBuddy 需要通过环境变量 `MES_CONFIG_PATH` 告诉 MCP Server 这个配置文件在哪里。

## 4. WorkBuddy MCP 配置怎么写

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
        "MES_CONFIG_PATH": "D:\\svn-workspace\\andon_sop-mcp\\src\\config\\mes-config.json"
      }
    }
  }
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `andon-sop-mcp` | MCP 名称，可自定义，建议保持有业务含义。 |
| `type` | 使用 `stdio`，表示 WorkBuddy 通过标准输入输出和本地 MCP 进程通信。 |
| `command` | 启动命令。这里用 `node`。 |
| `args` | 传给 `node` 的参数，也就是编译后的 MCP 入口文件路径。 |
| `cwd` | 项目根目录，即 `package.json` 所在目录。 |
| `env.MES_CONFIG_PATH` | 指定 `mes-config.json` 的绝对路径。这个字段很重要。 |

## 5. 路径怎么改成自己的

如果你的项目路径不是：

```text
D:\svn-workspace\andon_sop-mcp
```

比如你的项目在：

```text
D:\work\andon_sop-mcp
```

那么 WorkBuddy 配置要改成：

```json
{
  "mcpServers": {
    "andon-sop-mcp": {
      "type": "stdio",
      "command": "node",
      "args": [
        "D:\\work\\andon_sop-mcp\\dist\\src\\index.js"
      ],
      "cwd": "D:\\work\\andon_sop-mcp",
      "env": {
        "MES_CONFIG_PATH": "D:\\work\\andon_sop-mcp\\src\\config\\mes-config.json"
      }
    }
  }
}
```

Windows 路径在 JSON 中要注意：

- 普通路径：`D:\work\andon_sop-mcp`
- JSON 中要写成：`D:\\work\\andon_sop-mcp`

也就是每个 `\` 都要写成 `\\`。

## 6. 如何确认 MCP 能启动

可以先在 PowerShell 中手动测试：

```powershell
$env:MES_CONFIG_PATH="D:\svn-workspace\andon_sop-mcp\src\config\mes-config.json"
node D:\svn-workspace\andon_sop-mcp\dist\src\index.js
```

如果看到类似日志，说明 MCP 已经启动：

```text
MES TaskReport MCP Server starting...
Config loaded from: D:\svn-workspace\andon_sop-mcp\src\config\mes-config.json
Registered 4 tools: likeSelectMaterielList, selectCategoryTreeList, uploadSop, queryAbnormalReportPage
MES TaskReport MCP Server is ready. Waiting for requests...
```

这是 `stdio` 类型 MCP，启动后终端看起来会一直等待，这是正常的。测试结束后按 `Ctrl + C` 退出。

## 7. 当前 MCP 提供哪些工具

当前启用的工具包括：

| 工具 | 用途 |
|---|---|
| `likeSelectMaterielList` | 按物料名称模糊查询物料，返回 `materielId`。 |
| `selectCategoryTreeList` | 查询 SOP 分类列表，返回 `esopCategoryId`。 |
| `uploadSop` | 上传 SOP 文件到 MES。 |
| `queryAbnormalReportPage` | 分页查询异常报表。 |

## 8. 常见错误

### `MCP error -32000: Connection closed`

通常表示 WorkBuddy 启动了本地 MCP 进程，但 MCP 进程马上退出了。

优先检查：

1. `dist\src\index.js` 是否存在。
2. `cwd` 是否是项目根目录。
3. `MES_CONFIG_PATH` 是否指向真实存在的 `mes-config.json`。
4. `mes-config.json` 是否是合法 JSON。
5. `node` 命令是否可用。

### 找不到 MES 或接口超时

检查 `mes-config.json` 中的：

```json
"baseUrl": "http://localhost:9998"
```

如果 MES 后端不在本机，不能使用 `localhost`，要改成 MES 后端真实地址。

### 工具没有出现

检查 `mes-config.json` 中的 `tools`：

```json
"tools": {
  "likeSelectMaterielList": true,
  "selectCategoryTreeList": true,
  "uploadSop": true,
  "queryAbnormalReportPage": true
}
```

如果某个工具被设置为 `false`，WorkBuddy 中就不会注册这个工具。
