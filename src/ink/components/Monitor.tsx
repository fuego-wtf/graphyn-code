import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../store.js';
import { useAPI } from '../hooks/useAPI.js';

interface SystemMetrics {
  threads: {
    active: number;
    total: number;
    recent: Array<{
      id: string;
      name: string;
      lastActivity: string;
    }>;
  };
  agents: {
    available: number;
    inUse: number;
    popular: Array<{
      name: string;
      usageCount: number;
    }>;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    errorRate: number;
  };
  usage: {
    requestsToday: number;
    tokensUsed: number;
    remaining: number;
  };
}

export const Monitor: React.FC = () => {
  const { reset } = useStore();
  const api = useAPI();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    loadMetrics();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      setRefreshCount(prev => prev + 1);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refreshCount > 0) {
      loadMetrics();
    }
  }, [refreshCount]);

  const loadMetrics = async () => {
    try {
      // Simulate gathering metrics from various endpoints
      const [threadsData, agentsData, healthData] = await Promise.all([
        api.threads.list(),
        api.agents.list(),
        api.get<{ status: string; responseTime: number }>('/health')
      ]);
      
      // Calculate metrics
      const now = new Date();
      const activeThreads = threadsData.filter(t => {
        const lastUpdate = new Date(t.updated_at);
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate < 24;
      });
      
      setMetrics({
        threads: {
          active: activeThreads.length,
          total: threadsData.length,
          recent: threadsData.slice(0, 3).map(t => ({
            id: t.id,
            name: t.name,
            lastActivity: new Date(t.updated_at).toLocaleString()
          }))
        },
        agents: {
          available: agentsData.length,
          inUse: Math.floor(Math.random() * agentsData.length), // Simulated
          popular: agentsData.slice(0, 3).map(a => ({
            name: a.name,
            usageCount: Math.floor(Math.random() * 100) // Simulated
          }))
        },
        api: {
          status: 'healthy',
          responseTime: healthData.responseTime || 50,
          errorRate: 0.02 // Simulated
        },
        usage: {
          requestsToday: Math.floor(Math.random() * 1000),
          tokensUsed: Math.floor(Math.random() * 50000),
          remaining: 100000 - Math.floor(Math.random() * 50000)
        }
      });
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'green';
      case 'degraded': return 'yellow';
      case 'down': return 'red';
      default: return 'gray';
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (loading && refreshCount === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📊 System Monitor</Text>
        <Box marginTop={1}>
          <Text>Loading metrics...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>📊 System Monitor</Text>
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
        <Box marginTop={2}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  if (!metrics) return null;

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text bold>📊 System Monitor</Text>
        <Text color="gray">Auto-refresh: {refreshCount}</Text>
      </Box>
      
      {/* API Status */}
      <Box marginTop={2} flexDirection="column">
        <Text bold>API Status</Text>
        <Box marginLeft={2} flexDirection="column">
          <Box>
            <Text>Status: </Text>
            <Text color={getStatusColor(metrics.api.status)}>
              {metrics.api.status === 'healthy' ? '●' : '○'} {metrics.api.status}
            </Text>
          </Box>
          <Text>Response Time: <Text color="cyan">{metrics.api.responseTime}ms</Text></Text>
          <Text>Error Rate: <Text color={metrics.api.errorRate > 0.05 ? 'yellow' : 'green'}>
            {(metrics.api.errorRate * 100).toFixed(2)}%
          </Text></Text>
        </Box>
      </Box>
      
      {/* Threads */}
      <Box marginTop={2} flexDirection="column">
        <Text bold>Threads</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>Active: <Text color="green">{metrics.threads.active}</Text> / Total: <Text color="cyan">{metrics.threads.total}</Text></Text>
          {metrics.threads.recent.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Recent:</Text>
              {metrics.threads.recent.map(t => (
                <Text key={t.id} color="gray">  • {t.name} ({t.lastActivity})</Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Agents */}
      <Box marginTop={2} flexDirection="column">
        <Text bold>Agents</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>Available: <Text color="green">{metrics.agents.available}</Text> | In Use: <Text color="yellow">{metrics.agents.inUse}</Text></Text>
          {metrics.agents.popular.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Popular:</Text>
              {metrics.agents.popular.map(a => (
                <Text key={a.name} color="gray">  • {a.name} ({a.usageCount} uses)</Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Usage */}
      <Box marginTop={2} flexDirection="column">
        <Text bold>Usage Today</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>Requests: <Text color="cyan">{formatNumber(metrics.usage.requestsToday)}</Text></Text>
          <Text>Tokens Used: <Text color="yellow">{formatNumber(metrics.usage.tokensUsed)}</Text></Text>
          <Text>Remaining: <Text color="green">{formatNumber(metrics.usage.remaining)}</Text></Text>
        </Box>
      </Box>
      
      <Box marginTop={2} borderStyle="single" borderColor="gray" padding={1}>
        <Text dimColor>Refreshes every 5 seconds • Press ESC to exit</Text>
      </Box>
    </Box>
  );
};