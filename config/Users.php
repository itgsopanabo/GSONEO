<?php

return [

    /*
     * The role that may manage users. Role id 1 is Superadmin (Sys Admin),
     * which matches the condition gating the Utils menu in the sidebar.
     */
    'sys_admin_role_id' => (int) env('SYS_ADMIN_ROLE_ID', 1),

    /*
     * The status_code that means "may sign in". Everything else in the list
     * below is treated as inactive.
     */
    'active_status_code' => (int) env('ACTIVE_STATUS_CODE', 900),

    /*
     * The only statuses user management may assign. The status table is shared
     * with other parts of the system, so this keeps unrelated codes out of the
     * dropdowns. Keyed on status_code, not id — the ids behind these are
     * 17, 18 and 19 and carry no meaning of their own.
     */
    'selectable_status_codes' => [900, 901, 902],

];
