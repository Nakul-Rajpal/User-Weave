/**
 * Admin Control Panel
 * Allows admins to enable/disable workflow nodes for participants
 * Only visible and functional for admins
 */

'use client';

import { useWorkflowStore } from '~/lib/stores/workflowStore';
import { WORKFLOW_NODES } from '~/lib/workflow/nodeDefinitions';
import type { WorkflowNodeId } from '~/types/workflow';

interface HostControlPanelProps {
  isAdmin: boolean;
}

export default function HostControlPanel({ isAdmin }: HostControlPanelProps) {
  const { toggleNodeEnabled, isNodeEnabled } = useWorkflowStore();

  // Only render for admin
  if (!isAdmin) {
    return null;
  }

  const handleToggle = async (nodeId: WorkflowNodeId) => {
    await toggleNodeEnabled(nodeId);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎛️</span>
        <div>
          <h3 className="font-semibold text-gray-800">Admin Controls</h3>
          <p className="text-xs text-gray-600">Enable/disable sections for participants</p>
        </div>
      </div>

      <div className="space-y-2">
        {WORKFLOW_NODES.filter((node) => node.id !== 'meeting' && node.id !== 'exit').map((node) => {
          const enabled = isNodeEnabled(node.id);
          return (
            <div
              key={node.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{node.icon}</span>
                <div>
                  <div className="font-medium text-sm text-gray-800">{node.label}</div>
                  <div className="text-xs text-gray-500">{node.description}</div>
                </div>
              </div>

              <button
                onClick={() => handleToggle(node.id)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  enabled
                    ? 'bg-green-500 focus:ring-green-500'
                    : 'bg-gray-300 focus:ring-gray-400'
                }`}
                role="switch"
                aria-checked={enabled}
                aria-label={`Toggle ${node.label}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 <strong>Meeting</strong> and <strong>Exit</strong> are always accessible
        </p>
      </div>
    </div>
  );
}
