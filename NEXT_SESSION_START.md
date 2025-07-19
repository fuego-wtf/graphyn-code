# 🚀 COPY THIS TO START NEXT CLAUDE CODE SESSION

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