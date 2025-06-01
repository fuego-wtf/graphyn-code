#!/usr/bin/env bash
#
# Graphyn Code - Agent Functions
# Functions for managing living agent prompts and editorial direction

# Sync GRAPHYN.md with server
sync_graphyn_md() {
    local action="${1:-pull}"  # pull, push, or edit
    local graphyn_file="${PWD}/GRAPHYN.md"
    
    case "$action" in
        "pull")
            print_section "📥 Syncing GRAPHYN.md from server"
            
            if ! check_auth; then
                echo -e "${BRIGHT_BLUE}Please authenticate first: ${WHITE}graphyn auth <api-key>${NC}"
                return 1
            fi
            
            # Fetch from server
            local response
            response=$(call_api "GET" "/agent-prompts/editorial" "" 2>/dev/null)
            
            if [[ $? -eq 0 ]]; then
                local content
                content=$(echo "$response" | jq -r '.content // ""')
                
                if [[ -n "$content" && "$content" != "null" ]]; then
                    echo "$content" > "$graphyn_file"
                    echo -e "${BRIGHT_BLUE}✅ GRAPHYN.md synced from server${NC}"
                else
                    # Copy template if no server content
                    if [[ -f "${TEMPLATES_DIR}/GRAPHYN.md" ]]; then
                        cp "${TEMPLATES_DIR}/GRAPHYN.md" "$graphyn_file"
                        echo -e "${LIGHT_PURPLE}📋 Created GRAPHYN.md from template${NC}"
                    fi
                fi
            else
                echo -e "${TAN_BROWN}⚠️  Could not sync from server, using local file${NC}"
            fi
            ;;
            
        "push")
            print_section "📤 Pushing GRAPHYN.md to server"
            
            if [[ ! -f "$graphyn_file" ]]; then
                echo -e "${TAN_BROWN}❌ GRAPHYN.md not found in current directory${NC}"
                return 1
            fi
            
            if ! check_auth; then
                echo -e "${BRIGHT_BLUE}Please authenticate first: ${WHITE}graphyn auth <api-key>${NC}"
                return 1
            fi
            
            local content
            content=$(cat "$graphyn_file")
            local payload
            payload=$(jq -n --arg content "$content" '{content: $content}')
            
            local response
            response=$(call_api "PUT" "/agent-prompts/editorial" "$payload")
            
            if [[ $? -eq 0 ]]; then
                echo -e "${BRIGHT_BLUE}✅ GRAPHYN.md pushed to server${NC}"
                echo -e "${GRAY}Your editorial direction is now active for all agents${NC}"
            else
                echo -e "${TAN_BROWN}❌ Failed to push GRAPHYN.md to server${NC}"
                return 1
            fi
            ;;
            
        "edit")
            print_section "📝 Edit GRAPHYN.md"
            
            # Ensure we have latest version
            sync_graphyn_md "pull"
            
            # Open in editor
            local editor="${EDITOR:-${VISUAL:-vim}}"
            
            if command -v "$editor" >/dev/null 2>&1; then
                "$editor" "$graphyn_file"
                
                # Ask if user wants to push changes
                echo
                read -p "Push changes to server? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    sync_graphyn_md "push"
                fi
            else
                echo -e "${TAN_BROWN}❌ No editor found. Set EDITOR or VISUAL environment variable${NC}"
                echo -e "${GRAY}File location: $graphyn_file${NC}"
                return 1
            fi
            ;;
            
        *)
            echo -e "${TAN_BROWN}Usage: graphyn sync [pull|push|edit]${NC}"
            echo -e "${GRAY}  pull  - Download GRAPHYN.md from server${NC}"
            echo -e "${GRAY}  push  - Upload GRAPHYN.md to server${NC}"
            echo -e "${GRAY}  edit  - Edit GRAPHYN.md and optionally push${NC}"
            return 1
            ;;
    esac
}

