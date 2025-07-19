# Figma MCP Server Setup & Usage Guide

## 🎯 **Critical: Start New Session with This Context**

Copy and paste this EXACT text at the beginning of your next Claude Code session:

---

**I have Figma Dev Mode MCP Server configured and running. The available MCP tools are:**

- **get_image**: Gets visual representation of Figma frames
- **get_code**: Generates code from Figma frames  
- **get_variable_defs**: Extracts design tokens and variables
- **get_code_connect_map**: Gets component mapping information

**Tool Format:**
```
Tool name: mcp__figma-dev-mode-mcp-server__get_image
Parameters: nodeId, clientName, clientModel, clientLanguages, clientFrameworks
```

**Example Usage:**
```
mcp__figma-dev-mode-mcp-server__get_image({
  nodeId: "1568:55865",
  clientName: "claude code",
  clientModel: "claude-3.5-sonnet", 
  clientFrameworks: "react",
  clientLanguages: "typescript,css"
})
```

**Implementation Request:**
I need you to implement this Figma prototype:
- **Figma URL**: https://www.figma.com/proto/krhXq0l0ktpeunUgWWXqHj/Graphyn?page-id=1487%3A34172&node-id=1568-55865
- **Starting Frame ID**: 1568:55865 (Frame 1: Landing Page)

**Please use MCP tools to:**
1. Get exact design specifications from Figma using get_image and get_code
2. Implement React components that match designs precisely
3. Set up proper navigation between all frames
4. Use existing UI components where possible

**Project Setup:**
- React + TypeScript + Tailwind CSS + React Router configured
- Working directory: /Users/resatugurulu/Developer/graphyn-code
- Use TodoWrite to track implementation progress

**Start by using get_image on Frame 1568:55865 to see the design, then get_code to understand the structure.**

---

## 🔧 **Pre-Session Checklist**

Before starting the Claude Code session, verify:

### 1. Figma Desktop App
- [ ] Figma desktop app is running
- [ ] Updated to latest version
- [ ] File is open: https://www.figma.com/design/krhXq0l0ktpeunUgWWXqHj/Graphyn
- [ ] MCP Server enabled: Figma menu → Preferences → Enable Dev Mode MCP Server
- [ ] Confirmation message shown: "Server is enabled and running"

### 2. MCP Configuration
- [ ] File exists: `~/.claude/mcp_servers.json`
- [ ] Contains proper configuration (see below)
- [ ] Claude Code restarted after config changes

### 3. Claude Code Session
- [ ] Start Claude Code in project directory: `/Users/resatugurulu/Developer/graphyn-code`
- [ ] Check MCP tools available: type `/mcp` to verify figma-dev-mode-mcp-server is connected
- [ ] Paste the context above to start implementation

## 📋 **MCP Configuration File**

Ensure `~/.claude/mcp_servers.json` contains:

```json
{
  "mcpServers": {
    "figma-dev-mode-mcp-server": {
      "command": "npx",
      "args": ["@figma/mcp-server-figma-dev-mode"]
    }
  }
}
```

## 🎨 **Frame IDs for Implementation**

Based on the Figma prototype analysis:

- **Frame 1568:55865**: Landing Page (Start here)
- **Additional frames**: Will be discovered via MCP navigation analysis

## 🛠️ **Expected MCP Workflow**

1. **Visual Reference**: `get_image` on Frame 1568:55865
2. **Code Structure**: `get_code` on Frame 1568:55865  
3. **Design Tokens**: `get_variable_defs` for consistent styling
4. **Navigation Discovery**: Look for navigation elements in code output
5. **Systematic Implementation**: Build components matching exact designs

## 🚨 **Troubleshooting**

If MCP tools don't work:

1. **Check Figma Desktop**: MCP server must be running in Figma desktop app
2. **Restart Claude**: MCP configuration requires Claude Code restart
3. **Verify Node ID**: Use exact Frame IDs from Figma (like 1568:55865)
4. **Check Connection**: Use `/mcp` command to verify server status

## ✅ **Success Indicators**

You'll know it's working when:
- MCP tools return actual design data (not "no output")
- get_image shows visual representation of Figma frame
- get_code returns component structure and styling
- Can navigate between frames using discovered node IDs

## 📝 **Implementation Notes**

- Use TodoWrite to track each frame implementation
- Start with Frame 1568:55865 (Landing Page)
- Build components in existing React/TypeScript structure
- Match Figma designs exactly using MCP-provided specifications
- Implement navigation between discovered frames