import {
    Archive, ArrowDownToLine, Building2, CircleAlert, ArrowUpFromLine, BookOpen, Boxes, CalendarDays, ChartColumn, ClipboardCheck,
    ClipboardList, FileChartColumn, FilePenLine, FileSpreadsheet, FileText, FolderArchive, History, LayoutDashboard,
    LifeBuoy, Package, PackageCheck, PenLine, Printer, Receipt, Settings, ShieldCheck, ShoppingCart, Stamp, Tag, Tags, Terminal, Users,
} from 'lucide-react';

// Change this URL to your support form.
export const SUPPORT_FORM_URL = 'https://forms.gle/Ky2CMsRKpPHVvrGy8';

/**
 * The sidebar, defined once. Every item names the permission that the route
 * behind it checks, so the menu never offers a page that would answer 403.
 *
 *   { label, icon, route, active, permission }      a link (permission may be a list: any one will do)
 *   { label, icon, children: [...] }                a collapsible module group
 *   { ..., soon: true }                             listed but not yet available
 *
 * Groups show only when at least one child is visible.
 */
export const navigation = [
    {
        heading: 'Overview',
        items: [
            { label: 'Dashboard', icon: LayoutDashboard, route: 'dashboard', active: 'dashboard' },
            { label: 'Analytics', icon: ChartColumn, route: 'request-monitoring.index', active: 'request-monitoring.*', permission: 'monitoring.view' },
        ],
    },
    {
        heading: 'Modules',
        items: [
            {
                label: 'Procurement',
                icon: ShoppingCart,
                children: [
                    { label: 'Purchase Requests', icon: FileText, route: 'purchase-requests.index', active: 'purchase-requests.*', permission: 'pr.view' },
                    { label: 'Drafts and Encoded', icon: FilePenLine, route: 'encode.index', active: 'encode.*', permission: 'pr.encode' },
                    { label: 'Canvas Forms', icon: ClipboardList, route: 'canvas.index', active: 'canvas.*', permission: 'pr.canvass' },
                    { label: 'Purchase Orders', icon: Receipt, route: 'purchase-orders.index', active: 'purchase-orders.*', permission: 'pr.po' },
                ],
            },
            {
                label: 'Inventory',
                icon: Package,
                children: [
                    { label: 'Incoming Requests', icon: ArrowDownToLine, route: 'inventory.index', active: 'inventory.index', permission: 'inventory.incoming' },
                    { label: 'Inspection & Acceptance', icon: ClipboardCheck, route: 'inspection-acceptance-reports.index', active: 'inspection-acceptance-reports.*', permission: 'inventory.iar' },
                    { label: 'Requisition & Issue Slip', icon: FileSpreadsheet, route: 'ris.index', active: 'ris.*', permission: 'inventory.ris' },
                    { label: 'SSMI', icon: PackageCheck, route: 'ssmi.index', active: 'ssmi.*', permission: 'inventory.ssmi' },
                    { label: 'Outgoing Requests', icon: ArrowUpFromLine, route: 'inventory.outgoings', active: 'inventory.outgoings', permission: 'inventory.outgoing' },
                    // Anyone working an inventory stage can tag orders, so any of these opens it.
                    { label: 'Missing Tracker', icon: CircleAlert, route: 'missing-tracker.index', active: 'missing-tracker.*', permission: ['inventory.incoming', 'inventory.iar', 'inventory.ris', 'inventory.ssmi', 'inventory.outgoing'] },
                ],
            },
            {
                label: 'Records',
                icon: Archive,
                children: [
                    { label: 'Records Registry', icon: FolderArchive, route: 'records.index', active: 'records.*', permission: 'records.view' },
                    { label: 'Docket Management', icon: ClipboardList, permission: 'records.view', soon: true },
                ],
            },
        ],
    },
    {
        heading: 'System',
        items: [
            {
                label: 'Reports',
                icon: FileChartColumn,
                children: [
                    { label: 'Report Builder', icon: FileChartColumn, route: 'custom-reports.index', active: 'custom-reports.*', permission: 'reports.custom' },
                    { label: 'SQL Console', icon: Terminal, route: 'sql-console.index', active: 'sql-console.*', permission: 'reports.sql' },
                ],
            },
            {
                label: 'Administration',
                icon: Settings,
                children: [
                    { label: 'User List', icon: Users, route: 'users.index', active: 'users.*', permission: 'users.manage' },
                    { label: 'Roles & Permissions', icon: ShieldCheck, route: 'permissions.index', active: 'permissions.*', permission: 'permissions.manage' },
                    { label: 'Requesting Offices', icon: Building2, route: 'offices.index', active: 'offices.*', permission: 'offices.manage' },
                    { label: 'Items Catalogue', icon: Boxes, route: 'items.index', active: 'items.*', permission: 'items.manage' },
                    { label: 'Document Branding', icon: Stamp, route: 'document-settings.index', active: 'document-settings.index', permission: 'documents.manage' },
                    { label: 'PDF Signatories', icon: PenLine, route: 'document-settings.signatories', active: 'document-settings.signatories', permission: 'documents.manage' },
                    { label: 'Record Classes', icon: Tags, route: 'record-classes.index', active: 'record-classes.*', permission: 'record_classes.manage' },
                    { label: 'Tracker Tags', icon: Tag, route: 'tracker-tags.index', active: 'tracker-tags.*', permission: 'tracker_tags.manage' },
                    { label: 'Audit Trail', icon: History, route: 'audit-logs.index', active: 'audit-logs.*', permission: 'audit.view' },
                ],
            },
            { label: 'Docs', icon: BookOpen, route: 'docs.index', active: 'docs.*', permission: 'docs.view' },
        ],
    },
];

/** Links everyone gets at the bottom of the sidebar. External ones open a new tab. */
export const shortcuts = [
    { label: 'File a Leave', icon: CalendarDays, route: 'leave' },
    { label: 'Print Locator Slip', icon: Printer, route: 'pls', external: true },
    { label: 'Support Ticket', icon: LifeBuoy, href: SUPPORT_FORM_URL, external: true },
];

/** Drops items the user can't open and groups left with nothing in them. */
export function visibleNavigation(permissions) {
    const allowed = (item) => !item.permission
        || [].concat(item.permission).some((name) => permissions.includes(name));

    return navigation
        .map((section) => ({
            ...section,
            items: section.items
                .map((item) => (item.children ? { ...item, children: item.children.filter(allowed) } : item))
                .filter((item) => (item.children ? item.children.length > 0 : allowed(item))),
        }))
        .filter((section) => section.items.length > 0);
}

export const isActive = (item) => Boolean(item.active && route().current(item.active));

export const hrefOf = (item) => item.href ?? (item.route ? route(item.route) : '#');
