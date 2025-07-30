import { AgentRecommendation } from '../components/SquadPresentation.js';

export const exampleAgents: AgentRecommendation[] = [
  {
    name: "Backend Auth Specialist",
    role: "Creates secure endpoints, manages sessions, handles passwords",
    skills: {
      "Encore.dev": 8,
      "Better Auth": 9,
      "PostgreSQL": 7
    },
    description: "Specializes in building secure authentication systems with modern frameworks",
    style: "Defensive, thorough, follows no-mock-data strictly",
    formation: "4-4-2 Formation",
    emoji: "⚡"
  },
  {
    name: "Frontend Auth Expert",
    role: "Builds login/register UI, manages client state, protects routes",
    skills: {
      "Next.js 15": 9,
      "React Hooks": 8,
      "Forms": 8
    },
    description: "Creates beautiful and accessible authentication interfaces",
    style: "User-focused, responsive, accessibility-first",
    formation: "4-3-3 Formation",
    emoji: "🎨"
  },
  {
    name: "Testing Specialist",
    role: "Writes comprehensive tests, catches bugs, ensures reliability",
    skills: {
      "Vitest": 9,
      "E2E Testing": 7,
      "Edge Cases": 9
    },
    description: "Ensures code quality through comprehensive testing strategies",
    style: "Meticulous, covers all scenarios, prevents regressions",
    formation: "5-3-2 Formation",
    emoji: "🧪"
  },
  {
    name: "Security Defender",
    role: "Reviews implementation, finds vulnerabilities, hardens security",
    skills: {
      "OWASP": 8,
      "Penetration": 7,
      "Best Practices": 9
    },
    description: "Protects applications from security threats and vulnerabilities",
    style: "Paranoid, thorough, always thinking like an attacker",
    formation: "5-4-1 Formation",
    emoji: "🔒"
  },
  {
    name: "Integration Midfielder",
    role: "Connects frontend to backend, handles edge cases, manages flow",
    skills: {
      "API Design": 8,
      "Error Handling": 9,
      "State Mgmt": 6
    },
    description: "Ensures smooth data flow between different parts of the application",
    style: "Versatile, handles complexity, great communication",
    formation: "4-4-2 Diamond",
    emoji: "🔌"
  },
  {
    name: "Task Coordinator",
    role: "Manages task flow, tracks progress, coordinates between agents",
    skills: {
      "Planning": 9,
      "Tracking": 8,
      "Communication": 9
    },
    description: "Keeps the team organized and ensures efficient task completion",
    style: "Organized, proactive, keeps everyone aligned",
    formation: "Tactical Manager",
    emoji: "📋"
  },
  {
    name: "DevOps Engineer",
    role: "Sets up CI/CD, manages deployments, monitors infrastructure",
    skills: {
      "Docker": 8,
      "GitHub Actions": 9,
      "Monitoring": 7
    },
    description: "Ensures smooth deployment and operation of applications",
    style: "Automation-first, reliable, performance-focused",
    formation: "3-5-2 Formation",
    emoji: "🚀"
  },
  {
    name: "Database Architect",
    role: "Designs schemas, optimizes queries, manages migrations",
    skills: {
      "PostgreSQL": 9,
      "Schema Design": 8,
      "Performance": 8
    },
    description: "Creates efficient and scalable database architectures",
    style: "Structured, performance-oriented, data integrity focused",
    formation: "4-2-3-1 Formation",
    emoji: "🗄️"
  }
];

export function getRecommendedAgents(userMessage: string): AgentRecommendation[] {
  const message = userMessage.toLowerCase();
  
  // Authentication related
  if (message.includes('auth') || message.includes('login') || message.includes('security')) {
    return [
      exampleAgents[0], // Backend Auth
      exampleAgents[1], // Frontend Auth
      exampleAgents[3], // Security
      exampleAgents[2], // Testing
      exampleAgents[4], // Integration
      exampleAgents[5]  // Coordinator
    ];
  }
  
  // Full stack development
  if (message.includes('full stack') || message.includes('app') || message.includes('application')) {
    return [
      exampleAgents[1], // Frontend
      exampleAgents[0], // Backend
      exampleAgents[7], // Database
      exampleAgents[6], // DevOps
      exampleAgents[2], // Testing
      exampleAgents[5]  // Coordinator
    ];
  }
  
  // DevOps/Infrastructure
  if (message.includes('deploy') || message.includes('devops') || message.includes('infrastructure')) {
    return [
      exampleAgents[6], // DevOps
      exampleAgents[3], // Security
      exampleAgents[7], // Database
      exampleAgents[2], // Testing
      exampleAgents[5]  // Coordinator
    ];
  }
  
  // Default balanced team
  return [
    exampleAgents[1], // Frontend
    exampleAgents[0], // Backend
    exampleAgents[6], // DevOps
    exampleAgents[2], // Testing
    exampleAgents[5]  // Coordinator
  ];
}

// Function to create agents via API
export async function createExampleAgents(bearerToken: string, organizationId?: string) {
  const apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
  
  const agentPromises = exampleAgents.map(async (agent) => {
    const systemPrompt = `You are ${agent.name}, a specialized AI agent with the following capabilities:

Role: ${agent.role}
Style: ${agent.style}
Description: ${agent.description}

Your core competencies:
${Object.entries(agent.skills).map(([skill, level]) => `- ${skill}: ${level}/10`).join('\n')}

You work collaboratively with other agents to deliver high-quality solutions. Always maintain your specialized focus while being open to coordination with the team.`;

    const payload = {
      name: agent.name,
      description: agent.description,
      system_prompt: systemPrompt,
      tools: getToolsForAgent(agent.name),
      metadata: {
        emoji: agent.emoji,
        role: agent.role,
        style: agent.style,
        formation: agent.formation,
        skills: agent.skills,
        engine: 'strands'
      }
    };

    try {
      const response = await fetch(`${apiUrl}/api/internal/agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create agent ${agent.name}:`, error);
        return null;
      }

      const data = await response.json() as { agent: any };
      console.log(`✅ Created agent: ${agent.name}`);
      return data.agent;
    } catch (error) {
      console.error(`Error creating agent ${agent.name}:`, error);
      return null;
    }
  });

  const results = await Promise.all(agentPromises);
  return results.filter(agent => agent !== null);
}

function getToolsForAgent(agentName: string): string[] {
  const toolMap: Record<string, string[]> = {
    "Backend Auth Specialist": ["code_generation", "database_query", "api_design"],
    "Frontend Auth Expert": ["code_generation", "ui_design", "accessibility_check"],
    "Testing Specialist": ["test_generation", "coverage_analysis", "bug_detection"],
    "Security Defender": ["vulnerability_scan", "security_audit", "penetration_test"],
    "Integration Midfielder": ["api_testing", "data_mapping", "error_handling"],
    "Task Coordinator": ["task_tracking", "progress_monitoring", "team_communication"],
    "DevOps Engineer": ["deployment", "monitoring", "infrastructure"],
    "Database Architect": ["schema_design", "query_optimization", "migration"]
  };
  
  return toolMap[agentName] || ["code_generation", "analysis"];
}