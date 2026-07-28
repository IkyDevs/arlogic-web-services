# UI/UX Design
## EPIC-001: Enterprise Multi Branch System

---

## 1. Branch Selector Component

### 1.1 Location & Visibility

**Navigation Bar (Primary Location)**

```
┌─────────────────────────────────────────────────────┐
│ Arlogic Watch Service                               │
│                                                     │
│ [Cabang Jember ▼] | Dashboard | Services | Reports│
│                                                     │
│ Notification | Profile | Logout                    │
└─────────────────────────────────────────────────────┘
```

**Rules**:
- Shows current branch name
- Dropdown arrow indicates selectable
- Owner: Shows all branches
- Manager/Admin/Tech/QC: Shows only assigned branches (1-3 typically)
- Displays prominently at top-left of navigation

### 1.2 Dropdown Interaction

```
Click: [Cabang Jember ▼]
    ↓
Dropdown opens showing:
    ┌────────────────────┐
    │ Cabang Jember      │ ← Selected (checkmark)
    │ Cabang Kudus       │
    │ Cabang Surabaya    │
    │ ────────────────   │
    │ [+ Add Branch...] (Owner only)
    │ [Branch Settings]  │ (Owner only)
    └────────────────────┘
```

**Owner View (Additional Options)**:
```
    ┌────────────────────┐
    │ ☑ Cabang Jember    │
    │ ○ Cabang Kudus     │
    │ ○ Cabang Surabaya  │
    │ ────────────────   │
    │ ☐ All Branches     │ ← Cross-branch view
    │ ────────────────   │
    │ [+ Create Branch]  │
    │ [Manage Branches]  │
    │ [User Assignments] │
    └────────────────────┘
```

### 1.3 Branch Selection Behavior

**After selecting branch**:

```
1. Update session: branch_id = selected
2. Set cookie: x-branch-id = selected
3. Reload dashboard with new branch data
4. URL stays same (no branch param in URL for security)
5. Show toast: "Switched to Cabang Kudus"
```

**Performance Optimization**:
```
- Cache branch list (5 min TTL)
- Prefetch selected branch data while dropdown open
- Show loading state: [Cabang Kudus... ]
- Disable switching during load
```

---

## 2. Dashboard Variations by Role

### 2.1 Owner Dashboard (Company-Wide View)

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard                                                │
│                                                          │
│ [Cabang Jember ▼] | All Branches | Reports | Settings   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     COMPANY OVERVIEW                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Total Cabang: 3        Total Staff: 28    Revenue: ...│
│                                                         │
│  ┌──────────┬──────────┬──────────┐                    │
│  │ Jember   │ Kudus    │ Surabaya │                    │
│  │ 12 staff │ 8 staff  │ 8 staff  │                    │
│  │ Active   │ Active   │ Paused   │                    │
│  └──────────┴──────────┴──────────┘                    │
│                                                         │
│  Revenue Breakdown (Last 30 Days)                       │
│  ┌──────────────────────────────────┐                  │
│  │ Jember:    Rp 50,000,000 (60%)   │                  │
│  │ Kudus:     Rp 30,000,000 (35%)   │                  │
│  │ Surabaya:  Rp 5,000,000  (5%)    │                  │
│  │ ──────────────────────────────── │                  │
│  │ Total:     Rp 85,000,000         │                  │
│  └──────────────────────────────────┘                  │
│                                                         │
│  Performance (KPI by Branch)                            │
│  ┌─────────────────────────────────┐                   │
│  │ Branch   │ Services │ Quality │   │                 │
│  │ Jember   │ 45       │ 4.8★    │   │                 │
│  │ Kudus    │ 32       │ 4.6★    │   │                 │
│  │ Surabaya │ 8        │ 4.5★    │   │                 │
│  └─────────────────────────────────┘                   │
│                                                         │
│  [View Jember] [View Kudus] [View Surabaya] [Details]  │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Company-wide statistics
- Branch comparison cards
- Revenue breakdown pie chart
- Ability to drill into branch
- Branch management quick links

---