# Fetch agent prompt from server (living docs)
fetch_agent_prompt() {
    local agent_type="$1"
    
    if ! check_auth; then
        # Fallback to local prompts if not authenticated
        local prompt_file="${PROMPTS_DIR}/${agent_type}.md"
        if [[ -f "$prompt_file" ]]; then
            cat "$prompt_file"
            return 0
        else
            echo "Error: Agent prompt not found and not authenticated"
            return 1
        fi
    fi
    
    # Fetch living prompt from server
    local response
    response=$(call_api "GET" "/agent-prompts/${agent_type}" "" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        local prompt
        prompt=$(echo "$response" | jq -r '.prompt // ""')
        
        if [[ -n "$prompt" && "$prompt" != "null" ]]; then
            echo "$prompt"
            return 0
        fi
    fi
    
    # Fallback to local prompt
    local prompt_file="${PROMPTS_DIR}/${agent_type}.md"
    if [[ -f "$prompt_file" ]]; then
        cat "$prompt_file"
        return 0
    fi
    
    echo "Error: Could not fetch agent prompt for $agent_type"
    return 1
}

# Show agent customization status
show_agent_status() {
    print_section "🤖 Agent Customization Status"
    
    if ! check_auth; then
        echo -e "${TAN_BROWN}❌ Please authenticate to view agent status${NC}"
        return 1
    fi
    
    # Check editorial direction
    local editorial_response
    editorial_response=$(call_api "GET" "/agent-prompts/editorial" "" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        local has_editorial
        has_editorial=$(echo "$editorial_response" | jq -r '.content | length > 0')
        
        if [[ "$has_editorial" == "true" ]]; then
            local last_updated
            last_updated=$(echo "$editorial_response" | jq -r '.lastUpdated // ""')
            echo -e "${BRIGHT_BLUE}📋 Editorial Direction: ${WHITE}Active${NC}"
            if [[ -n "$last_updated" && "$last_updated" != "null" ]]; then
                echo -e "${GRAY}   Last updated: $(date -d "$last_updated" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$last_updated")${NC}"
            fi
        else
            echo -e "${GRAY}📋 Editorial Direction: Not configured${NC}"
        fi
    fi
    
    # Check each agent type
    for agent_type in "backend" "frontend" "architect"; do
        local agent_response
        agent_response=$(call_api "GET" "/agent-prompts/${agent_type}" "" 2>/dev/null)
        
        if [[ $? -eq 0 ]]; then
            local has_customizations
            local version
            has_customizations=$(echo "$agent_response" | jq -r '.hasCustomizations // false')
            version=$(echo "$agent_response" | jq -r '.version // 1')
            
            local status_icon="🤖"
            local status_text="Default"
            
            if [[ "$has_customizations" == "true" ]]; then
                status_icon="⚡"
                status_text="Customized"
            fi
            
            echo -e "${status_icon} ${agent_type^} Agent: ${WHITE}${status_text}${NC} ${GRAY}(v${version})${NC}"
        else
            echo -e "${GRAY}🤖 ${agent_type^} Agent: Unknown status${NC}"
        fi
    done
    
    echo
    echo -e "${GRAY}Commands:${NC}"
    echo -e "  ${WHITE}graphyn sync edit${NC}    - Edit your GRAPHYN.md"
    echo -e "  ${WHITE}graphyn sync push${NC}    - Upload changes to server"
    echo -e "  ${WHITE}graphyn sync pull${NC}    - Download latest from server"
}

# Initialize GRAPHYN.md in current directory
init_graphyn_md() {
    local graphyn_file="${PWD}/GRAPHYN.md"
    
    if [[ -f "$graphyn_file" ]]; then
        echo -e "${TAN_BROWN}GRAPHYN.md already exists in current directory${NC}"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi
    
    print_section "📋 Initializing GRAPHYN.md"
    
    # Try to sync from server first
    if check_auth; then
        sync_graphyn_md "pull"
    else
        # Copy template
        if [[ -f "${TEMPLATES_DIR}/GRAPHYN.md" ]]; then
            cp "${TEMPLATES_DIR}/GRAPHYN.md" "$graphyn_file"
            echo -e "${LIGHT_PURPLE}📋 Created GRAPHYN.md from template${NC}"
        else
            echo -e "${TAN_BROWN}❌ Template not found${NC}"
            return 1
        fi
    fi
    
    echo
    echo -e "${BRIGHT_BLUE}🎯 Next steps:${NC}"
    echo -e "1. ${WHITE}Edit GRAPHYN.md${NC} to customize your agents"
    echo -e "2. ${WHITE}graphyn sync push${NC} to upload your changes"
    echo -e "3. ${WHITE}graphyn --backend \"your question\"${NC} to test customization"
}

# Reset agent prompts to default
reset_agent_prompts() {
    local agent_type="$1"
    
    if [[ -z "$agent_type" ]]; then
        echo -e "${TAN_BROWN}Usage: graphyn reset [backend|frontend|architect|all]${NC}"
        return 1
    fi
    
    if ! check_auth; then
        echo -e "${BRIGHT_BLUE}Please authenticate first: ${WHITE}graphyn auth <api-key>${NC}"
        return 1
    fi
    
    if [[ "$agent_type" == "all" ]]; then
        print_section "🔄 Resetting all agent prompts"
        
        for type in "backend" "frontend" "architect"; do
            local response
            response=$(call_api "DELETE" "/agent-prompts/${type}" "")
            
            if [[ $? -eq 0 ]]; then
                echo -e "${BRIGHT_BLUE}✅ ${type^} agent reset to default${NC}"
            else
                echo -e "${TAN_BROWN}❌ Failed to reset ${type} agent${NC}"
            fi
        done
    else
        print_section "🔄 Resetting ${agent_type} agent prompt"
        
        local response
        response=$(call_api "DELETE" "/agent-prompts/${agent_type}" "")
        
        if [[ $? -eq 0 ]]; then
            echo -e "${BRIGHT_BLUE}✅ ${agent_type^} agent reset to default${NC}"
        else
            echo -e "${TAN_BROWN}❌ Failed to reset ${agent_type} agent${NC}"
            return 1
        fi
    fi
}