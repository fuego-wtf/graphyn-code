export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_type: 'user' | 'agent';
  sender_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

export async function getThreadMessages(
  threadId: string,
  token: string,
  apiUrl: string
): Promise<ThreadMessage[]> {
  const response = await fetch(`${apiUrl}/api/internal/threads/${threadId}/messages`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.statusText}`);
  }
  
  const data = await response.json() as { messages?: ThreadMessage[] };
  return data.messages || [];
}

export function pollThreadMessages(
  threadId: string,
  token: string,
  apiUrl: string,
  onNewMessage: (message: ThreadMessage) => void,
  interval = 2000
): () => void {
  let lastMessageId: string | null = null;
  let polling = true;
  
  const poll = async () => {
    if (!polling) return;
    
    try {
      const messages = await getThreadMessages(threadId, token, apiUrl);
      
      // Find new messages
      if (messages.length > 0) {
        const lastIndex = lastMessageId 
          ? messages.findIndex(m => m.id === lastMessageId)
          : -1;
          
        const newMessages = lastIndex >= 0 
          ? messages.slice(lastIndex + 1)
          : messages;
          
        for (const message of newMessages) {
          onNewMessage(message);
        }
        
        if (newMessages.length > 0) {
          lastMessageId = messages[messages.length - 1].id;
        }
      }
    } catch (err) {
      console.error('Error polling messages:', err);
    }
    
    if (polling) {
      setTimeout(poll, interval);
    }
  };
  
  // Start polling
  poll();
  
  // Return cleanup function
  return () => {
    polling = false;
  };
}