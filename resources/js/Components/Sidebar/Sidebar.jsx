import { useEffect, useId, useRef, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronsUpDown, ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen, UserRound, X } from 'lucide-react';
import { hrefOf, isActive, shortcuts, visibleNavigation } from './navigation';

const cx = (...classes) => classes.filter(Boolean).join(' ');

function initials(user) {
    const parts = [user?.emp_fname, user?.emp_lname].filter(Boolean);
    return parts.length ? parts.map((p) => p.trim()[0]).join('').slice(0, 2).toUpperCase() : '??';
}

/** Closes a popover on outside click or Escape. */
function useDismiss(open, onClose, refs) {
    useEffect(() => {
        if (!open) return;
        const onPointer = (e) => {
            if (!refs.some((ref) => ref.current?.contains(e.target))) onClose();
        };
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
}

function ItemLink({ item, collapsed, nested = false, onNavigate }) {
    const Icon = item.icon;
    const active = isActive(item);
    const base = cx(
        'group relative flex items-center gap-3 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        collapsed ? 'justify-center px-0 py-2.5' : nested ? 'py-2 pl-9 pr-3' : 'px-3 py-2',
    );

    if (item.soon) {
        return (
            <span className={cx(base, 'cursor-not-allowed text-gray-400 dark:text-gray-500')} title={collapsed ? `${item.label} (coming soon)` : undefined}>
                {!nested && <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />}
                {!collapsed && (
                    <>
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto rounded bg-gray-100 px-1.5 dark:bg-gray-700 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Soon
                        </span>
                    </>
                )}
            </span>
        );
    }

    return (
        <Link
            href={hrefOf(item)}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cx(
                base,
                active
                    ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white',
            )}
        >
            {active && !collapsed && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true" />}
            {!nested && (
                <Icon className={cx('h-[18px] w-[18px] shrink-0', active ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-200')} aria-hidden="true" />
            )}
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
        </Link>
    );
}

function Group({ item, collapsed, onNavigate }) {
    const Icon = item.icon;
    const containsActive = item.children.some(isActive);
    const [open, setOpen] = useState(containsActive);
    const [flyout, setFlyout] = useState(null);
    const buttonRef = useRef(null);
    const flyoutRef = useRef(null);
    const panelId = useId();

    // Open the group that holds the page the user just navigated to.
    useEffect(() => {
        if (containsActive) setOpen(true);
    }, [containsActive]);

    useDismiss(flyout !== null, () => setFlyout(null), [buttonRef, flyoutRef]);

    const toggle = () => {
        if (!collapsed) return setOpen((o) => !o);
        if (flyout) return setFlyout(null);
        const rect = buttonRef.current.getBoundingClientRect();
        setFlyout({ top: Math.min(rect.top, window.innerHeight - 60 - item.children.length * 40), left: rect.right + 8 });
    };

    return (
        <div>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                aria-expanded={collapsed ? flyout !== null : open}
                aria-controls={panelId}
                title={collapsed ? item.label : undefined}
                className={cx(
                    'group flex w-full items-center gap-3 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    collapsed ? 'justify-center py-2.5' : 'px-3 py-2',
                    containsActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white',
                    collapsed && containsActive && 'bg-indigo-50 dark:bg-indigo-500/10',
                )}
            >
                <Icon className={cx('h-[18px] w-[18px] shrink-0', containsActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-200')} aria-hidden="true" />
                {collapsed ? (
                    <span className="sr-only">{item.label}</span>
                ) : (
                    <>
                        <span className="truncate font-medium">{item.label}</span>
                        <ChevronDown className={cx('ml-auto h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
                    </>
                )}
            </button>

            {!collapsed && open && (
                <div id={panelId} className="relative mt-0.5 space-y-0.5">
                    <span className="absolute inset-y-1 left-[21px] w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                    {item.children.map((child) => (
                        <ItemLink key={child.label} item={child} nested onNavigate={onNavigate} />
                    ))}
                </div>
            )}

            {collapsed && flyout && (
                <div
                    id={panelId}
                    ref={flyoutRef}
                    style={{ top: flyout.top, left: flyout.left }}
                    className="fixed z-[60] w-60 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-1.5 shadow-xl"
                >
                    <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{item.label}</p>
                    {item.children.map((child) => (
                        <ItemLink key={child.label} item={child} onNavigate={() => { setFlyout(null); onNavigate?.(); }} />
                    ))}
                </div>
            )}
        </div>
    );
}

function UserMenu({ collapsed }) {
    const { auth } = usePage().props;
    const user = auth.user;
    const [menu, setMenu] = useState(null);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    useDismiss(menu !== null, () => setMenu(null), [buttonRef, menuRef]);

    const toggle = () => {
        if (menu) return setMenu(null);
        const rect = buttonRef.current.getBoundingClientRect();
        setMenu(collapsed ? { bottom: window.innerHeight - rect.bottom, left: rect.right + 8 } : { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width });
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                aria-expanded={menu !== null}
                aria-haspopup="menu"
                title={collapsed ? `${user.emp_fname} ${user.emp_lname}` : undefined}
                className={cx(
                    'flex w-full items-center gap-3 rounded-lg text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    collapsed ? 'justify-center p-1.5' : 'p-2',
                )}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    {initials(user)}
                </span>
                {!collapsed && (
                    <>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                                {user.emp_fname} {user.emp_lname}
                            </span>
                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{user.role?.role_name}</span>
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                    </>
                )}
            </button>

            {menu && (
                <div
                    ref={menuRef}
                    role="menu"
                    style={{ bottom: menu.bottom, left: menu.left, width: menu.width ?? 240 }}
                    className="fixed z-[60] rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-1.5 shadow-xl"
                >
                    <div className="border-b border-gray-200 dark:border-gray-700 px-3 pb-2 pt-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{user.emp_lname}, {user.emp_fname}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {user.role?.role_name} · {user.role?.section}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Employee ID {user.emp_id}</p>
                    </div>
                    <Link
                        href={route('profile.edit')}
                        role="menuitem"
                        className="mt-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                    >
                        <UserRound className="h-4 w-4" aria-hidden="true" /> Profile
                    </Link>
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
                    </Link>
                </div>
            )}
        </>
    );
}

/**
 * Application sidebar. `collapsed` shows an icon rail with fly-out module menus;
 * `mobile` renders it as a drawer with a close button instead of the collapse toggle.
 */
export default function Sidebar({ collapsed = false, onToggleCollapsed, mobile = false, onClose }) {
    const { auth } = usePage().props;
    const sections = visibleNavigation(auth.permissions ?? []);

    return (
        <div className={cx('flex h-full flex-col border-r border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300', collapsed ? 'w-[4.5rem]' : 'w-64')}>
            {/* Brand */}
            <div className={cx('flex h-16 shrink-0 items-center border-b border-gray-200 dark:border-gray-700', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
                <Link href={route('dashboard')} className="flex min-w-0 items-center gap-3" title="Dashboard">
                    <img src="/icon.png" alt="" className="h-9 w-9 shrink-0 rounded-md bg-gray-50 dark:bg-white/5 object-contain p-0.5" />
                    {!collapsed && (
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold tracking-wide text-gray-900 dark:text-white">GSONEO</span>
                            <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">General Services Office</span>
                        </span>
                    )}
                </Link>
                {mobile ? (
                    <button type="button" onClick={onClose} className="ml-auto rounded-md p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white" aria-label="Close menu">
                        <X className="h-5 w-5" />
                    </button>
                ) : (
                    !collapsed && (
                        <button type="button" onClick={onToggleCollapsed} className="ml-auto rounded-md p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white" aria-label="Collapse sidebar" title="Collapse sidebar">
                            <PanelLeftClose className="h-[18px] w-[18px]" />
                        </button>
                    )
                )}
            </div>

            {/* Navigation */}
            <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:thin]">
                {collapsed && !mobile && (
                    <button type="button" onClick={onToggleCollapsed} className="flex w-full justify-center rounded-md py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white" aria-label="Expand sidebar" title="Expand sidebar">
                        <PanelLeftOpen className="h-[18px] w-[18px]" />
                    </button>
                )}

                {sections.map((section) => (
                    <div key={section.heading}>
                        {collapsed ? (
                            <div className="mx-2 mb-2 border-t border-gray-200 dark:border-gray-700" aria-hidden="true" />
                        ) : (
                            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{section.heading}</p>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map((item) =>
                                item.children ? (
                                    <Group key={item.label} item={item} collapsed={collapsed} onNavigate={onClose} />
                                ) : (
                                    <ItemLink key={item.label} item={item} collapsed={collapsed} onNavigate={onClose} />
                                ),
                            )}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Shortcuts and account */}
            <div className="shrink-0 space-y-1 border-t border-gray-200 dark:border-gray-700 px-3 py-3">
                {!collapsed && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Shortcuts</p>}
                {shortcuts.map((item) => {
                    const Icon = item.icon;
                    return (
                        <a
                            key={item.label}
                            href={hrefOf(item)}
                            target={item.external ? '_blank' : undefined}
                            rel={item.external ? 'noopener noreferrer' : undefined}
                            title={collapsed ? item.label : undefined}
                            className={cx(
                                'group flex items-center gap-3 rounded-md text-sm text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-white',
                                collapsed ? 'justify-center py-2' : 'px-3 py-1.5',
                            )}
                        >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {collapsed ? (
                                <span className="sr-only">{item.label}</span>
                            ) : (
                                <>
                                    <span className="truncate">{item.label}</span>
                                    {item.external && <ExternalLink className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100" aria-hidden="true" />}
                                </>
                            )}
                        </a>
                    );
                })}
                <div className="pt-2">
                    <UserMenu collapsed={collapsed} />
                </div>
            </div>
        </div>
    );
}