### 2.2 Manager Dashboard (Branch-Specific View)

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard                                                │
│                                                          │
│ [Cabang Jember ▼] | Services | Inventory | Reports      │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  CABANG JEMBER OVERVIEW                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Staff: 12         Active Services: 8        This Month:
│                                              Rp 12,500,000
│
│  ┌──────────────────┐  ┌──────────────────┐             
│  │ Today Revenue    │  │ Service Status   │             
│  │ Rp 1,200,000     │  │ Pending:    2    │             
│  │ 3 services       │  │ In Progress: 5   │             
│  │                  │  │ QC Pending:  1   │             
│  └──────────────────┘  └──────────────────┘             
│                                                         
│  Recent Services (This Branch Only)                     
│  ┌──────────────────────────────────────┐              
│  │ INV-001 | John Doe | Watch Repair... │              
│  │ INV-002 | Jane Smith | Battery...    │              
│  │ INV-003 | Bob Johnson | Cleaning...  │              
│  └──────────────────────────────────────┘              
│                                                         
│  Inventory Summary (Jember Store)                       
│  ┌──────────────────────────────────────┐              
│  │ Low Stock (3 items) ⚠️              │              
│  │ - Bearing Swiss: 1 left              │              
│  │ [Request Stock Transfer]             │              
│  └──────────────────────────────────────┘              
│                                                         
│  [View All Services] [Create Order] [Manage Inventory]  │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Branch-only data
- Branch statistics
- Branch-specific inventory
- Staff list (for this branch)
- Cannot see other branches

---

### 2.3 Technician Dashboard (Personal View)

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard                                                │
│                                                          │
│ [Cabang Jember ▼] | My Queue | My Inventory | Profile   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│               MY ASSIGNED SERVICES                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Assigned to: Rudi Hartono                              │
│  Branch: Cabang Jember                                  │
│                                                         │
│  Pending Assignment (Jember Queue)                      │
│  ┌──────────────────────────────────────┐              
│  │ [Take] INV-001 | Apple Watch | S...│  │              
│  │ [Take] INV-002 | Rolex | Cleaning │  │              
│  └──────────────────────────────────────┘              
│                                                         │
│  My Work (Assigned to Me)                               │
│  ┌──────────────────────────────────────┐              
│  │ INV-003 | Jane Smith | In Progress  │              
│  │          [+ Update Progress]        │              
│  │                                      │              
│  │ INV-004 | Bob Johnson | Completed  │              
│  │          [Ready for QC]             │              
│  └──────────────────────────────────────┘              
│                                                         │
│  [Request Sparepart] [View Details] [My Performance]   │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Only own assigned services
- Branch queue (available to take)
- Cannot see other branches
- Simple interface focused on work

---

### 2.4 QC Dashboard (Review-Focused View)

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard                                                │
│                                                          │
│ [Cabang Jember ▼] | QC Queue | My Reviews | Reports     │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              QC REVIEW QUEUE (JEMBER)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Pending QC Review: 3                                   │
│  ┌──────────────────────────────────────┐              
│  │ [Review] INV-001 | Apple Watch       │              
│  │          Technician: Rudi            │              
│  │          Status: Ready for QC        │              
│  │          Last Updated: 2h ago        │              
│  │                                      │              
│  │ [Review] INV-002 | Rolex             │              
│  │          Technician: Siti            │              
│  │          Status: Ready for QC        │              
│  │          Last Updated: 1h ago        │              
│  │                                      │              
│  │ [Review] INV-003 | Fossil            │              
│  │          Technician: Doni            │              
│  │          Status: Ready for QC        │              
│  │          Last Updated: 30m ago       │              
│  └──────────────────────────────────────┘              
│                                                         │
│  Approved by You (This Month)                           │
│  ┌──────────────────────────────────────┐              
│  │ Total Approved: 24                   │              
│  │ Average Processing Time: 45 minutes  │              
│  │ Customer Satisfaction: 4.8★          │              
│  └──────────────────────────────────────┘              
│                                                         │
│  [View My Reviews] [Statistics]                         │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- QC-specific queue
- Branch-only reviews
- Review history
- Performance metrics

---

## 3. Branch Management Interface (Owner Only)

### 3.1 Branch Management Page

