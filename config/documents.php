<?php

// config/documents.php
//
// What generated PDFs print in their letterhead and over their pages until a
// system admin changes it on the Document Branding screen. Saved values live
// in the document_settings table and override these key by key.

return [

    'defaults' => [
        // Letterhead
        'header_lines' => "Republic of the Philippines\nProvince of Davao del Norte\nCity of Panabo",
        'office_name' => 'Office of the City General Services',
        'motto' => "Service to Panaboans\nService to God",
        'logo_size' => 60,          // px, height of each header logo

        // Design
        'accent_color' => '#000000',  // header rule, office name and title
        'header_rule' => true,        // line under the letterhead

        // Footer, printed at the bottom of every page
        'footer_text' => "3/F New City Hall Bldg., Nat'l Highway, JP Laurel, Panabo City 8105\n☎ (084) 628-4241 loc. 113  ·  ✉ gso2017@yahoo.com",
        'footer_page_numbers' => true,

        // Foreground (printed over every page)
        'watermark' => 'none',        // none | image | text
        'watermark_text' => 'CITY OF PANABO',
        'watermark_opacity' => 8,     // percent
        'watermark_size' => 360,      // px, width of the image or length of the text
    ],

    // Uploaded images, stored on the local disk under branding/.
    'images' => ['left_logo', 'right_logo', 'watermark_image'],

    /*
    |---------------------------------------------------------------------------
    | Sources of fund
    |---------------------------------------------------------------------------
    | code => label. Chosen when an SSMI number is generated; the code prints in
    | the SSMI's office code ("CAGRO-MOOE") and its SOURCE OF FUND line.
    */
    'fund_sources' => [
        'MOOE' => 'Maintenance and Other Operating Expenses',
        'CO' => 'Capital Outlay',
        '20%DF' => '20% Development Fund',
        'LDRRMF' => 'Local DRRM Fund',
        'SEF' => 'Special Education Fund',
        'TF' => 'Trust Fund',
    ],

    /*
    |---------------------------------------------------------------------------
    | Signatories
    |---------------------------------------------------------------------------
    | document => [label, slots => [slot => [label, default name, default position]]]
    |
    | The names and positions printed in each document's signature blocks, set on
    | the Signatories screen. An empty name prints a blank line to sign on.
    | Signatures that belong to the record itself — who requested a PR, who
    | canvassed it — come from the record and are not listed here. The Leave
    | form and Locator Slip keep their own signatories in their templates.
    */
    'signatories' => [
        'purchase_request' => ['Purchase Request', [
            'budget_officer' => ['Certified by (City Budget Office)', 'JOVEN M. SEPE, CPA, MBA', 'City Budget Officer I'],
            'cash_availability' => ['Cash Availability', '', ''],
            'approved_by' => ['Approved by', '', ''],
        ]],
        'canvass_form' => ['Canvass Form', [
            'signatory' => ['Very truly yours', 'ENGR. RANDEL B. PANAYANGAN', 'CGDH-CGSO'],
        ]],
        'iar' => ['Inspection and Acceptance Report', [
            'inspected_by' => ['Inspected by', '', 'Inspection Officer / Committee'],
            'accepted_by' => ['Received and accepted by', '', 'Supply and/or Property Custodian'],
        ]],
        'ssmi' => ['SSMI', [
            'prepared_by' => ['Prepared by', 'NUELO R. SUMATRA', 'Supply Officer II'],
            'certified_by' => ['Certified by', 'ANNIE FE A. BATILONG', 'Supply Officer III'],
            'posted_by' => ['Posted in the SLC by/date', '', 'Accounting Clerk'],
        ]],
    ],

];
