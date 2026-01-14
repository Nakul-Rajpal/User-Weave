# Workflow Navigation System Setup Guide

This guide explains how to set up and test the ReactFlow-based workflow navigation system for meeting rooms.

## Overview

The workflow system replaces button-based navigation with a visual ReactFlow canvas, allowing users to navigate between different meeting stages:

```
Meeting Room → Poll/Voting → Coding Mode → Code Review → Exit
```

### Key Features

- **Shared State**: All participants in a room see the same workflow state
- **Host Control**: First user to join becomes the host and controls workflow progression
- **Conditional Access**: Nodes must be visited in order (locked/unlocked states)
- **Real-time Sync**: Supabase real-time updates keep all participants synchronized
- **Persistent State**: Workflow state persists across page reloads

## Database Setup

### 1. Run the Migration

Apply the workflow_states table migration:

```bash
cd supabase
npx supabase migration up
```

Or if using Supabase CLI:

```bash
npx supabase db push
```

### 2. Verify Table Creation

Check that the `workflow_states` table was created:

```sql
-- Connect to your Supabase database
SELECT * FROM workflow_states;
```

Expected schema:
- `id` (uuid, primary key)
- `room_id` (text, unique)
- `current_node` (text)
- `host_user_id` (text)
- `visited_nodes` (text[])
- `metadata` (jsonb)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 3. Verify Real-time is Enabled

The migration automatically enables real-time for the table. Verify in Supabase dashboard:

1. Go to Database → Publications
2. Check that `workflow_states` is in the `supabase_realtime` publication

## Architecture

### File Structure

```
app/
├── routes/
│   ├── meet.$roomId.workflow.tsx      # Workflow canvas route
│   ├── meet.$roomId.poll.tsx           # Poll/Voting page
│   ├── meet.$roomId.code-review.tsx    # Code review page
│   └── meet.$roomId.tsx                # Meeting room (updated)
├── components/meet/
│   ├── WorkflowCanvas.tsx              # Main ReactFlow component
│   ├── WorkflowNodes/
│   │   ├── WorkflowNodeComponent.tsx   # Custom node component
│   │   └── index.ts
│   ├── VideoConference.tsx             # Updated with Workflow button
│   └── VideoTileStrip.tsx              # Updated with Workflow button
├── lib/
│   ├── stores/
│   │   └── workflowStore.ts            # Zustand store with Supabase sync
│   └── workflow/
│       ├── nodeDefinitions.ts          # Node and edge definitions
│       ├── conditionalAccess.ts        # Access control logic
│       └── workflowManager.ts          # Central workflow manager
└── types/
    └── workflow.ts                     # TypeScript types
```

### Workflow State Flow

```
User joins room
    ↓
workflowStore.initializeWorkflow(roomId, userId)
    ↓
Check if workflow_states exists for roomId
    ↓
    ├─ Exists: Load state, determine if user is host
    └─ Not exists: Create new state, user becomes host
    ↓
Subscribe to Supabase real-time updates
    ↓
User clicks "Workflow" button
    ↓
Navigate to /meet/:roomId/workflow
    ↓
Display ReactFlow canvas with nodes
    ↓
User clicks accessible node
    ↓
Host updates current_node in Supabase
    ↓
Real-time broadcast to all participants
    ↓
All participants navigate to selected node
```

## Testing

### 1. Start Development Server

```bash
pnpm run dev
```

### 2. Test Single User Flow

1. Navigate to `http://localhost:5173/meet`
2. Create or join a room (e.g., "test-room")
3. You should see the video conference with a **🔀 Workflow** button
4. Click the **Workflow** button
5. You should see the ReactFlow canvas with 5 nodes:
   - Meeting (current, unlocked)
   - Poll/Voting (locked)
   - Coding Mode (locked)
   - Code Review (locked)
   - Exit (unlocked)

### 3. Test Node Navigation

1. Click on the **Poll/Voting** node
   - Since Meeting is visited, Poll should be accessible
   - You should navigate to `/meet/test-room/poll`
2. Click **Workflow** button again
   - Poll node should now show as "Visited"
   - Coding Mode should now be unlocked
3. Click on **Coding Mode**
   - Navigate to `/meet/test-room/code`