```
┌─────────────────────────────────────────────────────┐
│ Branch Management                                   │
│                                                     │
│ [Cabang Jember ▼] | Settings | Users               │
└─────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│                 BRANCHES                           │
├────────────────────────────────────────────────────┤
│                                                    │
│  [+ Create New Branch]                             │
│                                                    │
│  Cabang Jember                                     │
│  ├─ Code: JMB001                                  │
│  ├─ Location: Jember, Jawa Timur                  │
│  ├─ Staff: 12                                     │
│  ├─ Status: Active ✓                              │
│  ├─ Created: 2026-01-01                           │
│  └─ [Edit] [Users] [Deactivate]                  │
│                                                    │
│  Cabang Kudus                                      │
│  ├─ Code: KDS001                                  │
│  ├─ Location: Kudus, Jawa Tengah                  │
│  ├─ Staff: 8                                      │
│  ├─ Status: Active ✓                              │
│  ├─ Created: 2026-02-01                           │
│  └─ [Edit] [Users] [Deactivate]                  │
│                                                    │
│  Cabang Surabaya                                   │
│  ├─ Code: SBY001                                  │
│  ├─ Location: Surabaya, Jawa Timur                │
│  ├─ Staff: 8                                      │
│  ├─ Status: Paused ⊘                              │
│  ├─ Created: 2026-03-01                           │
│  └─ [Edit] [Users] [Activate] [Delete]           │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 3.2 Create/Edit Branch Modal

```
┌─────────────────────────────────────────────┐
│ Create New Branch                           │
├─────────────────────────────────────────────┤
│                                             │
│ Branch Name: [________________]             │
│ Branch Code: [________________]             │
│                                             │
│ Location Details                           │
│ Address: [________________]                 │
│ City:    [________________]                 │
│ Province:[________________]                 │
│ Postal:  [________________]                 │
│                                             │
│ Contact                                    │
│ Phone: [________________]                   │
│ Email: [________________]                   │
│                                             │
│ Status: [Inactive ▼]                       │
│   - Inactive (not yet operational)          │
│   - Active                                  │
│   - Paused                                  │
│                                             │
│ [Cancel] [Create Branch]                   │
└─────────────────────────────────────────────┘
```

---

## 4. User Assignment Interface (Owner Only)

### 4.1 User Management Page

```
┌────────────────────────────────────────────────────┐
│ User Management                                    │
│                                                    │
│ [+ Create New User] | Branch Filter: [All ▼]      │
├────────────────────────────────────────────────────┤
│                                                    │
│  Rudi Hartono (rudi@arlogic.com)                  │
│  ├─ Primary Branch: Cabang Jember               │
│  ├─ Assigned Branches:                           │
│  │  • Cabang Jember (Technician)                 │
│  │  • Cabang Kudus (Technician)                  │
│  └─ [Edit] [Delete]                             │
│                                                    │
│  Siti Nur Azizah (siti@arlogic.com)              │
│  ├─ Primary Branch: Cabang Jember               │
│  ├─ Assigned Branches:                           │
│  │  • Cabang Jember (Admin)                      │
│  └─ [Edit] [Delete]                             │
│                                                    │
│  Doni Sutrisno (doni@arlogic.com)                │
│  ├─ Primary Branch: Cabang Kudus                │
│  ├─ Assigned Branches:                           │
│  │  • Cabang Kudus (Manager)                     │
│  └─ [Edit] [Delete]                             │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 4.2 Create User Modal

```
┌──────────────────────────────────────────────┐
│ Create New User                              │
├──────────────────────────────────────────────┤
│                                              │
│ Basic Information                            │
│ Email:      [________________]               │
│ Full Name:  [________________]               │
│ Gender:     [Male ▼]                        │
│                                              │
│ Branch Assignment                            │
│ Primary Branch: [Cabang Jember ▼]           │
│                                              │
│ Additional Branches                          │
│ ☐ Cabang Jember      (Role: [Admin ▼])      │
│ ☐ Cabang Kudus       (Role: [Admin ▼])      │
│ ☐ Cabang Surabaya    (Role: [Admin ▼])      │
│                                              │
│ [Cancel] [Create User]                       │
└──────────────────────────────────────────────┘
```

### 4.3 Edit User Modal

```
┌──────────────────────────────────────────────┐
│ Edit: Rudi Hartono                           │
├──────────────────────────────────────────────┤
│                                              │
│ Email: rudi@arlogic.com (read-only)          │
│                                              │
│ Primary Branch: [Cabang Jember ▼]           │
│                                              │
│ Branch Assignments                           │
│ ☑ Cabang Jember     (Role: [Technician ▼]) │
│   [Set as Primary] [Remove]                 │
│                                              │
│ ☑ Cabang Kudus      (Role: [Technician ▼]) │
│   [Set as Primary] [Remove]                 │
│                                              │
│ Available to Add:                            │
│ ○ Cabang Surabaya   (Role: [Admin ▼])       │
│   [Add to Branches]                         │
│                                              │
│ [Cancel] [Save Changes]                      │
└──────────────────────────────────────────────┘
```

---

## 5. Service Order Form (Branch Auto-Set)

### 5.1 Current Flow

```
┌─────────────────────────────────────────────────┐
│ Create Service Order                            │
│                                                 │
│ Branch: Cabang Jember (read-only)  ← Auto-set  │
└─────────────────────────────────────────────────┘

[Rest of form unchanged - customer, device, issue, etc.]
```

