export type ConversationTreeConversation = {
  id: string;
  title: string;
  rootNodeId?: string;
  activeLeafId?: string;
  nodeCount?: number;
  branchCount?: number;
  activeDepth?: number;
};

export type ConversationTreeNode = {
  id: string;
  parentId: string | null;
  role: string;
  speakerName?: string;
  preview: string;
  depth: number;
  siblingOrder: number;
  status: string;
  isActivePath: boolean;
  isActiveLeaf: boolean;
  childCount: number;
  branchCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ConversationTreeSummary = {
  conversation: ConversationTreeConversation;
  nodes: ConversationTreeNode[];
};

export type ConversationTreeFlowNodeData = Record<string, unknown> & {
  label: string;
  role: string;
  meta: string;
  preview: string;
  childCount: number;
  branchCount: number;
  isActivePath: boolean;
  isActiveLeaf: boolean;
};
