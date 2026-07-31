import {useState} from 'react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import Dropdown from '@/Components/Dropdown';
import {Link, usePage} from '@inertiajs/react';
import {ToastProvider} from "@/Contexts/ToastContext.jsx";

export default function AuthenticatedLayout({header, children}) {
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const {auth} = usePage().props;

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return parts[0][0].toUpperCase();
    };

    const userInitials = getInitials(auth.user.emp_fname);

    // Change this URL to your Google Form or customized external feedback loop
    const reportFormUrl = "https://forms.gle/Ky2CMsRKpPHVvrGy8";

    return (

        <ToastProvider>
            <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col md:flex-row">

                {/* Vertical Sidebar Pane (Desktop View)*/}
                <nav
                    className="md:sticky md:top-0 md:h-screen md:w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 z-50">

                    <div className="h-full flex flex-col justify-between p-4 md:p-5 overflow-y-auto">

                        {/* Top Section: Branding, Profile Card, Main Navigation Items */}
                        <div className="flex-1 flex flex-col">
                            {/* Logo / Header Branding Section */}
                            <div
                                className="flex items-center justify-between md:justify-start md:space-x-3 pb-5 border-b border-gray-100 dark:border-gray-700">
                                <Link href="/">
                                    <ApplicationLogo
                                        className="block h-8 w-auto fill-current text-gray-800 dark:text-gray-200"/>
                                </Link>
                                <span
                                    className="font-bold text-gray-800 dark:text-gray-200 hidden md:inline text-base tracking-tight">
                                    GSONeo
                                </span>

                                {/* Mobile Hamburger Toggle Button */}
                                <div className="flex items-center md:hidden">
                                    <button
                                        onClick={() => setShowingNavigationDropdown((prev) => !prev)}
                                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-400 transition"
                                    >
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'}
                                                  strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                  d="M4 6h16M4 12h16M4 18h16"/>
                                            <path className={showingNavigationDropdown ? 'inline-flex' : 'hidden'}
                                                  strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                  d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Interactive User Profile Dropdown Card */}
                            <div className="mt-5">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button type="button"
                                                className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100/70 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-between group transition duration-150 focus:outline-none">
                                            <div className="flex items-center space-x-3 min-w-0">
                                                <div
                                                    className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-sm select-none">
                                                    <span
                                                        className="text-white text-sm font-semibold tracking-wider font-mono">
                                                        {userInitials}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                                        {auth.user.emp_lname}, {auth.user.emp_fname}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate font-medium mt-0.5">
                                                        {auth.user.role?.role_name} ({auth.user.role?.section})
                                                    </p>
                                                </div>
                                            </div>
                                            <svg
                                                className="h-4 w-4 text-gray-400 group-hover:text-gray-500 transition-colors"
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                      d="M19 9l-7 7-7-7"/>
                                            </svg>
                                        </button>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content align="right" width="48"
                                                      contentClasses="py-1 bg-white dark:bg-gray-700">
                                        <div className="block px-4 py-2 text-xs text-gray-400">Manage Account</div>
                                        <Dropdown.Link href={route('profile.edit')}>Edit Profile</Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>

                            {/* Core Grouped Links Wrapper */}
                            <div className="hidden md:flex flex-col space-y-5 mt-6">

                                {/* General Items Section */}
                                <div className="flex flex-col space-y-1">

                                    <div className="flex flex-col space-y-1">
                                        <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            General
                                        </p>

                                        <NavLink href={route('dashboard')} active={route().current('dashboard')}
                                                 className="w-full justify-start py-2">
                                            Dashboard
                                        </NavLink>
                                    </div>
                                </div>

                                {/* ADMIN / MONITORING VIEW */}
                                {auth.user.role.section === 'Administration' && (
                                    <div className="flex flex-col space-y-1">
                                        <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            Monitoring Modules
                                        </p>

                                        {/* Procurement Monitoring */}
                                        <NavLink href={route('purchase-requests.index')}
                                                 active={route().current('purchase-requests.*')}
                                                 className="w-full justify-start py-2 text-xs">
                                            Purchase Request
                                        </NavLink>


                                        {/* Stocks Monitoring */}
                                        <NavLink href={route('inventory.index')}
                                                 active={route().current('inventory.index')}
                                                 className="w-full justify-start py-2 text-xs">
                                            Inventory
                                        </NavLink>
                                        <NavLink href={route('inspection-acceptance-reports.index')}
                                                 active={route().current('inspection-acceptance-reports.index')}
                                                 className="w-full justify-start py-2 text-xs">
                                            Inspection & Acceptance Report
                                        </NavLink>

                                        {/* Motor pool Monitoring */}
                                        <NavLink href="#" active={false} className="w-full justify-start py-2 text-xs">
                                            Motorpool
                                        </NavLink>

                                        {/* Records Monitoring */}
                                        <NavLink href="#" active={false} className="w-full justify-start py-2 text-xs">
                                            Archives
                                        </NavLink>
                                    </div>)}

                                {/* Procurement Group (Hidden for Admin) */}
                                {auth.user.role.section === 'Procurement' && (
                                    <div className="flex flex-col space-y-1">
                                        <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            Procurement
                                        </p>
                                        <NavLink
                                            href={route('purchase-requests.index')}
                                            active={route().current('purchase-requests.*')}
                                            className="w-full justify-start py-2 text-xs"
                                        >
                                            Purchase Request Management
                                        </NavLink>

                                        <NavLink
                                            href={route('purchase-orders.index')}
                                            active={route().current('purchase-orders.*')}
                                            className="w-full justify-start py-2 text-xs"
                                        >
                                            Purchase Order Management
                                        </NavLink>
                                    </div>
                                )}

                                {/* Stocks and Inventory Group (Hidden for Admin) */}

                                {/*
                                TODO 1. Match the navigation to the Designation Role
                                */}

                                {auth.user.role.section === 'Inventory and Sales' && (<>
                                    {/* Incoming */}
                                    <div className="flex flex-col space-y-1">

                                        <NavLink href={route('inventory.index')}
                                                 active={route().current('inventory.index')}
                                                 className="w-full justify-start py-2 text-xs">
                                            Incoming
                                        </NavLink>

                                        <NavLink href={route('ris.index')}
                                                 active={route().current('ris.index')}
                                                 className="w-full justify-start py-2 text-xs">
                                            Requisition and Issue Slip
                                        </NavLink>

                                        {/*TODO Route needs to match and add Controller and Model*/}
                                        {/*<NavLink href={route('')}*/}
                                        {/*         active={route().current('')}*/}
                                        {/*         className="w-full justify-start py-2 text-xs">*/}
                                        {/*    Outgoing*/}
                                        {/*</NavLink>*/}

                                    </div>

                                    {/* Generating Reports */}
                                    <div className="flex flex-col space-y-1">
                                        <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            Generating Reports
                                        </p>
                                        {/* Points to a list page where a PO is picked, then a report is generated for that PO.
                                                Update the route name/controller to whatever indexes your report-eligible POs. */}
                                        <NavLink href={route('inspection-acceptance-reports.index')}
                                                 active={route().current('inspection-acceptance-reports.index')}
                                                 className="w-full justify-start py-2 text-xs">
                                            IA Report
                                        </NavLink>

                                        {/*TODO Route needs to match*/}
                                        <NavLink
                                            href={route('ssmi.index')}
                                            active={route().current('ssmi.index')}
                                            className="w-full justify-start py-2 text-xs">
                                            SSMI (Summary of Supplies and Materials Issued)
                                        </NavLink>
                                    </div>
                                </>)}

                                {/* Records Group (Hidden for Admin) */}
                                {auth.user.role.section === 'Records (Archives)' && (
                                    <div className="flex flex-col space-y-1">
                                        <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            Records Management
                                        </p>
                                        <NavLink href="#" active={false} className="w-full justify-start py-2 text-xs">
                                            Docket Management
                                        </NavLink>
                                    </div>)}

                                {/* Motor pool Group (Hidden for Admin) */}
                                {auth.user.role.section === 'Motor Pool' && (<div className="flex flex-col space-y-1">
                                    <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        Motor pool
                                    </p>
                                    <NavLink href="#" active={false} className="w-full justify-start py-2 text-xs">
                                        Vehicle Management
                                    </NavLink>
                                </div>)}

                            </div>
                        </div>

                        {/* Bottom Utility Trays (Report Form + System Management Controls) */}
                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">

                            {/* Desktop Bottom Report Navigation Link */}
                            <a
                                href={reportFormUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden md:flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition duration-150 group"
                            >
                                <span className="flex items-center space-x-2">
                                    <svg className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" fill="none"
                                         viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                    </svg>
                                    <span>Submit a Support Ticket</span>
                                </span>
                                <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                                     fill="none"
                                     viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                </svg>
                            </a>

                            {/* Desktop Bottom System Minimal Logout Hook */}
                            <Link
                                href={route('logout')}
                                method="post"
                                as="button"
                                className="hidden md:flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-red-600 dark:hover:text-red-400 transition"
                            >
                                <span>Log Out</span>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                                </svg>
                            </Link>
                        </div>
                    </div>

                    {/* Mobile Responsive Dropdown Layout */}
                    {/*<div*/}
                    {/*    className={(showingNavigationDropdown ? 'block' : 'hidden') + ' md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3'}>*/}
                    {/*    <div className="space-y-1">*/}
                    {/*        <ResponsiveNavLink href={route('dashboard')}*/}
                    {/*                           active={route().current('dashboard')}>Dashboard</ResponsiveNavLink>*/}

                    {/*        /!* ADMIN / MONITORING VIEW *!/*/}
                    {/*        {auth.user.role.section === 'Administration' && (<>*/}
                    {/*            <div className="pt-2 pb-1"><span*/}
                    {/*                className="px-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Monitoring Modules</span>*/}
                    {/*            </div>*/}
                    {/*            <ResponsiveNavLink href={route('purchase-requests.index')}*/}
                    {/*                               active={route().current('purchase-requests.*')}>Purchase*/}
                    {/*                Request</ResponsiveNavLink>*/}
                    {/*            <ResponsiveNavLink href={route('inventory.index')}*/}
                    {/*                               active={route().current('inventory.index')}>Inventory</ResponsiveNavLink>*/}
                    {/*            <ResponsiveNavLink href={route('inventory.iar.index')}*/}
                    {/*                               active={route().current('inventory.iar.index')}>Inspection &*/}
                    {/*                Acceptance Report</ResponsiveNavLink>*/}
                    {/*        </>)}*/}

                    {/*        /!* Procurement Group *!/*/}
                    {/*        {auth.user.role.section === 'Procurement' && (<>*/}
                    {/*            <div className="pt-2 pb-1"><span*/}
                    {/*                className="px-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Procurement</span>*/}
                    {/*            </div>*/}
                    {/*            <ResponsiveNavLink href={route('purchase-requests.index')}*/}
                    {/*                               active={route().current('purchase-requests.*')}>Purchase Request*/}
                    {/*                Management</ResponsiveNavLink>*/}
                    {/*        </>)}*/}

                    {/*        /!* Stocks and Inventory Group *!/*/}
                    {/*        {auth.user.role.section === 'Inventory and Sales' && (<>*/}
                    {/*            <div className="pt-2 pb-1"><span*/}
                    {/*                className="px-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Incoming</span>*/}
                    {/*            </div>*/}
                    {/*            <ResponsiveNavLink href={route('inventory.index')}*/}
                    {/*                               active={route().current('inventory.index')}>Purchase*/}
                    {/*                Orders</ResponsiveNavLink>*/}
                    {/*            <ResponsiveNavLink href={route('inventory.iar.index')}*/}
                    {/*                               active={route().current('inventory.iar.index')}>Inspection &*/}
                    {/*                Acceptance Report</ResponsiveNavLink>*/}
                    {/*            /!*<ResponsiveNavLink href={route('inventory.ssmi.index')}*!/*/}
                    {/*            /!*                   active={route().current('inventory.ssmi.index')}>Supplies &*!/*/}
                    {/*            /!*    Material Inspection</ResponsiveNavLink>*!/*/}
                    {/*        </>)}*/}

                    {/*        /!* Records Group *!/*/}
                    {/*        {auth.user.role.section === 'Records (Archives)' && (<>*/}
                    {/*            <div className="pt-2 pb-1"><span*/}
                    {/*                className="px-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Records Management</span>*/}
                    {/*            </div>*/}
                    {/*            <ResponsiveNavLink href="#">Docket Management</ResponsiveNavLink>*/}
                    {/*        </>)}*/}

                    {/*        /!* Motor pool Group *!/*/}
                    {/*        {auth.user.role.section === 'Motor Pool' && (<>*/}
                    {/*            <div className="pt-2 pb-1"><span*/}
                    {/*                className="px-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Motor pool</span>*/}
                    {/*            </div>*/}
                    {/*            <ResponsiveNavLink href="#">Vehicle Management</ResponsiveNavLink>*/}
                    {/*        </>)}*/}
                    {/*    </div>*/}
                    {/*    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 pb-1 mt-3 space-y-1">*/}
                    {/*        <ResponsiveNavLink href={route('profile.edit')} active={route().current('profile.edit')}>Edit*/}
                    {/*            Profile</ResponsiveNavLink>*/}
                    {/*        /!* Mobile Report Trigger *!/*/}
                    {/*        <a*/}
                    {/*            href={reportFormUrl}*/}
                    {/*            target="_blank"*/}
                    {/*            rel="noopener noreferrer"*/}
                    {/*            className="block w-full pl-3 pr-4 py-2 border-l-4 border-transparent text-left text-base font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30 hover:border-gray-300 dark:hover:border-gray-600 transition"*/}
                    {/*        >*/}
                    {/*            Submit a Support ticket ↗*/}
                    {/*        </a>*/}
                    {/*        <ResponsiveNavLink href={route('logout')} method="post" as="button">Log*/}
                    {/*            Out</ResponsiveNavLink>*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                </nav>

                {/* Main Body Area */}
                <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden">
                    {header && (<header className="bg-white shadow dark:bg-gray-800">
                        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                            {header}
                        </div>
                    </header>)}
                    <main className="flex-1">{children}</main>
                </div>

            </div>
        </ToastProvider>);
}