**Key Change**:
- Branch field is READ-ONLY
- Automatically set from user's current branch
- Cannot be overridden by user
- Prevents accidental branch mismatch

---

### 5.2 Branch Display

```
Before Service Order Creation:

Header shows:
[Cabang Jember ▼] | Service Orders | ...

Form header shows:
Creating service order for: Cabang Jember

If user tries to change branch:
Prompt: "Switch to different branch first before creating order"
```

---

## 6. Report Branch Selection

### 6.1 Report Header

```
┌──────────────────────────────────────────────┐
│ Revenue Report                               │
│                                              │
│ Branch: [Cabang Jember ▼]                   │
│         (Owner: [All Branches ▼])            │
│                                              │
│ Date Range: [From] ← 2026-07-01             │
│             [To] ← 2026-07-31                │
│                                              │
│ [Generate] [Export PDF] [Print]              │
└──────────────────────────────────────────────┘
```

**Branch Selection Rules**:
- Manager/Admin: Shows only their branch
- Owner: Shows all branches + "All Branches" option
- Default: User's current branch

---

### 6.2 Report Footer

```
Revenue Report - Cabang Jember
Generated: July 28, 2026
Branch: Cabang Jember (JMB001)
Location: Jember, Jawa Timur

Total Revenue: Rp 45,000,000
[Table with breakdown]
```

---

## 7. Navigation Updates by Role

### 7.1 Admin Navigation

```
┌──────────────────────────────┐
│ [Cabang Jember ▼]            │
├──────────────────────────────┤
│ Dashboard                    │
│ Services                     │
│   - Queue                    │
│   - Create New Order         │
│   - History                  │
│ Transactions                 │
│   - New Transaction          │
│   - History                  │
│ Inventory                    │
│ Expenses                     │
│ Closing                      │
│ Reports                      │
│ Attendance                   │
│ Profile                      │
│ Logout                       │
└──────────────────────────────┘
```

### 7.2 Owner Navigation (Additional Items)

```
┌──────────────────────────────┐
│ [Cabang Jember ▼]            │
├──────────────────────────────┤
│ Dashboard                    │
│ ─── Company View ───         │
│ All Branches                 │
│ Branch Management            │
│   - Create Branch            │
│   - Edit Branches            │
│   - User Assignments         │
│ Reporting                    │
│   - Company Reports          │
│   - Analytics                │
│ ─── Branch View ───          │
│ [Same as Admin]              │
│ ─── System ───               │
│ Audit Logs                   │
│ Settings                     │
│ Profile                      │
│ Logout                       │
└──────────────────────────────┘
```

---

## 8. UI Components to Create

### 8.1 New Components

1. **BranchSelector.tsx**
   - Dropdown with branch options
   - Switch branch functionality
   - Show current branch name

2. **BranchManagementPage.tsx**
   - List of branches
   - Create/Edit/Delete branch modals
   - Branch status indicators

3. **UserAssignmentModal.tsx**
   - Assign user to branch
   - Multiple branch assignment
   - Role selection per branch

4. **BranchFilterReport.tsx**
   - Branch selector for reports
   - "All Branches" option for Owner
   - Date range picker

5. **BranchContextHeader.tsx**
   - Shows current branch name
   - Shows user's role in branch
   - Shows staff count (optional)

### 8.2 Modified Components

1. **ServiceOrderForm.tsx**
   - Add read-only branch field
   - Display selected branch prominently

2. **TransactionForm.tsx**
   - Add read-only branch field
   - Display selected branch

3. **Dashboard.tsx** (all variants)
   - Update to show branch context
   - Filter all data by branch
   - Role-specific widgets

4. **Navigation.tsx**
   - Add branch selector
   - Update menu items based on role

---

## 9. Wireframe: Branch Selector Interaction

```
State 1: Closed
┌────────────────────┐
│ [Cabang Jember  ▼] │
└────────────────────┘

State 2: Hover
┌────────────────────┐
│ [Cabang Jember  ▼] │ ← Slight highlight
└────────────────────┘

State 3: Open
┌────────────────────┐
│ [Cabang Jember  ▼] │
│ ┌──────────────────┐
│ │ ✓ Cabang Jember  │
│ │   Cabang Kudus   │
│ │   Cabang Surabaya│
│ └──────────────────┘
└────────────────────┘

State 4: After Selection (Kudus)
Loading...
[Cabang Kudus... ▼]

State 5: Loaded
┌────────────────────┐
│ [Cabang Kudus   ▼] │
└────────────────────┘
(Dashboard reloaded with Kudus data)
```