4. Continue through the workflow

### 4. Test Multi-User Synchronization

**User A (Host):**
1. Join room "sync-test"
2. Click Workflow button
3. You should see a "Host" badge
4. Navigate to Poll node

**User B (Participant):**
1. Join same room "sync-test" in a different browser/tab
2. Click Workflow button
3. You should NOT see a "Host" badge
4. You should see the same workflow state as User A
5. The current node should be "Poll" (synced from host)

**Host Action:**
1. User A navigates to Coding Mode

**Expected Result:**
- User B's workflow view should automatically update
- Current node changes to "Coding Mode"
- User B can click the Coding node to navigate there

### 5. Test Persistence

1. Join room "persist-test"
2. Navigate through workflow: Meeting → Poll → Coding
3. Close browser tab
4. Rejoin room "persist-test"
5. Click Workflow button
6. **Expected**: Workflow state is restored (current node = Coding, all previous nodes visited)

### 6. Test Conditional Access

1. Join new room "access-test"
2. Click Workflow button
3. Try clicking **Code Review** node (should be locked)
4. **Expected**: Alert message "This node is not accessible yet"
5. Navigate in order: Meeting → Poll → Coding → Code Review
6. **Expected**: Each node unlocks only after previous nodes are visited

## Troubleshooting

### Issue: Workflow state not loading

**Check:**
1. Supabase connection is working
2. Migration was applied successfully
3. RLS policies allow authenticated users to read/write

**Solution:**
```bash
# Check Supabase connection
npx supabase status

# Re-run migration
npx supabase db reset
npx supabase db push
```

### Issue: Real-time updates not working

**Check:**
1. Supabase real-time is enabled for `workflow_states` table
2. Browser console for WebSocket connection errors
3. Supabase real-time quota (free tier limits)

**Solution:**
```sql
-- Enable real-time manually
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_states;
```

### Issue: "Only host can change workflow state" error

**Explanation:**
- Only the first user to join (host) can navigate the workflow
- Other participants see the workflow but can't change it

**To test host functionality:**
1. Open incognito/private window
2. Join room first to become host
3. Test navigation

### Issue: TypeScript errors

**Solution:**
```bash
# Reinstall dependencies
pnpm install

# Clear cache and rebuild
rm -rf .cache build
pnpm run build
```

## Configuration

### Modify Workflow Nodes

Edit [app/lib/workflow/nodeDefinitions.ts](app/lib/workflow/nodeDefinitions.ts:7):

```typescript
export const WORKFLOW_NODES: WorkflowNode[] = [
  {
    id: 'my-custom-node',
    label: 'My Node',
    description: 'Description',
    route: '/meet/:roomId/my-route',
    icon: '🎯',
    color: '#3b82f6',
  },
  // ... more nodes
];
```

### Modify Access Rules

Edit [app/lib/workflow/conditionalAccess.ts](app/lib/workflow/conditionalAccess.ts:11):

```typescript
export const ACCESS_RULES: ConditionalAccessRule[] = [
  {
    nodeId: 'my-custom-node',
    requires: ['meeting'], // Requires meeting to be visited first
    requiresAll: true,
  },
];
```

### Customize Node Appearance

Edit [app/components/meet/WorkflowNodes/WorkflowNodeComponent.tsx](app/components/meet/WorkflowNodes/WorkflowNodeComponent.tsx:14):

Modify the `getNodeClasses()` function to change colors, borders, shadows, etc.

## Next Steps

1. **Implement Poll Functionality**: Add actual poll creation/voting in [app/routes/meet.$roomId.poll.tsx](app/routes/meet.$roomId.poll.tsx:1)
2. **Implement Code Review**: Add code diff viewer in [app/routes/meet.$roomId.code-review.tsx](app/routes/meet.$roomId.code-review.tsx:1)
3. **Add Notifications**: Toast notifications when workflow changes
4. **Add Workflow History**: Track workflow transition history in metadata
5. **Add Permission System**: Allow granular control over who can navigate

## Additional Resources

- [ReactFlow Documentation](https://reactflow.dev/)
- [Supabase Real-time Documentation](https://supabase.com/docs/guides/realtime)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
