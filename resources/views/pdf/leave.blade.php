@php
    $ticks = (array) ($ticks ?? []);
    $tick  = fn ($key) => in_array($key, $ticks, true) ? '&check;' : '';
@endphp
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Application for Leave &mdash; CS Form No. 6</title>
    <style>
        @page { size: A4 portrait; margin: 0; }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            background: #9a9a9a;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 7.2pt;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .page {
            width: 210mm;
            min-height: 297mm;
            margin: 24px auto;
            background: #fff;
            padding: 5mm 7mm;
            display: flex;
            flex-direction: column;
        }

        /* section rows share the leftover page height */
        .stretch { flex: 1; }

        /* ---------- Shared ---------- */
        .b   { border: 0.75px solid #000; }
        .bt  { border-top: 0.75px solid #000; }
        .bb  { border-bottom: 0.75px solid #000; }
        .bl  { border-left: 0.75px solid #000; }
        .br  { border-right: 0.75px solid #000; }
        .pad { padding: 1.8mm 2.2mm; }

        .row   { display: flex; }
        .grow  { flex: 1; }
        .bold  { font-weight: bold; }
        .ital  { font-style: italic; }
        .center{ text-align: center; }
        .tiny  { font-size: 5.4pt; }

        /* value lines — sized for handwriting */
        .val {
            display: inline-block;
            border-bottom: 0.75px solid #000;
            min-width: 22mm;
            height: 5mm;
            padding: 0 1mm;
            font-weight: bold;
            vertical-align: bottom;
        }
        .val.wide { min-width: 40mm; }
        .val.flex { display: block; min-width: 0; width: 100%; }

        /* checkboxes */
        .cb {
            display: inline-block;
            width: 3mm;
            height: 3mm;
            border: 0.75px solid #000;
            background: #fff;
            margin-right: 1.2mm;
            text-align: center;
            line-height: 2.7mm;
            font-size: 5.5pt;
            vertical-align: -0.3mm;
        }

        .opt { display: flex; align-items: flex-start; margin-bottom: 1.5mm; line-height: 1.25; }
        .opt .cb { flex-shrink: 0; margin-top: 0.2mm; }

        /* ---------- Masthead ---------- */
        .formno { line-height: 1.3; margin-bottom: 1mm; }

        .masthead { position: relative; text-align: center; padding: 0 34mm; }
        .masthead .seal { position: absolute; left: 22mm; top: 0; width: 13mm; height: 13mm; object-fit: contain; }
        .masthead .stamp { position: absolute; right: 0; top: 1mm; width: 32mm; height: 8mm; border: 0.75px solid #000; }
        .masthead .l1 { font-size: 7.5pt; font-weight: bold; }
        .masthead .l2 { font-size: 8pt; font-weight: bold; }
        .masthead .l3 { font-size: 7pt; font-weight: bold; font-style: italic; }

        .doctitle { text-align: center; font-size: 14pt; font-weight: bold; margin: 2.5mm 0 2mm; }

        /* ---------- Section bars ---------- */
        .bar { font-weight: bold; text-align: center; font-size: 7.5pt; padding: 1mm; }

        .sechead { font-weight: bold; margin-bottom: 1.2mm; }

        /* label strip with a rule beneath, then a slot to write in */
        .hdr-line {
            border-bottom: 0.75px solid #000;
            padding-bottom: 1mm;
            margin: 0 -1.8mm 0;
            padding-left: 1.8mm;
            padding-right: 1.8mm;
        }

        .write-slot {
            border-bottom: 0.75px solid #000;
            height: 7mm;
            margin-top: 4mm;
        }

        .col { width: 50%; display: flex; flex-direction: column; }
        .col-wide { width: 54%; }
        .col-narrow { width: 46%; }
        .col .sig { margin-top: auto; }

        /* ---------- Leave credits table ---------- */
        table.credits { width: 100%; border-collapse: collapse; margin-top: 1.5mm; }
        table.credits th,
        table.credits td { border: 0.75px solid #000; height: 5.2mm; padding: 0 1mm; font-size: 6pt; }
        table.credits th { font-weight: normal; text-align: center; }
        table.credits td.lbl { font-style: italic; width: 34%; }

        /* ---------- Signature blocks ---------- */
        .sig { text-align: center; margin-top: 4mm; }
        .sig .name { font-weight: bold; font-size: 7.5pt; border-bottom: 0.75px solid #000; padding-bottom: 0.4mm; }
        .sig .role { font-size: 6pt; padding-top: 0.4mm; }

        .fillline { border-bottom: 0.75px solid #000; height: 5.4mm; margin-bottom: 2mm; }

        /* ---------- Screen-only controls ---------- */
        .toolbar {
            width: 210mm;
            margin: 20px auto 40px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .toolbar button {
            font: 14px Arial, sans-serif;
            padding: 9px 18px;
            border: 1px solid #000;
            background: #fff;
            cursor: pointer;
            border-radius: 3px;
        }

        .toolbar button:hover { background: #eee; }
        .toolbar button:focus-visible { outline: 2px solid #0b57d0; outline-offset: 2px; }


        /* ================= PAGE 2 — instructions ================= */
        .page2 {
            page-break-before: always;
            break-before: page;
            break-inside: avoid;
            page-break-after: avoid;
            height: 297mm;
            display: flex;
            flex-direction: column;
            font-size: 7.4pt;
            line-height: 1.33;
        }

        .instr-title {
            border: 1.5px solid #000;
            text-align: center;
            font-weight: bold;
            font-size: 10pt;
            padding: 2.2mm;
            margin-bottom: 3.5mm;
        }

        .instr-intro { text-align: justify; margin-bottom: 3.5mm; }

        .instr-cols {
            column-count: 2;
            column-gap: 7mm;
            column-fill: balance;
            text-align: justify;
            flex: 1;
        }

        .item { margin-bottom: 3.4mm; }

        .ihead {
            font-weight: bold;
            margin-bottom: 0.9mm;
            break-after: avoid;
            page-break-after: avoid;
        }

        .item p { margin: 0; padding-left: 4mm; }

        .item ul,
        .item ol.alpha { margin: 0; padding-left: 8mm; }

        .item li { margin-bottom: 1mm; break-inside: avoid; }

        ol.alpha { list-style-type: lower-alpha; margin-top: 0.8mm; }

        .footnote {
            border-top: 0.75px solid #000;
            margin-top: 4mm;
            padding-top: 2mm;
            font-size: 6.4pt;
            text-align: justify;
        }

        @media print {
            body { background: #fff; }
            .page { margin: 0; }
            .toolbar { display: none; }
        }
    </style>
</head>
<body>

<div class="page">

    <div class="formno">
        Civil Service Form No. 6<br>
        Revised 2020
    </div>

    <div class="masthead">
        <img class="seal" src="{{ asset('images/panabo-seal.png') }}" alt=""
             onerror="this.style.visibility='hidden'">
        <div class="stamp"></div>
        <div class="l1">Republic of the Philippines</div>
        <div class="l2">CITY GOVERNMENT OF PANABO</div>
        <div class="l3">Government Center, JP Laurel, Panabo City, Davao del Norte 8105</div>
    </div>

    <div class="doctitle">APPLICATION FOR LEAVE</div>

    <div class="row b">
        <div class="pad col br">
            <div class="hdr-line">1.&nbsp;&nbsp;OFFICE/DEPARTMENT</div>
            <div class="write-slot center bold">{{ $office ?? '' }}</div>
        </div>
        <div class="pad col">
            <div class="hdr-line row">
                <span style="white-space:nowrap">2.&nbsp;&nbsp;NAME&nbsp;:</span>
                <span class="grow center ital">(Last)</span>
                <span class="grow center ital">(First)</span>
                <span class="grow center ital">(Middle)</span>
            </div>
            <div class="row">
                <div class="grow write-slot center bold" style="margin-right:2mm">{{ $last ?? '' }}</div>
                <div class="grow write-slot center bold" style="margin-right:2mm">{{ $first ?? '' }}</div>
                <div class="grow write-slot center bold">{{ $middle ?? '' }}</div>
            </div>
        </div>
    </div>

    <div class="row bl br bb pad" style="align-items:flex-end">
        <div style="width:34%">3.&nbsp;&nbsp;DATE OF FILING <span class="val">{{ $date_filing ?? '' }}</span></div>
        <div style="width:40%">4.&nbsp;&nbsp;POSITION <span class="val wide">{{ $position ?? '' }}</span></div>
        <div style="width:26%">5.&nbsp;&nbsp;SALARY <span class="val">{{ $salary ?? '' }}</span></div>
    </div>

    <div class="bl br bb bar">6.&nbsp;&nbsp;DETAILS OF APPLICATION</div>

    <div class="row bl br bb">
        <div class="pad col col-wide br">
            <div class="sechead">6.A&nbsp;&nbsp;TYPE OF LEAVE TO BE AVAILED OF</div>

            <div class="opt"><span class="cb">{!! $tick('vacation') !!}</span>
                <span>Vacation Leave <span class="tiny">(Sec. 51, Rule XVI, Omnibus Rules Implementing E.O. No. 292)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('mandatory') !!}</span>
                <span>Mandatory/Forced Leave <span class="tiny">(Sec. 25, Rule XVI, Omnibus Rules Implementing E.O. No. 292)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('sick') !!}</span>
                <span>Sick Leave <span class="tiny">(Sec. 43, Rule XVI, Omnibus Rules Implementing E.O. No. 292)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('maternity') !!}</span>
                <span>Maternity Leave <span class="tiny">(R.A. No. 11210 / IRR issued by CSC, DOLE and SSS)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('paternity') !!}</span>
                <span>Paternity Leave <span class="tiny">(R.A. No. 8187 / CSC MC No. 71, s. 1996, as amended)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('special_privilege') !!}</span>
                <span>Special Privilege Leave <span class="tiny">(Sec. 21, Rule XVI, Omnibus Rules Implementing E.O. No. 292)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('solo_parent') !!}</span>
                <span>Solo Parent Leave <span class="tiny">(R.A. No. 8972 / CSC MC No. 8, s. 2004)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('study') !!}</span>
                <span>Study Leave <span class="tiny">(Sec. 68, Rule XVI, Omnibus Rules Implementing E.O. No. 292)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('vawc') !!}</span>
                <span>10-Day VAWC Leave <span class="tiny">(R.A. No. 9262 / CSC MC No. 15, s. 2005)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('rehabilitation') !!}</span>
                <span>Rehabilitation Privilege <span class="tiny">(Sec. 55, Rule XVI, Omnibus Rules Implementing E.O. No. 292)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('special_women') !!}</span>
                <span>Special Leave Benefits for Women <span class="tiny">(R.A. No. 9710 / CSC MC No. 25, s. 2010)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('calamity') !!}</span>
                <span>Special Emergency (Calamity) Leave <span class="tiny">(CSC MC No. 2, s. 2012, as amended)</span></span></div>

            <div class="opt"><span class="cb">{!! $tick('adoption') !!}</span>
                <span>Adoption Leave <span class="tiny">(R.A. No. 8552)</span></span></div>

            <div class="ital" style="margin-top:2mm">Others:</div>
            <div class="fillline" style="width:52mm"></div>
        </div>

        <div class="pad col col-narrow">
            <div class="sechead">6.B&nbsp;&nbsp;DETAILS OF LEAVE</div>

            <div class="ital" style="margin-bottom:1mm">In case of Vacation/Special Privilege Leave:</div>
            <div class="opt"><span class="cb">{!! $tick('within_ph') !!}</span>
                <span class="grow">Within the Philippines <span class="val flex">{{ $within_ph ?? '' }}</span></span></div>
            <div class="opt"><span class="cb">{!! $tick('abroad') !!}</span>
                <span class="grow">Abroad (Specify) <span class="val flex">{{ $abroad ?? '' }}</span></span></div>

            <div class="ital" style="margin:2mm 0 1mm">In case of Sick Leave:</div>
            <div class="opt"><span class="cb">{!! $tick('in_hospital') !!}</span>
                <span class="grow">In Hospital (Specify Illness) <span class="val flex">{{ $in_hospital ?? '' }}</span></span></div>
            <div class="opt"><span class="cb">{!! $tick('out_patient') !!}</span>
                <span class="grow">Out Patient (Specify Illness) <span class="val flex">{{ $out_patient ?? '' }}</span></span></div>

            <div class="ital" style="margin:2mm 0 1mm">In case of Special Leave Benefits for Women:</div>
            <div>(Specify Illness) <span class="val flex">{{ $women_illness ?? '' }}</span></div>

            <div class="ital" style="margin:2mm 0 1mm">In case of Study Leave:</div>
            <div class="opt"><span class="cb">{!! $tick('masters') !!}</span><span>Completion of Master's Degree</span></div>
            <div class="opt"><span class="cb">{!! $tick('bar_board') !!}</span><span>BAR/Board Examination Review</span></div>

            <div class="ital" style="margin:2mm 0 1mm">Other purpose:</div>
            <div class="opt"><span class="cb">{!! $tick('monetization') !!}</span><span>Monetization of Leave Credits</span></div>
            <div class="opt"><span class="cb">{!! $tick('terminal') !!}</span><span>Terminal Leave</span></div>
        </div>
    </div>

    <div class="row bl br bb stretch">
        <div class="pad col br">
            <div class="sechead">6.C&nbsp;&nbsp;NUMBER OF WORKING DAYS APPLIED FOR</div>
            <div class="center bold" style="margin:1.5mm 0">{{ $working_days ?? '' }}</div>
            <div class="fillline"></div>
            <div class="ital">INCLUSIVE DATES</div>
            <div class="center bold" style="margin:1.5mm 0">{{ $inclusive_dates ?? '' }}</div>
            <div class="fillline"></div>
        </div>

        <div class="pad col">
            <div class="sechead">6.D&nbsp;&nbsp;COMMUTATION</div>
            <div class="opt" style="margin-top:1.5mm"><span class="cb">{!! $tick('not_requested') !!}</span><span>Not Requested</span></div>
            <div class="opt"><span class="cb">{!! $tick('requested') !!}</span><span>Requested</span></div>

            <div class="sig" style="margin-top:6mm">
                <div class="name">{{ $applicant ?? '' }}</div>
                <div class="role">(Signature of Applicant)</div>
            </div>
        </div>
    </div>

    <div class="row bl br bb bt stretch" style="border-top-width:2px">
        <div class="pad col br">
            <div class="sechead">7.A&nbsp;&nbsp;CERTIFICATION OF LEAVE CREDITS</div>
            <div style="margin-top:1.5mm">As of <span class="val">{{ $credits_as_of ?? '' }}</span></div>

            <table class="credits">
                <tr>
                    <th></th>
                    <th>Vacation Leave</th>
                    <th>Sick Leave</th>
                </tr>
                <tr>
                    <td class="lbl">Total Earned</td>
                    <td class="center">{{ $vl_earned ?? '' }}</td>
                    <td class="center">{{ $sl_earned ?? '' }}</td>
                </tr>
                <tr>
                    <td class="lbl">Less this application</td>
                    <td class="center">{{ $vl_less ?? '' }}</td>
                    <td class="center">{{ $sl_less ?? '' }}</td>
                </tr>
                <tr>
                    <td class="lbl">Balance</td>
                    <td class="center">{{ $vl_balance ?? '' }}</td>
                    <td class="center">{{ $sl_balance ?? '' }}</td>
                </tr>
            </table>

            <div class="sig">
                <div class="name">JAN MARI G. CAFE</div>
                <div class="role">CGDH I - CHRMO</div>
            </div>
        </div>

        <div class="pad col">
            <div class="sechead">7.B&nbsp;&nbsp;RECOMMENDATION</div>
            <div class="opt" style="margin-top:1.5mm"><span class="cb">{!! $tick('approval') !!}</span><span>For approval</span></div>
            <div class="opt"><span class="cb">{!! $tick('disapproval') !!}</span><span>For disapproval due to</span></div>
            <div class="fillline"></div>
            <div class="fillline"></div>
            <div class="fillline"></div>

            <div class="sig">
                <div class="name">ENGR. RANDEL B. PANAYANGAN, MMPA</div>
                <div class="role">CGDH-CGSO</div>
            </div>
        </div>
    </div>

    <div class="row bl br bb stretch">
        <div class="pad col br">
            <div class="sechead">7.C&nbsp;&nbsp;APPROVED FOR:</div>
            <div style="margin-top:1.5mm"><span class="val" style="min-width:16mm">{{ $days_with_pay ?? '' }}</span> days with pay</div>
            <div style="margin-top:1.2mm"><span class="val" style="min-width:16mm">{{ $days_without_pay ?? '' }}</span> days without pay</div>
            <div style="margin-top:1.2mm"><span class="val" style="min-width:16mm">{{ $days_others ?? '' }}</span> others (Specify)</div>
        </div>

        <div class="pad col">
            <div class="sechead">7.D&nbsp;&nbsp;DISAPPROVED DUE TO:</div>
            <div class="fillline" style="margin-top:1.5mm"></div>
            <div class="fillline"></div>
            <div class="fillline"></div>
        </div>
    </div>

    <div class="bl br bb pad" style="padding-top:5mm;padding-bottom:2mm">
        <div class="sig" style="width:70mm;margin:0 auto">
            <div class="name">PEDRITO A. MISOLES, MAED</div>
            <div class="role bold">City Administrator</div>
        </div>
    </div>

</div>

<div class="page page2">

    <div class="instr-title">INSTRUCTIONS AND REQUIREMENTS</div>

    <div class="instr-intro">
        Application for any type of leave shall be made on this Form and
        <strong><u>to be accomplished at least in duplicate</u></strong>
        with documentary requirements, as follows:
    </div>

    <div class="instr-cols">

        <div class="item">
            <div class="ihead">1.&nbsp;&nbsp;Vacation leave<sup>*</sup></div>
            <p>It shall be filed five (5) days in advance, whenever possible, of the effective date of such leave. Vacation leave within the Philippines or abroad shall be indicated in the form for purposes of securing travel authority and completing clearance from money and work accountabilities.</p>
        </div>

        <div class="item">
            <div class="ihead">2.&nbsp;&nbsp;Mandatory/Forced leave</div>
            <p>Annual five-day vacation leave shall be forfeited if not taken during the year. In case the scheduled leave has been cancelled in the exigency of the service by the head of agency, it shall no longer be deducted from the accumulated vacation leave. Availment of one (1) day or more Vacation Leave (VL) shall be considered for complying the mandatory/forced leave subject to the conditions under Section 25, Rule XVI of the Omnibus Rules Implementing E.O. No. 292.</p>
        </div>

        <div class="item">
            <div class="ihead">3.&nbsp;&nbsp;Sick leave<sup>*</sup></div>
            <ul>
                <li>It shall be filed immediately upon employee's return from such leave.</li>
                <li>If filed in advance or exceeding five (5) days, application shall be accompanied by a <u>medical certificate</u>. In case medical consultation was not availed of, an <u>affidavit</u> should be executed by an applicant.</li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">4.&nbsp;&nbsp;Maternity leave<sup>*</sup> &ndash; 105 days</div>
            <ul>
                <li>Proof of pregnancy e.g. ultrasound, doctor's certificate on the expected date of delivery</li>
                <li>Accomplished Notice of Allocation of Maternity Leave Credits (CS Form No. 6a), if needed</li>
                <li>Seconded female employees shall enjoy maternity leave with full pay in the recipient agency.</li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">5.&nbsp;&nbsp;Paternity leave &ndash; 7 days</div>
            <p>Proof of child's delivery e.g. birth certificate, medical certificate and marriage contract</p>
        </div>

        <div class="item">
            <div class="ihead">6.&nbsp;&nbsp;Special Privilege leave &ndash; 3 days</div>
            <p>It shall be filed/approved for at least one (1) week prior to availment, except on emergency cases. Special privilege leave within the Philippines or abroad shall be indicated in the form for purposes of securing travel authority and completing clearance from money and work accountabilities.</p>
        </div>

        <div class="item">
            <div class="ihead">7.&nbsp;&nbsp;Solo Parent leave &ndash; 7 days</div>
            <p>It shall be filed in advance or whenever possible five (5) days before going on such leave with updated Solo Parent Identification Card.</p>
        </div>

        <div class="item">
            <div class="ihead">8.&nbsp;&nbsp;Study leave<sup>*</sup> &ndash; up to 6 months</div>
            <ul>
                <li>Shall meet the agency's internal requirements, if any;</li>
                <li>Contract between the agency head or authorized representative and the employee concerned.</li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">9.&nbsp;&nbsp;VAWC leave &ndash; 10 days</div>
            <ul>
                <li>It shall be filed in advance or immediately upon the woman employee's return from such leave.</li>
                <li>It shall be accompanied by any of the following supporting documents:
                    <ol class="alpha">
                        <li>Barangay Protection Order (BPO) obtained from the barangay;</li>
                        <li>Temporary/Permanent Protection Order (TPO/PPO) obtained from the court;</li>
                        <li>If the protection order is not yet issued by the barangay or the court, a certification issued by the Punong Barangay/Kagawad or Prosecutor or the Clerk of Court that the application for the BPO, TPO or PPO has been filed with the said office shall be sufficient to support the application for the ten-day leave; or</li>
                        <li>In the absence of the BPO/TPO/PPO or the certification, a police report specifying the details of the occurrence of violence on the victim and a medical certificate may be considered, at the discretion of the immediate supervisor of the woman employee concerned.</li>
                    </ol>
                </li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">10.&nbsp;&nbsp;Rehabilitation leave<sup>*</sup> &ndash; up to 6 months</div>
            <ul>
                <li>Application shall be made within one (1) week from the time of the accident except when a longer period is warranted.</li>
                <li>Letter request supported by relevant reports such as the police report, if any.</li>
                <li>Medical certificate on the nature of the injuries, the course of treatment involved, and the need to undergo rest, recuperation, and rehabilitation, as the case may be.</li>
                <li>Written concurrence of a government physician should be obtained relative to the recommendation for rehabilitation if the attending physician is a private practitioner, particularly on the duration of the period of rehabilitation.</li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">11.&nbsp;&nbsp;Special leave benefits for women<sup>*</sup> &ndash; up to 2 months</div>
            <ul>
                <li>The application may be filed in advance, that is, at least five (5) days prior to the scheduled date of the gynecological surgery that will be undergone by the employee. In case of emergency, the application for special leave shall be filed immediately upon the employee's return but during confinement the agency shall be notified of said surgery.</li>
                <li>The application shall be accompanied by a medical certificate filled out by the proper medical authorities, e.g. the attending surgeon accompanied by a clinical summary reflecting the gynecological disorder which shall be addressed or was addressed by the said surgery; the histopathological report; the operative technique used in the surgery; the duration of the surgery including the peri-operative period (period of confinement around surgery); as well as the employees estimated period of recuperation for the same.</li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">12.&nbsp;&nbsp;Special Emergency (Calamity) leave &ndash; up to 5 days</div>
            <ul>
                <li>The special emergency leave can be applied for a maximum of five (5) straight working days or staggered basis within thirty (30) days from the actual occurrence of the natural calamity/disaster. Said privilege shall be enjoyed once a year, not in every instance of calamity or disaster.</li>
                <li>The head of office shall take full responsibility for the grant of special emergency leave and verification of the employee's eligibility to be granted thereof. Said verification shall include: validation of place of residence based on latest available records of the affected employee; verification that the place of residence is covered in the declaration of calamity area by the proper government agency; and such other proofs as may be necessary.</li>
            </ul>
        </div>

        <div class="item">
            <div class="ihead">13.&nbsp;&nbsp;Monetization of leave credits</div>
            <p>Application for monetization of fifty percent (50%) or more of the accumulated leave credits shall be accompanied by letter request to the head of the agency stating the valid and justifiable reasons.</p>
        </div>

        <div class="item">
            <div class="ihead">14.&nbsp;&nbsp;Terminal leave<sup>*</sup></div>
            <p>Proof of employee's resignation or retirement or separation from the service.</p>
        </div>

        <div class="item">
            <div class="ihead">15.&nbsp;&nbsp;Adoption Leave</div>
            <ul>
                <li>Application for adoption leave shall be filed with an authenticated copy of the Pre-Adoptive Placement Authority issued by the Department of Social Welfare and Development (DSWD).</li>
            </ul>
        </div>

    </div>

    <div class="footnote">
        <sup>*</sup> For leave of absence for thirty (30) calendar days or more and terminal leave, application shall be accompanied by a <u>clearance from money, property and work-related accountabilities</u> (pursuant to CSC Memorandum Circular No. 2, s. 1985).
    </div>

</div>

<script>
    window.addEventListener('load', function () {
        setTimeout(window.print, 350);
    });
</script>

</body>
</html>
