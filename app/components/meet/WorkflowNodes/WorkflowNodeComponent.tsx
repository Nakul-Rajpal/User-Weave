/**
 * Custom WorkflowNode Component for ReactFlow
 * Displays a node with icon, label, description, and state indicators
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorkflowNodeId } from '~/types/workflow';

export interface WorkflowNodeData {
  id: WorkflowNodeId;
  label: string;
  description: string;
  icon?: string;
  color?: string;
  isCurrent: boolean;
  isVisited: boolean;
  isAccessible: boolean;
  onClick: (nodeId: WorkflowNodeId) => void;
}

function WorkflowNodeComponent({ data }: NodeProps<WorkflowNodeData>) {
  const { id, label, description, icon, color, isCurrent, isVisited, isAccessible, onClick } = data;

  const handleClick = () => {
    if (isAccessible) {
      onClick(id);
    }
  };

  // Determine node styling based on state
  const getNodeClasses = () => {
    const baseClasses = 'px-6 py-4 rounded-lg border-2 min-w-[200px] transition-all cursor-pointer';

    if (!isAccessible) {
      return `${baseClasses} bg-gray-200 border-gray-300 opacity-50 cursor-not-allowed`;
    }

    if (isCurrent) {
      return `${baseClasses} bg-white border-blue-500 shadow-lg ring-2 ring-blue-300`;
    }

    if (isVisited) {
      return `${baseClasses} bg-white border-green-500 hover:shadow-md`;
    }

    return `${baseClasses} bg-white border-gray-300 hover:border-gray-400 hover:shadow-md`;
  };

  const getIconClasses = () => {
    if (isCurrent) return 'text-4xl';
    if (isVisited) return 'text-3xl opacity-80';
    return 'text-3xl opacity-50';
  };

  return (
    <div className={getNodeClasses()} onClick={handleClick}>
      {/* Input Handle */}
      {id !== 'meeting' && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: color || '#888',
            width: 10,
            height: 10,
          }}
        />
      )}

      {/* Node Content */}
      <div className="flex flex-col items-center text-center space-y-2">
        {/* Icon */}
        {icon && <div className={getIconClasses()}>{icon}</div>}

        {/* Label */}
        <div className="font-bold text-lg">{label}</div>

        {/* Description */}
        <div className="text-sm text-gray-600">{description}</div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs mt-2">
          {isCurrent && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
              Current
            </span>
          )}
          {isVisited && !isCurrent && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
              ✓ Visited
            </span>
          )}
          {!isAccessible && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
              🔒 Locked
            </span>
          )}
        </div>
      </div>

      {/* Output Handle */}
      {id !== 'exit' && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: color || '#888',
            width: 10,
            height: 10,
          }}
        />
      )}
    </div>
  );
}

export default memo(WorkflowNodeComponent);
