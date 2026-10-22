<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Personnel Locator Slip &mdash; 6 per A4</title>
    <style>
        @page { size: A4 portrait; margin: 0; }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            background: #9a9a9a;
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* ---------- Sheet: 2 columns x 3 rows ---------- */
        .page {
            width: 210mm;
            height: 297mm;
            margin: 24px auto;
            background: #fff;
            padding: 5mm;                     /* keeps the slips inside the printer's dead zone */
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(3, 1fr);
        }

        .cell { padding: 2mm; }

        .slip {
            width: 100%;
            height: 100%;
            border: 1px solid #000;
            padding: 2.5mm 3.5mm 2mm;
            display: flex;
            flex-direction: column;
        }

        /* ---------- Header ---------- */
        .head { position: relative; text-align: center; }

        .seal {
            position: absolute;
            left: 0;
            top: 0;
            width: 10mm;
            height: 10mm;
            object-fit: contain;
        }

        .republic {
            font-family: "Times New Roman", Times, serif;
            font-style: italic;
            font-size: 6pt;
            line-height: 1.3;
        }

        .office {
            font-size: 8pt;
            font-weight: bold;
            margin: 1.2mm 0 0.6mm;
        }

        .rule-double {
            border-top: 1px solid #000;
            border-bottom: 0.5px solid #000;
            height: 1mm;
            margin-bottom: 1.2mm;
        }

        .doc-title { font-size: 7pt; font-weight: bold; }

        .lead { font-size: 6pt; margin: 2.2mm 0 1.6mm; }

        /* ---------- Fields ---------- */
        .fields {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-evenly;
        }

        .row { display: flex; align-items: flex-end; margin-bottom: 0; }

        .label {
            width: 16mm;
            font-size: 6pt;
            font-weight: bold;
            flex-shrink: 0;
        }

        .colon { width: 2mm; flex-shrink: 0; font-size: 6pt; }

        .line { border-bottom: 0.5px solid #000; height: 3.4mm; }
        .line.full  { flex: 1; }
        .line.short { width: 26mm; flex-shrink: 0; }

        /* ---------- Approved-for block ---------- */
        .split { display: flex; }
        .split-left {
            width: 44mm;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 2.2mm;
        }
        .split-right { padding-left: 3mm; }

        .approved-title { font-size: 6pt; font-weight: bold; margin-bottom: 1.2mm; }

        .check-row { display: flex; align-items: center; margin-bottom: 1.4mm; }

        .box {
            width: 4.5mm;
            height: 3.4mm;
            border: 0.5px solid #000;
            background: #fff;
            margin-right: 1.8mm;
            flex-shrink: 0;
        }

        .check-row span { font-size: 6pt; }

        /* ---------- Signatures ---------- */
        .signatures { display: flex; justify-content: space-between; margin-top: 1mm; }

        .sig { text-align: center; }
        .sig-employee { width: 34mm; }
        .sig-approver { width: 46mm; }

        .sig-name {
            font-size: 6.5pt;
            font-weight: bold;
            border-bottom: 0.5px solid #000;
            padding-bottom: 0.3mm;
            white-space: nowrap;
        }

        .sig-blank { border-bottom: 0.5px solid #000; height: 3.6mm; }

        .sig-caption { font-size: 5pt; padding-top: 0.4mm; }

        .guard { width: 34mm; margin: 1.8mm auto 0; text-align: center; }
        .guard .sig-blank { height: 3.2mm; }

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

        @media print {
            body { background: #fff; }
            .page { margin: 0; }
            .toolbar { display: none; }
        }
    </style>
</head>
<body>

<div class="page">
    @for ($i = 0; $i < 6; $i++)
        <div class="cell">
            <div class="slip">

                <div class="head">
                    <img class="seal" src="{{ asset('images/panabo-seal.png') }}" alt=""
                         onerror="this.style.visibility='hidden'">
                    <div class="republic">
                        Republic of the Philippines<br>
                        Province of Davao del Norte<br>
                        Panabo City
                    </div>
                    <div class="office">CITY GENERAL SERVICES OFFICE</div>
                    <div class="rule-double"></div>
                    <div class="doc-title">PERSONNEL LOCATOR SLIP (PLS)</div>
                </div>

                <div class="lead">The undersigned request permission to leave official post to:</div>

                <div class="fields">
                    <div class="row">
                        <div class="label">PURPOSE</div>
                        <div class="colon">:</div>
                        <div class="line full"></div>
                    </div>

                    <div class="row">
                        <div class="label">DESTINATION</div>
                        <div class="colon">:</div>
                        <div class="line full"></div>
                    </div>

                    <div class="split">
                        <div class="split-left">
                            <div class="row">
                                <div class="label">DATE</div>
                                <div class="colon">:</div>
                                <div class="line short"></div>
                            </div>
                            <div class="row">
                                <div class="label">TIME OUT</div>
                                <div class="colon">:</div>
                                <div class="line short"></div>
                            </div>
                            <div class="row">
                                <div class="label">TIME IN</div>
                                <div class="colon">:</div>
                                <div class="line short"></div>
                            </div>
                        </div>

                        <div class="split-right">
                            <div class="approved-title">APPROVED For:</div>
                            <div class="check-row">
                                <div class="box"></div>
                                <span>Official Travel</span>
                            </div>
                            <div class="check-row">
                                <div class="box"></div>
                                <span>Personal</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="signatures">
                    <div class="sig sig-employee">
                        <div class="sig-blank"></div>
                        <div class="sig-caption">REQUESTING EMPLOYEE</div>
                    </div>

                    <div class="sig sig-approver">
                        <div class="sig-name">ENGR. RANDEL B. PANAYANGAN, RME, MPA</div>
                        <div class="sig-caption">CGDH-GSO</div>
                    </div>
                </div>



            </div>
        </div>
    @endfor
</div>


<script>
    window.addEventListener('load', function () {
        setTimeout(window.print, 350);
    });
</script>

</body>
</html>
