import React, { useEffect, useState } from 'react';
import { SquadBuilder } from './SquadBuilder.js';
import { AdvancedSquadFlow } from './AdvancedSquadFlow.js';
import { useAPI, useAuth } from '../hooks/useAPI.js';
import { ConfigManager } from '../../config-manager.js';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme/colors.js';

interface SquadBuilderWithFlowProps {
  query: string;
}

export const SquadBuilderWithFlow: React.FC<SquadBuilderWithFlowProps> = ({ query }) => {
  const api = useAPI();
  const { isAuthenticated } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useAdvancedFlow, setUseAdvancedFlow] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const configManager = new ConfigManager();
        const currentOrg = await configManager.get('currentOrganization');
        
        if (currentOrg?.id && api.client && isAuthenticated) {
          setOrganizationId(currentOrg.id);
          // Enable advanced flow when we have all required components
          setUseAdvancedFlow(true);
        }
      } catch (error) {
        console.error('Failed to check setup:', error);
      } finally {
        setLoading(false);
      }
    };

    if (api.client) {
      checkSetup();
    }
  }, [api.client, isAuthenticated]);

  if (loading) {
    return (
      <Box padding={1}>
        <Text color={colors.info}>
          <Spinner type="dots" /> Initializing squad builder...
        </Text>
      </Box>
    );
  }

  // Use advanced flow if we have all requirements
  if (useAdvancedFlow && organizationId && api.client) {
    return (
      <AdvancedSquadFlow
        initialQuery={query}
        apiClient={api.client}
        organizationId={organizationId}
      />
    );
  }

  // Fallback to basic squad builder
  return <SquadBuilder query={query} />;
};